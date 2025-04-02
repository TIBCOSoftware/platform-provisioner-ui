<!--
  - Copyright © 2025. Cloud Software Group, Inc.
  - This file is subject to the license terms contained
  - in the license file that is distributed with this file.
  -->

<template>
  <div id="provisioner">
    <nav class="navbar navbar-expand-lg fixed-top navbar-dark bg-dark">
      <Menubar class="header-menu" :model="items" v-if="user" breakpoint="1280px">
        <template #start>
          <router-link class="navbar-brand" to="/">Platform Provisioner</router-link>
        </template>
      </Menubar>

      <form class="form-inline" action="/auth/logout" method="POST" v-if="user && !user.noLogout">
        <div v-if="user && user.tenantId" class="btn-label">{{ user.firstName }} {{ user.lastName }}</div>
        <button class="btn btn-outline-success my-2 my-sm-0" type="submit">Log out</button>
      </form>
    </nav>

    <!-- route outlet -->
    <!-- component matched by the route will render here -->
    <router-view></router-view>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import utils from "./utils";
import Menubar from "primevue/menubar";
import menuContentService from "./services/menuContentService";
import type { RES_MENU_CONFIG_ITEM, RES_USER } from "@/types/response";
import { useRoute, useRouter } from "vue-router";

const user = ref<RES_USER>({} as RES_USER);
const items = ref<RES_MENU_CONFIG_ITEM[]>([]);
const router = useRouter();
const route = useRoute();

const loadMenu = () => {
  menuContentService.getMenuList().then((response: RES_MENU_CONFIG_ITEM[]) => {
    router.isReady().then(() => {
      const toUrl = decodeURIComponent(route.fullPath);
      items.value = menuContentService.highLightMenuConfig(toUrl, response);
    });
  });
};

onMounted(() => {
  utils
    .loggedIn()
    .then((loggedInUser) => {
      user.value = loggedInUser;
      if (user.value) {
        loadMenu();
      }
    })
    .catch(() => {
      user.value = {} as RES_USER;
    });
});
</script>

<style lang="less" scoped>
.navbar {
  padding-left: 16px;
  padding-right: 16px;
  background-color: #062e79 !important;
  .btn-label {
    margin-right: 5px;
    color: rgba(255, 255, 255, 0.75);
  }
}
.header-menu {
  flex-grow: 1;
  :deep(&.p-menubar) {
    padding: 0;
    background-color: #062e79;
    border: none;
    &.p-menubar-mobile {
      .p-menubar-root-list {
        padding-top: 0;
        top: 48px;
        padding-bottom: 0;
        .p-menubar-item .p-menubar-submenu {
          width: auto;
        }
      }
    }
    .p-menubar-root-list {
      .p-menubar-item {
        &.p-menubar-item-active > .p-menubar-item-content {
          .p-menubar-item-icon,
          .p-menubar-item-label,
          .p-menubar-submenu-icon {
            color: #fff;
          }
        }
        .p-menubar-item-content {
          background-color: #062e79;
          &:hover {
            background-color: #062e79;
            .p-menubar-item-icon,
            .p-menubar-item-label,
            .p-menubar-submenu-icon {
              color: #fff;
            }
          }
        }
        .p-menubar-submenu {
          background-color: #062e79;
          border: 0;
          padding: 0;
          border-radius: unset;
          width: max-content;
          .p-menubar-item {
            padding: 2px 0;
          }
        }
        .p-menubar-item-icon,
        .p-menubar-item-label,
        .p-menubar-submenu-icon {
          color: rgba(255, 255, 255, 0.5);
        }
      }
    }
  }
}
</style>
