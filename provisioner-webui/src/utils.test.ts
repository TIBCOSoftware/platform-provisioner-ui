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
import axios from "axios";
import { formatDataType, resetObjectAndAssign, toHashKey } from "./utils";

vi.mock("axios");
vi.mock("vue3-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("formatDataType", () => {
  it('should convert "true" string to boolean true', () => {
    expect(formatDataType("boolean", "true")).toBe(true);
  });

  it('should convert "false" string to boolean false', () => {
    expect(formatDataType("boolean", "false")).toBe(false);
  });

  it("should leave non-boolean-string value unchanged for boolean type", () => {
    expect(formatDataType("boolean", "maybe")).toBe("maybe");
  });

  it("should convert boolean true to boolean true", () => {
    expect(formatDataType("boolean", true)).toBe(true);
  });

  it("should convert undefined to empty string for string type", () => {
    expect(formatDataType("string", undefined)).toBe("");
  });

  it("should convert number to string for string type", () => {
    expect(formatDataType("string", 42)).toBe("42");
  });

  it("should convert string value to string for string type", () => {
    expect(formatDataType("string", "hello")).toBe("hello");
  });

  it('should convert "42" to number 42 for number type', () => {
    expect(formatDataType("number", "42")).toBe(42);
  });

  it("should convert non-numeric string to 0 for number type", () => {
    expect(formatDataType("number", "abc")).toBe(0);
  });

  it("should return empty array for null/undefined array type", () => {
    expect(formatDataType("array", null)).toEqual([]);
    expect(formatDataType("array", undefined)).toEqual([]);
  });

  it("should preserve existing array for array type", () => {
    const arr = [1, 2, 3];
    expect(formatDataType("array", arr)).toBe(arr);
  });

  it("should not convert for unknown type", () => {
    expect(formatDataType("unknown", "value")).toBe("value");
  });

  it("should be case-insensitive for type name", () => {
    expect(formatDataType("Boolean", "true")).toBe(true);
    expect(formatDataType("STRING", undefined)).toBe("");
    expect(formatDataType("Number", "5")).toBe(5);
  });
});

describe("resetObjectAndAssign", () => {
  it("should clear target and assign new content", () => {
    const target = { a: 1, b: 2 } as any;
    resetObjectAndAssign(target, { c: 3 });
    expect(target).toEqual({ c: 3 });
    expect(target.a).toBeUndefined();
  });

  it("should preserve the same object reference", () => {
    const target = { x: 1 } as any;
    const ref = target;
    resetObjectAndAssign(target, { y: 2 });
    expect(target).toBe(ref);
  });

  it("should deep clone the content", () => {
    const content = { nested: { value: 1 } };
    const target = {} as any;
    resetObjectAndAssign(target, content);
    content.nested.value = 999;
    expect(target.nested.value).toBe(1);
  });
});

describe("toHashKey", () => {
  it("should produce same hash for same input", () => {
    expect(toHashKey("test")).toBe(toHashKey("test"));
  });

  it("should produce different hash for different input", () => {
    expect(toHashKey("hello")).not.toBe(toHashKey("world"));
  });

  it("should default to length 16", () => {
    expect(toHashKey("test").length).toBe(16);
  });

  it("should respect custom length", () => {
    expect(toHashKey("test", 8).length).toBe(8);
  });

  it("should return hex characters only", () => {
    expect(toHashKey("test")).toMatch(/^[a-f0-9]+$/);
  });
});

describe("buildPublicApiUrl", () => {
  // We need to import the default export to test this
  let utils: typeof import("./utils").default;

  beforeEach(async () => {
    // Reset module to get fresh default export
    const mod = await import("./utils");
    utils = mod.default;
    // Mock window.location for getLocationOrigin
    Object.defineProperty(window, "location", {
      value: { protocol: "https:", host: "example.com" },
      writable: true
    });
  });

  it("should build correct URL with all params", () => {
    const url = utils.buildPublicApiUrl({
      account: "acc1",
      region: "us-west-2",
      pipeline: "deploy"
    });
    expect(url).toBe("https://example.com/cic2/public/v1/pipelinerun/acc1/us-west-2?pipeline=deploy");
  });

  it("should return empty string when account is missing", () => {
    expect(utils.buildPublicApiUrl({ account: "", region: "us-west-2", pipeline: "deploy" })).toBe("");
  });

  it("should return empty string when region is missing", () => {
    expect(utils.buildPublicApiUrl({ account: "acc1", region: "", pipeline: "deploy" })).toBe("");
  });

  it("should return empty string when pipeline is missing", () => {
    expect(utils.buildPublicApiUrl({ account: "acc1", region: "us-west-2", pipeline: "" })).toBe("");
  });
});

describe("getPipelineById", () => {
  let utils: typeof import("./utils").default;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("./utils");
    utils = mod.default;
  });

  it("should pass config to httpGet when provided", async () => {
    const controller = new AbortController();
    const mockResponse = { data: { metadata: { name: "run-1" } } };
    vi.mocked(axios.get).mockResolvedValue(mockResponse);

    await utils.getPipelineById("run-1", { signal: controller.signal });
    expect(axios.get).toHaveBeenCalledWith("/cic2-ws/v1/pipelineruns/run-1", { signal: controller.signal });
  });

  it("should call httpGet without config when not provided", async () => {
    const mockResponse = { data: { metadata: { name: "run-1" } } };
    vi.mocked(axios.get).mockResolvedValue(mockResponse);

    await utils.getPipelineById("run-1");
    expect(axios.get).toHaveBeenCalledWith("/cic2-ws/v1/pipelineruns/run-1", undefined);
  });
});

describe("getTaskRunById", () => {
  let utils: typeof import("./utils").default;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("./utils");
    utils = mod.default;
  });

  it("should pass config to httpGet when provided", async () => {
    const controller = new AbortController();
    const mockResponse = { data: { metadata: { name: "task-1" } } };
    vi.mocked(axios.get).mockResolvedValue(mockResponse);

    await utils.getTaskRunById("task-1", { signal: controller.signal });
    expect(axios.get).toHaveBeenCalledWith("/cic2-ws/v1/taskruns/task-1", { signal: controller.signal });
  });

  it("should call httpGet without config when not provided", async () => {
    const mockResponse = { data: { metadata: { name: "task-1" } } };
    vi.mocked(axios.get).mockResolvedValue(mockResponse);

    await utils.getTaskRunById("task-1");
    expect(axios.get).toHaveBeenCalledWith("/cic2-ws/v1/taskruns/task-1", undefined);
  });
});
