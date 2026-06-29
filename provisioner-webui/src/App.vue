<!--
  - Copyright © 2025. Cloud Software Group, Inc.
  - Licensed under the Apache License, Version 2.0 (the "License");
  - you may not use this file except in compliance with the License.
  - You may obtain a copy of the License at
  -
  -     http://www.apache.org/licenses/LICENSE-2.0
  -
  - Unless required by applicable law or agreed to in writing, software
  - distributed under the License is distributed on an "AS IS" BASIS,
  - WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  - See the License for the specific language governing permissions and
  - limitations under the License.
  -->

<template>
  <div id="provisioner">
    <nav class="navbar navbar-expand-lg fixed-top navbar-dark bg-dark">
      <div class="header-menu" v-if="user">
        <router-link class="navbar-brand" to="/">
          <img src="@/assets/logo.svg" width="32" height="32" class="brand-icon" alt="Platform Provisioner Logo" />
          <span>Platform Provisioner{{ envSuffix }}</span>
        </router-link>
        <Menubar :model="menuItems" class="nav-menu" />
      </div>

      <div class="navbar-right" v-if="user">
        <button
          type="button"
          class="theme-toggle-btn"
          @click="toggleThemeMenu"
          aria-haspopup="true"
          aria-controls="theme-menu-overlay"
          title="Switch theme"
        >
          <i class="bi bi-palette"></i>
        </button>
        <Menu id="theme-menu-overlay" ref="themeMenuRef" :model="themeMenuItems" :popup="true">
          <template #item="{ item, props }">
            <a v-bind="props.action" class="theme-menu-item">
              <span
                v-if="item.paletteColors"
                class="theme-swatch"
                :style="{
                  background: `linear-gradient(to right, ${item.paletteColors[0]} 20%, ${item.paletteColors[1]} 20%, ${item.paletteColors[1]} 40%, ${item.paletteColors[2]} 40%, ${item.paletteColors[2]} 60%, ${item.paletteColors[3]} 60%, ${item.paletteColors[3]} 80%, ${item.paletteColors[4]} 80%)`
                }"
              />
              <span class="theme-menu-label">{{ item.label }}</span>
              <i v-if="item.themeId && item.themeId === activeTheme" class="pi pi-check theme-menu-check" />
            </a>
          </template>
        </Menu>

        <form class="form-inline" action="/auth/logout" method="POST" v-if="!user.noLogout" aria-label="Logout">
          <div v-if="user.tenantId" class="user-info">
            {{ user.firstName }} {{ user.lastName }}
          </div>
          <button type="submit" class="logout-btn">Log out</button>
        </form>
      </div>
    </nav>

    <!-- route outlet -->
    <!-- component matched by the route will render here -->
    <router-view :key="routeKey"></router-view>

    <div class="app-version">{{ appVersion }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import utils from "./utils";
import Menubar from "primevue/menubar";
import Menu from "primevue/menu";
import menuContentService from "./services/menuContentService";
import type { RES_MENU_CONFIG_ITEM, RES_USER } from "@/types/response";
import { useRoute, useRouter } from "vue-router";
import { useTheme, palettes } from "./composables/useTheme";

const user = ref<RES_USER | null>(null);
const items = ref<RES_MENU_CONFIG_ITEM[]>([]);
const router = useRouter();
const route = useRoute();
const themeMenuRef = ref();

const appVersion = __APP_VERSION__;
const { activeTheme, applyTheme, saveTheme } = useTheme();

const toggleThemeMenu = (event: Event) => {
  themeMenuRef.value.toggle(event);
};

const themeMenuItems = computed(() => {
  return [
    {
      label: "Theme",
      items: palettes.map((p) => ({
        label: p.label,
        paletteColors: p.colors,
        themeId: p.id,
        command: () => {
          applyTheme(p.id);
          saveTheme(p.id);
        }
      }))
    }
  ];
});

// Build a normalized key for router-view that:
// - changes when path or title changes (different page/YAML)
// - ignores encoding differences (%20 vs +) and hash (#B)
const routeKey = computed(() => {
  const title = route.query.title ? String(route.query.title) : "";
  return title ? `${route.path}?title=${title}` : route.path;
});

// Convert RES_MENU_CONFIG_ITEM[] to PrimeVue MenuItem[]
const convertToMenuItems = (menuItems: RES_MENU_CONFIG_ITEM[]): any[] => {
  return menuItems
    .filter((item) => item.label || item.separator)
    .map((item) => {
      if (item.separator) {
        return { separator: true };
      }
      const menuItem: any = {
        label: item.label || "",
        icon: item.icon || undefined
      };
      if (item.routePath) {
        menuItem.command = () => {
          router.push(item.routePath!);
        };
      } else if (item.url && item.url.startsWith("http")) {
        menuItem.url = item.url;
        menuItem.target = "_blank";
      }
      if (item.items && item.items.length > 0) {
        menuItem.items = convertToMenuItems(item.items);
      }
      return menuItem;
    });
};

const menuItems = computed(() => convertToMenuItems(items.value));

// Convert internal URLs to Vue Router navigation commands
const convertUrlToCommand = (menuItems: RES_MENU_CONFIG_ITEM[]): RES_MENU_CONFIG_ITEM[] => {
  return menuItems.map((item) => {
    const converted = { ...item };
    if (converted.url && !converted.url.startsWith("http")) {
      const targetUrl = converted.url;
      converted.routePath = targetUrl;
      converted.command = () => {
        router.push(targetUrl);
      };
      delete converted.url;
    }
    if (converted.items) {
      converted.items = convertUrlToCommand(converted.items);
    }
    return converted;
  });
};

const loadMenu = () => {
  menuContentService.getMenuList().then((response: RES_MENU_CONFIG_ITEM[]) => {
    router.isReady().then(() => {
      items.value = convertUrlToCommand(response);
    });
  });
};

const envSuffix = ref("");

const updateTitle = () => {
  const hostname = window.location.hostname;
  if (hostname.includes("staging")) {
    envSuffix.value = " [Staging]";
  } else if (hostname === "localhost" || hostname === "127.0.0.1") {
    envSuffix.value = " [Local]";
  }
  document.title = `Platform Provisioner${envSuffix.value}`;
};

onMounted(() => {
  updateTitle();
  utils
    .loggedIn()
    .then((loggedInUser) => {
      user.value = loggedInUser;
      if (user.value) {
        loadMenu();
      }
    })
    .catch(() => {
      user.value = null;
    });
});
</script>

<style lang="less" scoped>
.navbar {
  padding: 0 16px;
  background: var(--navbar-bg);
  display: flex;
  align-items: center;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1030;
  min-height: 48px;

  .navbar-brand {
    font-weight: 600;
    font-size: 1rem;
    display: flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    color: #fff;
    white-space: nowrap;
    margin-right: 16px;
  }

  .user-info {
    margin-right: 0.5rem;
    color: rgba(255, 255, 255, 0.9);
    font-size: 0.8125rem;
  }

  .logout-btn {
    border: 1px solid rgba(255, 255, 255, 0.5);
    background: transparent;
    border-radius: var(--radius-sm);
    padding: 4px 14px;
    color: #fff;
    cursor: pointer;
    font-size: 0.8125rem;

    &:hover {
      background: rgba(255, 255, 255, 0.15);
    }
  }
}
.header-menu {
  flex-grow: 1;
  display: flex;
  align-items: center;

  .nav-menu {
    background: transparent;
    border: none;
    flex: 1;
    padding: 0;
  }
}

.navbar-right {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 10px;
}

.theme-toggle-btn {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.75);
  cursor: pointer;
  padding: 4px 6px;
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  border-radius: var(--radius-sm);

  &:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.15);
  }
}

.app-version {
  position: fixed;
  bottom: 4px;
  right: 8px;
  font-size: 0.6875rem;
  color: var(--text-secondary, #999);
  opacity: 0.35;
  user-select: all;
  z-index: 1;
  cursor: default;

  &:hover {
    opacity: 0.7;
  }
}
</style>

<style lang="less">
/* Theme menu popup — global (unscoped) because PrimeVue portals to body */
.p-menu[id="theme-menu-overlay"] {
  min-width: 220px;

  .theme-menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    cursor: pointer;
  }

  .theme-swatch {
    width: 48px;
    height: 16px;
    border-radius: 3px;
    border: 1px solid rgba(0, 0, 0, 0.15);
    flex-shrink: 0;
  }

  .theme-menu-label {
    flex: 1;
  }

  .theme-menu-check {
    font-size: 0.75rem;
    color: var(--primary-color);
    flex-shrink: 0;
  }
}
</style>
