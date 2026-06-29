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
  <div class="pv-doc-view">
    <MarkdownView :content="content" />
  </div>
</template>

<script setup lang="ts">
import MarkdownView from "@/components/MarkdownView.vue";
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
.pv-doc-view {
  padding: 0 20px;
  animation: fadeIn 0.4s ease-in-out;
}
</style>
