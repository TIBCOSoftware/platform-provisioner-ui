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
import LoginView from "./LoginView.vue";

const mockPush = vi.fn();

vi.mock("vue-router", () => ({
  useRoute: vi.fn(() => ({ query: {} })),
  useRouter: vi.fn(() => ({ push: mockPush }))
}));

vi.mock("../utils", () => ({
  default: {
    loggedIn: vi.fn().mockRejectedValue(new Error("not logged in")),
    httpGet: vi.fn().mockResolvedValue({ formAuthEnabled: false, samlEnabled: true }),
    httpPost: vi.fn()
  }
}));

describe("LoginView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render the login page", () => {
    const wrapper = mount(LoginView, {
      global: {
        stubs: {
          Button: { template: '<button><slot /></button>', props: ['as', 'href', 'severity', 'size', 'loading', 'type'] },
          InputText: true,
          Password: true
        }
      }
    });
    expect(wrapper.find(".login-page").exists()).toBe(true);
    expect(wrapper.text()).toContain("Platform Provisioner");
  });

  it("should render navbar with logo", () => {
    const wrapper = mount(LoginView, {
      global: {
        stubs: { Button: true, InputText: true, Password: true }
      }
    });
    expect(wrapper.find(".login-navbar").exists()).toBe(true);
    expect(wrapper.find("img").exists()).toBe(true);
  });

  it("should show SSO login by default when SAML is enabled", async () => {
    const wrapper = mount(LoginView, {
      global: {
        stubs: {
          Button: { template: '<button><slot /></button>', props: ['as', 'href', 'severity', 'size', 'loading', 'type'] },
          InputText: true,
          Password: true
        }
      }
    });
    // Wait for onMounted to complete
    await vi.dynamicImportSettled();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("Login with SSO");
  });

  it("should set login URL with callback when query param exists", async () => {
    const { useRoute } = await import("vue-router");
    vi.mocked(useRoute).mockReturnValue({ query: { callbackUrl: "/dashboard" } } as any);

    const wrapper = mount(LoginView, {
      global: {
        stubs: {
          Button: { template: '<a :href="$attrs.href"><slot /></a>', props: ['as', 'severity', 'size', 'loading', 'type'] },
          InputText: true,
          Password: true
        }
      }
    });
    await vi.dynamicImportSettled();
    await wrapper.vm.$nextTick();

    const html = wrapper.html();
    expect(html).toContain("/auth/login?callbackUrl=/dashboard");
  });

  it("should redirect to home if already logged in", async () => {
    const utils = await import("../utils");
    vi.mocked(utils.default.loggedIn).mockResolvedValueOnce(true as any);

    mount(LoginView, {
      global: {
        stubs: { Button: true, InputText: true, Password: true }
      }
    });
    await vi.dynamicImportSettled();

    expect(mockPush).toHaveBeenCalledWith({ path: "/" });
  });
});
