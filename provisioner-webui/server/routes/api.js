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

/**
 * The APIs provided for tenants.
 * Use basicAuth to authenticate API call.
 */

'use strict';

const Router = require('koa-router');
const configMap = require('../configmap');
const yaml = require('js-yaml');
const _ = require('lodash');

const utils = require('../utils');
const k8s = require('../k8s');
const { handleError } = require('../utils');

const router = new Router({
  prefix: '/cic2/public/v1'
});

// 401 (Unauthorized)
async function return401() {
  throw {
    statusCode: 401,
    message: 'Unauthorized'
  };
}
// 400 (Bad Request)
async function return400() {
  throw {
    statusCode: 400,
    message: 'Bad Request'
  };
}
// 403 (Forbidden)
async function return403() {
  throw {
    statusCode: 403,
    message: 'Forbidden'
  };
}

function getSsoUser(ctx) {
  if (ctx.session && ctx.session.passport && ctx.session.passport.user) {
    return ctx.session.passport.user;
  }
  return null;
}

/**
 * The private method to check the auth of the api call
 * @param {*} ctx
 * @param {*} next
 * @returns A JSON which contains createdByTenant, createdByUser name (only one of them has value)
 */
async function checkAuth(ctx, next) {
  // check auth
  const authorizationHeader = ctx.request.header['authorization'];

  let tenantAccounts = [];
  let createdByTenant, createdByUser;
  if (authorizationHeader) {
    const basicAuth = utils.parseBasicAuthHeader(authorizationHeader);
    if (!basicAuth) {
      console.log('[checkAuth] Authorization header is in wrong format');
      return await return401(ctx, next);
    }

    const authInfo = utils.authenticateUser(basicAuth.name, basicAuth.pass);
    if (!authInfo) {
      // For local development, edit provisioner-webui/server/data/tenantList.yaml
      // update basicAuth value by ./gen-password-hash.sh on-prem <password>
      console.log('[checkAuth] The salted hash value is not right');
      return await return401(ctx, next);
    }

    tenantAccounts = authInfo.accounts;
    createdByTenant = authInfo.username;
  } else {
    // no authorization header, check sso session
    const user = getSsoUser(ctx);
    if (!user) {
      console.log('[checkAuth] No Authorization header and No sso session us');
      return await return401(ctx, next);
    }

    tenantAccounts = configMap.getAccountBySsoUser(user.email);
    createdByUser = user.email;
  }
  if(!tenantAccounts || tenantAccounts.length === 0) {
    console.log('[checkAuth] No accounts configured for the user');
    return await return401(ctx, next);
  }

  // check an account
  const params = ctx.params;
  const awsAccount = params.awsAccount;
  console.log(`[checkAuth] The awsAccount is: ${awsAccount}.`);

  let validRole = false;
  for(let i = 0; i < tenantAccounts.length; i++) {
    let ta = tenantAccounts[i];
    if(ta.roles && ta.roles.length) {
      for(let j = 0; j < ta.roles.length; j++) {
        let role = ta.roles[j];
        if(role.id.toString() === awsAccount.toString()) {
          validRole = true;
          break;
        }
      }
    }
    if(validRole) {
      break;
    }
  }

  if(!validRole) {
    console.log("[checkAuth] The user doesn't have access to the account in payload");
    return await return403(ctx, next);
  }

  return {
    tenantAccounts,
    createdByTenant,
    createdByUser
  };
}

/**
 * Check Basic Auth or SSO session only (no account-level authorization).
 * Used for endpoints that are not account-specific (e.g., recipe lookup).
 */
async function checkBasicAuthOnly(ctx) {
  const authorizationHeader = ctx.request.header['authorization'];
  if (authorizationHeader) {
    const basicAuth = utils.parseBasicAuthHeader(authorizationHeader);
    if (!basicAuth) {
      console.log('[checkBasicAuthOnly] Authorization header is in wrong format');
      return await return401(ctx);
    }
    const authInfo = utils.authenticateUser(basicAuth.name, basicAuth.pass);
    if (!authInfo) {
      console.log('[checkBasicAuthOnly] The salted hash value is not right');
      return await return401(ctx);
    }
  } else {
    const user = getSsoUser(ctx);
    if (!user) {
      console.log('[checkBasicAuthOnly] No Authorization header and No sso session');
      return await return401(ctx);
    }
  }
}

