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

import axios, { type AxiosRequestConfig } from "axios";
import type { RES_USER } from "@/types/response";
import { toast } from "vue3-toastify";
import type { PIPELINE_DEPLOY_PARAMS, PIPELINE_DEPLOY_PARAMS_AWS } from "@/types/pipeline";
import type { YAML_EDITOR_CONTENT } from "@/types/props";
import { cloneDeep } from "lodash";
import SHA256 from "sha256-es";

let user: RES_USER;
export default {
  loggedIn() {
    if (user) {
      return Promise.resolve(user);
    } else {
      return this.httpGet("/cic2-ws/v1/whoami").then((response) => {
        user = response;
        return user;
      });
    }
  },
  getLocationOrigin() {
    // support IE6+, Firefox 2+, Chrome 1+ etc
    return `${window.location.protocol}//${window.location.host}`;
  },
  buildPublicApiUrl(params: PIPELINE_DEPLOY_PARAMS_AWS) {
    // any of the params is empty, return empty string
    if (!(params.account && params.region && params.pipeline)) {
      return "";
    }
    return this.getLocationOrigin() + "/cic2/public/v1" + `/pipelinerun/${params.account}/${params.region}?pipeline=${params.pipeline}`;
  },

  httpGet(url: string, config?: AxiosRequestConfig | undefined, isReturnHeader: boolean = false) {
    return axios.get(url, config).then((response) => (isReturnHeader ? response : response.data));
  },
  httpPost(url: string, data?: any, config?: AxiosRequestConfig | undefined) {
    return axios.post(url, data, config);
  },
  httpDelete(url: string, config?: AxiosRequestConfig | undefined) {
    return axios.delete(url, config);
  },
  callRestApi(url: string, method: string, data: any) {
    return axios.create().request({
      url: url,
      method: method,
      data: data,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache"
        // "Authorization": "Basic " + user.basicAuth
      }
    });
  },
  getPipelineById(pipelineRunId: string, config?: AxiosRequestConfig) {
    return this.httpGet(`/cic2-ws/v1/pipelineruns/${pipelineRunId}`, config);
  },
  deletePipelineRun(pipelineRunIds: string[]) {
    const requests = pipelineRunIds.map((id) => axios.delete(`/cic2-ws/v1/pipelineruns/${id}`));
    return axios.all(requests);
  },
  getUiProperties() {
    return this.httpGet("/cic2-ws/v1/ui-properties");
  },
  getTaskRunById(taskRunId: string, config?: AxiosRequestConfig) {
    return this.httpGet(`/cic2-ws/v1/taskruns/${taskRunId}`, config);
  },
  openNewTab(url: string) {
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },
  deployPipeline(deployParams: PIPELINE_DEPLOY_PARAMS_AWS, content: YAML_EDITOR_CONTENT) {
    const contentYAML = this.prepareContentYAML(cloneDeep(content));
    const deployData = {
      aws: deployParams,
      content: contentYAML
    } as PIPELINE_DEPLOY_PARAMS;
    const restUrl = this.buildPublicApiUrl(deployParams);
    const desc = "deploy pipeline";
    this.callRestApi(restUrl, "post", deployData)
      .then((response) => {
        toast.success("Succeed to " + desc + ". " + (response?.data?.name || ""));
      })
      .catch((error) => {
        const message = error?.response?.data?.message || error?.response?.data || "";
        toast.error("Failed to " + desc + ". " + message);
      });
  },
  prepareContentYAML(contentYAML: YAML_EDITOR_CONTENT) {
    if (Object.keys(contentYAML).length && contentYAML?.meta && user.email) {
      contentYAML.meta.guiEnv = {
        ...contentYAML.meta.guiEnv,
        actorEmail: user.email
      };
    }
    return contentYAML;
  }
};

export function formatDataType(dataType: string, value: any) {
  let newValue = value;
  if (dataType.toLowerCase() === "boolean") {
    const stringValue = String(value).toLowerCase();
    newValue = stringValue === "true" ? true : stringValue === "false" ? false : value;
  } else if (dataType.toLowerCase() === "string") {
    newValue = value === undefined ? "" : value.toString();
  } else if (dataType.toLowerCase() === "number") {
    newValue = isNaN(parseInt(value, 10)) ? 0 : parseInt(value, 10);
  } else if (dataType.toLowerCase() === "array") {
    newValue = newValue || [];
  }
  return newValue;
}

export function resetObjectAndAssign(target: any, content: any) {
  Object.keys(target).forEach((key) => delete target[key]);
  Object.assign(target, cloneDeep(content));
}

export function toHashKey(input: string, length = 16) {
  return SHA256.hash(input).substring(0, length);
}
