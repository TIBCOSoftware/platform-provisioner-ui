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

import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useMainStore } from "./store";

describe("useMainStore", () => {
  let store: ReturnType<typeof useMainStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    store = useMainStore();
  });

  it("should have correct initial state", () => {
    expect(store.isEditingYaml).toBe(false);
    expect(store.isShowingYamlEditor).toBe(false);
    expect(store.changedPipelineDeployParams).toEqual({ account: "", region: "", pipeline: "" });
    expect(store.accountDescription).toBe("");
  });

  it("setIsEditingYaml should update state", () => {
    store.setIsEditingYaml(true);
    expect(store.isEditingYaml).toBe(true);
    store.setIsEditingYaml(false);
    expect(store.isEditingYaml).toBe(false);
  });

  it("setIsShowingYamlEditor should update state", () => {
    store.setIsShowingYamlEditor(true);
    expect(store.isShowingYamlEditor).toBe(true);
  });

  it("setSelectedAccount should set account and description", () => {
    store.setSelectedAccount("acc1", "My Account");
    expect(store.changedPipelineDeployParams.account).toBe("acc1");
    expect(store.accountDescription).toBe("My Account");
  });

  it("setSelectedRegion should set region without clearing other params", () => {
    store.setSelectedAccount("acc1");
    store.setSelectedRegion("us-west-2");
    expect(store.changedPipelineDeployParams.account).toBe("acc1");
    expect(store.changedPipelineDeployParams.region).toBe("us-west-2");
  });

  it("setSelectedPipelineId should set pipeline", () => {
    store.setSelectedPipelineId("deploy-tp");
    expect(store.changedPipelineDeployParams.pipeline).toBe("deploy-tp");
  });

  it("setPipelineDeployParams should not overwrite with empty string", () => {
    store.setPipelineDeployParams("acc1", "us-west-2", "deploy");
    store.setPipelineDeployParams("", "eu-west-1", "");
    expect(store.changedPipelineDeployParams.account).toBe("acc1");
    expect(store.changedPipelineDeployParams.region).toBe("eu-west-1");
    expect(store.changedPipelineDeployParams.pipeline).toBe("deploy");
  });

  it("setYamlEditorContent should clear old keys and assign new", () => {
    store.setYamlEditorContent({ oldKey: "old" } as any);
    expect(store.yamlEditorContent.oldKey).toBe("old");

    store.setYamlEditorContent({ newKey: "new" } as any);
    expect(store.yamlEditorContent.newKey).toBe("new");
    expect(store.yamlEditorContent.oldKey).toBeUndefined();
  });

  it("setYamlEditorContent should preserve object reference", () => {
    const ref = store.yamlEditorContent;
    store.setYamlEditorContent({ a: 1 } as any);
    expect(store.yamlEditorContent).toBe(ref);
  });

  it("setSelectedPipeline should create a shallow copy", () => {
    const pipeline = { id: "test", name: "Test Pipeline" } as any;
    store.setSelectedPipeline(pipeline);
    expect(store.selectedPipeline).toEqual(pipeline);
    expect(store.selectedPipeline).not.toBe(pipeline);
  });

  it("setOriginalRecipeContent should deep clone content", () => {
    const content = { recipe: { nested: { value: 1 } } };
    store.setOriginalRecipeContent(content as any);
    content.recipe.nested.value = 999;
    expect(store.originalRecipeContent.recipe.nested.value).toBe(1);
  });

  it("should have empty uploadedFileNames initially", () => {
    expect(store.uploadedFileNames).toEqual({});
  });

  it("setUploadedFileName should store filename by reference", () => {
    store.setUploadedFileName("meta.guiEnv.GUI_FILE", "config.zip");
    expect(store.uploadedFileNames["meta.guiEnv.GUI_FILE"]).toBe("config.zip");
  });

  it("setUploadedFileName should allow multiple entries", () => {
    store.setUploadedFileName("meta.guiEnv.GUI_FILE1", "a.zip");
    store.setUploadedFileName("meta.guiEnv.GUI_FILE2", "b.tar");
    expect(store.uploadedFileNames["meta.guiEnv.GUI_FILE1"]).toBe("a.zip");
    expect(store.uploadedFileNames["meta.guiEnv.GUI_FILE2"]).toBe("b.tar");
  });

  it("setUploadedFileName should overwrite existing entry", () => {
    store.setUploadedFileName("meta.guiEnv.GUI_FILE", "old.zip");
    store.setUploadedFileName("meta.guiEnv.GUI_FILE", "new.zip");
    expect(store.uploadedFileNames["meta.guiEnv.GUI_FILE"]).toBe("new.zip");
  });
});
