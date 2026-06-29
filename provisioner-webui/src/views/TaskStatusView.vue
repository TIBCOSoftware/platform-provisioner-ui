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
  <div class="pv-status-view">
    <div
      class="action-btn-group"
    >
      <div>
        <aws-account v-bind:account="params.account"></aws-account>
      </div>
      <div>
        <Button severity="info" :disabled="isAccountEmpty" @click="onSubmit">
          <i class="bi bi-funnel" />
          Filter
        </Button>
      </div>
      <div v-if="isCleanUpAvailable">
        <Button severity="danger" :disabled="!isCleanUpEnabled" @click="cleanUp">
          <i class="bi bi-trash" />
          Clean Up Finished Pipelines
        </Button>
      </div>
    </div>

    <div class="accordion" id="tasks-status">
      <div class="table-toolbar">
        <h3 class="section-title">Pipeline Runs</h3>
        <MultiSelect
          v-model="selectedColumnFields"
          :options="toggleableColumns.map((col) => ({ label: col.header, value: col.field }))"
          optionLabel="label"
          optionValue="value"
          placeholder="Toggle Columns"
          style="min-width: 280px; max-width: 480px"
        >
          <template #header>
            <label class="select-all-header">
              <Checkbox :modelValue="isAllColumnsSelected" :binary="true" @update:modelValue="toggleAllColumns" />
              <span>Select All</span>
            </label>
          </template>
        </MultiSelect>
      </div>
      <DataTable
        :value="items"
        :loading="isFiltering"
        :stripedRows="true"
        :rowHover="true"
        v-model:expandedRows="expandedRows"
        :paginator="true"
        :rows="pageSize"
        :rowsPerPageOptions="[10, 20, 50]"
        dataKey="metadata.name"
        @rowExpand="onRowExpand"
        @rowCollapse="onRowCollapse"
      >
        <Column expander style="width: 3rem" />
        <Column header="Status" field="status">
          <template #body="{ data }">
            <Tag v-if="isStatusSucceed(data.showStatus)" :value="data.showStatus.conditions[0].reason" severity="success" rounded />
            <Tag
              v-else-if="isStatusFailed(data.showStatus)"
              :value="data.showStatus.conditions[0].reason"
              :severity="data.showStatus.conditions[0].reason === 'Cancelled' ? 'secondary' : data.showStatus.conditions[0].reason === 'PipelineRunTimeout' ? 'warn' : 'danger'"
              rounded
            />
            <div v-else-if="isStatusPending(data.showStatus)" class="is-loading">
              <i class="bi bi-arrow-repeat spin-icon"></i>
              <span>{{ data.showStatus.conditions[0].reason }}...</span>
            </div>
          </template>
        </Column>
        <Column header="Name" field="info.name">
          <template #body="{ data }">{{ data.info?.name || '' }}</template>
        </Column>
        <Column v-if="isColumnVisible('info.note')" header="Note" field="info.note">
          <template #body="{ data }">{{ data.info?.note || '' }}</template>
        </Column>
        <Column v-if="isColumnVisible('info.account')" header="Account" field="info.account">
          <template #body="{ data }">{{ data.info?.account || '' }}</template>
        </Column>
        <Column v-if="isColumnVisible('info.region')" header="Region" field="info.region">
          <template #body="{ data }">{{ data.info?.region || '' }}</template>
        </Column>
        <Column header="User" field="user">
          <template #body="{ data }">{{ data.metadata?.labels?.[`${PIPELINE_TEMPLATE_LABEL_KEY_CREATE_BY}`] || '' }}</template>
        </Column>
        <Column v-if="isColumnVisible('info.created')" header="Created" field="info.created">
          <template #body="{ data }">{{ data.info?.created || '' }}</template>
        </Column>
        <Column v-if="isColumnVisible('info.duration')" header="Duration" field="info.duration">
          <template #body="{ data }">{{ data.info?.duration || '' }}</template>
        </Column>
        <Column header="Actions" field="actions">
          <template #body="{ data }">
            <Button v-if="isStatusPending(data.showStatus)" severity="danger" size="small" @click="stopPipeline(data.info.name)">Stop</Button>
          </template>
        </Column>
        <template #expansion="slotProps">
          <div v-if="expandingRows[slotProps.data.metadata.name]" class="is-expanding">
            <i class="bi bi-arrow-repeat spin-icon"></i>
            Expanding...
          </div>
          <div v-else class="card-body">
            <div class="row">
              <!-- Tasks List -->
              <div class="col-3">
                <div v-if="slotProps.data.status['taskRuns']" class="task-list">
                  <template v-for="(taskRun, taskIndex) in slotProps.data.status['taskRuns']" :key="taskRun.id">
                    <div
                      class="pipeline-task-name"
                      :class="{
                        active: getActiveTab(slotProps.data.metadata.name) === taskRun.id,
                        'child-active': isChildStepActive(slotProps.data.metadata.name, taskRun.id, taskRun.status.steps)
                      }"
                      @click="setActiveTab(slotProps.data.metadata.name, taskRun.id)"
                    >
                      <span>{{ taskRun.pipelineTaskName }}</span>
                      <Tag v-if="isStatusSucceed(taskRun.status)" :value="taskRun.status.conditions[0].reason" severity="success" size="small" rounded />
                      <Tag
                        v-else-if="isStatusFailed(taskRun.status)"
                        :value="taskRun.status.conditions[0].reason"
                        :severity="taskRun.status.conditions[0].reason === 'TaskRunCancelled' ? 'secondary' : taskRun.status.conditions[0].reason === 'TaskRunTimeout' ? 'warn' : 'danger'"
                        size="small"
                        rounded
                      />
                      <span v-else-if="isStatusPending(taskRun.status)" class="is-loading">
                        <i class="bi bi-arrow-repeat spin-icon"></i>
                        <span>{{ getTaskStatusPendingReason(taskRun.status) }}...</span>
                      </span>
                    </div>
                    <div
                      v-for="step in (taskRun.status.steps || [])"
                      :key="`${taskRun.id}-${step.container}`"
                      class="pipeline-task-step"
                      :class="{ active: getActiveTab(slotProps.data.metadata.name) === `${taskRun.id}-${step.container}` }"
                      @click="setActiveTab(slotProps.data.metadata.name, `${taskRun.id}-${step.container}`); loopPodLog(taskRun.status.podName, step.container, slotProps.data.metadata.name, taskIndex as number)"
                    >
                      <span><Tag value="Log" severity="secondary" size="small" />{{ step.container }}</span>
                      <button
                        type="button"
                        class="open-log-btn bi bi-box-arrow-up-right"
                        @click.stop="openLogInNewTab(taskRun.status.podName, step.container)"
                        :aria-label="`Open full log in new tab`"
                        title="Open full log in new tab"
                      ></button>
                    </div>
                  </template>
                </div>
                <div v-else class="task-list">
                  <div
                    class="pipeline-task-name active"
                    @click="setActiveTab(slotProps.data.metadata.name, `error-${slotProps.data.info.name}`)"
                  >Error</div>
                </div>
              </div>
              <!-- Tasks Details -->
              <div class="col-9">
                <div v-if="slotProps.data.status['taskRuns']" class="tab-content">
                  <template v-for="(taskRun, taskIndex) in slotProps.data.status['taskRuns']" :key="taskRun.id">
                    <div v-show="getActiveTab(slotProps.data.metadata.name) === taskRun.id" class="code-block">
                      <div class="code-block-view">
                        <label>Status</label>
                        <VueJsonPretty :data="(slotProps.data.showTaskStatus[taskRun.id] as any)" :deep="3" :showLength="true" />
                      </div>
                      <div v-for="result in (taskRun.status.taskResults || [])" :key="result.name" class="code-block-view">
                        <label>{{ result.name }}</label>
                        <VCodeBlock :prismjs="true" lang="log" theme="tomorrow" :code="result.value" />
                      </div>
                    </div>
                    <div
                      v-for="step in (taskRun.status.steps || [])"
                      :key="`${taskRun.id}-${step.container}`"
                      v-show="getActiveTab(slotProps.data.metadata.name) === `${taskRun.id}-${step.container}`"
                      class="code-block"
                    >
                      <div v-if="!logs[getActiveIndex(taskRun.status.podName, step.container)]" class="is-loading" role="status">
                        <i class="bi bi-arrow-repeat spin-icon"></i>
                        <span>Loading...</span>
                      </div>
                      <div class="code-block-view">
                        <label>Logs</label>
                        <div v-if="truncatedLogs[getActiveIndex(taskRun.status.podName, step.container)]" class="log-truncated-banner">
                          <i class="bi bi-exclamation-triangle"></i>
                          <span>Showing last {{ LOG_TAIL_LINES }} lines.
                            <button
                              type="button"
                              class="open-log-link"
                              @click="openLogInNewTab(taskRun.status.podName, step.container)"
                              title="Open full log in new tab"
                            >View full log <i class="bi bi-box-arrow-up-right"></i></button>
                          </span>
                        </div>
                        <VCodeBlock
                          v-if="logs[getActiveIndex(taskRun.status.podName, step.container)]"
                          :prismjs="true"
                          lang="log"
                          theme="tomorrow"
                          :code="logs[getActiveIndex(taskRun.status.podName, step.container)]"
                        />
                      </div>
                    </div>
                  </template>
                </div>
                <div v-else class="tab-content">
                  <div class="code-block">
                    <div class="code-block-view">
                      <label>Status</label>
                      <VueJsonPretty :data="(slotProps.data.status as any)" :deep="3" :showLength="true" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </DataTable>
    </div>
  </div>
