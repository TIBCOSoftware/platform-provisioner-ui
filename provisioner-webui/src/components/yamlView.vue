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
  <div id="yaml-view">
    <!-- REST API endpoint URL -->
    <div class="rest-url mb-5">
      <label class="rest-url-label">REST API endpoint URL</label>
      <div class="rest-url-row">
        <InputText class="rest-url-input" disabled :modelValue="restUrl" />
        <Button severity="info" :disabled="!restUrl" @click="copyRestUrl">
          <i class="bi bi-clipboard" />
          Copy
        </Button>
      </div>
    </div>

    <!-- Editor Tabs -->
    <Tabs :value="currentEditor" @update:value="activeEditor">
      <TabList>
        <Tab value="yaml">YAML Editor</Tab>
        <Tab value="json">JSON Viewer</Tab>
      </TabList>
      <TabPanels>
        <TabPanel value="yaml">
          <!-- YAML Viewer -->
          <yaml-editor-container v-bind:content="yamlEditorContent" ref="yamlEditor"> </yaml-editor-container>
        </TabPanel>
        <TabPanel value="json">
          <!-- JSON Editor -->
          <json-editor-vue id="jsonEditor" v-model="jsonEditorContent" :options="jsonEditorOptions" :plus="false" ref="jsonEditor" />
        </TabPanel>
      </TabPanels>
    </Tabs>

    <!-- Actions -->
    <div class="form-buttons">
      <Button severity="success" :disabled="isInValid || isEditingYaml" @click="onPipelineDeploy">
        <i class="bi bi-check-lg" />
        Run
      </Button>
      <Button severity="info" :disabled="isInValid || isEditingYaml" @click="openStatusLink">
        <i class="bi bi-gear" />
        Status
      </Button>
      <Button severity="info" :disabled="isEditingYaml" @click="copyJson()">
        <i class="bi bi-clipboard" />
        Copy payload
      </Button>
    </div>
    <div class="test-reference" v-if="isDev">
      <div class="test-reference-search">
        <InputText v-model="referencePath" class="w-full" />
        <Button severity="info" :disabled="isEditingYaml" @click="onTestReference()">
          <i class="bi bi-search" />
          Test reference path
        </Button>
      </div>
      <small class="force-break">
        Note: Test reference path for files <i>~/github/platform-provisioner/charts/provisioner-config-local/config/pp-*.yaml</i>. See
        <a href="https://github.com/tibco/platform-provisioner-ui/tree/main/provisioner-webui/docs">readme</a>.
      </small>
      <pre class="force-break" v-if="referenceResult !== ''">{{ referenceResult }}</pre>
    </div>
  </div>
  <Dialog v-model:visible="showRunConfirm" header="Confirm Pipeline Run" :modal="true" :closable="true" :style="{ width: yamlChanges.hasChanges ? '920px' : '480px' }">
    <div class="run-confirm-content">
      <p>Are you sure you want to run this pipeline?</p>
      <div class="run-confirm-details">
        <div class="run-confirm-item">
          <span class="run-confirm-label">Account</span>
          <span class="run-confirm-value">
            {{ deployParams.account }}
            <span class="run-confirm-desc" v-if="store.accountDescription">({{ store.accountDescription }})</span>
          </span>
        </div>
        <div class="run-confirm-item">
          <span class="run-confirm-label">Region</span>
          <span class="run-confirm-value">{{ deployParams.region }}</span>
        </div>
        <div class="run-confirm-item">
          <span class="run-confirm-label">Pipeline</span>
          <span class="run-confirm-value">{{ deployParams.pipeline }}</span>
        </div>
        <div class="run-confirm-item" v-if="route.query.title">
          <span class="run-confirm-label">Recipe</span>
          <span class="run-confirm-value">{{ route.query.title }}</span>
        </div>
      </div>
      <RunConfirmChanges :changes="yamlChanges" />
    </div>
    <template #footer>
      <Button severity="secondary" @click="showRunConfirm = false">Cancel</Button>
      <Button severity="success" @click="confirmDeploy">
        <i class="bi bi-check-lg" />
        Run
      </Button>
    </template>
  </Dialog>
</template>
<script setup lang="ts">
import { ref, toRaw, watch, computed, onMounted } from "vue";
import { timer } from "rxjs";
import { dump } from "js-yaml";
import { toast } from "vue3-toastify";
import _ from "lodash";
import JsonEditorVue from "json-editor-vue3";
import yamlEditorContainer from "../components/yamlEditor/yamlEditor.vue";
import RunConfirmChanges from "@/components/RunConfirmChanges.vue";
import utils from "../utils";
import type { PIPELINE_EDITOR_TYPE } from "@/types/pipeline";
import { useMainStore } from "@/stores/store";
import { computeYamlChanges, type YamlDiffResult } from "@/changeTracker";
import { useRoute } from "vue-router";
import Button from "primevue/button";
import Dialog from "primevue/dialog";
import InputText from "primevue/inputtext";
import Tabs from "primevue/tabs";
import TabList from "primevue/tablist";
import Tab from "primevue/tab";
import TabPanels from "primevue/tabpanels";
import TabPanel from "primevue/tabpanel";
import type { YAML_EDITOR_CONTENT, YAML_VIEW_PROP_TYPES } from "@/types/props";

const store = useMainStore();
const route = useRoute();

const props = withDefaults(defineProps<YAML_VIEW_PROP_TYPES>(), {
  isInValid: false,
  pipelineGroups: () => []
});

