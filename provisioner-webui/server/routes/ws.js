/*
 * Copyright © 2025. Cloud Software Group, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const Router = require('koa-router');
const configMap = require('../configmap');

const k8s = require('../k8s');
const utils = require('../utils');
const { handleError } = require('../utils');

const fs = require('fs');
const semver = require("semver");
const crypto = require('crypto');

const isDev = process.env.NODE_ENV === 'development';
const isOnPrem = process.env.ON_PREM_MODE === 'true';
const formAuthEnabled = process.env.FORM_AUTH_ENABLED === 'true';

const router = new Router({
  prefix: '/cic2-ws/v1'
});

const secureRouter = new Router({
  prefix: '/cic2-ws/v1'
});

function getSsoUser(ctx) {
  if (ctx.session && ctx.session.passport && ctx.session.passport.user) {
    return ctx.session.passport.user;
  }
  if ((isDev || isOnPrem) && !formAuthEnabled) {
    const mockUserData = configMap.getMockUser();
    const mockUser = mockUserData["mockUser"];
    ctx.session.passport = {
      user: mockUser
    };
    return ctx.session.passport.user;
  }
  return null;
}

/**
 * Generate ETag for content caching (RFC 7232)
 * Uses MD5 for fast hash generation - security is not required for ETags
 */
function generateEtag(content) {
  return `"${crypto
    .createHash('md5')
    .update(JSON.stringify(content))
    .digest('hex')}"`;
}

/**
 * For reference about how to use utils.authenticateUser
 * @deprecated
 */
router.post('/login', async(ctx, next) => {
  const requestBody = ctx.request.body;
  let tenantId = requestBody.tenantId;
  if(tenantId) {
    tenantId = tenantId.toLowerCase();
  }
  const password = requestBody.password;
  if(tenantId && password) {
    // The authenticateUser function will attempt to retrieve the stored basicAuth value and then
    // use the same salt and sha512 password hash logic to determine if the user is authenticated.
    const authInfo = utils.authenticateUser(tenantId, password);
    if(authInfo) {
      ctx.cookies.set('login', authInfo.basicAuth);
      ctx.redirect('/');
      await next();
    }
  }

  ctx.response.status = 401;
  next();
});

router.post('/logout', async (ctx, next) => {
  // ctx.cookies.set('login', '');
  // ctx.redirect('/login');
  // next();

  ctx.post('/auth/logout');
  next();
});

router.get('/whoami', async (ctx, next) => {
  const user = getSsoUser(ctx);
  if(user) {
    ctx.body = user;
    ctx.status = 200;
  } else {
    ctx.status = 401;
  }
  await next();
});

secureRouter.get('/getAccountBySsoUser', async (ctx, next) => {
  const email = ctx.query.email || "";
  const account = configMap.getAccountBySsoUser(email);
  if (account.length) {
    ctx.body = account;
  } else {
    ctx.status = 403;
  }
  await next();
});

router.get('/menu-content', async (ctx, next) => {
  const menuContent = configMap.getMenuContent();
  if (menuContent) {
    ctx.status = 200;
    ctx.body = menuContent;
  } else {
    ctx.status = 404;
  }
  next();
});

router.get('/ui-properties', async (ctx, next) => {
  const envVariables = [
    'ON_PREM_MODE', 'PIPELINES_CLEAN_UP_ENABLED', 'NODE_ENV',
    'GIT_BRANCH', 'GIT_COMMIT', 'BUILD_TIME', 'DOCKERFILE',
    'PIPELINE_TEMPLATE_LABEL_KEY_ACCOUNT', 'PIPELINE_TEMPLATE_LABEL_KEY_ACTION',
    'PIPELINE_TEMPLATE_LABEL_KEY_CREATE_BY', 'PIPELINE_TEMPLATE_LABEL_KEY_NOTE',
    'ENABLE_UNRELEASED_FEATURE'
  ];
  const envVarsList = {};
  for (let key of envVariables) {
    envVarsList[key] = process.env[key] ? process.env[key] : '';
  }
  ctx.status = 200;
  ctx.body = envVarsList;
  next();
});