/**
 * Check the auth and valid parameters, call the k8s api to apply the taskrun YAML
 * @param {*} ctx
 * @param {*} next
 * @param {*} k8sApi
 * @param apiParams
 */
async function callK8sApi(ctx, next, k8sApi, apiParams) {
  // check auth
  const createdBy = await checkAuth(ctx, next);
  const tenantAccounts = createdBy.tenantAccounts;

  const params = ctx.params;
  // awsAccount and awsRegion are required
  const awsAccount = params.awsAccount;
  const awsRegion = params.awsRegion;

  const query = ctx.query;
  // below query parameters are optional, they could be null/undefined
  const cic2InstallationName = query.cic2InstallationName;
  const cic2ClusterId = query.cic2ClusterId;
  const managementRoleArn = query.managementRoleArn;

  const body = ctx.request.body;

  if(body) {

    // check aws parameters
    if(body.aws &&
      ((body.aws.account && body.aws.account.toString() !== awsAccount.toString()) ||
        (body.aws.region && body.aws.region.toLowerCase() !== awsRegion.toLowerCase()))) {
      return await return400(next);
    }

    // check k8s parameters
    if(body.k8s &&
      ((body.k8s.cic2InstallationName && cic2InstallationName && body.k8s.cic2InstallationName !== cic2InstallationName) ||
        (body.k8s.cic2ClusterId && cic2ClusterId && body.k8s.cic2ClusterId.toString() !== cic2ClusterId.toString()))) {
      return await return400(next);
    }
  }

  if(!body.version) {
    // nobody, delete method, construct a body
    body.version = "1.0.0";
  }
  // set aws.account and aws.region anyway in case the values are not present in the payload
  if(!body.aws) {
    body.aws = {};
  }
  body.aws.account = awsAccount;
  body.aws.region = awsRegion;
  if(cic2InstallationName || cic2ClusterId) {
    if(!body.k8s) {
      body.k8s  = {};
    }
    if(cic2InstallationName) {
      body.k8s.cic2InstallationName = cic2InstallationName;
    }
    if(cic2ClusterId) {
      body.k8s.cic2ClusterId = cic2ClusterId;
    }
  }
  if(managementRoleArn) {
    if(!body.aws) {
      body.aws = {};
    }
    if(managementRoleArn) {
      body.aws.managementRoleArn = managementRoleArn;
    }
  }

  // append createdBy
  if (createdBy.createdByTenant) {
    body.createdBy = {
      tenant: createdBy.createdByTenant
    };
  } else if (createdBy.createdByUser) {
    body.createdBy = {
      email: createdBy.createdByUser
    };
  }

  console.log(`[api] The method is: ${k8sApi.name}. The payload is: ${JSON.stringify(body)}`);

  return await k8sApi(body, apiParams, tenantAccounts);
}

const cleanTaskCreateResp = function(oriResp) {
  return {
    name: oriResp.metadata.name
  };
};

// todo: createdBy not present in pipeline payload
const createTektonTask = async function(ctx, next, k8sApi, method, apiParams) {
  try {
    const result = await callK8sApi(ctx, next, k8sApi, apiParams);
    if(result && result.metadata) {
      if(method) {
        if(method.toLowerCase() === 'post') {
          // 'created'
          ctx.status = 201;
        } else if(method.toLowerCase() === 'delete') {
          // 'delete'
          ctx.status = 202;
        }
      } else {
        ctx.status = 200;
      }
      ctx.body = cleanTaskCreateResp(result);
    }
    await next();
  } catch(e) {
    handleError(ctx, e, 'Error creating tekton task');
    await next();
  }
};

