/*
 * Copyright © 2025. Cloud Software Group, Inc.
 * This file is subject to the license terms contained
 * in the license file that is distributed with this file.
 */

'use strict';

const Router = require('koa-router');
const configMap = require('../configmap');

const k8s = require('../k8s');
const utils = require('../utils');
const { handelError } = require('../utils');
const isDev = process.env.NODE_ENV === 'development';
const isOnPrem = process.env.ON_PREM_MODE === 'true';

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
  if (isDev || isOnPrem) {
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
    'PIPELINE_TEMPLATE_LABEL_KEY_CREATE_BY', 'PIPELINE_TEMPLATE_LABEL_KEY_NOTE'
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
    ctx.status = 200;
    ctx.body = pageContent || {};
  } else {
    ctx.status = 404;
    ctx.body = "Not found.";
  }
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
    handelError(ctx, e, 'Error getTaskRun');
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
    handelError(ctx, e, 'Error getPipelineRun');
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
    handelError(ctx, e, 'Error stopPipelineRun');
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
    handelError(ctx, e, 'Error deletePipelineRun');
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
    handelError(ctx, e, 'Error getPipelineRuns');
    await next();
  }
});

secureRouter.get('/pod/:pod/:container/log', async (ctx, next) => {
  try {
    const result = await k8s.getContainerLog(ctx.params);
    ctx.status = 200;
    ctx.body = result;
    await next();
  } catch(e) {
    handelError(ctx, e, 'Error getContainerLog');
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
    handelError(ctx, e, `Error callK8sApi: ${api.name}`);
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

module.exports = { public: router, secure: secureRouter };