</template>

<script setup lang="ts">
import awsAccount from "../components/awsAccount.vue";

import utils from "../utils";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import duration from "dayjs/plugin/duration";
dayjs.extend(relativeTime);
dayjs.extend(duration);
import Button from "primevue/button";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import MultiSelect from "primevue/multiselect";
import Checkbox from "primevue/checkbox";
import Tag from "primevue/tag";
import VCodeBlock from "@wdns/vue-code-block";
import VueJsonPretty from "vue-json-pretty";
import "vue-json-pretty/lib/styles.css";
import "prismjs";
import "prismjs/components/prism-markup-templating";
import "prismjs/components/prism-log";
import { forkJoin, from, Subscription, timer } from "rxjs";
import { ref, reactive, onMounted, computed, watch, onBeforeUnmount } from "vue";
import { map } from "rxjs/operators";
import { useRoute } from "vue-router";
import { toast } from "vue3-toastify";
import type { PIPELINE_BASE_STATUS, PIPELINE_RUN, TASK_RUN } from "@/types/pipeline";
import { useMainStore } from "@/stores/store";
import axios from "axios";

const STATUS_QUERY_INTERVAL = 20 * 1000;
const LOG_QUERY_INTERVAL = 5 * 1000;
const LOG_TAIL_LINES = 2000;
const subscriptions: Subscription[] = [];
// AbortController for cancelling in-flight pipeline/taskrun HTTP requests when Filter is clicked.
let filterAbortController = new AbortController();