router.get('/file-content', async (ctx, next) => {
  const fileName = ctx.query.fileName;

  if (fileName) {
    let pageContent;
    if (fileName.endsWith(".yaml") || fileName.endsWith(".yml")) {
      pageContent = configMap.readYaml(fileName);
    } else {
      pageContent = configMap.getPageContent(fileName);
    }
    const etag = generateEtag(pageContent);
    const ifNoneMatch = ctx.headers['if-none-match'];
    if (ifNoneMatch === etag) {
      ctx.status = 304;
      return;
    }
    ctx.set('ETag', etag);
    ctx.status = 200;
    ctx.body = pageContent || {};
  } else {
    ctx.status = 404;
    ctx.body = "Not found.";
  }
  next();
});
/**
 * Get the available versions for a chart name from the tp-helm-charts index.yaml file.
 *
 * Query Parameters:
 * - chartName: (optional) The chart name to get versions for. If not provided, returns all tenants with their versions.
 * - helmChartUrl: (optional) The Helm chart URL of the index.yaml file to read. If not provided, uses the default file.
 * - generated: (optional) If set, returns only the generated timestamp of the file.
 */
router.get('/helm-chart-version', async (ctx, next) => {
  const chartName = ctx.query.chartName;
  const token = ctx.query.token;
  const helmChartUrl = ctx.query.helmChartUrl;
  if (!helmChartUrl) {
    ctx.status = 400;
    ctx.body = "Missing helm Chart Url, need to config it from home page settings.";
    next();
    return;
  }

  const generated = ctx.query.generated;
  const fileName = utils.simpleHelmChartUrlToFileName(helmChartUrl);
  const filePath = configMap.downloadFolderPath + "/" + fileName;

  let fileResponse;
  if (fs.existsSync(filePath)) {
    fileResponse = configMap.readYaml(filePath, true);
  } else {
    try {
      const response = await utils.fetchHelmChartFile(helmChartUrl, token);
      if (response?.status === 200 && response?.data) {
        utils.saveHelmChartFile(filePath, response.data);
        fileResponse = configMap.loadYamlContent(response.data);
      }
    } catch (err) {
      console.log("axios fetchHelmChartFile error: ", err.response.statusText);
    }
  }
  if (fileResponse) {
    let pageContent = "";
    if (generated) {
      if (fileResponse.generated) {
        pageContent = fileResponse.generated;
      }
    } else {
      const entryObj = {};
      const entries = fileResponse.entries || {};
      for (const key in entries) {
        const versions = [];
        entries[key].forEach((item) => {
          versions.push(item.version);
        })
        // remove duplicate versions and sorting in descending order
        entryObj[key] = Array.from(new Set(versions))
          .filter(v => semver.valid(v))
          .sort(semver.rcompare);
      }
      pageContent = chartName ? entryObj[chartName] : entryObj;
    }
    ctx.status = 200;
    ctx.body = pageContent;
  } else {
    ctx.status = 404;
    ctx.body = `Yaml file cannot be accessed from ${helmChartUrl}, config it from home page settings.`;
  }
  next();
});

/**
 * Fetch helm chart file from GitHub repository and save it locally.
 * It uses ETag to avoid unnecessary downloads.
 * The file is saved in the data folder with a name derived from the GitHub URL.
 *
 * Query Parameters:
 * - helmChartUrl: The URL of the helm chart file in the GitHub repository.
 * - token: (optional) Personal Access Token for GitHub authentication.
 */
router.get('/get-helm-chart-file', async (ctx, next) => {
  const helmChartUrl = ctx.query.helmChartUrl;
  const token = ctx.query.token;
  if (!helmChartUrl) {
    ctx.status = 400;
    ctx.body = "Missing helmChartUrl parameter.";
    next();
    return;
  }

  const fileName = utils.simpleHelmChartUrlToFileName(helmChartUrl);
  const filePath = configMap.downloadFolderPath + "/" + fileName;
  let fileResponse;
  if (fs.existsSync(filePath)) {
    fileResponse = configMap.readYaml(filePath, true);
  }
  let bodyData;
  try {
    const response = await utils.fetchHelmChartFile(helmChartUrl, token, fileResponse?.etag);
    if (response.status === 304) {
      ctx.status = 304;
      return;
    } else if (response.status === 200) {
      if (response.data) {
        bodyData = utils.saveHelmChartFile(filePath, response.data, response.headers["etag"]);
      }
      ctx.status = 200;
    } else {
      ctx.status = response.status;
    }
  } catch (error) {
    ctx.status = error.status;
    bodyData = error.message;
  }
  ctx.body = bodyData;
  next();
});