/**
 * @swagger
 * /cic2/public/v1/save/{awsAccount}/{awsRegion}/{deployType}:
 *   post:
 *     summary: Save deployment payload
 *     tags: [payload]
 *     parameters:
 *       - in: path
 *         name: awsAccount
 *         required: true
 *         schema: { type: string }
 *         description: Account ID (e.g., gcp-98372901679)
 *       - in: path
 *         name: awsRegion
 *         required: true
 *         schema: { type: string }
 *         description: Provisioner cluster region (e.g., us-west-2)
 *       - in: path
 *         name: deployType
 *         required: true
 *         schema: { type: string }
 *         description: Deployment type identifier
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object }
 *     responses:
 *       201: { description: Saved, content: { application/json: { schema: { type: object, properties: { name: { type: string } } } } } }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — no access to account }
 */
router.post('/save/:awsAccount/:awsRegion/:deployType', async (ctx, next) => {
  const deployType = ctx.params.deployType;
  await createTektonTask(ctx, next, k8s.savePayload, 'post', { deployType });
});

/**
 * @swagger
 * /cic2/public/v1/prepare/{awsAccount}/{awsRegion}:
 *   post:
 *     summary: Prepare account for provisioning
 *     tags: [cluster]
 *     parameters:
 *       - in: path
 *         name: awsAccount
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: awsRegion
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object }
 *     responses:
 *       201: { description: Created, content: { application/json: { schema: { type: object, properties: { name: { type: string } } } } } }
 *       401: { description: Unauthorized }
 */
router.post('/prepare/:awsAccount/:awsRegion', async (ctx, next) => {
  await createTektonTask(ctx, next, k8s.prepareAccount, 'post');
});

/**
 * @swagger
 * /cic2/public/v1/pipelinerun/{awsAccount}/{awsRegion}:
 *   post:
 *     summary: Trigger a pipeline run
 *     description: Submit a recipe to start a new pipeline run. The recipe JSON is passed in the request body under the "content" field.
 *     tags: [pipeline]
 *     parameters:
 *       - in: path
 *         name: awsAccount
 *         required: true
 *         schema: { type: string }
 *         description: Account ID (e.g., gcp-98372901679)
 *       - in: path
 *         name: awsRegion
 *         required: true
 *         schema: { type: string }
 *         description: Provisioner cluster region (e.g., us-west-2)
 *       - in: query
 *         name: pipeline
 *         schema: { type: string }
 *         description: Pipeline type (e.g., generic-runner, helm-install)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               aws: { type: object, properties: { account: { type: string }, region: { type: string }, pipeline: { type: string } } }
 *               content: { type: object, description: Full recipe JSON }
 *     responses:
 *       201: { description: Pipeline triggered, content: { application/json: { schema: { type: object, properties: { name: { type: string, description: Pipeline run name for monitoring } } } } } }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
router.post('/pipelinerun/:awsAccount/:awsRegion', async (ctx, next) => {
  await createTektonTask(ctx, next, k8s.runPipeline, 'post');
});

/**
 * @swagger
 * /cic2/public/v1/eks/{awsAccount}/{awsRegion}/tasks:
 *   post:
 *     summary: Create EKS cluster
 *     tags: [cluster]
 *     parameters:
 *       - in: path
 *         name: awsAccount
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: awsRegion
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object }
 *     responses:
 *       201: { description: Created, content: { application/json: { schema: { type: object, properties: { name: { type: string } } } } } }
 *       401: { description: Unauthorized }
 */
router.post('/eks/:awsAccount/:awsRegion/tasks', async (ctx, next) => {
  await createTektonTask(ctx, next, k8s.eksCreate, 'post');
});

/**
 * @swagger
 * /cic2/public/v1/eks/{awsAccount}/{awsRegion}:
 *   delete:
 *     summary: Teardown EKS cluster
 *     tags: [cluster]
 *     parameters:
 *       - in: path
 *         name: awsAccount
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: awsRegion
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       202: { description: Accepted, content: { application/json: { schema: { type: object, properties: { name: { type: string } } } } } }
 *       401: { description: Unauthorized }
 */
router.delete('/eks/:awsAccount/:awsRegion', async (ctx, next) => {
  await createTektonTask(ctx, next, k8s.eksTeardown, 'delete');
});

