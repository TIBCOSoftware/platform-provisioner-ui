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

import { ref } from "vue";
import { updatePreset } from "@primevue/themes";

const STORAGE_KEY = "app-color-theme";

export interface ThemePalette {
  id: string;
  label: string;
  colors: [string, string, string, string, string]; // 5 palette colors
}

export const palettes: ThemePalette[] = [
  { id: "default", label: "Default", colors: ["#F7FBFC", "#D6E6F2", "#B9D7EA", "#769FCD", "#2F4052"] },
  { id: "tropical", label: "Tropical", colors: ["#264653", "#2A9D8F", "#E9C46A", "#F4A261", "#E76F51"] },
  { id: "azure", label: "Azure", colors: ["#8ECAE6", "#219EBC", "#023047", "#FFB703", "#FB8500"] },
  { id: "tibco", label: "Tibco", colors: ["#EFF5FC", "#D5E4F7", "#95BCEB", "#1369D3", "#092F5F"] }
];

/** Darken a hex color by a fraction (0–1). */
export function darken(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const nr = Math.round(r * (1 - amount));
  const ng = Math.round(g * (1 - amount));
  const nb = Math.round(b * (1 - amount));
  return `#${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`;
}

/** Lighten a hex color by mixing with white. */
export function lighten(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const nr = Math.round(r + (255 - r) * amount);
  const ng = Math.round(g + (255 - g) * amount);
  const nb = Math.round(b + (255 - b) * amount);
  return `#${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`;
}

