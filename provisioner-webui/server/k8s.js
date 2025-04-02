/*
 * Copyright © 2025. Cloud Software Group, Inc.
 * This file is subject to the license terms contained
 * in the license file that is distributed with this file.
 */

const k8s = require('@kubernetes/client-node');
const axios = require('axios');
const nconf = require('nconf');
const _ = require('lodash');
const fs = require('fs');
const yaml = require('js-yaml');
const configMap = require('./configmap');
const https = require("https");

const kc = new k8s.KubeConfig();
const namespace = nconf.get('k8s:namespace') || 'tekton-tasks';
const opts = {};
const TEKTON_API_VERSION = process.env.TEKTON_API_VERSION || 'v1beta1';

const loadK8sOptions = function() {
  let isInit = false;
  const clusterOptions = nconf.get('clusterOptions');
  if(clusterOptions) {
    const caFile = clusterOptions.clusters[0].caFile;
    try {
      const caFileExist = fs.existsSync(caFile);
      if(caFileExist) {
        kc.loadFromOptions(clusterOptions);
        isInit = true;
      }
    } catch(e) {
      console.log("Failed to check caFile. Will load k8s default options", ", error: " + e.message);
    }
  }

  if(!isInit) {
    kc.loadFromDefault();
  }

  // opts will have cert, ca etc. which is necessary to call k8s api
  void kc.applyToFetchOptions(opts);
};

const httpsAgent = function () {
  const agentOptions = {};
  const cluster = kc.getCurrentCluster();
  const user = kc.getCurrentUser();
  if (cluster && cluster.caData) {
    agentOptions.ca = Buffer.from(cluster.caData, 'base64');
  } else if (cluster && cluster.caFile) {
    agentOptions.ca = fs.readFileSync(cluster.caFile);
  }
  if (user && user.certData && user.keyData) {
    agentOptions.cert = Buffer.from(user.certData, 'base64');
    agentOptions.key = Buffer.from(user.keyData, 'base64');
  } else if (user && user.certFile && user.keyFile) {
    agentOptions.cert = fs.readFileSync(user.certFile);
    agentOptions.key = fs.readFileSync(user.keyFile);
  }
  return new https.Agent(agentOptions);
};

const getAxiosResponse = async function(options) {
  try {
    const response = await axios(options);
    return response.data;
  } catch (error) {
    console.error('Error message:', error.message);
    throw error;
  }
};

const get = async function(url) {
  loadK8sOptions();
  const options = _.merge({}, opts, {
    method: 'GET',
    url: `${kc.getCurrentCluster().server}${url}`,
    headers: {
      "Content-Type": 'application/json'
    },
    httpsAgent: httpsAgent(),
    responseType: 'json' // automatically parse string to JSON
  });
  return await getAxiosResponse(options);
};

const post = async function(url, data) {
  loadK8sOptions();
  const options = _.merge({}, opts, {
    method: 'POST',
    url: `${kc.getCurrentCluster().server}${url}`,
    headers: {
      "Content-Type": 'application/json'
    },
    httpsAgent: httpsAgent(),
    responseType: 'json',  // automatically parse string to JSON
    data: data
  });
  console.log('POST a PipelineRun', JSON.stringify(data, null, 2));
  return await getAxiosResponse(options);
};

const patch = async function(url, data) {
  loadK8sOptions();
  const options = _.merge({}, opts, {
    method: 'PATCH',
    url: `${kc.getCurrentCluster().server}${url}`,
    headers: {
      "Content-Type": 'application/merge-patch+json'
    },
    httpsAgent: httpsAgent(),
    responseType: 'json',  // automatically parse string to JSON
    data: data
  });
  console.log('PATCH k8s resource: ' + `${kc.getCurrentCluster().server}${url}, data: `, JSON.stringify(data, null,2));
  return await getAxiosResponse(options);
};

const deleteRequest = async function(url) {
  loadK8sOptions();
  const options = _.merge({}, opts, {
    method: 'DELETE',
    url: `${kc.getCurrentCluster().server}${url}`,
    headers: {
      "Content-Type": 'application/json'
    },
    httpsAgent: httpsAgent(),
    responseType: 'json'
  });
  console.log('DELETE k8s resource: ' + `${kc.getCurrentCluster().server}${url}`);
  return await getAxiosResponse(options);
};

