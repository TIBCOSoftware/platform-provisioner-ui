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
import {
  isBase64Content,
  computeYamlChanges,
  groupChanges,
  formatChangeValue,
  type GuiEnvChange
} from "./changeTracker";
import type { PIPELINE_GROUPS } from "@/types/pipeline";

const makePipelineGroups = (options: { reference: string; name: string; guiType?: string }[], index = 1, title = "Step 1"): PIPELINE_GROUPS[] => [
  {
    index,
    title,
    description: "",
    isValid: true,
    options: options.map((opt) => ({
      value: "",
      name: opt.name,
      type: "string",
      guiType: opt.guiType || "input",
      reference: opt.reference
    }))
  }
];

describe("isBase64Content", () => {
  it("returns false for short strings", () => {
    expect(isBase64Content("abc")).toBe(false);
  });

  it("returns false for non-string values", () => {
    expect(isBase64Content(123)).toBe(false);
    expect(isBase64Content(null)).toBe(false);
    expect(isBase64Content(undefined)).toBe(false);
  });

  it("returns true for long base64 strings", () => {
    const base64 = "A".repeat(300) + "==";
    expect(isBase64Content(base64)).toBe(true);
  });

  it("returns false for long strings with non-base64 characters", () => {
    const nonBase64 = "Hello World! ".repeat(50);
    expect(isBase64Content(nonBase64)).toBe(false);
  });
});

describe("computeYamlChanges", () => {
  it("returns no changes when original equals current", () => {
    const yaml = { meta: { guiEnv: { GUI_FIELD: "value" } } };
    const groups = makePipelineGroups([{ reference: "meta.guiEnv.GUI_FIELD", name: "Field" }]);

    const result = computeYamlChanges(yaml, { ...yaml }, groups);
    expect(result.hasChanges).toBe(false);
    expect(result.guiEnvChanges).toHaveLength(0);
    expect(result.otherDiffText).toBe("");
  });

  it("detects guiEnv changes", () => {
    const original = { meta: { guiEnv: { GUI_NAME: "old" } } };
    const current = { meta: { guiEnv: { GUI_NAME: "new" } } };
    const groups = makePipelineGroups([{ reference: "meta.guiEnv.GUI_NAME", name: "Instance Name" }]);

    const result = computeYamlChanges(original, current, groups);
    expect(result.hasChanges).toBe(true);
    expect(result.guiEnvChanges).toHaveLength(1);
    expect(result.guiEnvChanges[0].optionName).toBe("Instance Name");
    expect(result.guiEnvChanges[0].newValue).toBe("new");
    expect(result.guiEnvChanges[0].groupIndex).toBe(1);
    expect(result.guiEnvChanges[0].groupTitle).toBe("Step 1");
    expect(result.otherDiffText).toBe("");
  });

  it("detects non-guiEnv changes as diff text", () => {
    const original = { meta: { guiEnv: { GUI_FIELD: "same" } }, spec: { replicas: 1 } };
    const current = { meta: { guiEnv: { GUI_FIELD: "same" } }, spec: { replicas: 3 } };
    const groups = makePipelineGroups([{ reference: "meta.guiEnv.GUI_FIELD", name: "Field" }]);

    const result = computeYamlChanges(original, current, groups);
    expect(result.hasChanges).toBe(true);
    expect(result.guiEnvChanges).toHaveLength(0);
    expect(result.otherDiffText).toContain("-  replicas: 1");
    expect(result.otherDiffText).toContain("+  replicas: 3");
  });

  it("detects mixed guiEnv and non-guiEnv changes", () => {
    const original = { meta: { guiEnv: { GUI_NAME: "old" } }, spec: { replicas: 1 } };
    const current = { meta: { guiEnv: { GUI_NAME: "new" } }, spec: { replicas: 3 } };
    const groups = makePipelineGroups([{ reference: "meta.guiEnv.GUI_NAME", name: "Name" }]);

    const result = computeYamlChanges(original, current, groups);
    expect(result.hasChanges).toBe(true);
    expect(result.guiEnvChanges).toHaveLength(1);
    expect(result.otherDiffText).toContain("replicas");
  });

  it("ignores options not under meta.guiEnv for friendly format", () => {
    const original = { spec: { replicas: 1 } };
    const current = { spec: { replicas: 3 } };
    const groups = makePipelineGroups([{ reference: "spec.replicas", name: "Replicas" }]);

    const result = computeYamlChanges(original, current, groups);
    expect(result.hasChanges).toBe(true);
    expect(result.guiEnvChanges).toHaveLength(0);
    expect(result.otherDiffText).toContain("replicas");
  });
});

describe("groupChanges", () => {
  it("groups changes by groupIndex", () => {
    const changes: GuiEnvChange[] = [
      { groupIndex: 1, groupTitle: "Step 1", optionName: "A", reference: "a", guiType: "input", newValue: "1" },
      { groupIndex: 2, groupTitle: "Step 2", optionName: "B", reference: "b", guiType: "input", newValue: "2" },
      { groupIndex: 1, groupTitle: "Step 1", optionName: "C", reference: "c", guiType: "input", newValue: "3" }
    ];

    const grouped = groupChanges(changes);
    expect(grouped).toHaveLength(2);
    expect(grouped[0].groupIndex).toBe(1);
    expect(grouped[0].items).toHaveLength(2);
    expect(grouped[1].groupIndex).toBe(2);
    expect(grouped[1].items).toHaveLength(1);
  });

  it("returns empty array for no changes", () => {
    expect(groupChanges([])).toHaveLength(0);
  });
});

describe("formatChangeValue", () => {
  it("formats strings", () => {
    expect(formatChangeValue("hello")).toBe("hello");
  });

  it("formats numbers", () => {
    expect(formatChangeValue(42)).toBe("42");
  });

  it("formats booleans", () => {
    expect(formatChangeValue(true)).toBe("true");
  });

  it("formats arrays as comma-separated", () => {
    expect(formatChangeValue(["a", "b", "c"])).toBe("a, b, c");
  });

  it("formats objects as JSON", () => {
    expect(formatChangeValue({ key: "val" })).toBe('{"key":"val"}');
  });

  it("returns [file modified] for base64 content without filename", () => {
    const base64 = "A".repeat(300) + "==";
    expect(formatChangeValue(base64)).toBe("[file modified]");
  });

  it("returns [file: name] for base64 content with filename", () => {
    const base64 = "A".repeat(300) + "==";
    expect(formatChangeValue(base64, "config.zip")).toBe("[file: config.zip]");
  });
});
