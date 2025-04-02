<!--
  - Copyright © 2025. Cloud Software Group, Inc.
  - This file is subject to the license terms contained
  - in the license file that is distributed with this file.
  -->

<template>
  <div class="welcome-view">
    <h1>Welcome {{ user.firstName }} {{ user.lastName }}</h1>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import utils from "../utils";
import type { RES_USER } from "@/types/response";

const user = ref<RES_USER>({} as RES_USER);
const router = useRouter();

onMounted(() => {
  utils
    .loggedIn()
    .then((response) => {
      user.value = response;
    })
    .catch(() => {
      router.push({ path: "/login" });
    });

  utils.getUiProperties().then((properties) => {
    const gitInfo = {
      GIT_BRANCH: properties["GIT_BRANCH"],
      GIT_COMMIT: properties["GIT_COMMIT"],
      BUILD_TIME: properties["BUILD_TIME"],
      DOCKERFILE: properties["DOCKERFILE"]
    };
    if (Object.values(gitInfo).some((v) => v) && gitInfo.DOCKERFILE !== "Dockerfile") {
      console.log(gitInfo);
    }
  });
});
</script>

<style lang="less" scoped>
.welcome-view {
  h1 {
    text-align: center;
    margin-top: 200px;
  }
}
</style>
