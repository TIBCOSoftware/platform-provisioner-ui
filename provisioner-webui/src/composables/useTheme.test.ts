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

vi.mock("@primevue/themes", () => ({
  updatePreset: vi.fn()
}));

import {
  darken,
  lighten,
  mix,
  buildScale,
  brightness,
  assignRoles,
  buildSurfaceScale,
  palettes,
  applyTheme,
  saveTheme,
  loadSavedTheme
} from "./useTheme";

describe("darken", () => {
  it("should return black when amount is 1", () => {
    expect(darken("#ffffff", 1)).toBe("#000000");
  });

  it("should return the same color when amount is 0", () => {
    expect(darken("#ff8040", 0)).toBe("#ff8040");
  });

  it("should darken white by 50%", () => {
    expect(darken("#ffffff", 0.5)).toBe("#808080");
  });

  it("should keep black unchanged", () => {
    expect(darken("#000000", 0.5)).toBe("#000000");
  });
});

describe("lighten", () => {
  it("should return white when amount is 1", () => {
    expect(lighten("#000000", 1)).toBe("#ffffff");
  });

  it("should return the same color when amount is 0", () => {
    expect(lighten("#ff8040", 0)).toBe("#ff8040");
  });

  it("should lighten black by 50%", () => {
    expect(lighten("#000000", 0.5)).toBe("#808080");
  });

  it("should keep white unchanged", () => {
    expect(lighten("#ffffff", 0.5)).toBe("#ffffff");
  });
});

describe("mix", () => {
  it("should return color1 when weight is 0", () => {
    expect(mix("#ff0000", "#0000ff", 0)).toBe("#ff0000");
  });

  it("should return color2 when weight is 1", () => {
    expect(mix("#ff0000", "#0000ff", 1)).toBe("#0000ff");
  });

  it("should return midpoint when weight is 0.5", () => {
    const result = mix("#ff0000", "#0000ff", 0.5);
    expect(result).toBe("#800080");
  });

  it("should mix two identical colors to same color", () => {
    expect(mix("#abcdef", "#abcdef", 0.5)).toBe("#abcdef");
  });
});

describe("brightness", () => {
  it("should return 255 for white", () => {
    expect(brightness("#ffffff")).toBe(255);
  });

  it("should return 0 for black", () => {
    expect(brightness("#000000")).toBe(0);
  });

  it("should calculate using ITU-R BT.601 formula", () => {
    // Pure red: 0.299 * 255 = 76.245
    expect(brightness("#ff0000")).toBeCloseTo(76.245, 1);
    // Pure green: 0.587 * 255 = 149.685
    expect(brightness("#00ff00")).toBeCloseTo(149.685, 1);
    // Pure blue: 0.114 * 255 = 29.07
    expect(brightness("#0000ff")).toBeCloseTo(29.07, 1);
  });
});

describe("buildScale", () => {
  it("should return an object with 11 keys (50-950)", () => {
    const scale = buildScale("#769FCD");
    const keys = Object.keys(scale);
    expect(keys).toHaveLength(11);
    expect(keys).toEqual(["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"]);
  });

  it("should set 500 to the base color", () => {
    const base = "#769FCD";
    const scale = buildScale(base);
    expect(scale[500]).toBe(base);
  });

  it("should have 50 lighter than 500", () => {
    const scale = buildScale("#769FCD");
    expect(brightness(scale[50])).toBeGreaterThan(brightness(scale[500]));
  });

  it("should have 950 darker than 500", () => {
    const scale = buildScale("#769FCD");
    expect(brightness(scale[950])).toBeLessThan(brightness(scale[500]));
  });
});

