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
  <div class="pv-pipeline-view">
    <h2>
      {{ pageTitle }}
      <button
        v-if="pipelineDescription"
        type="button"
        class="pipeline-desc-btn"
        @click="visiblePipelineDescription = true"
        aria-label="Show pipeline description"
      >
        <i class="bi bi-card-text" />
      </button>
    </h2>
    <div class="page-update-warning" v-if="isPendingUpdate">
      The pipeline content has been updated on the server. Please click browser refresh button or <a href="#" @click.prevent="reloadPage">here</a> to get the latest content.
    </div>
    <div class="pipeline-view-content card-box" :class="{ 'pipeline-view-grouped': pipelineGroups.length > 1 }">
      <div class="pipeline-splitter">
        <div class="panel-left" :style="{ flex: isShowYamlInPage ? '0 1 60%' : '1' }">
          <!-- Account -->
          <aws-account v-bind:account="deployParams.account"></aws-account>
          <!-- Region -->
          <aws-region v-bind:region="deployParams.region"></aws-region>
          <!-- Pipelines -->
          <pipelines-list :is-show-yaml-in-page="isShowYamlInPage" :is-in-valid="isInValid" :pipeline-groups="pipelineGroups"></pipelines-list>
        </div>
        <div class="panel-right" v-if="isShowYamlInPage" :style="{ flex: '0 1 40%' }">
          <yaml-view
            :is-in-valid="isInValid"
            :pipeline-groups="pipelineGroups"
            :editor-yaml-content="yamlEditorContent"
            :editor-json-content="jsonEditorContent"
          ></yaml-view>
        </div>
      </div>
    </div>
  </div>
  <Drawer v-model:visible="visiblePipelineDescription" header="PipeLine description" position="right" style="width: 50%">
    <MarkdownView :content="pipelineDescription" />
  </Drawer>
  <Drawer v-model:visible="visibleYaml" header="YAML/JSON View" position="right" style="width: 50%" @hide="hideYamlEditor()">
    <yaml-view
      v-if="!isShowYamlInPage"
      :is-in-valid="isInValid"
      :pipeline-groups="pipelineGroups"
      :editor-yaml-content="yamlEditorContent"
      :editor-json-content="jsonEditorContent"
    ></yaml-view>
  </Drawer>
</template>
<script setup lang="ts">
import { ref, watch, computed, onMounted, onBeforeUnmount } from "vue";
import { useRoute } from "vue-router";
import { load } from "js-yaml";
import { toast } from "vue3-toastify";
import _, { isNumber } from "lodash";
import DOMPurify from "dompurify";
import awsAccount from "../components/awsAccount.vue";
import awsRegion from "../components/awsRegion.vue";
import PipelinesList from "../components/pipelinesList.vue";
import menuContentService from "../services/menuContentService";
import Drawer from "primevue/drawer";
import MarkdownView from "@/components/MarkdownView.vue";
import type { PIPELINE, PIPELINE_GROUPS, PIPELINE_OPTION } from "@/types/pipeline";
import { useMainStore } from "@/stores/store";
import type { RES_MENU_CONTENT, RES_PAGE_CONTENT } from "@/types/response";
import YamlView from "@/components/yamlView.vue";
import type { JSON_EDITOR_CONTENT, YAML_EDITOR_CONTENT } from "@/types/props";
import { catchError, distinctUntilChanged, EMPTY, filter, from, fromEvent, interval, startWith, Subscription, switchMap, throttleTime } from "rxjs";
import { map } from "rxjs/operators";
import { OTHER_GROUP_INDEX, OTHER_GROUP_TITLE } from "@/types/global";
import utils, { formatDataType } from "@/utils";

const store = useMainStore();
const route = useRoute();
const lastEtag = ref<string>("");
const isPendingUpdate = ref<boolean>(false);
const reloadPage = () => window.location.reload();
let pollingSub: Subscription | null = null;

// Polling configuration
const POLLING_INTERVAL_MS = 30_000;

