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

import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import yamlView from "./yamlView.vue";
import { useMainStore } from "@/stores/store";

vi.mock("../utils", () => ({
  default: {
    buildPublicApiUrl: vi.fn().mockReturnValue("https://example.com/api"),
    getUiProperties: vi.fn().mockResolvedValue({ NODE_ENV: "production" }),
    deployPipeline: vi.fn(),
    openNewTab: vi.fn()
  }
}));

vi.mock("vue3-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn() }
}));

describe("yamlView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  const mountComponent = (props = {}) => {
    return mount(yamlView, {
      props: {
        isInValid: false,
        pipelineGroups: [],
        ...props
      },
      global: {
        stubs: {
          "yaml-editor-container": true,
          "json-editor-vue": true,
          RunConfirmChanges: { template: '<div class="run-confirm-changes-stub" />' },
          Button: { template: '<button :disabled="$attrs.disabled" @click="$emit(\'click\')"><slot /></button>', inheritAttrs: true },
          Dialog: { template: '<div v-if="$attrs.visible" class="dialog"><slot /><slot name="footer" /></div>', inheritAttrs: true },
          InputText: { template: '<input :value="$attrs.modelValue" />', inheritAttrs: true },
          Tabs: { template: '<div><slot /></div>' },
          TabList: { template: '<div><slot /></div>' },
          Tab: { template: '<div><slot /></div>' },
          TabPanels: { template: '<div><slot /></div>' },
          TabPanel: { template: '<div><slot /></div>' }
        }
      }
    });
  };

  it("should render yaml view", () => {
    const wrapper = mountComponent();
    expect(wrapper.find("#yaml-view").exists()).toBe(true);
  });

  it("should render REST API endpoint section", () => {
    const wrapper = mountComponent();
    expect(wrapper.text()).toContain("REST API endpoint URL");
  });

  it("should render Run button", () => {
    const wrapper = mountComponent();
    const buttons = wrapper.findAll("button");
    const runBtn = buttons.find((b) => b.text().includes("Run"));
    expect(runBtn).toBeDefined();
  });

  it("should disable Run button when isInValid is true", () => {
    const wrapper = mountComponent({ isInValid: true });
    const buttons = wrapper.findAll("button");
    const runBtn = buttons.find((b) => b.text().includes("Run"));
    expect(runBtn?.attributes("disabled")).toBeDefined();
  });

  it("should show confirmation dialog when Run is clicked", async () => {
    const wrapper = mountComponent();
    const buttons = wrapper.findAll("button");
    const runBtn = buttons.find((b) => b.text() === "Run");
    await runBtn?.trigger("click");
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".dialog").exists()).toBe(true);
    expect(wrapper.text()).toContain("Are you sure you want to run this pipeline");
  });

  it("should render RunConfirmChanges component inside confirmation dialog", async () => {
    const wrapper = mountComponent();
    const buttons = wrapper.findAll("button");
    const runBtn = buttons.find((b) => b.text() === "Run");
    await runBtn?.trigger("click");
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".run-confirm-changes-stub").exists()).toBe(true);
  });

  it("should close dialog and call deployPipeline when confirm Run is clicked", async () => {
    const wrapper = mountComponent();

    // Open dialog
    const buttons = wrapper.findAll("button");
    const runBtn = buttons.find((b) => b.text() === "Run");
    await runBtn?.trigger("click");
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".dialog").exists()).toBe(true);

    // Click confirm Run in the dialog footer
    const dialogButtons = wrapper.find(".dialog").findAll("button");
    const confirmBtn = dialogButtons.find((b) => b.text().includes("Run"));
    await confirmBtn?.trigger("click");
    await wrapper.vm.$nextTick();

    const utils = (await import("../utils")).default;
    expect(utils.deployPipeline).toHaveBeenCalled();
    expect(wrapper.find(".dialog").exists()).toBe(false);
  });

  it("should close dialog without deploying when Cancel is clicked", async () => {
    const wrapper = mountComponent();

    // Open dialog
    const buttons = wrapper.findAll("button");
    const runBtn = buttons.find((b) => b.text() === "Run");
    await runBtn?.trigger("click");
    await wrapper.vm.$nextTick();

    // Click Cancel
    const dialogButtons = wrapper.find(".dialog").findAll("button");
    const cancelBtn = dialogButtons.find((b) => b.text() === "Cancel");
    await cancelBtn?.trigger("click");
    await wrapper.vm.$nextTick();

    const utils = (await import("../utils")).default;
    expect(utils.deployPipeline).not.toHaveBeenCalled();
    expect(wrapper.find(".dialog").exists()).toBe(false);
  });
});
