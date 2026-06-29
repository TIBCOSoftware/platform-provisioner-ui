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

import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import RunConfirmChanges from "./RunConfirmChanges.vue";
import type { YamlDiffResult } from "@/changeTracker";

const noChanges: YamlDiffResult = {
  guiEnvChanges: [],
  otherDiffText: "",
  hasChanges: false,
  uploadedFileNames: {}
};

const guiEnvOnly: YamlDiffResult = {
  guiEnvChanges: [
    { groupIndex: 1, groupTitle: "Step 1", optionName: "Instance Name", reference: "meta.guiEnv.GUI_NAME", guiType: "input", newValue: "my-instance" },
    { groupIndex: 1, groupTitle: "Step 1", optionName: "Cluster Size", reference: "meta.guiEnv.GUI_SIZE", guiType: "input", newValue: "large" },
    { groupIndex: 2, groupTitle: "Step 2", optionName: "Region", reference: "meta.guiEnv.GUI_REGION", guiType: "dropdown", newValue: "us-west-2" }
  ],
  otherDiffText: "",
  hasChanges: true,
  uploadedFileNames: {}
};

const diffOnly: YamlDiffResult = {
  guiEnvChanges: [],
  otherDiffText: "@@ -1,3 +1,3 @@\n spec:\n-  replicas: 1\n+  replicas: 3",
  hasChanges: true,
  uploadedFileNames: {}
};

const mixedChanges: YamlDiffResult = {
  guiEnvChanges: [
    { groupIndex: 1, groupTitle: "Deploy CP", optionName: "Version", reference: "meta.guiEnv.GUI_VERSION", guiType: "input", newValue: "2.0.0" }
  ],
  otherDiffText: "@@ -5,3 +5,3 @@\n config:\n-  debug: false\n+  debug: true",
  hasChanges: true,
  uploadedFileNames: {}
};

const fileUploadChanges: YamlDiffResult = {
  guiEnvChanges: [
    { groupIndex: 1, groupTitle: "Step 1", optionName: "Config File", reference: "meta.guiEnv.GUI_FILE", guiType: "file", newValue: "A".repeat(300) + "==" }
  ],
  otherDiffText: "",
  hasChanges: true,
  uploadedFileNames: { "meta.guiEnv.GUI_FILE": "config.zip" }
};

describe("RunConfirmChanges", () => {
  const mountComponent = (changes: YamlDiffResult) => {
    return mount(RunConfirmChanges, { props: { changes } });
  };

  it("should not render when there are no changes", () => {
    const wrapper = mountComponent(noChanges);
    expect(wrapper.find(".run-confirm-changes").exists()).toBe(false);
  });

  it("should render when there are changes", () => {
    const wrapper = mountComponent(guiEnvOnly);
    expect(wrapper.find(".run-confirm-changes").exists()).toBe(true);
    expect(wrapper.text()).toContain("Changes");
  });

  it("should display guiEnv changes grouped by step", () => {
    const wrapper = mountComponent(guiEnvOnly);
    const groups = wrapper.findAll(".change-group");
    expect(groups).toHaveLength(2);
    expect(groups[0].text()).toContain("#1 Step 1");
    expect(groups[1].text()).toContain("#2 Step 2");
  });

  it("should display change items with option names and values", () => {
    const wrapper = mountComponent(guiEnvOnly);
    const items = wrapper.findAll(".change-item");
    expect(items).toHaveLength(3);
    expect(items[0].text()).toContain("Instance Name:");
    expect(items[0].text()).toContain("my-instance");
    expect(items[2].text()).toContain("Region:");
    expect(items[2].text()).toContain("us-west-2");
  });

  it("should display unified diff for non-guiEnv changes", () => {
    const wrapper = mountComponent(diffOnly);
    expect(wrapper.find(".other-changes").exists()).toBe(true);
    expect(wrapper.text()).toContain("Other changes:");
    expect(wrapper.find(".other-changes-diff").exists()).toBe(true);
  });

  it("should apply correct CSS classes to diff lines", () => {
    const wrapper = mountComponent(diffOnly);
    const diffLines = wrapper.findAll(".other-changes-diff span");
    const classes = diffLines.map((el) => el.classes());
    expect(classes.some((c) => c.includes("diff-hunk"))).toBe(true);
    expect(classes.some((c) => c.includes("diff-added"))).toBe(true);
    expect(classes.some((c) => c.includes("diff-removed"))).toBe(true);
    expect(classes.some((c) => c.includes("diff-context"))).toBe(true);
  });

  it("should display both guiEnv and diff sections for mixed changes", () => {
    const wrapper = mountComponent(mixedChanges);
    expect(wrapper.find(".gui-env-changes").exists()).toBe(true);
    expect(wrapper.find(".other-changes").exists()).toBe(true);
    expect(wrapper.text()).toContain("Version:");
    expect(wrapper.text()).toContain("2.0.0");
    expect(wrapper.text()).toContain("Other changes:");
  });

  it("should not show other-changes section when otherDiffText is empty", () => {
    const wrapper = mountComponent(guiEnvOnly);
    expect(wrapper.find(".other-changes").exists()).toBe(false);
  });

  it("should not show gui-env-changes section when guiEnvChanges is empty", () => {
    const wrapper = mountComponent(diffOnly);
    expect(wrapper.find(".gui-env-changes").exists()).toBe(false);
  });

  it("should display file upload with friendly filename", () => {
    const wrapper = mountComponent(fileUploadChanges);
    expect(wrapper.text()).toContain("[file: config.zip]");
  });
});