const defaultTitle = "Pipelines";
const queryTitle = route.query.title || "";
let subscription: Subscription | null = null;

// reactive data
const visibleYaml = ref(false);
const visiblePipelineDescription = ref(false);
const pipelineDescription = ref("");
const pageTitle = ref(defaultTitle);
const pipelineGroups = ref<PIPELINE_GROUPS[]>([]);

const yamlEditorContent = ref<YAML_EDITOR_CONTENT>({});
const jsonEditorContent = ref<JSON_EDITOR_CONTENT>({});
const enableUnreleasedFeature = ref(false);

utils.getUiProperties().then((properties: Record<string, string>) => {
  enableUnreleasedFeature.value = properties["ENABLE_UNRELEASED_FEATURE"] === "true";
});

// Computed properties
const deployParams = computed(() => store.changedPipelineDeployParams);
const isInValid = computed(() => {
  const hasInvalidGroup = pipelineGroups.value.some((group) => !group.isValid);
  return !deployParams.value.account || hasInvalidGroup || !deployParams.value.pipeline;
});
// When the query parameter title exists in the URL, it means that the pipeline is configured.
// true: the YAML editor is displayed in the Drawer.
// false: the pipeline has not been configured, and the YAML editor is displayed directly on the right.
const alwaysShowYamlInDrawerWidth = 1440;
const alwaysShowYamlInDrawerWithStepWidth = 1800;

// Note: true: show on the right side, false: show in the drawer
const isShowYamlInPage = computed(() => {
  // no stepper: When the query parameter title is empty (Not configured) or there is only one group (Narrower left)
  // stepper: When the query parameter title is exists(Configured) or there are multiple groups (Wider left)
  const showDrawerWidth = queryTitle === "" || pipelineGroups.value.length <= 1 ? alwaysShowYamlInDrawerWidth : alwaysShowYamlInDrawerWithStepWidth;

  return browserWidth.value >= showDrawerWidth;
});
const browserWidth = ref<number>(window.innerWidth);
const updateBrowserWidth = () => {
  browserWidth.value = window.innerWidth;
};

onMounted(() => {
  subscription = fromEvent(window, "resize")
    .pipe(
      throttleTime(200),
      map(() => window.innerWidth),
      distinctUntilChanged()
    )
    .subscribe(() => {
      updateBrowserWidth();
    });
});

onBeforeUnmount(() => {
  subscription?.unsubscribe();
  pollingSub?.unsubscribe();
});

const handleIsShowYamlEditorChange = (newData: boolean) => {
  visibleYaml.value = newData;
};
const hideYamlEditor = () => {
  store.setIsShowingYamlEditor(false);
};
const formatPipelineGroups = (groups: PIPELINE_GROUPS[], options: PIPELINE_OPTION[]) => {
  // When there is no group, do not distinguish the step, do not verify on the step title
  if (!groups || groups.length === 0) {
    groups = [
      {
        title: "",
        description: "",
        index: 1,
        isValid: true,
        options: options
      }
    ];
    return groups;
  }
  groups.forEach((group) => {
    group.isValid = true;
    group.options = options.filter((option) => option.groupIndex === group.index);
  });
  const otherOptions = options.filter((option) => !option.groupIndex);
  // When there is a step, put the options without a group into the Others group
  if (otherOptions.length > 0) {
    groups.push({
      title: OTHER_GROUP_TITLE,
      description: "",
      index: isNumber(groups[0]?.index) ? groups.length + 1 : OTHER_GROUP_INDEX,
      isValid: true,
      options: otherOptions
    });
  }
  return groups;
};
const formatPipelineOptions = (yamlContent: YAML_EDITOR_CONTENT, options: PIPELINE_OPTION[]) => {
  (options || []).forEach((option) => {
    const defaultValue = _.get(yamlContent, option.reference);
    option.value = formatDataType(option.type, defaultValue);
    if (option.description) {
      option.description = DOMPurify.sanitize(option.description, {
        USE_PROFILES: { html: true },
        ADD_ATTR: ["target"]
      });
    }
  });
  return options;
};

