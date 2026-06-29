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
import MarkdownView from "./MarkdownView.vue";

describe("MarkdownView", () => {
  it("should render empty when content is empty string", () => {
    const wrapper = mount(MarkdownView, { props: { content: "" } });
    expect(wrapper.find(".markdown-body").html()).toContain("");
    expect(wrapper.find(".markdown-body").text()).toBe("");
  });

  it("should render markdown as HTML", () => {
    const wrapper = mount(MarkdownView, { props: { content: "**bold text**" } });
    expect(wrapper.find(".markdown-body").html()).toContain("<strong>bold text</strong>");
  });

  it("should render headings", () => {
    const wrapper = mount(MarkdownView, { props: { content: "# Hello World" } });
    expect(wrapper.find("h1").text()).toBe("Hello World");
  });

  it("should render links", () => {
    const wrapper = mount(MarkdownView, { props: { content: "[link](https://example.com)" } });
    const link = wrapper.find("a");
    expect(link.exists()).toBe(true);
    expect(link.attributes("href")).toBe("https://example.com");
  });

  it("should sanitize dangerous HTML (XSS prevention)", () => {
    const wrapper = mount(MarkdownView, {
      props: { content: '<script>alert("xss")</script>' }
    });
    expect(wrapper.find(".markdown-body").html()).not.toContain("<script>");
  });
});
