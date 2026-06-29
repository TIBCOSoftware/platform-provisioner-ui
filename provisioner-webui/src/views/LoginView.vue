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
  <div class="login-page">
    <nav class="login-navbar">
      <img src="@/assets/logo.svg" width="32" height="32" alt="Platform Provisioner Logo" />
      <span>Platform Provisioner</span>
    </nav>
    <div class="login-view card-box">
      <i class="bi bi-shield-lock login-icon"></i>

      <!-- SSO login (default view) -->
      <template v-if="authConfig.samlEnabled && !showFormLogin">
        <h5 class="login-title">
          Click the button below to access Platform Provisioner
        </h5>
        <Button as="a" :href="loginUrl" severity="primary" size="large" class="login-btn"> Login with SSO </Button>
      </template>

      <!-- Form login (shown when checkbox is checked, or when SSO is not available) -->
      <template v-if="showFormLogin && authConfig.formAuthEnabled">
        <h5 class="login-title">Sign in with your credentials</h5>
        <form class="local-login-form" @submit.prevent="handleLocalLogin">
          <div class="form-field">
            <InputText v-model="email" type="email" placeholder="Email" class="login-input" />
          </div>
          <div class="form-field">
            <Password v-model="password" placeholder="Password" :feedback="false" toggleMask class="login-password" />
          </div>
          <p v-if="loginError" class="login-error">{{ loginError }}</p>
          <Button type="submit" severity="primary" size="large" class="login-btn" :loading="isLoading"> Sign In </Button>
        </form>
        <div v-if="authConfig.samlEnabled" class="login-divider">
          <span>or</span>
        </div>
        <Button as="a" :href="loginUrl" severity="secondary" size="large" class="login-btn"> Login with SSO </Button>
      </template>

      <!-- Fallback: neither enabled (should not happen) -->
      <template v-if="!authConfig.formAuthEnabled && !authConfig.samlEnabled">
        <h5 class="login-title">
          Click the button below to access Platform Provisioner
        </h5>
        <Button as="a" :href="loginUrl" severity="primary" size="large" class="login-btn"> Login with your Account </Button>
      </template>

      <!-- Subtle checkbox to toggle form login -->
      <label v-if="authConfig.formAuthEnabled && authConfig.samlEnabled" class="form-login-toggle">
        <input type="checkbox" v-model="showFormLogin" />
        <span>Admin</span>
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import Password from "primevue/password";
import { useRouter, useRoute } from "vue-router";
import utils from "../utils";

const route = useRoute();
const router = useRouter();
const loginUrl = ref("/auth/login" + (route.query.callbackUrl ? "?callbackUrl=" + route.query.callbackUrl : ""));

const authConfig = reactive({ formAuthEnabled: false, samlEnabled: false });
const showFormLogin = ref(false);
const email = ref("");
const password = ref("");
const loginError = ref("");
const isLoading = ref(false);

async function handleLocalLogin() {
  loginError.value = "";
  isLoading.value = true;
  try {
    await utils.httpPost("/auth/local-login", {
      email: email.value,
      password: password.value,
    });
    // Full page reload to re-initialize App.vue (navbar, menu, user state)
    window.location.href = (route.query.callbackUrl as string) || "/";
  } catch (e: any) {
    loginError.value = e?.response?.data?.message || "Login failed";
  } finally {
    isLoading.value = false;
  }
}

onMounted(async () => {
  try {
    await utils.loggedIn();
    router.push({ path: "/" });
    return;
  } catch {
    console.log("User needs to login first.");
  }

  try {
    const config = await utils.httpGet("/auth/config");
    authConfig.formAuthEnabled = config.formAuthEnabled;
    authConfig.samlEnabled = config.samlEnabled;
    // If SSO is not available, show form login by default
    if (!config.samlEnabled && config.formAuthEnabled) {
      showFormLogin.value = true;
    }
  } catch {
    // Fallback: show SAML login only
    authConfig.samlEnabled = true;
  }
});
</script>

<style lang="less" scoped>
.login-page {
  min-height: 100vh;
  background: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  min-height: 48px;
  padding: 0 16px;
  background: var(--navbar-bg);
  display: flex;
  align-items: center;
  gap: 8px;
  color: #fff;
  font-weight: 600;
  font-size: 1rem;
  z-index: 1030;
}

.login-view {
  max-width: 520px;
  width: 100%;
  text-align: center;
  padding: 3rem 2.5rem;
  box-shadow: var(--shadow-lg);
  animation: fadeIn 0.6s ease-in-out;
}

.login-icon {
  display: block;
  font-size: 3rem;
  color: var(--primary-color);
  margin-bottom: 1.5rem;
  animation: pulse 2s ease-in-out infinite;
}

.login-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2rem;
  line-height: 1.625;
}

.login-btn {
  font-size: 1.125rem;
  padding: 0.75rem 2.5rem;
  text-decoration: none;
  width: 100%;
}

.local-login-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-field {
  text-align: left;
}

.login-input {
  width: 100%;
}

.login-password {
  width: 100%;

  :deep(input) {
    width: 100%;
  }
}

.login-error {
  color: var(--red-500, #ef4444);
  font-size: 0.875rem;
  margin: 0;
}

.login-divider {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin: 1.5rem 0;
  color: var(--text-secondary);
  font-size: 0.875rem;

  &::before,
  &::after {
    content: "";
    flex: 1;
    border-top: 1px solid var(--border-color);
  }
}

.form-login-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  align-self: flex-end;
  margin-top: 1rem;
  opacity: 0.25;
  cursor: pointer;
  font-size: 0.7rem;
  color: var(--text-secondary);
  user-select: none;

  &:hover {
    opacity: 0.5;
  }

  input {
    cursor: pointer;
    width: 10px;
    height: 10px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .login-icon {
    animation: none;
  }
}
</style>
