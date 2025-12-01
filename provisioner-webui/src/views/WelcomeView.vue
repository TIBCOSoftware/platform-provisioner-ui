<!--
  - Copyright © 2025. Cloud Software Group, Inc.
  - This file is subject to the license terms contained
  - in the license file that is distributed with this file.
  -->

<template>
  <div class="welcome-view">
    <h1>Welcome {{ user.firstName }} {{ user.lastName }}</h1>
    <div class="container">
      <div class="row">
        <div class="col-sm">
          <Panel header="Config Helm Chart URL">
            <div class="form-group">
              <label for="helmChartUrl" class="col-form-label">Helm chart url</label>
              <AutoComplete
                id="helmChartUrl"
                v-model="helmChartVersions.helmChartUrl"
                :suggestions="filteredChartUrls"
                optionLabel="url"
                @complete="searchChartUrl"
                :dropdown="true"
                placeholder="Search or type..."
              >
                <template #option="slotProps">
                  <div class="flex align-options-center">
                    <div :title="slotProps.option.description">{{ slotProps.option.url }}</div>
                  </div>
                </template>
              </AutoComplete>
            </div>
            <div class="form-group">
              <label for="token" class="col-form-label">Token: (Optional, access token for above helm chart url)</label>
              <Password type="password" id="token" v-model="helmChartVersions.token" placeholder="ghp_**"
                        :inputStyle="{ width: '100%', fontSize: '12px' }" autocomplete="off"
                        :feedback="false" toggleMask />
            </div>
            <div class="form-group">
              <label class="col-form-label"
                     :class="{ 'msg-error': helmChartVersions.errorMsg, 'msg-success': helmChartVersions.successMsg }">{{ helmChartVersions.errorMsg || helmChartVersions.successMsg || helmChartVersions.generated }}</label>
              <div class="footer">
                <Button type="button" severity="primary" label="Reload file"
                        :disabled="isChartUrlEmpty()"
                        :title="isChartUrlEmpty() ? 'Please provide helm chart url to enable it.' : 'Reload the helm chart file from given url.'"
                        icon="pi pi-sync" :loading="loading" @click="getHelmChartFile(getChartUrl())" />
                <Button type="button" severity="success" label="Save config"
                        :title="isChartUrlEmpty() ? 'Please provide helm chart url to enable it.' : 'Save the github token and file url to browser local storage.'"
                        icon="pi pi-save" @click="saveConfig" />
              </div>
            </div>
            <Divider />
            <div class="form-group">
              <p>Check if above helm chart content is loaded.</p>
            </div>
            <div class="form-group">
              <label for="chartName" class="col-form-label">Chart name: </label>
              <div>
                <AutoComplete
                  id="chartName"
                  v-model="helmChartVersions.chartName"
                  :suggestions="filteredChartNames"
                  @complete="searchChartName"
                  :disabled="isChartUrlEmpty() || cachedChartMap.size === 0"
                  :dropdown="true"
                  placeholder="Search or type..."
                />
              </div>
            </div>
            <div class="form-group">
              <label for="version" class="col-form-label">Version: </label>
              <div>
                <AutoComplete
                  id="version"
                  v-model="helmChartVersions.version"
                  :suggestions="filteredVersions"
                  @complete="searchVersion"
                  :disabled="helmChartVersions.chartName === ''"
                  :dropdown="true"
                  :placeholder="helmChartVersions.chartName === '' ? 'Select chartName to enable it.' : 'Search or type version...'"
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
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import utils from "../utils";

import type {
  CP_VERSION,
  GITHUB_INFO,
  HELM_CHART_VERSIONS,
  RES_CHART_URL,
  RES_MENU_CONTENT,
  RES_USER
} from "@/types/response";
import Panel from 'primevue/panel';
import AutoComplete, { type AutoCompleteCompleteEvent } from 'primevue/autocomplete';
import Button from "primevue/button";
import Divider from 'primevue/divider';
import Password from "primevue/password";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);

const user = ref<RES_USER>({} as RES_USER);
const router = useRouter();

const loading = ref<boolean>(false);
const cachedChartUrls = ref<RES_CHART_URL[]>([]);
const filteredChartUrls = ref<RES_CHART_URL[]>([]);

const cachedChartMap = ref(new Map<string, string[]>());
const filteredChartNames = ref<string[]>([]);
const filteredVersions = ref<string[]>([]);

const localStorageKey = "helmChartConfig";
// Load saved config from local storage
const savedConfig = localStorage.getItem(localStorageKey);
let helmChartVersionsLocalStorageData: GITHUB_INFO | null = null;
if (savedConfig) {
  helmChartVersionsLocalStorageData = JSON.parse(savedConfig);
}
const helmChartVersions = ref<HELM_CHART_VERSIONS>({
  token: helmChartVersionsLocalStorageData?.token || "",
  helmChartUrl: helmChartVersionsLocalStorageData?.helmChartUrl || "",
  generated: "",
  chartName: "",
  version: "",
  successMsg: "",
  errorMsg: ""
});