/**
 * @swagger
 * /cic2/public/v1/eks/{awsAccount}/{awsRegion}/charts/tasks:
 *   post:
 *     summary: Update Helm charts
 *     tags: [chart]
 *     parameters:
 *       - in: path
 *         name: awsAccount
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: awsRegion
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object }
 *     responses:
 *       201: { description: Created, content: { application/json: { schema: { type: object, properties: { name: { type: string } } } } } }
 *       401: { description: Unauthorized }
 */
router.post('/eks/:awsAccount/:awsRegion/charts/tasks', async (ctx, next) => {
  await createTektonTask(ctx, next, k8s.chartsUpdate, 'post');
});

/**
 * @swagger
 * /cic2/public/v1/eks/{awsAccount}/{awsRegion}/charts:
 *   delete:
 *     summary: Delete Helm charts
 *     tags: [chart]
 *     parameters:
 *       - in: path
 *         name: awsAccount
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: awsRegion
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       202: { description: Accepted, content: { application/json: { schema: { type: object, properties: { name: { type: string } } } } } }
 *       401: { description: Unauthorized }
 */
router.delete('/eks/:awsAccount/:awsRegion/charts', async (ctx, next) => {
  await createTektonTask(ctx, next, k8s.chartsDelete, 'delete');
});

/**
 * @swagger
 * /cic2/public/v1/eks/{awsAccount}/{awsRegion}/pipelineruns:
 *   get:
 *     summary: List pipeline run names
 *     description: Returns an array of pipeline run name strings for the given account, sorted by creation time (newest first).
 *     tags: [pipeline]
 *     parameters:
 *       - in: path
 *         name: awsAccount
 *         required: true
 *         schema: { type: string }
 *         description: Account ID (e.g., gcp-98372901679)
 *       - in: path
 *         name: awsRegion
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Array of pipeline run names
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { type: string }
 *               example: ["generic-runner-gcp-98372901679-1778095829634"]
 *       401: { description: Unauthorized }
 */
router.get([
  '/eks/:awsAccount/:awsRegion/tasks',
  '/eks/:awsAccount/:awsRegion/pipelineruns'
], async (ctx, next) => {
  try {
    const awsAccount = ctx.params.awsAccount;
    const result = await callK8sApi(ctx, next, k8s.getPipelineRuns, {
      labelSelector: `${process.env.PIPELINE_TEMPLATE_LABEL_KEY_ACCOUNT}=${awsAccount}`
    });
    ctx.status = 200;
    const names = [];
    if(result && result.items) {
      result.items.forEach(item => {
        names.push(item.metadata.name);
      });
    }
    ctx.body = names;
    await next();
  } catch(e) {
    handleError(ctx, e, 'Error getting tasks status');
    await next();
  }
});

/**
 * @swagger
 * /cic2/public/v1/eks/{awsAccount}/{awsRegion}/pipelineruns/{pipelineRunId}:
 *   get:
 *     summary: Get pipeline run status
 *     description: Returns the Tekton PipelineRun status (conditions, timestamps). Check .conditions for completion status.
 *     tags: [pipeline]
 *     parameters:
 *       - in: path
 *         name: awsAccount
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: awsRegion
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: pipelineRunId
 *         required: true
 *         schema: { type: string }
 *         description: Pipeline run name
 *     responses:
 *       200: { description: Pipeline run status object, content: { application/json: { schema: { type: object } } } }
 *       401: { description: Unauthorized }
 */
router.get([
  '/eks/:awsAccount/:awsRegion/tasks/:pipelineRunId',
  '/eks/:awsAccount/:awsRegion/pipelineruns/:pipelineRunId'
], async (ctx, next) => {
  try {
    const pipelineRunId = ctx.params.pipelineRunId;
    const result = await callK8sApi(ctx, next, k8s.getPipelineRun, { pipelineRunId });
    ctx.status = 200;
    const status = result.status;
    if(status.taskSpec) {
      delete status.taskSpec;
    }
    ctx.body = status;
    await next();
  } catch(e) {
    handleError(ctx, e, 'Error getting task status');
    await next();
  }
});