const updatePipelineOnPage = (pipelineId: string, pipelineName: string, pipelineContent: string) => {
  menuContentService.getMenuContent().then((menuRes: RES_MENU_CONTENT) => {
    // Must use pipelineId to get the fileName
    let toUrl = `/pipelines/${pipelineId}`;
    if (queryTitle) {
      toUrl += `?title=${queryTitle}`;
    }
    const fileName = menuContentService.findConfigFileFromMenuConfig(toUrl, menuRes.menuConfig);
    pipelineDescription.value = "";

    if (fileName) {
      startPolling(fileName, pipelineId, pipelineContent);
    } else {
      initEditorContent(pipelineContent);
      pageTitle.value = defaultTitle + ": " + pipelineName;
      pipelineGroups.value = [...formatPipelineGroups([], [])];
    }
  });
};

const handlePageContentUpdate = (pageRes: RES_PAGE_CONTENT, pipelineId: string, pipelineContent: string) => {
  let pipelineOptions: PIPELINE_OPTION[] = [];
  // If a defined recipe, update YAML content with a defined recipe at first, below code will use it.
  // Keep below code on top of the following code.
  if (pageRes.recipe || pipelineContent) {
    // Note: update content only, do not pass pipelineId
    initEditorContent(pageRes.recipe || pipelineContent);
  }
  if (route.path.includes(pipelineId) && pageRes.pipelineName) {
    pageTitle.value = defaultTitle + ": " + pageRes.pipelineName;
  }
  if (pageRes.description) {
    pipelineDescription.value = pageRes.description;
  }
  if (pageRes.options && pageRes.options.length > 0) {
    const visibleOptions = enableUnreleasedFeature.value
      ? pageRes.options.filter((opt: PIPELINE_OPTION) => !opt.unreleasedFeature)
      : pageRes.options;
    pipelineOptions = [...formatPipelineOptions(jsonEditorContent.value, visibleOptions)];
    store.setOriginalOptionsContent(pipelineOptions);
  }
  // Note: cannot move below code to above code, because it needs to use pipelineOptions
  pipelineGroups.value = [...formatPipelineGroups(pageRes.groups || [], pipelineOptions)];
  validateYAMLContent();
};

const startPolling = (fileName: string, pipelineId: string, pipelineContent: string) => {
  pollingSub = interval(POLLING_INTERVAL_MS)
    .pipe(
      // Trigger the first emission immediately
      startWith(0),
      // On each tick, send a request and automatically cancel the previous unfinished one
      switchMap(() =>
        from(menuContentService.getPageContent(fileName, lastEtag.value)).pipe(
          catchError((err) => {
            console.warn("Polling error - continuing to poll:", err.message || err);
            return EMPTY;
          })
        )
      ),
      filter((res) => res.headers?.etag !== lastEtag.value)
    )
    .subscribe((res) => {
      if (lastEtag.value === "") {
        // First time fetching content
        handlePageContentUpdate(res.data, pipelineId, pipelineContent);
      } else {
        isPendingUpdate.value = true;
      }
      lastEtag.value = res.headers?.etag || "";
    });
};

// Handle the change of the Pipeline option
const onPipelineOptionChange = (pipelineOption: PIPELINE_OPTION) => {
  if (pipelineOption.reference) {
    const currentValue = formatDataType(pipelineOption.type, pipelineOption.value);
    const tempYamlContent = _.cloneDeep(yamlEditorContent.value);
    _.set(tempYamlContent, pipelineOption.reference, currentValue);
    store.setYamlEditorContent(tempYamlContent);
    validateYAMLContent();
  }
};

// Handle the change of the YAML editor
const onYamlEditorChange = (content: YAML_EDITOR_CONTENT) => {
  pipelineGroups.value = pipelineGroups.value.map((group) => {
    group.options = formatPipelineOptions(content, group.options);
    return group;
  });
  validateYAMLContent();
};

