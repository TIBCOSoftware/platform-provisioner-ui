<!--
  - Copyright © 2025. Cloud Software Group, Inc.
  - This file is subject to the license terms contained
  - in the license file that is distributed with this file.
  -->

<template>
  <div id="yaml-view">
    <!-- REST API endpoint URL -->
    <div class="rest-url">
      <InputGroup>
        <InputGroupAddon>REST API endpoint URL</InputGroupAddon>
        <InputText type="text" disabled :modelValue="restUrl" />
        <Button label="Copy" severity="info" icon="pi pi-copy" @click="copyRestUrl" v-bind:disabled="!restUrl" />
      </InputGroup>
    </div>

    <!-- Editor Tabs -->
    <ul class="nav nav-tabs" id="editorsTab" role="tablist">
      <li class="nav-item">
        <a
          class="nav-link active"
          id="yaml-editor-tab"
          data-bs-toggle="tab"
          href="#yamlEditor"
          role="tab"
          v-on:click="activeEditor('yaml')"
          aria-controls="yamlEditor"
          aria-selected="false"
        >
          YAML Editor
        </a>
      </li>
      <li class="nav-item">
        <a
          class="nav-link"
          id="json-editor-tab"
          data-bs-toggle="tab"
          href="#jsonEditor"
          role="tab"
          v-on:click="activeEditor('json')"
          aria-controls="jsonEditor"
          aria-selected="true"
        >
          JSON Viewer
        </a>
      </li>
    </ul>

    <!-- Editors -->
    <div class="tab-content" id="editorTabsContent">
      <div class="tab-pane fade show active" id="yamlEditor" role="tabpanel" aria-labelledby="yaml-editor-tab">
        <!-- YAML Viewer -->
        <yaml-editor-container
          v-bind:content="yamlEditorContent"
          ref="yamlEditor"
        >
        </yaml-editor-container>
      </div>
      <div class="tab-pane fade" id="jsonEditor" role="tabpanel" aria-labelledby="json-editor-tab">
        <!-- JSON Editor -->
        <json-editor-vue v-model="jsonEditorContent" :options="jsonEditorOptions" :plus="false" ref="jsonEditor" />
      </div>
    </div>

    <!-- Actions -->
    <div class="form-buttons">
      <Button label="Run" severity="success" icon="pi pi-check" :disabled="isInValid || isEditingYaml" @click="onPipelineDeploy" />
      <Button label="Status" severity="info" icon="pi pi-cog" :disabled="isInValid || isEditingYaml" @click="openStatusLink" />
      <Button label="Copy payload" severity="info" icon="pi pi-copy" :disabled="isEditingYaml" @click="copyJson()" />
    </div>
    <div class="test-reference" v-if="isDev">
      <div class="test-reference-search">
        <input type="text" v-model="referencePath" class="form-control" />
        <Button label="Test reference path" severity="info" icon="pi pi-search" :disabled="isEditingYaml" @click="onTestReference()" />
      </div>
      <small class="force-break">
        Note: Test reference path for files <i>~/github/platform-provisioner/charts/provisioner-config-local/config/pp-*.yaml</i>.
        See
        <a href="https://github.com/tibco/platform-provisioner-ui/tree/main/provisioner-webui/docs">readme</a>.
      </small>
      <pre class="force-break" v-if="referenceResult !== ''">{{ referenceResult }}</pre>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, watch, computed, onMounted } from "vue";
import { timer } from "rxjs";
import { dump } from "js-yaml";
import { toast } from "vue3-toastify";
import _ from "lodash";
import JsonEditorVue from "json-editor-vue3";
import yamlEditorContainer from "../components/yamlEditor/yamlEditor.vue";
import utils from "../utils";
import type { PIPELINE_EDITOR_TYPE } from "@/types/pipeline";
import { useMainStore } from "@/stores/store";
import Button from "primevue/button";
import InputGroup from 'primevue/inputgroup';
import InputGroupAddon from 'primevue/inputgroupaddon';
import InputText from 'primevue/inputtext';
import type { YAML_EDITOR_CONTENT, YAML_VIEW_PROP_TYPES } from "@/types/props";

const store = useMainStore();

const props = withDefaults(defineProps<YAML_VIEW_PROP_TYPES>(), {
  isInValid: false,
  pipelineGroups: () => ([]),
});

const jsonEditorOptions = {
  mode: "code",
  modes: ["code"],
  mainMenuBar: false,
  navigationBar: false
};
let currentEditor = "yaml";

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
const onPipelineDeploy = () => {
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
    const jsonData = yamlEditorContent.value
    if (currentEditor === "json") {
      content = JSON.stringify(jsonData, null, 2);
    } else {
      content = dump(jsonData,{
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
  currentEditor = editorType;
  timer(300).subscribe(() => {
    if (editorType === "yaml") {
      yamlEditor.value?.editor.resize(true);
    }
    if (editorType === "json") {
      jsonEditor.value?.editor.aceEditor.setReadOnly(true);
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

watch(() => props.pipelineGroups?.[0]?.options?.[0]?.reference, (newVal) => {
  referencePath.value = newVal;
}, { deep: true });

</script>
<style lang="less" scoped>
.rest-url {
  margin-bottom: 20px;
  .p-inputgroupaddon {
    font-size: 0.75rem;
  }
  input.p-inputtext {
    font-size: 0.75rem;
    padding: 0 10px;
  };
  button:disabled {
    cursor: not-allowed;
  }
}
#yaml-view {
  .test-reference {
    .test-reference-search {
      display: flex;
      align-content: center;
      justify-content: space-between;
      input {
        width: calc(100% - 200px);
        padding: 0 5px;
        font-size: 0.75rem;
      }
    }
    small {
      display: block;
      margin: 10px 0;
      color: var(--p-gray-400);
      i {
        background: var(--p-gray-200);
        padding: 2px 6px;
        font-weight: 500;
        border-radius: 3px;
      }
    }
    pre {
      max-height: 500px;
      padding-bottom: 30px;
      font-size: 0.75rem;
    }
  }
  #editorsTab .nav-link {
    z-index: 1;
    position: relative;
  }
  #yamlEditor {
    border: 1px solid #dee2e6;
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
        border-color: #dee2e6;
        top: -1px;
      }
      .ace-jsoneditor {
        font-size: 0.75rem !important;
      }
    }
  }
  .form-buttons {
    margin-top: 10px;
    margin-bottom: 0.5rem;
    button,
    a {
      margin-right: 10px;
      &:disabled {
        cursor: not-allowed;
      }
    }
  }
}
</style>
