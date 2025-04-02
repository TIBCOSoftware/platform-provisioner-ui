/*
 * Copyright © 2025. Cloud Software Group, Inc.
 * This file is subject to the license terms contained
 * in the license file that is distributed with this file.
 */

import axios from "axios";
import type { RES_USER } from "@/types/response";
import { toast } from "vue3-toastify";
import type { PIPELINE_DEPLOY_PARAMS, PIPELINE_DEPLOY_PARAMS_AWS } from "@/types/pipeline";
import type { YAML_EDITOR_CONTENT } from "@/types/props";

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
    return this.getLocationOrigin() + "/cic2/public/v1" +
      `/pipelinerun/${params.account}/${params.region}?pipeline=${params.pipeline}`;
  },

  httpGet(url: string) {
    return axios.get(url).then((response) => response.data);
  },
  httpPost(url: string, data?: any) {
    return axios.post(url, data);
  },
  httpDelete(url: string) {
    return axios.delete(url);
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
  getPipelineById(pipelineRunId: string) {
    return this.httpGet(`/cic2-ws/v1/pipelineruns/${pipelineRunId}`);
  },
  deletePipelineRun(pipelineRunIds: string[]) {
    const requests = pipelineRunIds.map((id) => axios.delete(`/cic2-ws/v1/pipelineruns/${id}`));
    return axios.all(requests);
  },
  getUiProperties() {
    return this.httpGet("/cic2-ws/v1/ui-properties");
  },
  getTaskRunById(taskRunId: string) {
    return this.httpGet(`/cic2-ws/v1/taskruns/${taskRunId}`);
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
    const deployData = {
      aws: deployParams,
      content
    } as PIPELINE_DEPLOY_PARAMS;
    const restUrl = this.buildPublicApiUrl(deployParams);
    const desc = "deploy pipeline";
    this
      .callRestApi(restUrl, "post", deployData)
      .then((response) => {
        toast.success("Succeed to " + desc + ". " + (response?.data?.name || ""));
      })
      .catch((error) => {
        const message = error?.response?.data?.message || error?.response?.data || "";
        toast.error("Failed to " + desc + ". " + message);
      });
  },
};