const store = useMainStore();
const route = useRoute();

const params = reactive({
  account: (route.query.account || "") as string,
  action: (route.query.action || "all") as string
});
const fetchingLogs = reactive<{ [key: string]: AbortController }>({});
const pollingPipelines = reactive<{ [key: string]: boolean }>({});
const expandingRows = reactive<{ [key: string]: boolean }>({});
const expandedRowMap = reactive<{ [key: string]: boolean }>({});
const truncatedLogs = reactive<{ [key: string]: boolean }>({});

const items = ref<PIPELINE_RUN[]>([]);
const isFiltering = ref(false);
const expandedRows = ref<PIPELINE_RUN[]>([]);
const logs = ref<{ [key: string]: string }>({});
const isAccountEmpty = ref(!route.query.account);
const isCleanUpAvailable = ref(false);
const PIPELINE_TEMPLATE_LABEL_KEY_ACCOUNT = ref("");
const PIPELINE_TEMPLATE_LABEL_KEY_ACTION = ref("");
const PIPELINE_TEMPLATE_LABEL_KEY_CREATE_BY = ref("");
const PIPELINE_TEMPLATE_LABEL_KEY_NOTE = ref("");
const pageSize = ref(10);

const toggleableColumns = ref([
  { field: "info.note", header: "Note", visible: true },
  { field: "info.account", header: "Account", visible: false },
  { field: "info.region", header: "Region", visible: true },
  { field: "info.created", header: "Created", visible: true },
  { field: "info.duration", header: "Duration", visible: true }
]);
const COLUMN_STORAGE_KEY = "task-status-selected-columns";
const selectedColumnFields = ref<string[]>(
  (() => {
    const saved = localStorage.getItem(COLUMN_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
    return toggleableColumns.value.filter((col) => col.visible).map((col) => col.field);
  })()
);

const isCleanUpEnabled = computed(() => {
  return items.value.some((item) => item.finished);
});

const isAllColumnsSelected = computed(() => {
  return selectedColumnFields.value.length === toggleableColumns.value.length;
});

const toggleAllColumns = (checked: boolean) => {
  selectedColumnFields.value = checked
    ? toggleableColumns.value.map((col) => col.field)
    : [];
};

const isColumnVisible = (field: string) => {
  return selectedColumnFields.value.includes(field);
};

watch(
  selectedColumnFields,
  (cols) => {
    localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(cols));
  },
  { deep: true }
);

