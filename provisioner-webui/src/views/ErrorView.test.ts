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

import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import ErrorView from "./ErrorView.vue";

const mockRoute = { query: {} as Record<string, string> };

vi.mock("vue-router", () => ({
  useRoute: vi.fn(() => mockRoute)
}));

vi.mock("../utils", () => ({
  default: {
    httpGet: vi.fn().mockRejectedValue(new Error("not found"))
  }
}));

describe("ErrorView", () => {
  it("should render error heading", () => {
    const wrapper = mount(ErrorView);
    expect(wrapper.find("h1").text()).toBe("Error");
  });

  it("should show default error message when no code", () => {
    const wrapper = mount(ErrorView);
    expect(wrapper.text()).toContain("You do not have permission to access this page");
  });

  it("should not show login button by default", () => {
    const wrapper = mount(ErrorView);
    expect(wrapper.find(".login-btn").exists()).toBe(false);
  });

  it("should show login button for 403 code", async () => {
    mockRoute.query = { code: "403" };

    const wrapper = mount(ErrorView);
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".login-btn").exists()).toBe(true);
    expect(wrapper.find(".login-btn").text()).toContain("Back to Login");

    // Reset
    mockRoute.query = {};
  });
});