const getPipelineRuns = async function(paramsObj, apiParams) {
  let response;
  if(apiParams && apiParams.labelSelector) {
    response = await get(`/apis/tekton.dev/${TEKTON_API_VERSION}/namespaces/${namespace}/pipelineruns?labelSelector=${apiParams.labelSelector}&limit=500`);
  } else {
    response = await get(`/apis/tekton.dev/${TEKTON_API_VERSION}/namespaces/${namespace}/pipelineruns`);
  }
  cleanItemsScript(response.items);
  return response;
};

const loadPayload = async function(paramsObj, apiParams) {
  return await get(`/api/v1/namespaces/${namespace}/configmaps/${apiParams.configMapName}`);
};

const getTasksConfigmaps = async function(paramsObj, apiParams) {
  let response;
  if(apiParams && apiParams.labelSelector) {
    response = await get(`/api/v1/namespaces/${namespace}/configmaps?labelSelector=${apiParams.labelSelector}&limit=500`);
  } else {
    response = await get(`/api/v1/namespaces/${namespace}/configmaps`);
  }
  return response;
};

const getTaskRun = async function(paramsObj, apiParams) {
  const response = await get(`/apis/tekton.dev/${TEKTON_API_VERSION}/namespaces/${namespace}/taskruns/${apiParams.taskRunId}`);
  cleanItemScript(response);
  return response;
};

const getPipelineRun = async function(paramsObj, apiParams) {
  const response = await get(`/apis/tekton.dev/${TEKTON_API_VERSION}/namespaces/${namespace}/pipelineruns/${apiParams.pipelineRunId}`);
  cleanItemScript(response);
  return response;
};

const stopPipelineRun = async function(paramsObj, apiParams) {
  // The docs https://github.com/tektoncd/pipeline/blob/main/docs/pipelineruns.md#cancelling-a-pipelinerun say that the status
  const cancelled = process.env.PIPELINE_RUN_CANCELLED || 'Cancelled';
  const data = {
    'spec' : {
      'status': cancelled
    }
  };
  return await patch(`/apis/tekton.dev/${TEKTON_API_VERSION}/namespaces/${namespace}/pipelineruns/${apiParams.pipelineRunId}`, data);
};

const deletePipelineRun = async function(paramsObj, apiParams) {
  return await deleteRequest(`/apis/tekton.dev/${TEKTON_API_VERSION}/namespaces/${namespace}/pipelineruns/${apiParams.pipelineRunId}`);
};

const postPipelineRuns = async function(data) {
  // Note: create pipeline API Path is determined by the version of the Pipeline itself
  const apiVersion = data.apiVersion || `tekton.dev/${TEKTON_API_VERSION}`;
  return await post(`/apis/${apiVersion}/namespaces/${namespace}/pipelineruns`, data);
};

const saveConfigMap = async function(data) {
  try {
    await deleteRequest(`/api/v1/namespaces/${namespace}/configmaps/${data.metadata.name}`);
    console.log('ConfigMap is deleted: ' + data.metadata.name);
  } catch (e) {
    console.log('The config map does not exist: ' + data.metadata.name + ", error: " + e.message);
  }
  return await post(`/api/v1/namespaces/${namespace}/configmaps`, data);
};

const getNamespace = async function() {
  return await get(`/api/v1/namespaces/${namespace}`);
};

function cleanItemScript(item) {
  if(item.status && item.status && item.status.taskSpec && item.status.taskSpec.steps) {
    item.status.taskSpec.steps.forEach(step => {
      if(step.script) {
        step.script = '';
      }
    });
  }
}

function cleanItemsScript(items) {
  items.forEach(item => {
    cleanItemScript(item);
  });
}

/**
 * export methods
 */
const createPipelineRuns = async function(data) {
  const result = await getNamespace();
  if(result.status && result.status.phase === 'Active') {
    return await postPipelineRuns(data);
  } else {
    throw new Error('Namespace is not ready');
  }
};

/**
 * Before run the task, change the tekton metadata
 * To fix CPIR-943 add the created-by label for a task
 * @param {*} data
 * @param {*} account
 * @param {*} action
 * @param {*} name
 * @param {*} createdBy
 */