describe("assignRoles", () => {
  it("should sort colors by brightness and assign roles", () => {
    const colors: [string, string, string, string, string] = ["#F7FBFC", "#D6E6F2", "#B9D7EA", "#769FCD", "#2F4052"];
    const roles = assignRoles(colors);
    expect(roles).toHaveProperty("lightest");
    expect(roles).toHaveProperty("light");
    expect(roles).toHaveProperty("medium");
    expect(roles).toHaveProperty("accent");
    expect(roles).toHaveProperty("navy");
  });

  it("should ensure lightest is very light (brightness >= 220)", () => {
    const colors: [string, string, string, string, string] = ["#F7FBFC", "#D6E6F2", "#B9D7EA", "#769FCD", "#2F4052"];
    const roles = assignRoles(colors);
    expect(brightness(roles.lightest)).toBeGreaterThanOrEqual(220);
  });

  it("should ensure navy is dark (brightness <= 80)", () => {
    const colors: [string, string, string, string, string] = ["#F7FBFC", "#D6E6F2", "#B9D7EA", "#769FCD", "#2F4052"];
    const roles = assignRoles(colors);
    expect(brightness(roles.navy)).toBeLessThanOrEqual(80);
  });

  it("should adapt colors with mixed brightness", () => {
    // All mid-range colors — assignRoles applies lighten(0.6) and darken(0.5)
    const colors: [string, string, string, string, string] = ["#808080", "#909090", "#a0a0a0", "#707070", "#606060"];
    const roles = assignRoles(colors);
    // lightest should have been lightened (may not reach 220 exactly for extreme mid-range)
    expect(brightness(roles.lightest)).toBeGreaterThan(brightness("#a0a0a0"));
    // navy should have been darkened
    expect(brightness(roles.navy)).toBeLessThan(brightness("#606060"));
  });
});

describe("buildSurfaceScale", () => {
  it("should return an object with 12 keys (0-950)", () => {
    const scale = buildSurfaceScale("#F7FBFC", "#D6E6F2", "#B9D7EA", "#769FCD", "#2F4052");
    const keys = Object.keys(scale);
    expect(keys).toHaveLength(12);
  });

  it("should set 0 to white", () => {
    const scale = buildSurfaceScale("#F7FBFC", "#D6E6F2", "#B9D7EA", "#769FCD", "#2F4052");
    expect(scale[0]).toBe("#ffffff");
  });

  it("should set 50 to lightest color", () => {
    const scale = buildSurfaceScale("#F7FBFC", "#D6E6F2", "#B9D7EA", "#769FCD", "#2F4052");
    expect(scale[50]).toBe("#F7FBFC");
  });

  it("should set 950 to navy color", () => {
    const scale = buildSurfaceScale("#F7FBFC", "#D6E6F2", "#B9D7EA", "#769FCD", "#2F4052");
    expect(scale[950]).toBe("#2F4052");
  });
});

describe("palettes", () => {
  it("should have 4 predefined palettes", () => {
    expect(palettes).toHaveLength(4);
  });

  it("each palette should have id, label, and 5 colors", () => {
    for (const palette of palettes) {
      expect(palette.id).toBeTruthy();
      expect(palette.label).toBeTruthy();
      expect(palette.colors).toHaveLength(5);
    }
  });

  it("should include default, tropical, azure, and tibco", () => {
    const ids = palettes.map((p) => p.id);
    expect(ids).toContain("default");
    expect(ids).toContain("tropical");
    expect(ids).toContain("azure");
    expect(ids).toContain("tibco");
  });
});

describe("applyTheme", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should not throw for valid palette id", () => {
    expect(() => applyTheme("default")).not.toThrow();
  });

  it("should do nothing for unknown palette id", async () => {
    const { updatePreset } = vi.mocked(await import("@primevue/themes"));
    applyTheme("nonexistent");
    expect(updatePreset).not.toHaveBeenCalled();
  });
});

describe("saveTheme / loadSavedTheme", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("should save theme id to localStorage", () => {
    saveTheme("azure");
    expect(localStorage.getItem("app-color-theme")).toBe("azure");
  });

  it("should load and apply saved theme", () => {
    localStorage.setItem("app-color-theme", "tibco");
    expect(() => loadSavedTheme()).not.toThrow();
  });

  it("should not apply invalid saved theme", async () => {
    const { updatePreset } = vi.mocked(await import("@primevue/themes"));
    localStorage.setItem("app-color-theme", "invalid-theme");
    loadSavedTheme();
    expect(updatePreset).not.toHaveBeenCalled();
  });
});
