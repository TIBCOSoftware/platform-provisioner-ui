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

import _ from "lodash";
import { dump } from "js-yaml";
import { createPatch } from "diff";
import type { PIPELINE_GROUPS } from "@/types/pipeline";
import type { YAML_EDITOR_CONTENT } from "@/types/props";

export interface GuiEnvChange {
  groupIndex: number | string;
  groupTitle: string;
  optionName: string;
  reference: string;
  guiType: string;
  newValue: any;
}

export interface GroupedGuiEnvChanges {
  groupIndex: number | string;
  groupTitle: string;
  items: GuiEnvChange[];
}

export interface YamlDiffResult {
  guiEnvChanges: GuiEnvChange[];
  otherDiffText: string;
  hasChanges: boolean;
  uploadedFileNames: Record<string, string>;
}

/**
 * Detect if a value is base64-encoded file content (from file upload).
 */
export function isBase64Content(value: any): boolean {
  if (typeof value !== "string" || value.length < 200) return false;
  return /^[A-Za-z0-9+/\n\r]+={0,2}$/.test(value.trim());
}

/**
 * Extract changes within meta.guiEnv using pipeline option metadata for friendly display.
 */
function extractGuiEnvChanges(
  original: YAML_EDITOR_CONTENT,
  current: YAML_EDITOR_CONTENT,
  pipelineGroups: PIPELINE_GROUPS[]
): GuiEnvChange[] {
  const changes: GuiEnvChange[] = [];

  for (const group of pipelineGroups) {
    for (const option of group.options) {
      if (!option.reference || !option.reference.startsWith("meta.guiEnv")) continue;

      const originalValue = _.get(original, option.reference);
      const currentValue = _.get(current, option.reference);

      if (!_.isEqual(originalValue, currentValue)) {
        changes.push({
          groupIndex: group.index,
          groupTitle: group.title,
          optionName: option.name,
          reference: option.reference,
          guiType: option.guiType,
          newValue: currentValue
        });
      }
    }
  }

  return changes;
}

/**
 * Compute unified diff for non-guiEnv changes.
 */
function computeNonGuiEnvDiff(
  original: YAML_EDITOR_CONTENT,
  current: YAML_EDITOR_CONTENT
): string {
  const originalClone = _.cloneDeep(original);
  const currentClone = _.cloneDeep(current);

  // Remove meta.guiEnv from both so we only diff non-guiEnv parts
  if (originalClone.meta) delete originalClone.meta.guiEnv;
  if (currentClone.meta) delete currentClone.meta.guiEnv;

  if (_.isEqual(originalClone, currentClone)) return "";

  const originalYaml = dump(originalClone, { lineWidth: -1, noRefs: true });
  const currentYaml = dump(currentClone, { lineWidth: -1, noRefs: true });

  const patch = createPatch("yaml", originalYaml, currentYaml, "", "", { context: 3 });

  // Strip the file header lines (first 4 lines) and return only the diff hunks
  const lines = patch.split("\n");
  const hunkStart = lines.findIndex((line) => line.startsWith("@@"));
  if (hunkStart === -1) return "";

  return lines.slice(hunkStart).join("\n").trimEnd();
}

/**
 * Compute all YAML changes between original and current content.
 */
export function computeYamlChanges(
  original: YAML_EDITOR_CONTENT,
  current: YAML_EDITOR_CONTENT,
  pipelineGroups: PIPELINE_GROUPS[],
  uploadedFileNames?: Record<string, string>
): YamlDiffResult {
  const guiEnvChanges = extractGuiEnvChanges(original, current, pipelineGroups);
  const otherDiffText = computeNonGuiEnvDiff(original, current);
  const hasChanges = guiEnvChanges.length > 0 || otherDiffText.length > 0;

  return { guiEnvChanges, otherDiffText, hasChanges, uploadedFileNames: uploadedFileNames || {} };
}

/**
 * Group flat guiEnvChanges by groupIndex for display.
 */
export function groupChanges(changes: GuiEnvChange[]): GroupedGuiEnvChanges[] {
  const grouped = new Map<number | string, GroupedGuiEnvChanges>();

  for (const change of changes) {
    const key = change.groupIndex;
    if (!grouped.has(key)) {
      grouped.set(key, {
        groupIndex: change.groupIndex,
        groupTitle: change.groupTitle,
        items: []
      });
    }
    grouped.get(key)!.items.push(change);
  }

  return Array.from(grouped.values());
}

/**
 * Format a value for display. Handles arrays, objects, primitives, and file uploads.
 */
export function formatChangeValue(value: any, fileName?: string): string {
  if (isBase64Content(value)) {
    return fileName ? `[file: ${fileName}]` : "[file modified]";
  }
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object" && value !== null) return JSON.stringify(value);
  return String(value);
}
