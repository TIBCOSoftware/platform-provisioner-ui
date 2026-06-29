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
  <div id="pipeline-list">
    <span class="pv-error" v-if="loaded && pipelineList.length === 0">No pipelines found. </span>
    <div class="pipeline-field-container pv-field-horizontal" v-if="pipelineList.length > 0">
      <div class="label-title">Pipelines</div>
      <div class="pipeline-field">
        <Select v-if="pipelineList.length > 1" :modelValue="selectedPipelineId" :options="pipelineSelectOptions" optionLabel="label" optionValue="value" @change="(e: any) => onPipelineChange(e.value)" class="pipeline-select" />
        <div class="pipelines" v-if="pipelineList.length === 1">
          <InputText disabled :modelValue="pipelineList[0].name + ' [' + pipelineList[0].id + ']'" class="w-full" />
        </div>
        <div class="pipelines" v-if="pipelineList.length < 1">
          <span class="pv-error">No pipelines found.</span>
        </div>
        <Button severity="info" @click="showPipelineDescription">
          <i class="bi bi-card-text" />
          Description
        </Button>
        <Button severity="info" v-if="!isShowYamlInPage" @click="showYamlEditor()">
          <i class="bi bi-filetype-yml" />
          Preview YAML
        </Button>
      </div>
    </div>

    <pipelines-options :is-show-yaml-in-page="isShowYamlInPage" :is-in-valid="isInValid" :pipeline-groups="pipelineGroups"></pipelines-options>
  </div>
  <Drawer
    v-model:visible="visiblePipelineDescription"
    :style="{ width: isShowYamlInPage ? 'calc(50vw)' : '50%' }"
    :position="drawerPosition as 'left' | 'right'"
    :blockScroll="true"
    :class="{ 'modal-mask-with-yaml': isShowYamlInPage }"
    class="pipeline-description"
    :header="selectedPipelineName"
  >
    <div class="description markdown-content" v-if="pipelineDescription">
      <MarkdownView :content="pipelineDescription" />
    </div>
  </Drawer>
</template>

<script setup lang="ts">
import Drawer from "primevue/drawer";
import Button from "primevue/button";
import Select from "primevue/select";
import InputText from "primevue/inputtext";
import { onMounted, ref, computed } from "vue";
import utils from "@/utils";
import _ from "lodash";
import MarkdownView from "@/components/MarkdownView.vue";
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
const loaded = ref(false);
const pipelineDescription = ref("");
const visiblePipelineDescription = ref(false);
const selectedPipelineName = ref("");
const selectedPipelineId = ref<string | null>(null);

const pipelineSelectOptions = computed(() =>
  pipelineList.value.map((opt) => ({
    label: opt.name + " [" + opt.id + "]" + formatVersion(opt.pipelineRun.apiVersion),
    value: opt.id
  }))
);

// for Drawer
const drawerPosition = ref("right");

const showYamlEditor = () => {
  store.setIsShowingYamlEditor(true);
};

const showPipelineDescription = () => {
  visiblePipelineDescription.value = true;
  drawerPosition.value = props.isShowYamlInPage ? "left" : "right";
};

// Get pipelines data
const getPipelines = () => {
  utils.httpGet("/cic2-ws/v1/pipelines").then(
    (pipelines: PIPELINES) => {
      loaded.value = true;
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
    },
    () => {
      loaded.value = true;
    }
  );
};

onMounted(() => {
  getPipelines();
});
// Handle pipeline change
const emitPipelineChange = (pipeline: PIPELINE) => {
  pipelineDescription.value = pipeline.description || "";
  selectedPipelineName.value = pipeline.name || "";
  selectedPipelineId.value = pipeline.id;
  store.setSelectedPipeline(pipeline);
};

// Handle option change
const onPipelineChange = (value: string) => {
  const selectedPipeline = _.find(pipelineList.value, (option) => option.id === value);
  if (!selectedPipeline) {
    return;
  }
  emitPipelineChange(selectedPipeline);

  const newUrl = `/pipelines/${value}`;
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
    align-items: center;
    gap: 0.75rem;
    justify-content: space-between;

    .pipeline-select,
    .pipelines {
      display: flex;
      flex: 1;
    }

    button {
      margin-left: 8px;
      white-space: nowrap;
    }

  }
}

.pipeline-description {
  :deep(.p-drawer-content) {
    display: flex;
    flex-direction: column;
  }

  .description {
    flex: 1;
    border: 1px solid var(--border-color);
    padding: 16px;
    border-radius: var(--radius-md);
    background: var(--bg-primary);
    display: flex;
    flex-direction: column;
    min-height: 100%;

    :deep(.markdown-body) {
      flex: 1;
    }

    :deep(pre) {
      background: var(--code-bg-dark);
      color: var(--code-text-light);
      margin: 12px 0;
    }
  }
}
</style>