// Reactive tab state per expanded row (keyed by pipeline name)
const activeExpandTab = reactive<{ [pipelineName: string]: string }>({});

const getActiveTab = (pipelineName: string): string => {
  return activeExpandTab[pipelineName] || "";
};

const setActiveTab = (pipelineName: string, tabId: string) => {
  activeExpandTab[pipelineName] = tabId;
};

const isChildStepActive = (pipelineName: string, taskRunId: string, steps: any[]): boolean => {
  const current = getActiveTab(pipelineName);
  if (!current || !steps) return false;
  return steps.some(step => current === `${taskRunId}-${step.container}`);
};

const onRowExpand = (event: any) => {
  const data = event.data as PIPELINE_RUN;
  expandedRowMap[data.metadata.name] = true;
  if (expandingRows[data.metadata.name] === undefined) {
    expandingRows[data.metadata.name] = true;
  }
  // Set default active tab for error case (no taskRuns)
  if (!data.status.childReferences) {
    activeExpandTab[data.metadata.name] = `error-${data.info?.name || data.metadata.name}`;
  }
  subscriptions.push(loopTaskRuns(data.metadata.name));
  // Start pipeline status polling when row is expanded
  if (isStatusPending(data.status)) {
    loopPipelineById(data.metadata.name);
  }
};

const onRowCollapse = (event: any) => {
  const data = event.data as PIPELINE_RUN;
  const pipelineName = data.metadata.name;
  expandedRowMap[pipelineName] = false;
  delete activeExpandTab[pipelineName];
  data.status?.taskRuns?.forEach((taskRun: TASK_RUN) => {
    taskRun.status.steps?.forEach(step => {
      const activeIndex = getActiveIndex(taskRun.status.podName, step.container);
      fetchingLogs[activeIndex]?.abort();
      delete fetchingLogs[activeIndex];
      delete logs.value[activeIndex];
      delete truncatedLogs[activeIndex];
    });
  });
};

