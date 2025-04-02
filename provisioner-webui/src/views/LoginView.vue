<!--
  - Copyright © 2025. Cloud Software Group, Inc.
  - This file is subject to the license terms contained
  - in the license file that is distributed with this file.
  -->

<template>
  <div class="login-view">
    <h5>Click the button below to access Platform Provisioner</h5>
    <a class="btn btn-lg btn-primary" :href="loginUrl">Login with your Account</a>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import utils from "../utils";

const route = useRoute();
const router = useRouter();
const loginUrl = ref("/auth/login" + (route.query.callbackUrl ? "?callbackUrl=" + route.query.callbackUrl : ""));

onMounted(() => {
  utils
    .loggedIn()
    .then(() => router.push({ path: "/" }))
    .catch(() => {
      console.log("User needs to login first.");
    });
});
</script>

<style lang="less" scoped>
.login-view {
  margin: auto;
  top: 300px;
  position: relative;
  max-width: 820px;
  text-align: center;
  font-size: var(--bs-body-font-size);
  font-weight: 400;
  line-height: 1.5;
}
</style>
