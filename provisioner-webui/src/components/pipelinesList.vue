<!--
  - Copyright © 2025. Cloud Software Group, Inc.
  - This file is subject to the license terms contained
  - in the license file that is distributed with this file.
  -->

<template>
  <div id="pipeline-list">
    <span class="pv-error" v-if="pipelineList.length === 0">No pipelines found. </span>
    <div class="pipeline-field-container pv-field-horizontal" v-if="pipelineList.length > 0">
      <div class="label-title">Pipelines</div>
      <div class="pipeline-field">
        <select class="form-select" v-if="pipelineList.length > 1" @change="onPipelineChange($event)">
          <option v-bind:value="opt.id" v-for="opt in pipelineList" v-bind:key="opt.id">
            {{ opt.name + " [" + opt.id + "]" + formatVersion(opt.pipelineRun.apiVersion) }}
          </option>
        </select>
        <div class="pipelines" v-if="pipelineList.length === 1">
          <input type="text" disabled :value="pipelineList[0].name + ' [' + pipelineList[0].id + ']'" />
        </div>
        <div class="pipelines" v-if="pipelineList.length < 1">
          <span class="pv-error">No pipelines found.</span>
        </div>
        <Button label="Description" severity="info" icon="bi bi-card-text" @click="showPipelineDescription" />
        <Button label="Preview YAML" severity="info" icon="bi bi-filetype-yml"
                v-if="!isShowYamlInPage" @click="showYamlEditor()" />
      </div>
    </div>

    <pipelines-options :is-show-yaml-in-page="isShowYamlInPage" :is-in-valid="isInValid" :pipeline-groups="pipelineGroups"></pipelines-options>

  </div>
  <Drawer
    v-model:visible="visiblePipelineDescription"
    :header="selectedPipelineName"
    :blockScroll="true"
    :position="drawerPosition"
    :pt="{ mask: isShowYamlInPage ? { class: 'modal-mask-with-yaml' } : {} }"
    class="pipeline-description">
    <div class="description" v-if="pipelineDescription">
      <VMarkdownView :content="pipelineDescription"></VMarkdownView>
    </div>
  </Drawer>
</template>

<script setup lang="ts">
import Drawer from "primevue/drawer";
import Button from "primevue/button";
import { onMounted, ref } from "vue";
import utils from "@/utils";
import _ from "lodash";
import { VMarkdownView } from "vue3-markdown";
import PipelinesOptions from "./pipelinesOptions.vue";
import type { PIPELINE, PIPELINES } from "@/types/pipeline";
import { useMainStore } from "@/stores/store";
import { useRoute, useRouter } from "vue-router";
import type { PIPELINE_LIST_PROP_TYPES } from "@/types/props";

const store = useMainStore();
const router = useRouter();
const route = useRoute();

// Define props
const props = defineProps<PIPELINE_LIST_PROP_TYPES>();

// reactive data
const pipelineList = ref<PIPELINE[]>([]);
const pipelineDescription = ref("");
const visiblePipelineDescription = ref(false);
const selectedPipelineName = ref("");

// for Drawer
const drawerPosition = ref('right');

const showYamlEditor = () => {
  store.setIsShowingYamlEditor(true);
};

const showPipelineDescription = () => {
  visiblePipelineDescription.value = true;
  drawerPosition.value = props.isShowYamlInPage ? 'left' : 'right';
};

// Get pipelines data
const getPipelines = () => {
  utils.httpGet("/cic2-ws/v1/pipelines").then((pipelines: PIPELINES) => {
    if (_.isEmpty(pipelines)) {
      console.error("No pipelines found");
      return;
    }

    pipelineList.value = _(pipelines)
      .mapValues((value, id: string) => _.merge({}, value, { id }))
      .values()
      .value();

    let defaultPipeline = pipelineList.value[0];
    const paramPipelineName = route.params.name;
    if (paramPipelineName) {
      const matchedPipeline = pipelineList.value.find((pipe) => pipe.id === paramPipelineName);
      if (matchedPipeline) {
        defaultPipeline = matchedPipeline;
        pipelineList.value = [matchedPipeline];
      }
    }

    emitPipelineChange(defaultPipeline);
  });
};

onMounted(() => {
  getPipelines();
});
// Handle pipeline change
const emitPipelineChange = (pipeline: PIPELINE) => {
  pipelineDescription.value = pipeline.description || "";
  selectedPipelineName.value = pipeline.name || "";
  store.setSelectedPipeline(pipeline);
};

// Handle option change
const onPipelineChange = (event: Event) => {
  const selectedPipelineId = (event.target as HTMLInputElement).value;
  const selectedPipeline = _.find(pipelineList.value, (option) => option.id === selectedPipelineId);
  if (!selectedPipeline) {
    return;
  }
  emitPipelineChange(selectedPipeline);

  const newUrl = `/pipelines/${selectedPipelineId}`;
  window.history.replaceState({ path: newUrl }, "", newUrl);

  // Manually update the internal state of the router to synchronize route.path
  router.currentRoute.value.path = newUrl;
};

const formatVersion = (apiVersion: string) => {
  return " " + apiVersion.replace("tekton.dev/", "");
};
</script>
<style lang="less" scoped>
#pipeline-list {
  .pipeline-field {
    display: flex;
    justify-content: space-between;
    align-items: center;
    .form-select,
    .pipelines {
      display: flex;
      flex: 1;
    }
    button {
      margin-left: 15px;
    }
  }
  .pipelines {
    input {
      border: 1px solid #d1d1d1;
      padding: 6px 12px;
      border-radius: 4px;
      background-color: #f5f5f5;
      width: 100%;
    }
  }
}
.pipeline-description {
  .description {
    border: 1px solid #ece8e8;
    padding: 11px;
    :deep(pre) {
      code {
        background: unset;
        color: unset;
        font-family: unset;
        font-size: 0.875rem;
        text-shadow: unset;
        &::selection {
          background: #adccf2;
        }
      }
    }
  }
}
</style>