const processItem = (_item: PIPELINE_RUN) => {
  const item = { ..._item };
  item.info = {
    name: item.metadata.name,
    pipeline: item.metadata.labels["tekton.dev/pipeline"],
    note: item.metadata.labels[`${PIPELINE_TEMPLATE_LABEL_KEY_NOTE.value}`],
    namespace: item.metadata.namespace,
    account: item.status.pipelineSpec.tasks[0].params.find((param: any) => param.name === "awsAccount")?.value || "",
    region: item.status.pipelineSpec.tasks[0].params.find((param: any) => param.name === "awsRegion")?.value || "",
    created: dayjs(item.metadata.creationTimestamp).fromNow(),
    duration: dayjs.duration(dayjs(item.status.completionTime).diff(dayjs(item.status.startTime))).humanize()
  };

  item.showStatus = {
    completionTime: item.status.completionTime,
    conditions: item.status.conditions,
    podName: item.status.podName,
    startTime: item.status.startTime
  };

  item.finished = isStatusSucceed(item.status) || isStatusFailed(item.status);

  if (item.status["taskRuns"] && Array.isArray(item.status["taskRuns"])) {
    // Sort tasks (TROP-18441)
    item.status["taskRuns"].sort((a, b) => {
      const dateA = new Date(a.status.startTime).getTime();
      const dateB = new Date(b.status.startTime).getTime();
      return dateA - dateB;
    });

    // convert status.taskRuns to showTaskStatus
    item.showTaskStatus = {};
    item.status.taskRuns.forEach((taskRun) => {
      item.showTaskStatus[taskRun.id] = {
        completionTime: taskRun.status.completionTime,
        conditions: taskRun.status.conditions,
        podName: taskRun.status.podName,
        startTime: taskRun.status.startTime
      };
    });
  }
  const index = items.value.findIndex((_item) => _item.metadata.name === item.metadata.name);
  if (!item.status["taskRuns"]) {
    item.status["taskRuns"] = items.value[index].status["taskRuns"];
  }
  if (!item.showTaskStatus) {
    item.showTaskStatus = items.value[index].showTaskStatus;
  }
  return item;
};

const getStatus = () => {
  unsubscribeFilterQuery();
  isFiltering.value = true;
  let label = `labelSelector=${PIPELINE_TEMPLATE_LABEL_KEY_ACCOUNT.value}=${params.account}`;
  if (params.action !== "all") {
    label += `,${PIPELINE_TEMPLATE_LABEL_KEY_ACTION.value}=${params.action}`;
  }
  utils.httpGet(`/cic2-ws/v1/pipelineruns?${label}`).then((response: PIPELINE_RUN) => {
    if (response.items) {
      // sort the items by creationTimestamp desc
      response.items.sort((a, b) => new Date(b.metadata.creationTimestamp).getTime() - new Date(a.metadata.creationTimestamp).getTime());

      items.value = [...response.items];

      for (let i = 0; i < items.value.length; i++) {
        items.value[i] = processItem(items.value[i]);
        if (isStatusPending(items.value[i]?.status)) {
          console.log("Start fetching for item: ", items.value[i].metadata.name);
          loopPipelineById(items.value[i].metadata.name);
        }
      }
    }
  }).finally(() => {
    isFiltering.value = false;
  });
};

const loopTaskRuns = (expandPipelineName: string): Subscription => {
  const initialIndex = items.value.findIndex((item) => item.metadata.name === expandPipelineName);
  const data = items.value[initialIndex];
  if (!data?.status.childReferences) {
    return new Subscription();
  }

  const { signal } = filterAbortController;
  const observables = data.status.childReferences.map((child) => {
    const taskId = child.name;
    return from(utils.getTaskRunById(taskId, { signal })).pipe(
      map(
        (response) =>
          ({
            id: taskId,
            pipelineTaskName: child.pipelineTaskName,
            status: response.status
          }) as TASK_RUN
      )
    );
  });

  return forkJoin(observables).subscribe({
    next: (results) => {
      if (!expandedRowMap[expandPipelineName]) {
        return;
      }
      // Re-find index in case items array was modified during async fetch
      const currentIndex = items.value.findIndex((item) => item.metadata.name === expandPipelineName);
      if (currentIndex === -1) return;
      const currentData = items.value[currentIndex];

      currentData.status["taskRuns"] = results;
      // Mutate in place to preserve object reference in expandedRows
      Object.assign(items.value[currentIndex], processItem(currentData));
      expandingRows[expandPipelineName] = false;
      // Set default active tab to first task if not already set
      if (results.length > 0 && !activeExpandTab[expandPipelineName]) {
        activeExpandTab[expandPipelineName] = results[0].id;
      }
    },
    error: (err) => {
      // Ignore cancelled requests (triggered by Filter / onSubmit)
      if (axios.isCancel(err)) return;
      expandingRows[expandPipelineName] = false;
      console.error("Error fetching task runs:", err);
    }
  });
};

