<!--
  - Copyright © 2025. Cloud Software Group, Inc.
  - This file is subject to the license terms contained
  - in the license file that is distributed with this file.
  -->

<template>
  <div class="pv-doc-view">
    <VMarkdownView :content="content" />
  </div>
</template>

<script setup lang="ts">
import { VMarkdownView } from "vue3-markdown";
import utils from "../utils";
import { ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import { toast } from "vue3-toastify";

const content = ref("");
const route = useRoute();

onMounted(() => {
  const docFile = route.params.name;
  utils.httpGet(`/cic2-ws/v1/page-content/${docFile}`).then(
    (response) => {
      content.value = response;
    },
    (error) => {
      const message = error?.response?.data?.message || error?.response?.data || "";
      let errorMsg = "Can not get the page content. " + message;
      toast.error(errorMsg);
    }
  );
});
</script>
<style lang="less" scoped>
.pv-doc-view pre code {
  background: unset;
  color: unset;
  font-family: unset;
  font-size: 0.875rem;
  text-shadow: unset;
}
</style>