const jsonEditorOptions = {
  mode: "code",
  modes: ["code"],
  mainMenuBar: false,
  navigationBar: false
};
const currentEditor = ref("yaml");

// reactive data
const isDev = ref(false);

// Computed properties
const isEditingYaml = computed(() => store.isEditingYaml);
const deployParams = computed(() => store.changedPipelineDeployParams);
const restUrl = computed(() => utils.buildPublicApiUrl(store.changedPipelineDeployParams));

// for yaml-view
const referenceResult = ref("");
const referencePath = ref("");

const yamlEditor = ref<PIPELINE_EDITOR_TYPE | null>(null);
const jsonEditor = ref<PIPELINE_EDITOR_TYPE | null>(null);
const yamlEditorContent = ref<YAML_EDITOR_CONTENT>(store.yamlEditorContent);
const jsonEditorContent = ref<YAML_EDITOR_CONTENT>(store.yamlEditorContent);

const openStatusLink = () => {
  const url = `/status?account=${deployParams.value.account}&action=pipeline`;
  utils.openNewTab(url);
};
const showRunConfirm = ref(false);
const yamlChanges = ref<YamlDiffResult>({ guiEnvChanges: [], otherDiffText: "", hasChanges: false, uploadedFileNames: {} });
const onPipelineDeploy = () => {
  yamlChanges.value = computeYamlChanges(
    toRaw(store.originalRecipeContent),
    toRaw(store.yamlEditorContent),
    props.pipelineGroups,
    toRaw(store.uploadedFileNames)
  );
  showRunConfirm.value = true;
};
const confirmDeploy = () => {
  showRunConfirm.value = false;
  utils.deployPipeline(deployParams.value, yamlEditorContent.value);
};
const copyRestUrl = () => {
  if (navigator && navigator.clipboard) {
    navigator.clipboard.writeText(restUrl.value).then(() => {
      toast.success("The REST API endpoint URL is copied.");
    });
  } else {
    toast.error("Failed to copy the REST API endpoint URL.");
  }
};
const copyJson = () => {
  if (navigator && navigator.clipboard) {
    let content: string;
    // for PCP-8976, copy textarea payload content only
    const jsonData = yamlEditorContent.value;
    if (currentEditor.value === "json") {
      content = JSON.stringify(jsonData, null, 2);
    } else {
      content = dump(jsonData, {
        lineWidth: -1
      });
    }
    navigator.clipboard.writeText(content).then(() => {
      toast.success("The REST API payload is copied.");
    });
  } else {
    toast.error("Failed to copy the REST API payload.");
  }
};
const onTestReference = () => {
  referenceResult.value = _.get(yamlEditorContent.value, referencePath.value?.trim());
};
const activeEditor = (editorType: string) => {
  currentEditor.value = editorType;
  timer(300).subscribe(() => {
    if (editorType === "yaml") {
      yamlEditor.value?.editor.resize(true);
    }
    if (editorType === "json") {
      const aceEditor = jsonEditor.value?.editor.aceEditor;
      if (aceEditor) {
        const monoFont = getComputedStyle(document.documentElement).getPropertyValue("--font-family-mono").trim();
        aceEditor.setReadOnly(true);
        aceEditor.setOption("fontFamily", monoFont);
        aceEditor.setOption("fontSize", 13);
      }
      jsonEditor.value?.editor.resize(true);
    }
  });
};

// Execute when the component is mounted
onMounted(() => {
  utils.getUiProperties().then((properties) => {
    isDev.value = properties["NODE_ENV"] === "development";
  });
});

watch(
  () => props.pipelineGroups?.[0]?.options?.[0]?.reference,
  (newVal) => {
    referencePath.value = newVal;
  },
  { deep: true }
);
</script>
<style lang="less" scoped>
#yaml-view {
  .rest-url {
    .rest-url-label {
      display: block;
      font-weight: 500;
      font-size: 0.8125rem;
      color: var(--text-secondary);
      margin-bottom: 4px;
    }

    .rest-url-row {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .rest-url-input {
      flex: 1;
      font-family: var(--font-family-mono);
      font-size: 0.8125rem;
    }
  }

  .form-buttons {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.75rem;
    padding: 0.75rem 0;
  }

  .test-reference {
    margin-top: 16px;
    padding: 12px;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);

    .test-reference-search {
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
      justify-content: space-between;
    }

    small {
      display: block;
      margin: 8px 0;
      font-size: 0.75rem;
      color: var(--text-secondary);
      line-height: 1.5;

      a {
        color: var(--primary-color);
        text-decoration: none;

        &:hover {
          text-decoration: underline;
        }
      }
    }

    pre {
      max-height: 500px;
      margin-top: 8px;
      padding: 10px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      font-size: 0.8125rem;
    }
  }

  #yaml-editor-container {
    border: 1px solid var(--border-color);
    border-top: 0;
  }

  #jsonEditor {
    margin-bottom: 10px;
    height: calc(100vh - 400px);
    min-height: 480px;
    :deep(.container) {
      height: calc(100% - 25px);
      padding: 0;

      .jsoneditor {
        border: 1px solid var(--border-color);
        border-top: 0;
      }

      .ace-jsoneditor,
      .ace-jsoneditor .ace_editor {
        font-family: var(--font-family-mono) !important;
        font-size: 0.8125rem !important;
      }

      // Align gutter padding with YAML editor
      .ace_gutter {
        padding-left: 4px;
        padding-right: 8px;
      }
    }
  }
}
</style>