const hasActiveStreaming = (pipelineId: string): boolean => {
  const item = items.value.find((i) => i.metadata.name === pipelineId);
  if (!item?.status?.taskRuns) return false;
  return item.status.taskRuns.some((taskRun: TASK_RUN) =>
    taskRun.status.steps?.some(step => {
      const activeIndex = getActiveIndex(taskRun.status.podName, step.container);
      return !!fetchingLogs[activeIndex];
    })
  );
};

const loopPipelineById = (pipelineId: string) => {
  // Prevent duplicate polling chains for the same pipeline
  if (pollingPipelines[pipelineId]) {
    return;
  }
  pollingPipelines[pipelineId] = true;

  utils
    .getPipelineById(pipelineId, { signal: filterAbortController.signal })
    .then((response) => {
      const itemIndex = items.value.findIndex((_item) => _item.metadata.name === pipelineId);
      // Mutate in place to preserve object reference in expandedRows
      const processed = processItem(response);
      Object.assign(items.value[itemIndex], processed);

      if (isStatusPending(response?.status)) {
        // Skip polling if streaming log is active — the streaming end
        // signal will trigger a final status refresh instead
        if (hasActiveStreaming(pipelineId)) {
          delete pollingPipelines[pipelineId];
          return;
        }
        // If row is expanded, also refresh task runs (steps may not
        // be available yet if the task just started)
        if (expandedRowMap[pipelineId]) {
          subscriptions.push(loopTaskRuns(pipelineId));
        }
        // Always continue polling for running pipelines (every 20s)
        subscriptions.push(
          timer(STATUS_QUERY_INTERVAL).subscribe(() => {
            delete pollingPipelines[pipelineId];
            loopPipelineById(pipelineId);
          })
        );
      } else {
        delete pollingPipelines[pipelineId];
        if (expandedRowMap[pipelineId]) {
          // Pipeline just completed while row is expanded — refresh task runs
          subscriptions.push(loopTaskRuns(pipelineId));
        }
      }
    })
    .catch((error) => {
      // Ignore cancelled requests (triggered by Filter / onSubmit)
      if (axios.isCancel(error)) return;
      delete pollingPipelines[pipelineId];
      console.error("Error occurred while fetching logs for item", error);
    });
};
const getTaskStatusPendingReason = (status: PIPELINE_BASE_STATUS) => {
  return ["Started", "Running"].includes(status.conditions[0].reason) ? status.conditions[0].reason : "Pending";
};
const isStatusSucceed = (status: PIPELINE_BASE_STATUS) => {
  return status?.conditions[0].status === "True";
};
const isStatusFailed = (status: PIPELINE_BASE_STATUS) => {
  return status?.conditions[0].status === "False";
};
const isStatusPending = (status: PIPELINE_BASE_STATUS) => {
  return status?.conditions[0].status === "Unknown";
};
/**
 * Loop the pod log
 * @param pod pod name
 * @param container container name
 * @param pipelineName current pipeline name
 * @param taskIndex task index of item
 */
