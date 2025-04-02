<!--
  - Copyright © 2025. Cloud Software Group, Inc.
  - This file is subject to the license terms contained
  - in the license file that is distributed with this file.
  -->

<template>
  <div class="pv-error-view">
    <h1>Error</h1>
    <p v-if="!isMdError">{{ errorMessage }}</p>
    <VMarkdownView v-if="isMdError" :content="content" />
  </div>
</template>

<script setup lang="ts">
import utils from "../utils";
import { VMarkdownView } from "vue3-markdown";
import "vue3-markdown/dist/style.css";
import { ref, onMounted } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();
const isMdError = ref(false);
const content = ref("");
const errorMessage = ref("You do not have permission to access this page. Please contact your administrator.");

onMounted(() => {
  const code = route.query.code;
  if (code) {
    isMdError.value = true;
    switch (code) {
      case "403":
        utils.httpGet("/cic2-ws/v1/page-content/errorPage").then(
          (response) => {
            errorMessage.value = response;
          },
          (error) => {
            console.error("Can not get the page content.", error);
          }
        );
        break;
      case "404":
        errorMessage.value = "The page you are looking for does not exist.";
        break;
    }
  }
  content.value = errorMessage.value;
});
</script>

<style lang="less" scoped>
.pv-error-view {
  margin: 200px auto 0;
  width: 600px;
  h1 {
    text-align: left;
  }
}
</style>