/** Mix two hex colors by a fraction (0 = color1, 1 = color2). */
export function mix(hex1: string, hex2: string, weight: number): string {
  const r1 = parseInt(hex1.slice(1, 3), 16);
  const g1 = parseInt(hex1.slice(3, 5), 16);
  const b1 = parseInt(hex1.slice(5, 7), 16);
  const r2 = parseInt(hex2.slice(1, 3), 16);
  const g2 = parseInt(hex2.slice(3, 5), 16);
  const b2 = parseInt(hex2.slice(5, 7), 16);
  const r = Math.round(r1 + (r2 - r1) * weight);
  const g = Math.round(g1 + (g2 - g1) * weight);
  const b = Math.round(b1 + (b2 - b1) * weight);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * Build a full color scale (50–950) from a base accent color,
 * used for both the PrimeVue primary token scale and CSS variables.
 */
export function buildScale(base: string): Record<string, string> {
  return {
    50: lighten(base, 0.92),
    100: lighten(base, 0.78),
    200: lighten(base, 0.6),
    300: lighten(base, 0.4),
    400: lighten(base, 0.2),
    500: base,
    600: darken(base, 0.15),
    700: darken(base, 0.3),
    800: darken(base, 0.45),
    900: darken(base, 0.6),
    950: darken(base, 0.75)
  };
}

/** Calculate perceived brightness (0–255). */
export function brightness(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Assign UI roles from 5 palette colors.
 * Sorts by brightness and adapts colors to ensure usability:
 *   lightest → page backgrounds (must be very light)
 *   light    → secondary surfaces, borders
 *   medium   → mid-range elements
 *   accent   → primary buttons, links (needs white text contrast)
 *   navy     → navbar, dark text (must be dark)
 */
export function assignRoles(colors: [string, string, string, string, string]) {
  const sorted = [...colors].sort((a, b) => brightness(b) - brightness(a));

  const lightest = brightness(sorted[0]) >= 220 ? sorted[0] : lighten(sorted[0], 0.6);
  const light = brightness(sorted[1]) >= 180 ? sorted[1] : lighten(sorted[1], 0.4);
  const medium = sorted[2];
  const accent = brightness(sorted[3]) <= 160 ? sorted[3] : darken(sorted[3], 0.35);
  const navy = brightness(sorted[4]) <= 80 ? sorted[4] : darken(sorted[4], 0.5);

  return { lightest, light, medium, accent, navy };
}

/** Build a surface scale from role-assigned colors. */
export function buildSurfaceScale(lightest: string, light: string, medium: string, accent: string, navy: string): Record<string, string> {
  return {
    0: "#ffffff",
    50: lightest,
    100: mix(lightest, light, 0.4),
    200: light,
    300: medium,
    400: mix(medium, accent, 0.5),
    500: mix(accent, navy, 0.2),
    600: mix(accent, navy, 0.4),
    700: mix(accent, navy, 0.55),
    800: mix(accent, navy, 0.7),
    900: mix(accent, navy, 0.85),
    950: navy
  };
}

const activeTheme = ref<string>("default");

/** Set CSS custom properties on :root. */
function setCssVars(lightest: string, light: string, medium: string, accent: string, navy: string): void {
  const navbarBg = darken(accent, 0.25);
  const style = document.documentElement.style;

  // Palette
  style.setProperty("--palette-lightest", lightest);
  style.setProperty("--palette-lighter", mix(lightest, light, 0.5));
  style.setProperty("--palette-light", light);
  style.setProperty("--palette-medium", medium);
  style.setProperty("--palette-blue", accent);
  style.setProperty("--palette-navy", navy);
  style.setProperty("--navbar-bg", navbarBg);

  // Primary
  style.setProperty("--primary-color", accent);
  style.setProperty("--primary-hover", darken(accent, 0.15));
  style.setProperty("--primary-light", lighten(accent, 0.92));
  style.setProperty("--primary-dark", navy);

  // Info matches primary
  style.setProperty("--info-color", accent);
  style.setProperty("--info-hover", darken(accent, 0.15));
  style.setProperty("--info-light", lighten(accent, 0.92));
  style.setProperty("--info-dark", navy);

  // Secondary
  style.setProperty("--secondary-color", mix(medium, accent, 0.5));
  style.setProperty("--secondary-hover", navy);
  style.setProperty("--secondary-light", light);
  style.setProperty("--secondary-dark", navy);

  // Neutrals
  style.setProperty("--bg-primary", "#ffffff");
  style.setProperty("--bg-secondary", lightest);
  style.setProperty("--bg-tertiary", light);
  style.setProperty("--border-color", mix(light, medium, 0.5));
  style.setProperty("--text-primary", navy);
  style.setProperty("--text-secondary", mix(accent, navy, 0.4));
  style.setProperty("--text-muted", mix(medium, accent, 0.5));

  // Code
  style.setProperty("--code-bg-dark", navy);
  style.setProperty("--code-text-light", lightest);

  // Shadows
  const shadowBase = navy
    .replace("#", "")
    .match(/.{2}/g)!
    .map((h) => parseInt(h, 16))
    .join(", ");
  style.setProperty("--shadow-sm", `0 1px 3px rgba(${shadowBase}, 0.06)`);
  style.setProperty("--shadow-md", `0 1px 3px rgba(${shadowBase}, 0.1)`);
  style.setProperty("--shadow-lg", `0 4px 6px rgba(${shadowBase}, 0.1)`);
  style.setProperty("--shadow-hover", `0 1px 3px rgba(${shadowBase}, 0.1)`);
}

/** Apply a theme by palette id. Updates CSS vars and PrimeVue tokens. */
export function applyTheme(id: string): void {
  const palette = palettes.find((p) => p.id === id);
  if (!palette) return;

  activeTheme.value = id;

  // Sort colors by brightness and assign UI roles
  const { lightest, light, medium, accent, navy } = assignRoles(palette.colors);

  // Update CSS custom properties
  setCssVars(lightest, light, medium, accent, navy);

  // Update PrimeVue design tokens
  const primaryScale = buildScale(accent);
  const surfaceScale = buildSurfaceScale(lightest, light, medium, accent, navy);

  updatePreset({
    semantic: {
      primary: primaryScale,
      colorScheme: {
        light: {
          surface: surfaceScale,
          primary: {
            color: "{primary.500}",
            contrastColor: "#ffffff",
            hoverColor: "{primary.600}",
            activeColor: "{primary.700}"
          },
          highlight: {
            background: "{primary.50}",
            focusBackground: "{primary.100}",
            color: "{primary.700}",
            focusColor: "{primary.800}"
          },
          formField: {
            background: "{surface.0}",
            disabledBackground: "{surface.200}",
            filledBackground: "{surface.50}",
            filledFocusBackground: "{surface.50}",
            borderColor: "{surface.300}",
            hoverBorderColor: "{surface.400}",
            focusBorderColor: "{primary.color}",
            invalidBorderColor: "#EF4444",
            color: "{surface.900}",
            disabledColor: "{surface.500}",
            placeholderColor: "{surface.400}",
            floatLabelColor: "{surface.500}",
            floatLabelFocusColor: "{primary.color}",
            floatLabelInvalidColor: "#EF4444",
            iconColor: "{surface.400}",
            shadow: "none"
          },
          text: {
            color: "{surface.900}",
            hoverColor: "{surface.950}",
            mutedColor: "{surface.500}",
            hoverMutedColor: "{surface.600}"
          },
          content: {
            background: "{surface.0}",
            hoverBackground: "{surface.50}",
            borderColor: "{surface.200}",
            color: "{text.color}",
            hoverColor: "{text.hover.color}"
          },
          navigation: {
            item: {
              focusBackground: "{surface.100}",
              activeBackground: "{surface.100}",
              color: "{text.color}",
              focusColor: "{text.hover.color}",
              activeColor: "{text.hover.color}",
              icon: {
                color: "{surface.400}",
                focusColor: "{surface.500}",
                activeColor: "{surface.500}"
              }
            },
            submenuLabel: {
              background: "transparent",
              color: "{text.muted.color}"
            },
            submenuIcon: {
              color: "{surface.400}",
              focusColor: "{surface.500}",
              activeColor: "{surface.500}"
            }
          }
        }
      }
    },
    components: {
      button: {
        colorScheme: {
          light: {
            root: {
              primary: {
                background: "{primary.500}",
                hoverBackground: "{primary.600}",
                activeBackground: "{primary.700}",
                borderColor: "{primary.500}",
                hoverBorderColor: "{primary.600}",
                activeBorderColor: "{primary.700}",
                color: "#ffffff",
                hoverColor: "#ffffff",
                activeColor: "#ffffff",
                focusRing: { color: "{primary.500}", shadow: "none" }
              },
              secondary: {
                background: "{surface.100}",
                hoverBackground: "{surface.200}",
                activeBackground: "{surface.300}",
                borderColor: "{surface.100}",
                hoverBorderColor: "{surface.200}",
                activeBorderColor: "{surface.300}",
                color: "{surface.600}",
                hoverColor: "{surface.700}",
                activeColor: "{surface.800}",
                focusRing: { color: "{surface.600}", shadow: "none" }
              },
              info: {
                background: "{primary.500}",
                hoverBackground: "{primary.600}",
                activeBackground: "{primary.700}",
                borderColor: "{primary.500}",
                hoverBorderColor: "{primary.600}",
                activeBorderColor: "{primary.700}",
                color: "#ffffff",
                hoverColor: "#ffffff",
                activeColor: "#ffffff",
                focusRing: { color: "{primary.500}", shadow: "none" }
              },
              contrast: {
                background: navy,
                hoverBackground: "{primary.800}",
                activeBackground: "{primary.700}",
                borderColor: navy,
                hoverBorderColor: "{primary.800}",
                activeBorderColor: "{primary.700}",
                color: "#ffffff",
                hoverColor: "#ffffff",
                activeColor: "#ffffff",
                focusRing: { color: navy, shadow: "none" }
              }
            }
          }
        }
      },
      datatable: {
        row: {
          hoverBackground: mix(lightest, light, 0.5)
        },
        colorScheme: {
          light: {
            row: {
              stripedBackground: lightest
            }
          }
        }
      },
      tag: {
        colorScheme: {
          light: {
            primary: { background: "{primary.500}", color: "#ffffff" },
            info: { background: "{primary.500}", color: "#ffffff" },
            secondary: { background: "{surface.200}", color: "{surface.700}" },
            contrast: { background: navy, color: "#ffffff" }
          }
        }
      }
    }
  });
}

/** Save theme id to localStorage. */
export function saveTheme(id: string): void {
  localStorage.setItem(STORAGE_KEY, id);
}

/** Load and apply the saved theme from localStorage (if any). */
export function loadSavedTheme(): void {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && palettes.some((p) => p.id === saved)) {
    applyTheme(saved);
  }
}

export function useTheme() {
  return {
    activeTheme,
    palettes,
    applyTheme,
    saveTheme,
    loadSavedTheme
  };
}
