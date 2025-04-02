<!--
  - Copyright © 2025. Cloud Software Group, Inc.
  - This file is subject to the license terms contained
  - in the license file that is distributed with this file.
  -->

<template>
  <div class="pv-pipeline-view">
    <h2>{{ pageTitle }} <i v-if="pipelineDescription" class="bi bi-card-text" @click="visiblePipelineDescription = true" /></h2>
    <div class="pipeline-view-content" :class="{'pipeline-view-grouped': pipelineGroups.length > 1}">
      <Splitter>
        <SplitterPanel size="60" class="panel-left">
          <!-- Account -->
          <aws-account v-bind:account="deployParams.account"></aws-account>
          <!-- Region -->
          <aws-region v-bind:region="deployParams.region"></aws-region>
          <!-- Pipelines -->
          <pipelines-list :is-show-yaml-in-page="isShowYamlInPage" :is-in-valid="isInValid" :pipeline-groups="pipelineGroups"></pipelines-list>
        </SplitterPanel>
        <SplitterPanel size="40" class="panel-right" v-if="isShowYamlInPage">
          <yaml-view :is-in-valid="isInValid"
                     :pipeline-groups="pipelineGroups"
                     :editor-yaml-content="yamlEditorContent" :editor-json-content="jsonEditorContent"></yaml-view>
        </SplitterPanel>
      </Splitter>
    </div>
  </div>
  <Drawer v-model:visible="visiblePipelineDescription" header="PipeLine description" :blockScroll="true" position="right">
    <VMarkdownView :content="pipelineDescription"></VMarkdownView>
  </Drawer>
  <Drawer v-model:visible="visibleYaml" header="YAML/JSON View" :blockScroll="true" position="right" @hide="hideYamlEditor()">
    <yaml-view v-if="!isShowYamlInPage"
               :is-in-valid="isInValid"
               :pipeline-groups="pipelineGroups"
               :editor-yaml-content="yamlEditorContent" :editor-json-content="jsonEditorContent"></yaml-view>
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
import Splitter from 'primevue/splitter';
import SplitterPanel from 'primevue/splitterpanel';
import { VMarkdownView } from "vue3-markdown";
import type { PIPELINE, PIPELINE_GROUPS, PIPELINE_OPTION } from "@/types/pipeline";
import { useMainStore } from "@/stores/store";
import type { RES_MENU_CONTENT, RES_PAGE_CONTENT } from "@/types/response";
import YamlView from "@/components/yamlView.vue";
import type { JSON_EDITOR_CONTENT, YAML_EDITOR_CONTENT } from "@/types/props";
import { distinctUntilChanged, fromEvent, Subscription, throttleTime } from "rxjs";
import { map } from "rxjs/operators";
import { OTHER_GROUP_INDEX, OTHER_GROUP_TITLE } from "@/types/global";

const store = useMainStore();
const route = useRoute();

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
  const showDrawerWidth = (queryTitle === "" || pipelineGroups.value.length <= 1)
    ? alwaysShowYamlInDrawerWidth
    : alwaysShowYamlInDrawerWithStepWidth;

  return browserWidth.value >= showDrawerWidth;
});
const browserWidth = ref<number>(window.innerWidth);
const updateBrowserWidth = () => {
  browserWidth.value = window.innerWidth;
};

onMounted(() => {
  subscription = fromEvent(window, 'resize')
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
});

const handleIsShowYamlEditorChange = (newData: boolean) => {
  visibleYaml.value = newData;
};
const hideYamlEditor = () => {
  store.setIsShowingYamlEditor(false);
};
const formatDataType = (dataType: string, value: any) => {
  let newValue = value;
  if (dataType.toLowerCase() === "boolean") {
    const stringValue = String(value).toLowerCase();
    newValue = stringValue === "true" ? true : stringValue === "false" ? false : value;
  } else if (dataType.toLowerCase() === "string") {
    newValue = value === undefined ? "" : value.toString();
  } else if (dataType.toLowerCase() === "number") {
    newValue = isNaN(parseInt(value, 10)) ? 0 : parseInt(value, 10);
  } else if (dataType.toLowerCase() === "array") {
    newValue = newValue || [];
  }
  return newValue;
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
  /* do not need to sort the groups by index
  groups = groups.sort((a, b) => {
    // Convert index to number if it's numeric, otherwise keep it as a string
    const aIndex = isNaN(a.index) ? a.index : Number(a.index);
    const bIndex = isNaN(b.index) ? b.index : Number(b.index);

    // If both are numbers, sort numerically
    if (!isNaN(aIndex) && !isNaN(bIndex)) {
      return aIndex - bIndex;
    }

    // If both are strings, sort alphabetically
    if (isNaN(aIndex) && isNaN(bIndex)) {
      return String(aIndex).localeCompare(String(bIndex));
    }

    // If one is a number and the other is a string, prioritize numbers
    return !isNaN(aIndex) ? -1 : 1;
  });
  */
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
    let pipelineOptions: PIPELINE_OPTION[] = [];
    pipelineDescription.value = "";

    if (fileName) {
      menuContentService.getPageContent(fileName).then((pageRes: RES_PAGE_CONTENT) => {
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
          pipelineOptions = [...formatPipelineOptions(jsonEditorContent.value, pageRes.options)];
        }
        // Note: cannot move below code to above code, because it needs to use pipelineOptions
        pipelineGroups.value = [...formatPipelineGroups(pageRes.groups || [], pipelineOptions)];
        validateYAMLContent();
      });
    } else {
      initEditorContent(pipelineContent);
      pageTitle.value = defaultTitle + ": " + pipelineName;
      pipelineGroups.value = [...formatPipelineGroups([], pipelineOptions)];
    }
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
    i {
      margin-left: 10px;
      color: #b5b6b6;
      font-size: 1.125rem;
      cursor: pointer;
    }
  }
}
.p-splitter {
  border: 0;
  .p-splitterpanel {
    min-width: var(--yaml-editor-width);
  }
  .panel-left {
    padding-right: 10px
  }
  .panel-right {
    padding-left: 10px
  }

}

</style>