router.get('/page-content/:content', async (ctx, next) => {
  const contentFile = ctx.params.content;
  const content = configMap.getPageContent(contentFile);
  if (content) {
    ctx.status = 200;
    ctx.body = content;
  } else {
    ctx.status = 404;
  }
  next();
});

secureRouter.get('/accounts', async (ctx, next) => {
  const user = getSsoUser(ctx);
  if (user) {
    ctx.body = configMap.getAccountBySsoUser(user.email);
  } else {
    ctx.status = 401;
  }
  await next();
});

secureRouter.get('/taskruns/:taskRunId', async (ctx, next) => {
  try {
    const result = await k8s.getTaskRun(null, ctx.params);
    ctx.status = 200;
    ctx.body = result;
    await next();
  } catch(e) {
    handleError(ctx, e, 'Error getTaskRun');
    await next();
  }
});

secureRouter.get('/pipelines', async (ctx, next) => {
  const user = getSsoUser(ctx);
  const account = configMap.getAccountBySsoUser(user.email);
  // console.log(`[ws.js] The account for ${user.email} is ${JSON.stringify(account)}`);
  ctx.body = await k8s.getPipelineTemplates(account);
  await next();
});

secureRouter.get('/pipelineruns/:pipelineRunId', async (ctx, next) => {
  try {
    const result = await k8s.getPipelineRun(null, ctx.params);
    ctx.status = 200;
    ctx.body = result;
    await next();
  } catch(e) {
    handleError(ctx, e, 'Error getPipelineRun');
    await next();
  }
});

secureRouter.post('/pipelineruns/:pipelineRunId', async (ctx, next) => {
  try {
    const result = await k8s.stopPipelineRun(null, ctx.params);
    ctx.status = 202;
    ctx.body = result;
    await next();
  } catch(e) {
    handleError(ctx, e, 'Error stopPipelineRun');
    await next();
  }
});

secureRouter.delete('/pipelineruns/:pipelineRunId', async (ctx, next) => {
  try {
    const result = await k8s.deletePipelineRun(null, ctx.params);
    ctx.status = 202;
    ctx.body = result;
    await next();
  } catch(e) {
    handleError(ctx, e, 'Error deletePipelineRun');
    await next();
  }
});

secureRouter.get('/pipelineruns', async (ctx, next) => {
  const labelSelector = ctx.query.labelSelector;
  try {
    const result = await k8s.getPipelineRuns(null, { labelSelector });
    ctx.status = 200;
    ctx.body = result;
    await next();
  } catch(e) {
    handleError(ctx, e, 'Error getPipelineRuns');
    await next();
  }
});

secureRouter.get('/pod/:pod/:container/log', async (ctx, next) => {
  try {
    const follow = ctx.query?.follow?.toLowerCase() === 'true';
    const tailLines = ctx.query?.tailLines ? parseInt(ctx.query.tailLines, 10) : undefined;
    const result = await k8s.getContainerLog(ctx.params, follow, tailLines);
    ctx.status = 200;
    ctx.body = result;
    if (follow) {
      ctx.set('Content-Type', 'text/plain');
      ctx.set('Transfer-Encoding', 'chunked');
    } else {
      await next();
    }
  } catch(e) {
    handleError(ctx, e, 'Error getContainerLog');
    await next();
  }
});

async function callK8sApi(ctx, next, api) {
  const body = ctx.request.body;
  try {
    const result = await api(body);
    ctx.status = 200;
    ctx.body = result;
    await next();
  } catch(e) {
    handleError(ctx, e, `Error callK8sApi: ${api.name}`);
    await next();
  }
}
secureRouter.post('/eks/teardown', async (ctx, next) => {
  await callK8sApi(ctx, next, k8s.eksTeardown);
});

secureRouter.post('/eks/create', async (ctx, next) => {
  await callK8sApi(ctx, next, k8s.eksCreate);
});

secureRouter.post('/charts/update', async (ctx, next) => {
  await callK8sApi(ctx, next, k8s.chartsUpdate);
});

secureRouter.post('/charts/delete', async (ctx, next) => {
  await callK8sApi(ctx, next, k8s.chartsDelete);
});

module.exports = { public: router, secure: secureRouter, generateEtag, getSsoUser };
