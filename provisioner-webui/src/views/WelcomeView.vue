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
  <div class="welcome-view">
    <h1 class="welcome-title">
      Welcome {{ user.firstName }} {{ user.lastName }}
    </h1>
    <div class="welcome-content">
      <div class="welcome-grid">
        <div class="col-sm min-w-[480px]">
          <Panel>
            <template #header>
              <div class="panel-header-content">
                <i class="pi pi-cog"></i>
                <span>Config Helm Chart URL</span>
              </div>
            </template>
            <div class="mb-5">
              <label for="helmChartUrl" class="col-form-label">Helm chart url</label>
              <AutoComplete
                v-model="helmChartUrlString"
                :suggestions="filteredChartUrlSuggestions"
                @complete="onChartUrlComplete"
                @item-select="(e: any) => onChartUrlSelect(e.value)"
                dropdown
                placeholder="Search or type..."
                class="w-full"
              />
            </div>
            <div class="mb-5">
              <label for="token" class="col-form-label">Token: (Optional, access token for above helm chart url)</label>
              <Password v-model="helmChartVersions.token" placeholder="ghp_**" toggleMask :feedback="false" :inputProps="{ autocomplete: 'new-password' }" class="w-full" />
            </div>
            <div class="mb-5">
              <label
                class="col-form-label"
                :class="{ 'msg-error': helmChartVersions.errorMsg, 'msg-success': helmChartVersions.successMsg }"
                aria-live="polite"
                >{{ helmChartVersions.errorMsg || helmChartVersions.successMsg || helmChartVersions.generated }}</label
              >
              <div class="config-buttons">
                <Button
                  severity="primary"
                  :disabled="isChartUrlEmpty()"
                  :title="isChartUrlEmpty() ? 'Please provide helm chart url to enable it.' : 'Reload the helm chart file from given url.'"
                  :loading="loading"
                  @click="getHelmChartFile(getChartUrl())"
                >
                  <i class="bi bi-arrow-repeat" />
                  Reload file
                </Button>
                <Button
                  severity="success"
                  :title="
                    isChartUrlEmpty() ? 'Please provide helm chart url to enable it.' : 'Save the github token and file url to browser local storage.'
                  "
                  @click="saveConfig"
                >
                  <i class="bi bi-save" />
                  Save config
                </Button>
              </div>
            </div>
            <Divider />
            <div class="mb-5">
              <p>Check if above helm chart content is loaded.</p>
            </div>
            <div class="mb-5">
              <label for="chartName" class="col-form-label">Chart name: </label>
              <div>
                <AutoComplete
                  v-model="helmChartVersions.chartName"
                  :suggestions="filteredChartNameSuggestions"
                  @complete="onChartNameComplete"
                  :disabled="isChartUrlEmpty() || cachedChartMap.size === 0"
                  dropdown
                  placeholder="Search or type..."
                  class="w-full"
                />
              </div>
            </div>
            <div class="mb-5">
              <label for="version" class="col-form-label">Version: </label>
              <div>
                <AutoComplete
                  v-model="helmChartVersions.version"
                  :suggestions="filteredVersionSuggestions"
                  @complete="onVersionComplete"
                  :disabled="helmChartVersions.chartName === ''"
                  dropdown
                  :placeholder="helmChartVersions.chartName === '' ? 'Select chartName to enable it.' : 'Search or type version...'"
                  class="w-full"
                />
              </div>
            </div>
          </Panel>
        </div>
        <div class="col-sm"></div>
        <div class="col-sm"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import utils from "../utils";
import Panel from "primevue/panel";
import AutoComplete from "primevue/autocomplete";
import Button from "primevue/button";
import Divider from "primevue/divider";
import Password from "primevue/password";

import type { CP_VERSION, GITHUB_INFO, HELM_CHART_VERSIONS, RES_CHART_URL, RES_MENU_CONTENT, RES_USER } from "@/types/response";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);

const user = ref<RES_USER>({} as RES_USER);
const router = useRouter();

const loading = ref<boolean>(false);
const cachedChartUrls = ref<RES_CHART_URL[]>([]);

const cachedChartMap = ref(new Map<string, string[]>());

const localStorageKey = "helmChartConfig";
// Load saved config from local storage
const savedConfig = localStorage.getItem(localStorageKey);
let helmChartVersionsLocalStorageData: GITHUB_INFO | null = null;
if (savedConfig) {
  helmChartVersionsLocalStorageData = JSON.parse(savedConfig);
}

// For AutoComplete we need a string model for the URL input
const getInitialChartUrl = (): string => {
  const val = helmChartVersionsLocalStorageData?.helmChartUrl;
  if (!val) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object" && typeof val.url === "string") return val.url;
  return "";
};

const helmChartUrlString = ref<string>(getInitialChartUrl());

const helmChartVersions = ref<HELM_CHART_VERSIONS>({
  token: helmChartVersionsLocalStorageData?.token || "",
  helmChartUrl: helmChartVersionsLocalStorageData?.helmChartUrl || "",
  generated: "",
  chartName: "",
  version: "",
  successMsg: "",
  errorMsg: ""
});

// PrimeVue AutoComplete uses @complete event with string suggestions array
const filteredChartUrlSuggestions = ref<string[]>([]);
const filteredChartNameSuggestions = ref<string[]>([]);
const filteredVersionSuggestions = ref<string[]>([]);

const onChartUrlComplete = (event: any) => {
  const q = (event.query || "").toLowerCase();
  filteredChartUrlSuggestions.value = cachedChartUrls.value
    .filter((item) => item.url.toLowerCase().includes(q))
    .map((item) => item.url);
};