/**
 * @swagger
 * /cic2/public/v1/eks/{awsAccount}/{awsRegion}/pipelineruns/{pipelineRunId}/cancel:
 *   post:
 *     summary: Cancel a running pipeline
 *     tags: [pipeline]
 *     parameters:
 *       - in: path
 *         name: awsAccount
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: awsRegion
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: pipelineRunId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Cancelled, content: { application/json: { schema: { type: object, properties: { name: { type: string } } } } } }
 *       401: { description: Unauthorized }
 */
router.post('/eks/:awsAccount/:awsRegion/pipelineruns/:pipelineRunId/cancel', async (ctx, next) => {
  ctx.request.body = ctx.request.body || {};
  const pipelineRunId = ctx.params.pipelineRunId;
  await createTektonTask(ctx, next, k8s.stopPipelineRun, null, { pipelineRunId });
});

/**
 * @swagger
 * /cic2/public/v1/eks/{awsAccount}/{awsRegion}/taskruns/{taskRunId}:
 *   get:
 *     summary: Get task run status
 *     tags: [pipeline]
 *     parameters:
 *       - in: path
 *         name: awsAccount
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: awsRegion
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: taskRunId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Task run status, content: { application/json: { schema: { type: object } } } }
 *       401: { description: Unauthorized }
 */
router.get('/eks/:awsAccount/:awsRegion/taskruns/:taskRunId', async (ctx, next) => {
  try {
    const taskRunId = ctx.params.taskRunId;
    const result = await callK8sApi(ctx, next, k8s.getTaskRun, { taskRunId });
    ctx.status = 200;
    const status = result.status;
    if(status.taskSpec) {
      delete status.taskSpec;
    }
    ctx.body = status;
    await next();
  } catch(e) {
    handleError(ctx, e, 'Error getting taskruns');
    await next();
  }
});

/**
 * @swagger
 * /cic2/public/v1/load/{awsAccount}/{awsRegion}/{deployType}:
 *   get:
 *     summary: Load saved deployment payload
 *     description: Reads a previously saved recipe payload from a Kubernetes ConfigMap.
 *     tags: [payload]
 *     parameters:
 *       - in: path
 *         name: awsAccount
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: awsRegion
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: deployType
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Parsed recipe YAML as JSON, content: { application/json: { schema: { type: object } } } }
 *       404: { description: Payload not found }
 *       401: { description: Unauthorized }
 */
router.get('/load/:awsAccount/:awsRegion/:deployType', async (ctx, next) => {
  try {
    const awsAccount = ctx.params.awsAccount;
    const awsRegion = ctx.params.awsRegion;
    const deployType = ctx.params.deployType;
    const result = await callK8sApi(ctx, next, k8s.loadPayload, {
      configMapName: `${awsAccount}-${awsRegion}-deploy-${deployType}`,
    });

    if (_.has(result, ['data', 'recipe.yaml'])) {
      let payload = result['data']['recipe.yaml'];
      try {
        payload = yaml.load(payload);
        ctx.status = 200;
        ctx.body = payload;
      } catch (e) {
        handleError(ctx, e, 'The payload could not be loaded.');
      }
    } else {
      ctx.status = 404;
      handleError(ctx, null, 'The payload was not found.');
    }
    await next();
  } catch(e) {
    handleError(ctx, e, 'Error loading payload');
    await next();
  }
});

/**
 * @swagger
 * /cic2/public/v1/eks/{awsAccount}/{awsRegion}/pod/{pod}/{container}/log:
 *   get:
 *     summary: Get pod container log
 *     description: Returns container log output. Supports tail, follow, and regex filtering.
 *     tags: [log]
 *     parameters:
 *       - in: path
 *         name: awsAccount
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: awsRegion
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: pod
 *         required: true
 *         schema: { type: string }
 *         description: Pod name (e.g., generic-runner-gcp-98372901679-xxx-generic-runner-pod)
 *       - in: path
 *         name: container
 *         required: true
 *         schema: { type: string }
 *         description: Container name (e.g., step-generic-runner)
 *       - in: query
 *         name: follow
 *         schema: { type: boolean }
 *         description: Stream logs in real-time
 *       - in: query
 *         name: tailLines
 *         schema: { type: integer }
 *         description: Return only the last N lines
 *       - in: query
 *         name: filterRegex
 *         schema: { type: string }
 *         description: URL-encoded regex to filter log lines
 *     responses:
 *       200: { description: Log output as plain text, content: { text/plain: { schema: { type: string } } } }
 *       400: { description: Invalid filterRegex }
 *       401: { description: Unauthorized }
 */
