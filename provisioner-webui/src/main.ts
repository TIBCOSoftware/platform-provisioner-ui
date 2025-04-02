/*
 * Copyright © 2025. Cloud Software Group, Inc.
 * This file is subject to the license terms contained
 * in the license file that is distributed with this file.
 */

import "bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
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
import Lara from "@primevue/themes/lara";
app.use(PrimeVue, {
  theme: {
    options: {
      darkModeSelector: "light"
    },
    preset: Lara
  }
});

const pinia = createPinia();
app.use(pinia);

app.use(Vue3Toastify, {
  autoClose: 3000,
  position: "bottom-center"
});

app.use(router);

app.mount("#app");