const loopPodLog = (pod: string, container: string, pipelineName: string, taskIndex: number) => {
  const currentItem = items.value.find((item) => item.metadata.name === pipelineName);
  if (!currentItem?.status?.taskRuns?.[taskIndex]) {
    return;
  }
  const status: PIPELINE_BASE_STATUS = currentItem.status.taskRuns[taskIndex].status;
  const activeIndex = getActiveIndex(pod, container);
  const follow = status?.conditions[0].status === "Unknown";

  // do not fetch the log in below cases:
  // 1. log is not pending and logs have activeIndex value
  // 2. pipeline row is not expanded
  // 3. log is in fetching state
  if ((!isStatusPending(status) && logs.value[activeIndex]) || !expandedRowMap[pipelineName] || fetchingLogs[activeIndex]) {
    return;
  }
  // axios does not support fetch streaming API, so we use fetch API to get the streaming responses log
  const controller = new AbortController();
  fetchingLogs[activeIndex] = controller;
  fetch(`/cic2-ws/v1/pod/${pod}/${container}/log?follow=${follow}&tailLines=${LOG_TAIL_LINES}`, {
    signal: controller.signal
  }).then((response) => {
    if (!response.ok) {
      throw new Error(`Failed to fetch logs for pod: ${pod}`);
    }
    logs.value[activeIndex] = logs.value[activeIndex] || "Loading...";
    return response.body?.getReader();
  }).then(reader => {
    if (!reader) {
      logs.value[activeIndex] = "No logs available";
      return null;
    }
      const decoder = new TextDecoder();
      logs.value[activeIndex] = "";
      let lineCount = 0;
      let initialChunk = true;

      const processChunk = async () => {
        const { done, value } = await reader.read();
        if (done) {
          delete fetchingLogs[activeIndex];
          // Check if initial load was truncated (got tailLines or more lines)
          if (lineCount >= LOG_TAIL_LINES) {
            truncatedLogs[activeIndex] = true;
          }
          // Streaming ended — container finished. Refresh pipeline status.
          loopPipelineById(pipelineName);
          return null;
        }

        const text = decoder.decode(value, { stream: true });
        logs.value[activeIndex] += text;
        lineCount += (text.match(/\n/g) || []).length;

        // Detect truncation on the first chunk for streaming mode
        if (initialChunk && lineCount >= LOG_TAIL_LINES) {
          truncatedLogs[activeIndex] = true;
        }
        initialChunk = false;

        // after log is rendered in UI, scroll to the bottom
        timer(100).subscribe(() => scrollLogToBottom(pipelineName));

        return processChunk();
      };
      return processChunk();
    })
    .catch((error) => {
      if (error.name === 'AbortError') {
        console.log('Cancel log fetch: ', error.message);
        return;
      }
      // clean up fetchingLogs so retry can proceed
      delete fetchingLogs[activeIndex];
      // in case pod is not created, so no logs on pod
      let errorMsg = `Fail to get log of pod: ${pod}`;
      if (error.response && error.response.data && error.response.data.message) {
        errorMsg = error.response.data.message;
      }
      logs.value[activeIndex] = errorMsg;
      if (isStatusPending(status)) {
        subscriptions.push(
          timer(LOG_QUERY_INTERVAL).subscribe(() => {
            loopPodLog(pod, container, pipelineName, taskIndex);
          })
        );
      }
    });
};

const onSubmit = () => {
  // Cancel all in-flight pipeline/taskrun HTTP requests from the previous session
  filterAbortController.abort();
  filterAbortController = new AbortController();
  expandedRows.value = [];

  // the reactive value cannot be reset directly, so we need to delete the key one by one
  Object.keys(expandingRows).forEach((key) => delete expandingRows[key]);
  Object.keys(expandedRowMap).forEach((key) => delete expandedRowMap[key]);
  Object.keys(fetchingLogs).forEach(key => {
    // abort the fetch request
    fetchingLogs[key]?.abort();
    delete fetchingLogs[key];
  });
  Object.keys(pollingPipelines).forEach(key => delete pollingPipelines[key]);
  Object.keys(truncatedLogs).forEach(key => delete truncatedLogs[key]);
  Object.keys(activeExpandTab).forEach(key => delete activeExpandTab[key]);
  // clear cached logs so re-expand fetches fresh content
  Object.keys(logs.value).forEach(key => delete logs.value[key]);
  getStatus();
};

const scrollLogToBottom = (pipelineName: string) => {
  const activeTab = activeExpandTab[pipelineName];
  if (!activeTab) return;
  // Find the visible code-block-view's pre element within tasks-status
  const container = document.getElementById("tasks-status");
  if (!container) return;
  const visiblePres = container.querySelectorAll(".code-block-view pre");
  const lastPre = visiblePres[visiblePres.length - 1];
  if (lastPre) {
    lastPre.scrollTop = lastPre.scrollHeight;
  }
};