router.get('/eks/:awsAccount/:awsRegion/pod/:pod/:container/log', async (ctx, next) => {
  try {
    await checkAuth(ctx, next);
    const awsAccount = ctx.params.awsAccount;
    const pod = ctx.params.pod;
    const container = ctx.params.container;
    const follow = ctx.query?.follow?.toLowerCase() === 'true';
    const tailLines = ctx.query?.tailLines ? parseInt(ctx.query.tailLines, 10) : undefined;
    const param = {
      awsAccount,
      pod,
      container
    };
    const result = await k8s.getContainerLog(param, follow, tailLines);
    ctx.status = 200;
    // for PDP-2079: return log match filterRegex
    // e.g. filterRegex: ^(?!###).$*
    // curl -s --request GET 'https://<host>/cic2/public/v1/eks/910716586980/us-west-2/pod/xxx/step-generic-runner/log?filterRegex=%5E%28%3F%21%23%23%23%29.%2A%24' --header 'Authorization: Basic xxx'
    const filterRegex = ctx.query.filterRegex;
    let regResult = "";
    if (filterRegex) {
      try {
        const re = new RegExp(filterRegex, "gm");
        const regContents = result.match(re);
        if (regContents && regContents.length > 0) {
          regResult = regContents.join("\n");
        }
      } catch (regexErr) {
        ctx.status = 400;
        ctx.body = `Invalid filterRegex: ${regexErr.message}`;
        return await next();
      }
    }
    ctx.body = regResult || result;
    await next();
  } catch(e) {
    handleError(ctx, e, 'Error getting pod container log');
    await next();
  }
});


/**
 * @swagger
 * /cic2/public/v1/recipe:
 *   get:
 *     summary: Get recipe template by title
 *     description: Returns the full recipe configuration (UI form metadata + recipe YAML) for a given recipe title. The "recipe" field contains the complete pipeline recipe as a YAML string.
 *     tags: [recipe]
 *     parameters:
 *       - in: query
 *         name: title
 *         required: true
 *         schema: { type: string }
 *         description: Recipe title from the URL query parameter (e.g., deploy-tp-on-prem-gcp-k3s)
 *       - in: query
 *         name: pipeline
 *         schema: { type: string }
 *         description: Pipeline type to narrow the lookup (e.g., generic-runner)
 *     responses:
 *       200:
 *         description: Recipe configuration with embedded recipe YAML
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 pipelineName: { type: string }
 *                 description: { type: string }
 *                 groups: { type: array, items: { type: object } }
 *                 options: { type: array, items: { type: object } }
 *                 recipe: { type: string, description: Full pipeline recipe as YAML string }
 *       400: { description: Missing title parameter }
 *       404: { description: Recipe not found }
 *       401: { description: Unauthorized }
 */
router.get('/recipe', async (ctx, next) => {
  try {
    await checkBasicAuthOnly(ctx);

    const title = ctx.query.title;
    if (!title) {
      ctx.status = 400;
      ctx.body = { error: 'Missing required query parameter: title' };
      return await next();
    }

    const pipeline = ctx.query.pipeline || null;
    const result = configMap.getRecipeByTitle(title, pipeline);
    if (result.error) {
      ctx.status = result.reason === 'no-menu' ? 500 : 404;
      ctx.body = { error: result.error };
      return await next();
    }

    ctx.status = 200;
    ctx.body = result.recipe;
    await next();
  } catch(e) {
    handleError(ctx, e, 'Error getting recipe');
    await next();
  }
});

module.exports = router;
