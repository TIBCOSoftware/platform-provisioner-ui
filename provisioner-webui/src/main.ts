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

import "bootstrap-icons/font/bootstrap-icons.min.css";
import "primeicons/primeicons.css";
import "vue3-toastify/dist/index.css";
import "./assets/global.less";

import Vue3Toastify from "vue3-toastify";

import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import { createPinia } from "pinia";

const app = createApp(App);

import PrimeVue from "primevue/config";
import Aura from "@primevue/themes/aura";
import { definePreset } from "@primevue/themes";

// Design tokens based on Ocean Blue palette: #F7FBFC #D6E6F2 #B9D7EA #769FCD
// Reference: https://primevue.org/theming/styled/
const AppPreset = definePreset(Aura, {
  primitive: {
    borderRadius: {
      none: "0",
      xs: "2px",
      sm: "4px",
      md: "6px",
      lg: "8px",
      xl: "12px"
    }
  },
  semantic: {
    // Primary palette
    primary: {
      50: "#f0f5fa",
      100: "#D6E6F2",
      200: "#B9D7EA",
      300: "#9AC3E0",
      400: "#88B1D4",
      500: "#769FCD",
      600: "#5F8ABB",
      700: "#4A73A3",
      800: "#355D8D",
      900: "#2B4F72",
      950: "#1A3350"
    },
    // Form field defaults — controls InputText, Select, AutoComplete padding
    formField: {
      paddingX: "0.6rem",
      paddingY: "0.35rem",
      sm: {
        fontSize: "0.75rem",
        paddingX: "0.5rem",
        paddingY: "0.25rem"
      },
      lg: {
        fontSize: "1rem",
        paddingX: "0.875rem",
        paddingY: "0.625rem"
      },
      borderRadius: "{border.radius.md}",
      focusRing: {
        width: "0",
        style: "none",
        color: "transparent",
        offset: "0",
        shadow: "none"
      }
    },
    // Navigation item defaults (padding is NOT color-related, so lives here)
    navigation: {
      list: {
        padding: "0.25rem 0.25rem",
        gap: "2px"
      },
      item: {
        padding: "0.75rem 0.75rem",
        borderRadius: "{content.border.radius}",
        gap: "0.5rem"
      }
    },
    // Color scheme overrides
    colorScheme: {
      light: {
        // Surface colors mapped to our palette
        surface: {
          0: "#ffffff",
          50: "#F7FBFC",
          100: "#EEF3F8",
          200: "#D6E6F2",
          300: "#B9D7EA",
          400: "#8EAEC8",
          500: "#6E90AE",
          600: "#456B8A",
          700: "#3A5A78",
          800: "#2B4F72",
          900: "#1E3D5C",
          950: "#112C44"
        },
        // Primary action colors
        primary: {
          color: "{primary.500}",
          contrastColor: "#ffffff",
          hoverColor: "{primary.600}",
          activeColor: "{primary.700}"
        },
        // Highlight (selection)
        highlight: {
          background: "{primary.50}",
          focusBackground: "{primary.100}",
          color: "{primary.700}",
          focusColor: "{primary.800}"
        },
        // Form field colors
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
        // Text colors
        text: {
          color: "{surface.900}",
          hoverColor: "{surface.950}",
          mutedColor: "{surface.500}",
          hoverMutedColor: "{surface.600}"
        },
        // Content area
        content: {
          background: "{surface.0}",
          hoverBackground: "{surface.50}",
          borderColor: "{surface.200}",
          color: "{text.color}",
          hoverColor: "{text.hover.color}"
        },
        // Navigation items
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
  // Component-level token overrides
  components: {
    button: {
      root: {
        // Button padding independent of formField
        paddingX: "0.85rem",
        paddingY: "0.35rem"
      },
      colorScheme: {
        light: {
          root: {
            // Primary button — uses palette blue
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
              focusRing: {
                color: "{primary.500}",
                shadow: "none"
              }
            },
            // Secondary button
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
              focusRing: {
                color: "{surface.600}",
                shadow: "none"
              }
            },
            // Info button — same as primary in our palette
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
              focusRing: {
                color: "{primary.500}",
                shadow: "none"
              }
            },
            // Success button
            success: {
              background: "#22C55E",
              hoverBackground: "#16A34A",
              activeBackground: "#15803D",
              borderColor: "#22C55E",
              hoverBorderColor: "#16A34A",
              activeBorderColor: "#15803D",
              color: "#ffffff",
              hoverColor: "#ffffff",
              activeColor: "#ffffff",
              focusRing: {
                color: "#22C55E",
                shadow: "none"
              }
            },
            // Danger button
            danger: {
              background: "#EF4444",
              hoverBackground: "#DC2626",
              activeBackground: "#B91C1C",
              borderColor: "#EF4444",
              hoverBorderColor: "#DC2626",
              activeBorderColor: "#B91C1C",
              color: "#ffffff",
              hoverColor: "#ffffff",
              activeColor: "#ffffff",
              focusRing: {
                color: "#EF4444",
                shadow: "none"
              }
            },
            // Warn button
            warn: {
              background: "#F59E0B",
              hoverBackground: "#D97706",
              activeBackground: "#B45309",
              borderColor: "#F59E0B",
              hoverBorderColor: "#D97706",
              activeBorderColor: "#B45309",
              color: "#ffffff",
              hoverColor: "#ffffff",
              activeColor: "#ffffff",
              focusRing: {
                color: "#F59E0B",
                shadow: "none"
              }
            },
            // Contrast button — uses navy
            contrast: {
              background: "{primary.900}",
              hoverBackground: "{primary.800}",
              activeBackground: "{primary.700}",
              borderColor: "{primary.900}",
              hoverBorderColor: "{primary.800}",
              activeBorderColor: "{primary.700}",
              color: "#ffffff",
              hoverColor: "#ffffff",
              activeColor: "#ffffff",
              focusRing: {
                color: "{primary.900}",
                shadow: "none"
              }
            }
          }
        }
      }
    },
    // Tag component
    tag: {
      root: {
        fontSize: "0.75rem"
      },
      colorScheme: {
        light: {
          primary: { background: "{primary.500}", color: "#ffffff" },
          success: { background: "#22C55E", color: "#ffffff" },
          info: { background: "{primary.500}", color: "#ffffff" },
          warn: { background: "#F59E0B", color: "#ffffff" },
          danger: { background: "#EF4444", color: "#ffffff" },
          secondary: { background: "{surface.200}", color: "{surface.700}" },
          contrast: { background: "{primary.900}", color: "#ffffff" }
        }
      }
    }
  }
});

app.use(PrimeVue, {
  theme: {
    options: {
      darkModeSelector: "light",
      // Enable CSS layers so unlayered rules in global.less
      // (e.g. font-size overrides) always beat PrimeVue defaults.
      cssLayer: {
        name: "primevue",
        order: "primevue"
      }
    },
    preset: AppPreset
  }
});

import { loadSavedTheme } from "./composables/useTheme";
loadSavedTheme();

const pinia = createPinia();
app.use(pinia);

app.use(Vue3Toastify, {
  autoClose: 3000,
  position: "bottom-center"
});

app.use(router);

app.mount("#app");