const validateNote = (str: string) => {
  // Check the format directly through the regular expression, and ensure that the string length does not exceed 30
  if (str.length > 30) {
    return false;
  }
  return /^(([A-Za-z0-9][-A-Za-z0-9_.]*)?[A-Za-z0-9])?$/.test(str);
};

// Update content editor
const initEditorContent = (content: string) => {
  const contentYAML = load(content) || {};
  store.setYamlEditorContent(contentYAML);
  store.setOriginalRecipeContent(contentYAML);
};

// Validate YAML content
const validateYAMLContent = () => {
  // the key of below object is the type of the input field
  // see type of guiType code in docs: provisioner-webui/docs/README.md
  const validators: Record<string, (value: unknown) => boolean> = {
    password: (value) => value !== "",
    string: (value) => value !== "",
    number: _.isNumber,
    boolean: _.isBoolean,
    array: (value) => _.isArray(value) && value.length > 0
  };
  let isValid = true;
  pipelineGroups.value.forEach((group) => {
    for (const option of group.options) {
      if (option.required) {
        isValid = validators[option.type](option.value);
        group.isValid = isValid;
        if (!isValid) break;
      }
    }
  });
  const guiEnvNote = yamlEditorContent.value?.meta?.guiEnv?.note || "";
  toast.clearAll();
  if (!validateNote(guiEnvNote)) {
    toast.error(
      "Invalid note. meta.guiEnv.note: `" +
        guiEnvNote +
        "`<br/>" +
        "1. It should be a string and the length should not exceed 30 characters.<br/>" +
        "2. Must match the regular expression `^(([A-Za-z0-9][-A-Za-z0-9_.]*)?[A-Za-z0-9])?$`."
    );
    isValid = false;
  }
  return isValid;
};

watch(
  () => store.isShowingYamlEditor,
  (newValue) => {
    handleIsShowYamlEditorChange(newValue);
  }
);

watch(
  () => store.changedPipelineOptionField.value || store.changedPipelineOptionField.values,
  (newValue) => {
    onPipelineOptionChange(store.changedPipelineOptionField);
  },
  { deep: true }
);

watch(
  () => store.yamlEditorContent,
  (newValue) => {
    onYamlEditorChange(newValue);
    yamlEditorContent.value = newValue;
    jsonEditorContent.value = newValue;
  },
  { deep: true }
);

watch(
  () => store.selectedPipeline,
  (newValue: PIPELINE) => {
    if (newValue) {
      const pipelineId = newValue.id;
      const pipelineName = newValue.name;
      const pipelineContent = newValue.defaultValue;
      store.setSelectedPipelineId(pipelineId);
      updatePipelineOnPage(pipelineId, pipelineName, pipelineContent);
    }
  },
  { deep: true }
);
watch(
  () => isShowYamlInPage.value,
  (newValue) => {
    if (newValue) {
      hideYamlEditor();
    }
  }
);
</script>
<style lang="less" scoped>
.pv-pipeline-view {
  h2 {
    display: flex;
    align-items: center;
    gap: 0.625rem;

    .pipeline-desc-btn {
      background: none;
      border: none;
      cursor: pointer;
      color: var(--primary-color);
      font-size: 1rem;
      padding: 4px 8px;
      border-radius: var(--radius-sm);
      display: inline-flex;
      align-items: center;

      &:hover {
        background: var(--primary-light);
      }
    }
  }

  .pipeline-view-content {
    padding: 12px;

    &.pipeline-view-grouped {
      padding: 12px;
    }
  }
  .page-update-warning {
    background-color: var(--warning-light);
    color: var(--warning-dark);
    border: 1px solid var(--warning-color);
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    margin-bottom: 12px;
    font-size: 0.8125rem;
    text-align: center;
  }
}

.pipeline-splitter {
  display: flex;
  gap: 12px;

  .panel-left {
    min-width: 0;
  }

  .panel-right {
    min-width: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding-left: 12px;
    border-left: 1px solid var(--border-color);
  }
}
</style>
