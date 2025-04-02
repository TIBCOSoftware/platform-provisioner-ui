/*
 * Copyright © 2025. Cloud Software Group, Inc.
 * This file is subject to the license terms contained
 * in the license file that is distributed with this file.
 */

import { createRouter, createWebHistory } from "vue-router";
import utils from "../utils";
import DocsView from "@/views/DocsView.vue";
import ErrorView from "@/views/ErrorView.vue";
import LoginView from "@/views/LoginView.vue";
import PipelineView from "@/views/PipelineView.vue";
import TaskStatusView from "@/views/TaskStatusView.vue";
import WelcomeView from "@/views/WelcomeView.vue";

const index = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "Welcome",
      component: WelcomeView,
      meta: {
        requiresAuth: true
      }
    },
    {
      path: "/login",
      name: "Login",
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: LoginView
    },
    {
      path: "/error",
      name: "Error",
      component: ErrorView
    },
    {
      path: "/docs/:name",
      name: "Docs",
      component: DocsView,
      meta: {
        requiresAuth: true
      }
    },
    {
      path: "/:catchAll(.*)",
      redirect: "/"
    },
    {
      path: "/status",
      name: "Status",
      component: TaskStatusView,
      meta: {
        requiresAuth: true
      },
      props: (route) => ({ account: route.query.account, action: route.query.action })
    },
    {
      path: "/pipelines/:name?",
      name: "Pipelines",
      component: PipelineView,
      meta: {
        requiresAuth: true
      }
    }
  ]
});

index.beforeEach((to, from, next) => {
  if (to.matched.some((record) => record.meta.requiresAuth)) {
    // this route requires auth, check if logged in
    // if not login, redirect to login page.
    utils
      .loggedIn()
      .then((user) => {
        return utils
          .httpGet("/cic2-ws/v1/getAccountBySsoUser?email=" + user.email)
          .then((account) => {
            if (account?.length > 0) {
              next();
            } else {
              next("/error?code=403");
            }
          })
          .catch(() => {
            next("/error?code=403");
          });
      })
      .catch(() => {
        // Note: when the current page is root page or error page, callbackUrl should be empty
        const callbackUrl = ["/", "/error"].includes(window.location.pathname) ? "" : encodeURIComponent(window.location.href);
        next("/login" + (callbackUrl ? "?callbackUrl=" + callbackUrl : ""));
      });
  } else {
    next(); // does not require auth, make sure to always call next()!
  }
});

export default index;