const cleanUp = () => {
  const finishedPipelines = items.value.filter((item) => item.finished).map((item) => item?.info?.name);

  utils.deletePipelineRun(finishedPipelines).then(
    (responses) => {
      if (responses.some((response) => response.status !== 202)) {
        toast.error("One or more pipelines could be removed.");
      } else {
        toast.success("All the finished pipelines were removed");
      }
      onSubmit();
    },
    (error) => {
      toast.error("Something wrong happened. Please check Logs.");
      console.error("Something wrong happened. Please check Logs ", error);
      onSubmit();
    }
  );
};

const stopPipeline = (taskName: string) => {
  utils
    .httpPost(`/cic2-ws/v1/pipelineruns/${taskName}`)
    .then(() => {
      getStatus();
    })
    .catch((error) => {
      // Error stopping pipeline run
      let errorMsg = `Error stopping pipeline run: ${taskName}`;
      if (error.response && error.response.data && error.response.data.error) {
        errorMsg = error.response.data.error;
      }
      toast.error(errorMsg);
    });
};

const openLogInNewTab = (pod: string, container: string) => {
  const url = `/cic2-ws/v1/pod/${pod}/${container}/log`;
  utils.openNewTab(url);
};

const getActiveIndex = (pod: string, container: string): string => {
  return `${pod}_${container}`;
};

const unsubscribeFilterQuery = () => {
  subscriptions.forEach((sub) => sub.unsubscribe());
  subscriptions.length = 0;
};

onMounted(() => {
  utils.getUiProperties().then((properties) => {
    isCleanUpAvailable.value = properties["PIPELINES_CLEAN_UP_ENABLED"] === "true";
    PIPELINE_TEMPLATE_LABEL_KEY_ACCOUNT.value = properties["PIPELINE_TEMPLATE_LABEL_KEY_ACCOUNT"] || "";
    PIPELINE_TEMPLATE_LABEL_KEY_ACTION.value = properties["PIPELINE_TEMPLATE_LABEL_KEY_ACTION"] || "";
    PIPELINE_TEMPLATE_LABEL_KEY_CREATE_BY.value = properties["PIPELINE_TEMPLATE_LABEL_KEY_CREATE_BY"] || "";
    PIPELINE_TEMPLATE_LABEL_KEY_NOTE.value = properties["PIPELINE_TEMPLATE_LABEL_KEY_NOTE"] || "";
    if (["pipeline", "prepare"].includes(params.action as string)) {
      getStatus();
    }
  });
});

onBeforeUnmount(() => {
  filterAbortController.abort();
  unsubscribeFilterQuery();
});

watch(
  () => store.changedPipelineDeployParams.account,
  (newValue) => {
    if (newValue) {
      params.account = newValue;
    }
    isAccountEmpty.value = !params.account;
  },
  { immediate: true }
);
</script>

<style lang="less" scoped>
.pv-status-view {
  padding-top: 20px;

  .action-btn-group {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.75rem;
    margin-bottom: 1rem;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);

    :deep(.pv-field-horizontal) {
      padding: 0;
      margin: 0;

      .label-title {
        width: auto;
        font-size: 0.8125rem;
      }
    }
  }
  .is-loading {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    color: var(--primary-color);
    font-size: 0.8125rem;

    i {
      display: inline-block;
    }
  }

  .is-expanding {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100px;
    color: var(--text-secondary);

    i {
      margin-right: 8px;
      color: var(--primary-color);
    }
  }

  #tasks-status {
    min-width: 1440px;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    overflow: hidden;
    margin-bottom: 30px;

    .table-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      border-bottom: 1px solid var(--border-color);

      .section-title {
        margin: 0;
        font-size: 1rem;
        font-weight: 600;
        color: var(--text-primary);
      }
    }

    // Note: Expand row content styles are in global.less under #tasks-status
    // because template-rendered elements inside DataTable expansion lack scoped attributes.
  }
}
</style>

<style lang="less">
/* MultiSelect header — global (unscoped) because PrimeVue portals to body */
.p-multiselect-header {
  display: none;
}

.select-all-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  font-size: 0.875rem;
  color: var(--text-primary);
}
</style>