const changeMetadata = function(data, account, action, name, createdBy) {
  // add labels
  data.metadata.labels[`${process.env.PIPELINE_TEMPLATE_LABEL_KEY_ACCOUNT}`] = account;
  data.metadata.labels[`${process.env.PIPELINE_TEMPLATE_LABEL_KEY_ACTION}`] = action;
  // For CPIR-3539: add the note to the taskrun
  // note is from the input yaml: meta.guiEnv.note
  if (data?.spec?.params?.length > 0) {
    data.spec.params.filter(param => param.name === 'input')
      .map(param => {
        const inputYamlJson = JSON.parse(param.value);
        data.metadata.labels[`${process.env.PIPELINE_TEMPLATE_LABEL_KEY_NOTE}`] = inputYamlJson?.meta?.guiEnv?.note || '';
      });
  }
  if (name) {
    data.metadata.labels[`${process.env.PIPELINE_TEMPLATE_LABEL_KEY_NAME}`] = name;
  }
  if (createdBy) {
    let createdByName;
    if (createdBy.tenant) {
      createdByName = createdBy.tenant;
    } else if (createdBy.email) {
      createdByName = createdBy.email;
      // remove @domain.com from email
      const pos = createdByName.indexOf('@');
      if (pos !== -1) {
        createdByName = createdByName.substring(0, pos);
      }
    }

    // https://kubernetes.io/docs/concepts/overview/working-with-objects/labels/
    // sanitize the value
    createdByName = createdByName.replace(/[^a-zA-Z0-9-_.]/g, '-').replace(/^[-_.]+/g, '').replace(/[-_.]+$/g, '');
    if (createdByName.length > 63) {
      createdByName = createdByName.substring(0, 63);
    }
    data.metadata.labels[`${process.env.PIPELINE_TEMPLATE_LABEL_KEY_CREATE_BY}`] = createdByName;
  }

  // change the task name to make it unique
  if (name) {
    data.metadata.name = name;
  } else {
    data.metadata.name = [data.metadata.name, account, new Date().getTime()].join('-');
  }
};

const callTaskRun = async function(body, template, action, paramsArray, nameSuffix) {
  try {
    const data = _.merge({}, template);
    const awsAccount = body.aws.account + "";
    if (paramsArray) {
      paramsArray.push({ name: "awsAccount", value: awsAccount });
      paramsArray.push({ name: "awsRegion", value: body.aws.region });
      data.spec.params = paramsArray;
    }

    if (nameSuffix) {
      const name = awsAccount + '-' + body.aws.region + '-' + nameSuffix;
      changeMetadata(data, awsAccount, action, name, body.createdBy);
      data.data = {
        'recipe.yaml': yaml.dump(body)
      };
    } else {
      changeMetadata(data, awsAccount, action, null, body.createdBy);
    }
    let response;
    if (nameSuffix) {
      response = await saveConfigMap(data);
    } else {
      response = await createPipelineRuns(data);
    }
    cleanItemScript(response);
    return response;
  } catch (e) {
    const error = e.error.message || e.message || "Unknown error";
    console.error("Error calling taskrun: " + action, error);
    throw new Error(error);
  }
};

const callCreateTaskrun = async function(body, templateName, action) {
  let templates = configMap.getTemplates();
  templates = JSON.parse(JSON.stringify(templates).replace(/namespacePlaceholder/g, namespace));
  return await callTaskRun(body, templates[templateName], action, [
    {
      name: "input",
      value: JSON.stringify(body, null, 4)
    }
  ]);
};

const prepareAccount = async function(paramsObj) {
  let templates = configMap.getTemplates();
  templates = JSON.parse(JSON.stringify(templates).replace(/namespacePlaceholder/g, namespace));
  return await callTaskRun(paramsObj, templates['prepare-account'], 'prepare', [
    {
      name: "accountLdap",
      value: paramsObj.aws.ldap
    }
  ]);
};

const savePayload = async function(paramsObj, apiParams) {
  let templates = configMap.getTemplates();
  templates = JSON.parse(JSON.stringify(templates).replace(/namespacePlaceholder/g, namespace));
  return await callTaskRun(paramsObj, templates['save-payload'], 'save', null, 'deploy-' + apiParams.deployType);
};

const runPipeline = async function(paramsObj, apiParams, tenantAccounts) {
  const templates = await getPipelineTemplates(tenantAccounts);
  if (!templates[paramsObj.aws.pipeline]) {
    console.error(`The pipeline template ${paramsObj.aws.pipeline} is not found`);
  }

  try {
    let template = templates[paramsObj.aws.pipeline]['pipelineRun'];
    const content = paramsObj.content;
    if (content && paramsObj.createdBy) {
      content.createdBy = paramsObj.createdBy;
    }
    return await callTaskRun(paramsObj, template, 'pipeline', [
      {
        name: "input",
        value: JSON.stringify(content, null, 4)
      }
    ]);
  } catch (error) {
    throw new Error(error.message);
  }

};