const searchChartUrl = (event: AutoCompleteCompleteEvent) => {
  const q = event.query.toLowerCase();
  filteredChartUrls.value = [...cachedChartUrls.value].filter(item =>
    item.url.toLowerCase().includes(q)
  );
}
const searchChartName = (event: AutoCompleteCompleteEvent) => {
  const q = event.query.toLowerCase();
  filteredChartNames.value = [...cachedChartMap.value.keys()].filter(item =>
    item.toLowerCase().includes(q)
  );
}
const searchVersion = (event: AutoCompleteCompleteEvent) => {
  const q = event.query.toLowerCase();
  const versions = cachedChartMap.value.get(helmChartVersions.value.chartName) || [];
  filteredVersions.value = versions.filter(item =>
    item.toLowerCase().includes(q)
  );
};

const saveConfig = () => {
  const config: GITHUB_INFO = {
    token: helmChartVersions.value.token,
    helmChartUrl: helmChartVersions.value.helmChartUrl || "",
  };
  // Save to local storage
  localStorage.setItem(localStorageKey, JSON.stringify(config));

  helmChartVersions.value.errorMsg = "";
  helmChartVersions.value.successMsg = "Github information saved to browser local storage.";
}

const loadChartUrls = () => {
  utils.httpGet("/cic2-ws/v1/menu-content")
    .then((response: RES_MENU_CONTENT) => {
      if (response.chartConfig) {
        cachedChartUrls.value = response.chartConfig.chartUrls || [];
      }
    })
}
const loadChart = () => {
  let url = "/cic2-ws/v1/helm-chart-version?";
  const helmChartUrl = getChartUrl();
  if (helmChartUrl) {
    url += "&helmChartUrl=" + encodeURIComponent(helmChartUrl);
  }
  utils.httpGet(url).then((response) => {
    cachedChartMap.value = new Map(Object.entries(response as CP_VERSION));
  });
}

const loadChartGenerated = (helmChartUrl: string) => {
  if (!helmChartUrl) {
    return;
  }
  let url = "/cic2-ws/v1/helm-chart-version?generated=true"
    + "&helmChartUrl=" + encodeURIComponent(helmChartUrl);
  utils.httpGet(url).then((response: string) => {
    if (response && dayjs(response).isValid()) {
      helmChartVersions.value.generated = `Helm chart file generated at local time: ${dayjs.utc(response).local().format("MM/DD/YYYY HH:mm:ss")}`;
    }
    loadChart();
  });
}

const getHelmChartFile = (helmChartUrl: string) => {
  if (!helmChartUrl) {
    return;
  }
  loading.value = true;
  helmChartVersions.value.successMsg = "";
  helmChartVersions.value.errorMsg = "";
  helmChartVersions.value.generated = "";

  const url = "/cic2-ws/v1/get-helm-chart-file?"
    + "token=" + encodeURIComponent(helmChartVersions.value.token)
    + "&helmChartUrl=" + encodeURIComponent(helmChartUrl);
  return utils.httpGet(url).then(() => {
    loading.value = false;
    loadChartGenerated(helmChartUrl);
  }).catch((error) => {
    loading.value = false;
    if (error.status === 304) {
      loadChart();
      helmChartVersions.value.successMsg = "No changed for the given Helm chart URL.";
    } else {
      helmChartVersions.value.errorMsg = "Cannot load the given Helm chart URL.";
    }
  });
}

const getChartUrl = () => {
  const val = helmChartVersions.value.helmChartUrl;
  if (typeof val === 'string') {
    return val.trim();
  }
  if (val && typeof val === 'object' && typeof val.url === 'string') {
    return val.url.trim();
  }
  return '';
}

const isChartUrlEmpty = () => {
  return getChartUrl() === '';
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
  return utils.getUiProperties().then(properties => {
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
  checkIsLoggedIn().then(logged => {
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
.welcome-view {
  h1 {
    text-align: right;
    margin: 60px 20px 10px 0;
    font-size: 24px;
  }
  .container {
    max-width: 90%;
    .col-sm {
      min-width: 480px;
      .form-group {
        #token {
          width: 100%;
        }
        label {
          &.msg-success, &.msg-warning, &.msg-error {
            font-weight: bold;
          }
        }
        .p-autocomplete {
          min-width: 420px;
          width: 100%;
        }
        .footer {
          display: flex;
          justify-content: space-between;
        }
      }
    }
  }
}
</style>
