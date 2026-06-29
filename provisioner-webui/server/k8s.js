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

const get = async function(url, responseType = 'json') {
  loadK8sOptions();
  const options = _.merge({}, opts, {
    method: 'GET',
    url: `${kc.getCurrentCluster().server}${url}`,
    headers: {
      "Content-Type": 'application/json'
    },
    httpsAgent: httpsAgent(),
    responseType: responseType // automatically parse string to JSON
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
  let allItems = [];
  let continueToken = '';
  const base = `/apis/tekton.dev/${TEKTON_API_VERSION}/namespaces/${namespace}/pipelineruns`;

  do {
    let url = apiParams?.labelSelector
      ? `${base}?labelSelector=${encodeURIComponent(apiParams.labelSelector)}&limit=500`
      : `${base}?limit=500`;
    if (continueToken) {
      url += `&continue=${encodeURIComponent(continueToken)}`;
    }
    const response = await get(url);
    allItems = allItems.concat(response.items || []);
    continueToken = response.metadata?.continue || '';
  } while (continueToken);

  // Sort by creation time descending so the newest items come first
  allItems.sort((a, b) =>
    new Date(b.metadata.creationTimestamp) - new Date(a.metadata.creationTimestamp)
  );

  allItems.forEach(item => stripPipelineRunFields(item));
  cleanItemsScript(allItems);
  return { items: allItems };
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
  stripPipelineRunFields(response);
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

// Strip large unused fields from PipelineRun responses to reduce payload size.
// Scoped to PipelineRun only — TaskRun and other resources are not affected.
function stripPipelineRunFields(item) {
  delete item.spec;
  if (item.metadata) {
    delete item.metadata.managedFields;
    delete item.metadata.annotations;
  }
  if (item.status) {
    delete item.status.provenance;
    if (item.status.pipelineSpec) {
      [item.status.pipelineSpec.tasks, item.status.pipelineSpec.finally].forEach(list => {
        if (list) {
          list.forEach(task => {
            if (task.params) {
              task.params = task.params.filter(p => p.name !== 'input');
            }
          });
        }
      });
    }
  }
}

function cleanItemScript(item) {
  if(item.status && item.status.taskSpec && item.status.taskSpec.steps) {
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
 * Sanitize an arbitrary string into a valid Kubernetes label value.
 *
 * PCP-19684: a user-supplied `note` was previously written to a label verbatim,
 * so a note containing spaces or other label-invalid characters made the k8s API
 * reject the whole PipelineRun with a 422. This applies the same sanitization the
 * `create-by` label already uses, in one shared place so the two cannot drift.
 *
 * K8s label values must be empty OR be at most 63 characters, contain only
 * alphanumerics, '-', '_' or '.', and begin and end with an alphanumeric:
 * https://kubernetes.io/docs/concepts/overview/working-with-objects/labels/
 *
 * Order matters: truncate before stripping the leading/trailing separators so a
 * cut that lands on a '-'/'_'/'.' cannot leave an invalid trailing character. A
 * falsy input (and an input that sanitizes away to nothing) yields '', which is
 * itself a valid label value.
 *
 * @param {*} value the raw value to sanitize
 * @returns {string} a label-safe value (possibly empty)
 */
const sanitizeLabelValue = function(value) {
  if (!value) {
    return '';
  }
  return String(value)
    .replace(/[^a-zA-Z0-9-_.]/g, '-') // replace invalid chars with '-'
    .substring(0, 63)                 // enforce the 63-char label limit
    .replace(/^[-_.]+/g, '')          // must start with an alphanumeric
    .replace(/[-_.]+$/g, '');         // must end with an alphanumeric
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
        // PCP-19684: sanitize the user-supplied note so a value with spaces or
        // other label-invalid characters can't make the k8s API reject the run.
        data.metadata.labels[`${process.env.PIPELINE_TEMPLATE_LABEL_KEY_NOTE}`] = sanitizeLabelValue(inputYamlJson?.meta?.guiEnv?.note);
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

    // sanitize the value to a valid k8s label (shared with the note label)
    data.metadata.labels[`${process.env.PIPELINE_TEMPLATE_LABEL_KEY_CREATE_BY}`] = sanitizeLabelValue(createdByName);
  }

  // change the task name to make it unique
  if (name) {
    data.metadata.name = name;
  } else {
    data.metadata.name = [data.metadata.name, account, new Date().getTime()].join('-');
  }
};

/**
 * Safely extract a human-readable message from an error thrown anywhere in the
 * taskrun path, without ever throwing while doing so.
 *
 * Errors reaching the taskrun catch blocks come in several shapes:
 *   - axios / k8s API errors: the real reason lives in `e.response.data`, which
 *     for the Kubernetes API is a Status object ({ message, reason, code });
 *     surface that first so the true failure is visible.
 *   - legacy callers that throw `{ error: { message } }`.
 *   - plain `Error` objects (`e.message`).
 *
 * PCP-19676: the previous code read `e.error.message` unguarded, so a plain
 * Error (where `e.error` is undefined) made the extraction itself throw
 * "Cannot read properties of undefined (reading 'message')" — masking the real
 * error and making the failure undebuggable.
 *
 * @param {*} e the caught error (any shape, may be null/undefined)
 * @returns {string} a non-empty error message
 */
const normalizeError = function(e) {
  if (!e) {
    return 'Unknown error';
  }
  const apiBody = e.response && e.response.data;
  if (apiBody) {
    if (typeof apiBody === 'string' && apiBody.trim()) {
      return apiBody;
    }
    if (apiBody.message) {
      return apiBody.message;
    }
    if (apiBody.reason) {
      return apiBody.reason;
    }
    // Last resort: surface the raw API body so a rejection without a top-level
    // message/reason is still visible rather than swallowed. Guard the
    // serialization so a non-serializable body (e.g. circular) can never throw.
    try {
      const serialized = JSON.stringify(apiBody);
      if (serialized && serialized !== '{}') {
        return serialized;
      }
    } catch (_err) {
      // ignore and fall through to the generic message
    }
  }
  return (e.error && e.error.message) || e.message || 'Unknown error';
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
    const error = normalizeError(e);
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
  const pipelineName = paramsObj.aws.pipeline;
  // Fail with a clear, actionable message instead of letting the lookup below
  // throw a cryptic "Cannot read properties of undefined (reading 'pipelineRun')"
  // (PCP-19676 — this masked the true cause when a template was not visible).
  if (!templates[pipelineName] || !templates[pipelineName]['pipelineRun']) {
    throw new Error(`The pipeline template '${pipelineName}' is not found`);
  }

  try {
    let template = templates[pipelineName]['pipelineRun'];
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
    throw new Error(normalizeError(error));
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

const getContainerLog = async function(params, follow, tailLines) {
  const pod = params.pod;
  const container = params.container;
  follow = follow || false;
  const responseType = follow ? 'stream' : 'json';
  let url = `/api/v1/namespaces/${namespace}/pods/${pod}/log?container=${container}&follow=${follow}`;
  if (tailLines) {
    url += `&tailLines=${tailLines}`;
  }
  return await get(url, responseType);
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
  getContainerLog: getContainerLog,
  changeMetadata: changeMetadata,
  isTemplateAccessible: isTemplateAccessible,
  stripPipelineRunFields: stripPipelineRunFields,
  normalizeError: normalizeError
};