const eksTeardown = async function(paramsObj) {
  return await callCreateTaskrun(paramsObj, 'teardown-eks', 'teardown');
};
const eksCreate = async function(paramsObj) {
  return await callCreateTaskrun(paramsObj, 'create-eks', 'create');
};
const chartsUpdate = async function(paramsObj) {
  return await callCreateTaskrun(paramsObj, 'update-charts', 'update');
};
const chartsDelete = async function(paramsObj) {
  return await callCreateTaskrun(paramsObj, 'delete-charts', 'delete');
};

const getContainerLog = async function(params) {
  const pod = params.pod;
  const container = params.container;
  return await get(`/api/v1/namespaces/${namespace}/pods/${pod}/log?container=${container}`);
};

function isTemplateAccessible(template, account) {
  // console.log(`[k8s.js] The template is ${JSON.stringify(template)}, the account is ${JSON.stringify(account)}`);
  if (!account || account.length === 0) {
    return false;
  }
  const accountGroups = account.map(a => a.id);
  // if the user belongs to an admin group, he can see all the pipeline no matter what
  if (accountGroups.indexOf('admin') !== -1) {
    return true;
  }
  const groupsAnnotation = `${process.env.PIPELINE_TEMPLATE_LABEL_KEY_CONFIG_GROUPS}`;
  if (template.metadata && template.metadata.annotations && template.metadata.annotations[groupsAnnotation]) {
    const strConfigGroups = template.metadata.annotations[groupsAnnotation];
    let configGroups = null;
    try {
      configGroups = JSON.parse(strConfigGroups);
    } catch(e) {
      console.error(`The config-groups ${strConfigGroups} is not a valid json`, ", error: " + e.message);
    }
    if (!configGroups) {
      // if the config-groups are not valid, the pipeline will hide
      return false;
    }
    if (configGroups.all === true) {
      return true;
    }

    if (configGroups.tenants && configGroups.tenants.length > 0) {
      for (let i = 0; i < configGroups.tenants.length; i++) {
        if (accountGroups.indexOf(configGroups.tenants[i]) !== -1) {
          return true;
        }
      }
    }
    // if all is not present or all is false, need to check a tenant group
    return false;
  }
  return true;
}

const getPipelineTemplates = async function(account) {
  const labelKey = process.env.PIPELINE_TEMPLATE_LABEL_KEY_CONFIG;
  const labelValue = process.env.PIPELINE_TEMPLATE_LABEL_VALUE || 'pipeline-gui-config';
  const result = await getTasksConfigmaps(undefined, {
    labelSelector: `${labelKey}=${labelValue}`
  });

  let pipelines = {};
  const nameMap = {};
  if (result && result.items && result.items.length > 0) {
    for (let i = 0; i < result.items.length; i++) {
      const item = result.items[i];
      if (item.data && item.data.config) {
        if (!isTemplateAccessible(item, account)) {
          continue;
        }

        let p = null;
        try {
          p = yaml.load(item.data.config);
        } catch (e) {
          console.log(`The string ${item.data.config} is not a valid yaml`, ", error: " + e.message);
        }
        if (p) {
          const keys = Object.keys(p);
          if (keys.length !== 1) {
            console.warn(`The pipeline config data ${item.data.config} has ${keys.length} keys. Only one key is expected.`);
          }
          keys.forEach(key => {
            if (nameMap[key]) {
              console.warn(`The pipeline config ${key} is already exist`);
            } else {
              nameMap[key] = true;
            }
          });
          pipelines = _.assign(pipelines, p);
        }
      }
    }
  }
  return pipelines;
};

module.exports = {
  savePayload: savePayload,
  loadPayload: loadPayload,
  getTasksConfigmaps: getTasksConfigmaps,
  getPipelineTemplates: getPipelineTemplates,
  getPipelineRuns: getPipelineRuns,
  getPipelineRun: getPipelineRun,
  getTaskRun: getTaskRun,
  stopPipelineRun: stopPipelineRun,
  deletePipelineRun: deletePipelineRun,
  prepareAccount: prepareAccount,
  runPipeline: runPipeline,
  eksTeardown: eksTeardown,
  eksCreate: eksCreate,
  chartsUpdate: chartsUpdate,
  chartsDelete: chartsDelete,
  getContainerLog: getContainerLog
};
