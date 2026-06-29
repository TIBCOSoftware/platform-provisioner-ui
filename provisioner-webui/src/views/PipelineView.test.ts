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
import type { PIPELINE_OPTION } from "@/types/pipeline";

/**
 * Replicate the filtering logic from PipelineView.vue for unit testing.
 */
function filterUnreleasedOptions(
  options: PIPELINE_OPTION[],
  enableUnreleasedFeature: boolean
): PIPELINE_OPTION[] {
  return enableUnreleasedFeature
    ? options.filter((opt) => !opt.unreleasedFeature)
    : options;
}

const makeOption = (name: string, unreleasedFeature?: boolean): PIPELINE_OPTION => ({
  value: "",
  name,
  type: "string",
  guiType: "input",
  reference: `meta.guiEnv.${name}`,
  unreleasedFeature
});

describe("filterUnreleasedOptions", () => {
  it("returns all options when flag is off", () => {
    const options = [
      makeOption("Field1"),
      makeOption("Field2", true),
      makeOption("Field3", false)
    ];

    const result = filterUnreleasedOptions(options, false);
    expect(result).toHaveLength(3);
  });

  it("hides options with unreleasedFeature: true when flag is on", () => {
    const options = [
      makeOption("Field1"),
      makeOption("Field2", true),
      makeOption("Field3", false)
    ];

    const result = filterUnreleasedOptions(options, true);
    expect(result).toHaveLength(2);
    expect(result.map((o) => o.name)).toEqual(["Field1", "Field3"]);
  });

  it("returns all options when none have unreleasedFeature", () => {
    const options = [
      makeOption("Field1"),
      makeOption("Field2"),
      makeOption("Field3")
    ];

    const result = filterUnreleasedOptions(options, true);
    expect(result).toHaveLength(3);
  });

  it("returns empty array when all options are unreleased and flag is on", () => {
    const options = [
      makeOption("Field1", true),
      makeOption("Field2", true)
    ];

    const result = filterUnreleasedOptions(options, true);
    expect(result).toHaveLength(0);
  });

  it("handles empty options array", () => {
    expect(filterUnreleasedOptions([], false)).toHaveLength(0);
    expect(filterUnreleasedOptions([], true)).toHaveLength(0);
  });
});
