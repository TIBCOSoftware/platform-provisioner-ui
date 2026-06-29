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
import type { RES_MENU_CONFIG_ITEM } from "@/types/response";

vi.mock("axios");
vi.mock("vue3-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Import after mocks
import menuContentService from "./menuContentService";

describe("findConfigFileFromMenuConfig", () => {
  const menuConfig: RES_MENU_CONFIG_ITEM[] = [
    {
      label: "Pipeline A",
      url: "/pipelines/pipeline-a",
      config: "pp-pipeline-a.yaml"
    },
    {
      label: "Group",
      config: "",
      items: [
        {
          label: "Pipeline B",
          url: "/pipelines/pipeline-b",
          config: "pp-pipeline-b.yaml"
        }
      ]
    }
  ];

  it("should find config for top-level URL", () => {
    const result = menuContentService.findConfigFileFromMenuConfig("/pipelines/pipeline-a", menuConfig);
    expect(result).toBe("pp-pipeline-a.yaml");
  });

  it("should find config for nested child URL", () => {
    const result = menuContentService.findConfigFileFromMenuConfig("/pipelines/pipeline-b", menuConfig);
    expect(result).toBe("pp-pipeline-b.yaml");
  });

  it("should return empty string when URL not found", () => {
    const result = menuContentService.findConfigFileFromMenuConfig("/pipelines/nonexistent", menuConfig);
    expect(result).toBe("");
  });

  it("should be case-insensitive", () => {
    const result = menuContentService.findConfigFileFromMenuConfig("/Pipelines/Pipeline-A", menuConfig);
    expect(result).toBe("pp-pipeline-a.yaml");
  });
});

describe("highLightMenuConfig", () => {
  it("should add active class to matching item", () => {
    const menuConfig: RES_MENU_CONFIG_ITEM[] = [
      { label: "A", url: "/page-a", config: "" },
      { label: "B", url: "/page-b", config: "" }
    ];

    menuContentService.highLightMenuConfig("/page-a", menuConfig);
    expect(menuConfig[0].class).toBe("p-menubar-item-active");
    expect(menuConfig[1].class).toBeUndefined();
  });

  it("should add active class to parent of matching child", () => {
    const menuConfig: RES_MENU_CONFIG_ITEM[] = [
      {
        label: "Parent",
        config: "",
        items: [{ label: "Child", url: "/child-page", config: "" }]
      }
    ];

    menuContentService.highLightMenuConfig("/child-page", menuConfig);
    expect(menuConfig[0].class).toBe("p-menubar-item-active");
    expect(menuConfig[0].items![0].class).toBe("p-menubar-item-active");
  });

  it("should clear active class from non-matching items", () => {
    const menuConfig: RES_MENU_CONFIG_ITEM[] = [
      { label: "A", url: "/page-a", config: "", class: "p-menubar-item-active" },
      { label: "B", url: "/page-b", config: "" }
    ];

    menuContentService.highLightMenuConfig("/page-b", menuConfig);
    expect(menuConfig[0].class).toBeUndefined();
    expect(menuConfig[1].class).toBe("p-menubar-item-active");
  });

  it("should ignore hash fragments in URL", () => {
    const menuConfig: RES_MENU_CONFIG_ITEM[] = [{ label: "A", url: "/page-a", config: "" }];

    menuContentService.highLightMenuConfig("/page-a#section", menuConfig);
    expect(menuConfig[0].class).toBe("p-menubar-item-active");
  });

  it("should handle URL with query string containing +", () => {
    const menuConfig: RES_MENU_CONFIG_ITEM[] = [
      { label: "A", url: "/pipelines/deploy?title=my pipeline", config: "" }
    ];

    menuContentService.highLightMenuConfig("/pipelines/deploy?title=my+pipeline", menuConfig);
    expect(menuConfig[0].class).toBe("p-menubar-item-active");
  });

  it("should handle percent-encoded URLs", () => {
    const menuConfig: RES_MENU_CONFIG_ITEM[] = [
      { label: "A", url: "/pipelines/deploy tp", config: "" }
    ];

    menuContentService.highLightMenuConfig("/pipelines/deploy%20tp", menuConfig);
    expect(menuConfig[0].class).toBe("p-menubar-item-active");
  });

  it("should handle empty items array", () => {
    const menuConfig: RES_MENU_CONFIG_ITEM[] = [];
    menuContentService.highLightMenuConfig("/page", menuConfig);
    expect(menuConfig).toEqual([]);
  });
});

describe("getMenuContent caching", () => {
  beforeEach(async () => {
    // Reset module to clear cache
    vi.resetModules();
  });

  it("should be a function", () => {
    expect(typeof menuContentService.getMenuContent).toBe("function");
  });

  it("should return a promise", async () => {
    const axios = await import("axios");
    vi.mocked(axios.default.get).mockResolvedValueOnce({ data: [] });
    const result = menuContentService.getMenuContent();
    expect(result).toBeInstanceOf(Promise);
  });
});
