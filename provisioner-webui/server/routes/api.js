/*
 * Copyright © 2025. Cloud Software Group, Inc.
 * This file is subject to the license terms contained
 * in the license file that is distributed with this file.
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
const { handelError } = require('../utils');

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
    handelError(ctx, e, 'Error creating tekton task');
    await next();
  }
};

/**
 * Save Payload.
 */
router.post('/save/:awsAccount/:awsRegion/:deployType', async (ctx, next) => {
  const deployType = ctx.params.deployType;
  await createTektonTask(ctx, next, k8s.savePayload, 'post', { deployType });
});

/**
 * Prepare Account.
 */
router.post('/prepare/:awsAccount/:awsRegion', async (ctx, next) => {
  await createTektonTask(ctx, next, k8s.prepareAccount, 'post');
});

/**
 * Run Pipeline.
 */
router.post('/pipelinerun/:awsAccount/:awsRegion', async (ctx, next) => {
  await createTektonTask(ctx, next, k8s.runPipeline, 'post');
});

/**
 * Create AWS eks.
 * The 'eks' is the name Amazon Managed Kubernetes Service, so no need to add /aws in a path
 */
router.post('/eks/:awsAccount/:awsRegion/tasks', async (ctx, next) => {
  await createTektonTask(ctx, next, k8s.eksCreate, 'post');
});

/**
 * Teardown AWS eks
 */
router.delete('/eks/:awsAccount/:awsRegion', async (ctx, next) => {
  await createTektonTask(ctx, next, k8s.eksTeardown, 'delete');
});

/**
 * Update charts.
 */
router.post('/eks/:awsAccount/:awsRegion/charts/tasks', async (ctx, next) => {
  await createTektonTask(ctx, next, k8s.chartsUpdate, 'post');
});

/**
 * Delete charts.
 */
router.delete('/eks/:awsAccount/:awsRegion/charts', async (ctx, next) => {
  await createTektonTask(ctx, next, k8s.chartsDelete, 'delete');
});

/**
 * Get tasks status
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
    handelError(ctx, e, 'Error getting tasks status');
    await next();
  }
});

/**
 * Get task status
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
    handelError(ctx, e, 'Error getting task status');
    await next();
  }
});

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
    handelError(ctx, e, 'Error getting taskruns');
    await next();
  }
});

/**
 * Load payload
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
        handelError(ctx, e, 'The payload could not be loaded.');
      }
    } else {
      ctx.status = 404;
      handelError(ctx, null, 'The payload was not found.');
    }
    await next();
  } catch(e) {
    handelError(ctx, e, 'Error loading payload');
    await next();
  }
});

/**
 * Get pod container log
 */
router.get('/eks/:awsAccount/:awsRegion/pod/:pod/:container/log', async (ctx, next) => {
  try {
    await checkAuth(ctx, next);
    const awsAccount = ctx.params.awsAccount;
    const pod = ctx.params.pod;
    const container = ctx.params.container;
    const param = {
      awsAccount,
      pod,
      container
    };
    const result = await k8s.getContainerLog(param);
    ctx.status = 200;
    // for PDP-2079: return log match filterRegex
    // e.g. filterRegex: ^(?!###).$*
    // curl -s --request GET 'https://<host>/cic2/public/v1/eks/910716586980/us-west-2/pod/xxx/step-generic-runner/log?filterRegex=%5E%28%3F%21%23%23%23%29.%2A%24' --header 'Authorization: Basic xxx'
    const filterRegex = ctx.query.filterRegex;
    let regResult = "";
    if (filterRegex) {
      const regContents = result.match(new RegExp(filterRegex, "gm"));
      if (regContents && regContents.length > 0) {
        regResult = regContents.join("\n");
      }
    }
    ctx.body = regResult || result;
    await next();
  } catch(e) {
    handelError(ctx, e, 'Error getting pod container log');
    await next();
  }
});


module.exports = router;
