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
  <div class="error-page">
    <div class="pv-error-view">
      <h1>Error</h1>
      <p v-if="!isMdError">{{ errorMessage }}</p>
      <MarkdownView v-if="isMdError" :content="content" />
      <a v-if="showLoginButton" href="/login" class="login-btn">
        <i class="bi bi-box-arrow-in-right" />
        Back to Login
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import utils from "../utils";
import MarkdownView from "@/components/MarkdownView.vue";
import { ref, onMounted } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();
const isMdError = ref(false);
const showLoginButton = ref(false);
const content = ref("");
const errorMessage = ref("You do not have permission to access this page. Please contact your administrator.");

onMounted(() => {
  const code = route.query.code;
  if (code) {
    isMdError.value = true;
    switch (code) {
      case "403":
        showLoginButton.value = true;
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
.error-page {
  min-height: 100vh;
  background: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.pv-error-view {
  max-width: 700px;
  width: 100%;
  padding: 40px;
  box-shadow: var(--shadow-lg);
  animation: fadeIn 0.5s ease-in-out;
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);

  h1 {
    text-align: center;
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 24px;
    color: var(--danger-color);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;

    &::before {
      content: "\F33B";
      font-family: "bootstrap-icons";
      font-size: 1.5rem;
      color: var(--danger-color);
    }
  }

  p {
    text-align: center;
    font-size: 0.9375rem;
    color: var(--text-secondary);
    line-height: 1.8;
    padding: 20px;
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
  }

  .login-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-top: 24px;
    padding: 10px 24px;
    background: var(--primary-color);
    color: #fff;
    border-radius: var(--radius-md);
    text-decoration: none;
    font-size: 0.9375rem;
    font-weight: 500;
    width: 100%;

    &:hover {
      opacity: 0.9;
    }
  }

  :deep(.markdown-body) {
    h1 {
      color: var(--danger-color);
      font-size: 1.5rem;
      border-bottom: 1px solid var(--border-color);
    }

    p {
      text-align: center;
      background: transparent;
      border: none;
      padding: 0;
      box-shadow: none;
    }
  }
}
</style>
