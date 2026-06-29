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

import { defineStore } from "pinia";
import type { PIPELINE, PIPELINE_DEPLOY_PARAMS_AWS, PIPELINE_OPTION } from "@/types/pipeline";
import type { YAML_EDITOR_CONTENT } from "@/types/props";
import { resetObjectAndAssign } from "@/utils";

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
    accountDescription: "",
    selectedPipeline: {} as PIPELINE,
    originalRecipeContent: {} as any,
    originalOptionsContent: {} as any,
    yamlEditorContent: {} as any,
    uploadedFileNames: {} as Record<string, string>
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
    setSelectedAccount(newValue: string, description = "") {
      this.accountDescription = description;
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
    setOriginalRecipeContent(content: YAML_EDITOR_CONTENT) {
      resetObjectAndAssign(this.originalRecipeContent, content);
    },
    setOriginalOptionsContent(content: YAML_EDITOR_CONTENT) {
      resetObjectAndAssign(this.originalOptionsContent, content);
    },
    setUploadedFileName(reference: string, fileName: string) {
      this.uploadedFileNames[reference] = fileName;
    },
    setYamlEditorContent(content: YAML_EDITOR_CONTENT) {
      // delete all keys in yamlEditorContent, then assign new content to it.
      // keep the reference of yamlEditorContent to avoid reactivity issue.
      Object.keys(this.yamlEditorContent).forEach((key) => {
        delete this.yamlEditorContent[key];
      });
      Object.assign(this.yamlEditorContent, content);
    }
  }
});