const onChartNameComplete = (event: any) => {
  const q = (event.query || "").toLowerCase();
  filteredChartNameSuggestions.value = [...cachedChartMap.value.keys()].filter((item) => item.toLowerCase().includes(q));
};

const onVersionComplete = (event: any) => {
  const q = (event.query || "").toLowerCase();
  const versions = cachedChartMap.value.get(helmChartVersions.value.chartName) || [];
  filteredVersionSuggestions.value = versions.filter((item) => item.toLowerCase().includes(q));
};

const onChartUrlSelect = (val: string) => {
  helmChartUrlString.value = val;
  helmChartVersions.value.helmChartUrl = val;
};

const saveConfig = () => {
  const config: GITHUB_INFO = {
    token: helmChartVersions.value.token,
    helmChartUrl: helmChartVersions.value.helmChartUrl || ""
  };
  // Save to local storage
  localStorage.setItem(localStorageKey, JSON.stringify(config));

  helmChartVersions.value.errorMsg = "";
  helmChartVersions.value.successMsg = "Github information saved to browser local storage.";
};

const loadChartUrls = () => {
  utils.httpGet("/cic2-ws/v1/menu-content").then((response: RES_MENU_CONTENT) => {
    if (response.chartConfig) {
      cachedChartUrls.value = response.chartConfig.chartUrls || [];
    }
  });
};
const loadChart = () => {
  let url = "/cic2-ws/v1/helm-chart-version?";
  const helmChartUrl = getChartUrl();
  if (helmChartUrl) {
    url += "&helmChartUrl=" + encodeURIComponent(helmChartUrl);
  }
  utils.httpGet(url).then((response) => {
    cachedChartMap.value = new Map(Object.entries(response as CP_VERSION));
  });
};

const loadChartGenerated = (helmChartUrl: string) => {
  if (!helmChartUrl) {
    return;
  }
  let url = "/cic2-ws/v1/helm-chart-version?generated=true" + "&helmChartUrl=" + encodeURIComponent(helmChartUrl);
  utils.httpGet(url).then((response: string) => {
    if (response && dayjs(response).isValid()) {
      helmChartVersions.value.generated = `Helm chart file generated at local time: ${dayjs.utc(response).local().format("MM/DD/YYYY HH:mm:ss")}`;
    }
    loadChart();
  });
};

const getHelmChartFile = (helmChartUrl: string) => {
  if (!helmChartUrl) {
    return;
  }
  loading.value = true;
  helmChartVersions.value.successMsg = "";
  helmChartVersions.value.errorMsg = "";
  helmChartVersions.value.generated = "";

  const url =
    "/cic2-ws/v1/get-helm-chart-file?" +
    "token=" +
    encodeURIComponent(helmChartVersions.value.token) +
    "&helmChartUrl=" +
    encodeURIComponent(helmChartUrl);
  return utils
    .httpGet(url)
    .then(() => {
      loading.value = false;
      loadChartGenerated(helmChartUrl);
    })
    .catch((error) => {
      loading.value = false;
      if (error.status === 304) {
        loadChart();
        helmChartVersions.value.successMsg = "No changed for the given Helm chart URL.";
      } else {
        helmChartVersions.value.errorMsg = "Cannot load the given Helm chart URL.";
      }
    });
};

const getChartUrl = () => {
  return helmChartUrlString.value.trim();
};

const isChartUrlEmpty = () => {
  return getChartUrl() === "";
};

const checkIsLoggedIn = () => {
  return utils
    .loggedIn()
    .then((response) => {
      user.value = response;
      return true;
    })
    .catch(() => {
      router.push({ path: "/login" });
      return false;
    });
};

const getUiProperties = () => {
  return utils.getUiProperties().then((properties) => {
    const gitInfo = {
      GIT_BRANCH: properties["GIT_BRANCH"],
      GIT_COMMIT: properties["GIT_COMMIT"],
      BUILD_TIME: properties["BUILD_TIME"],
      DOCKERFILE: properties["DOCKERFILE"]
    };
    if (Object.values(gitInfo).some((v) => v) && gitInfo.DOCKERFILE !== "Dockerfile") {
      console.log(gitInfo);
    }
    return properties;
  });
};

onMounted(() => {
  checkIsLoggedIn().then((logged) => {
    if (logged) {
      getUiProperties();
      loadChartUrls();
      const helmChartUrl = getChartUrl();
      if (helmChartUrl) {
        getHelmChartFile(helmChartUrl);
      }
    }
  });
});
</script>

<style lang="less" scoped>
.welcome-title {
  margin-top: 3.75rem;
  margin-left: 1.25rem;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary);
}

.welcome-content {
  max-width: 90%;
  margin: 0 auto;
}

.welcome-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.5rem;

  :deep(.p-panel-header) {
    background: var(--palette-light);
    padding: 0.825rem 1rem;
    margin-bottom: 20px;

    .panel-header-content {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      span {
        font-size: 0.825rem;
        font-weight: 600;
      }
    }
  }
}

.config-buttons {
  display: flex;
  gap: 0.5rem;
  justify-content: space-between;
}
.w-full input {
  width: 100%;
}

.welcome-view {
  .col-sm {
    label {
      font-weight: 500;
      color: var(--text-primary);
      margin-bottom: 6px;
      display: block;
      font-size: 0.8125rem;
    }

    p {
      color: var(--text-secondary);
      font-size: 0.875rem;
      margin: 8px 0;
    }

  }
}
</style>
