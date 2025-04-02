/*
 * Copyright © 2025. Cloud Software Group, Inc.
 * This file is subject to the license terms contained
 * in the license file that is distributed with this file.
 */

import { defineStore } from "pinia";
import type { PIPELINE, PIPELINE_DEPLOY_PARAMS_AWS, PIPELINE_OPTION } from "@/types/pipeline";
import type { YAML_EDITOR_CONTENT } from "@/types/props";

export const useMainStore = defineStore("main", {
  state: () => ({
    isEditingYaml: false,
    isShowingYamlEditor: false,
    changedPipelineOptionField: {} as PIPELINE_OPTION,
    changedPipelineDeployParams: {
      account: "",
      region: "",
      pipeline: ""
    } as PIPELINE_DEPLOY_PARAMS_AWS,
    selectedPipeline: {} as PIPELINE,
    yamlEditorContent: {} as any
  }),
  actions: {
    setIsEditingYaml(isEditing: boolean) {
      this.isEditingYaml = isEditing;
    },
    setIsShowingYamlEditor(isShow: boolean) {
      this.isShowingYamlEditor = isShow;
    },
    setPipelineOptionField(option: PIPELINE_OPTION) {
      this.changedPipelineOptionField = option;
    },
    setSelectedAccount(newValue: string) {
      this.setPipelineDeployParams(newValue, "", "");
    },
    setSelectedRegion(newValue: string) {
      this.setPipelineDeployParams("", newValue, "");
    },
    setSelectedPipelineId(newValue: string) {
      this.setPipelineDeployParams("", "", newValue);
    },
    setPipelineDeployParams(account: string, region: string, pipeline: string) {
      this.changedPipelineDeployParams.account = account || this.changedPipelineDeployParams.account;
      this.changedPipelineDeployParams.region = region || this.changedPipelineDeployParams.region;
      this.changedPipelineDeployParams.pipeline = pipeline || this.changedPipelineDeployParams.pipeline;
    },
    setSelectedPipeline(pipeline: PIPELINE) {
      this.selectedPipeline = { ...pipeline };
    },
    setYamlEditorContent(content: YAML_EDITOR_CONTENT) {
      // delete all keys in yamlEditorContent, then assign new content to it.
      // keep the reference of yamlEditorContent to avoid reactivity issue.
      Object.keys(this.yamlEditorContent).forEach(key => {
        delete this.yamlEditorContent[key];
      });
      Object.assign(this.yamlEditorContent, content);
    }
  }
});
