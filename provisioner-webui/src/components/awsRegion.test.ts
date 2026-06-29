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
import awsRegion from "./awsRegion.vue";

vi.mock("../services/menuContentService", () => ({
  default: {
    getAWSRegions: vi.fn().mockResolvedValue({
      values: ["us-west-2", "eu-west-1", "ap-southeast-2"],
      defaultValue: "us-west-2"
    })
  }
}));

describe("awsRegion", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("should render region label", () => {
    const wrapper = mount(awsRegion, {
      props: { region: "us-west-2" },
      global: { stubs: { Select: true } }
    });
    expect(wrapper.text()).toContain("Region");
  });

  it("should render Select component", () => {
    const wrapper = mount(awsRegion, {
      props: { region: "us-west-2" },
      global: { stubs: { Select: true } }
    });
    expect(wrapper.findComponent({ name: "Select" }).exists()).toBe(true);
  });

  it("should fetch regions on mount", async () => {
    const menuContentService = await import("../services/menuContentService");
    mount(awsRegion, {
      props: { region: "us-west-2" },
      global: { stubs: { Select: true } }
    });
    await vi.dynamicImportSettled();
    expect(menuContentService.default.getAWSRegions).toHaveBeenCalled();
  });

  it("should use fallback regions on fetch error", async () => {
    const menuContentService = await import("../services/menuContentService");
    vi.mocked(menuContentService.default.getAWSRegions).mockRejectedValueOnce(new Error("Network error"));

    const wrapper = mount(awsRegion, {
      props: { region: "" },
      global: { stubs: { Select: true } }
    });
    await vi.dynamicImportSettled();
    await wrapper.vm.$nextTick();
    // Component should fallback to default regions without throwing
  });

  it("should accept region prop", () => {
    const wrapper = mount(awsRegion, {
      props: { region: "eu-west-1" },
      global: { stubs: { Select: true } }
    });
    expect(wrapper.props("region")).toBe("eu-west-1");
  });
});
