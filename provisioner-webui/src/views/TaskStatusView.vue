<!--
  - Copyright © 2025. Cloud Software Group, Inc.
  - This file is subject to the license terms contained
  - in the license file that is distributed with this file.
  -->

<template>
  <div class="pv-status-view">
    <div class="action-btn-group">
      <div>
        <aws-account v-bind:account="params.account"></aws-account>
      </div>
      <div class="action-btn">
        <Button label="Filter" severity="info" icon="pi pi-filter" :disabled="isAccountEmpty" @click="onSubmit" />
      </div>
      <div class="action-btn" v-if="isCleanUpAvailable">
        <Button label="Clean Up Finished Pipelines" severity="danger" icon="pi pi-trash" :disabled="!isCleanUpEnabled" @click="cleanUp" />
      </div>
    </div>

    <div class="accordion" id="tasks-status">
      <!-- The new table list use primevue -->
      <DataTable
        :value="items"
        :paginator="true"
        :rows="pageSize"
        :rowsPerPageOptions="[10, 20, 50]"
        v-model:expandedRows="expandedRows"
        @row-expand="onRowExpand"
        @row-collapse="onRowCollapse"
        @page="onPageChange"
        dataKey="info.name"
        responsiveLayout="scroll"
      >
        <Column :expander="true" />
        <Column header="Status">
          <template v-slot:body="item">
            <!-- See status doc: https://tekton.dev/docs/pipelines/pipelineruns/#monitoring-execution-status -->
            <div v-if="isStatusSucceed(item.data.showStatus)">
              <span class="badge bg-success">{{ item.data.showStatus.conditions[0].reason }}</span>
            </div>
            <div v-if="isStatusFailed(item.data.showStatus)">
                <span
                  :class="[
                    'badge',
                    item.data.showStatus.conditions[0].reason === 'Cancelled'
                      ? 'bg-secondary'
                      : item.data.showStatus.conditions[0].reason === 'PipelineRunTimeout'
                        ? 'bg-warning'
                        : 'bg-danger'
                  ]"
                >
                  {{ item.data.showStatus.conditions[0].reason }}
                </span>
            </div>
            <div class="is-loading" v-if="isStatusPending(item.data.showStatus)" role="status">
              <i class="pi pi-spin pi-spinner"></i>
              <span>{{ item.data.showStatus.conditions[0].reason }}...</span>
            </div>
          </template>
        </Column>
        <Column field="info.name" header="Name"></Column>
        <Column field="info.note" header="Note"></Column>
        <Column header="User">
          <template v-slot:body="item">
            {{ item.data.metadata.labels[`${PIPELINE_TEMPLATE_LABEL_KEY_CREATE_BY}`] }}
          </template>
        </Column>
        <Column field="info.created" header="Created"></Column>
        <Column field="info.duration" header="Duration"></Column>
        <Column header="Actions">
          <template v-slot:body="item">
              <span v-if="isStatusPending(item.data.showStatus)">
                <button type="button" class="badge bg-danger" v-on:click="stopPipeline(item.data.info.name)">Stop</button>
              </span>
          </template>
        </Column>
        <!-- Note: below code: data: expanded each row data, itemIndex: re-defined index -->
        <template #expansion="{ data, index: itemIndex }">
          <div class="is-expanding" v-if="expandingRows[data.metadata.name]"><i class="pi pi-spin pi-spinner"></i> Expanding...</div>
          <div v-if="!expandingRows[data.metadata.name]">
            <div class="card-body">
              <div class="row">
                <!-- Tasks List -->
                <div class="col-3">
                  <div class="list-group" id="list-tab" role="tablist" v-if="data.status['taskRuns']">
                    <template v-for="(taskRun, taskIndex) in data.status['taskRuns']" :key="taskRun.id">
                      <!-- Tasks -->
                      <a
                        class="list-group-item list-group-item-action pipeline-task-name"
                        :id="'list-' + taskRun.id + '-list'"
                        data-bs-toggle="list"
                        :href="'#list-' + taskRun.id"
                        role="tab"
                        :class="{ active: taskIndex === 0 }"
                        aria-controls="home"
                      >
                        <span>{{ taskRun["pipelineTaskName"] }}</span>

                        <!-- See status doc: https://tekton.dev/docs/pipelines/taskruns/#monitoring-execution-status -->
                        <span v-if="isStatusSucceed(taskRun.status)" class="badge bg-success">{{ taskRun["status"].conditions[0].reason }}</span>
                        <span
                          v-if="isStatusFailed(taskRun.status)"
                          :class="[
                              'badge',
                              taskRun['status'].conditions[0].reason === 'TaskRunCancelled'
                                ? 'bg-secondary'
                                : taskRun['status'].conditions[0].reason === 'TaskRunTimeout'
                                  ? 'bg-warning'
                                  : 'bg-danger'
                            ]"
                        >{{ taskRun["status"].conditions[0].reason }}</span>
                        <span class="is-loading" v-if="isStatusPending(taskRun['status'])">
                            <i class="pi pi-spin pi-spinner"></i>
                            <span>{{ getTaskStatusPendingReason(taskRun["status"]) }}...</span>
                          </span>
                      </a>

                      <!-- Task Steps -->
                      <a
                        v-for="step in taskRun['status']['steps']"
                        v-bind:key="taskRun.id + step.container"
                        v-on:click="loopPodLog(taskRun['status']['podName'], step.container, data.metadata.name, taskIndex)"
                        :aria-disabled="!logs[getActiveIndex(taskRun.status.podName, step.container)]"
                        class="list-group-item list-group-item-action pipeline-task-step"
                        :id="'list-' + taskRun.id + '-' + step.container + '-list'"
                        data-bs-toggle="list"
                        :href="'#list-' + taskRun.id + '-' + step.container"
                        role="tab"
                        aria-controls="profile"
                      >
                        <span> <span class="badge bg-dark">Log</span>{{ step.container }} </span>
                        <span class="pi pi-external-link" v-on:click="openLogInNewTab(taskRun['status']['podName'], step.container)"></span>
                      </a>
                    </template>
                  </div>
                  <div class="list-group" id="list-tab-error" role="tablist" v-if="!data.status['taskRuns']">
                    <a
                      class="list-group-item list-group-item-action pipeline-task-name active"
                      :id="'list-' + data.info.name + '-list'"
                      data-bs-toggle="list"
                      :href="'#list-' + data.info.name"
                      role="tab"
                      aria-controls="home"
                    >
                      Error
                    </a>
                  </div>
                </div>

                <!-- Tasks Details -->
                <div class="col-9">
                  <div class="tab-content" id="nav-tabContent" v-if="data.status['taskRuns']">
                    <template v-for="(taskRun, taskIndex) in data.status['taskRuns']" :key="taskRun.id">
                      <!-- Task Status -->
                      <div
                        class="tab-pane fade"
                        v-bind:class="{ active: taskIndex === 0, show: taskIndex === 0 }"
                        :id="'list-' + taskRun.id"
                        role="tabpanel"
                        :aria-labelledby="'list-' + taskRun.id + '-list'"
                      >
                        <div class="code-block-view">
                          <label>Status</label>
                          <VCodeBlock prismjs lang="json" theme="tomorrow" :code="getStatusJson(data.showTaskStatus[taskRun.id])" />
                        </div>

                        <div v-if="taskRun['status']['taskResults']">
                          <div class="code-block-view" v-for="result in taskRun['status']['taskResults']" v-bind:key="taskRun.id + result.name">
                            <label>{{ result.name }}</label>
                            <VCodeBlock prismjs lang="log" theme="tomorrow" :code="result.value" />
                          </div>
                        </div>
                      </div>

                      <!-- Steps Logs -->
                      <div
                        v-for="step in taskRun['status']['steps']"
                        v-bind:key="taskRun.id + step.container"
                        class="tab-pane fade"
                        :id="'list-' + taskRun.id + '-' + step.container"
                        role="tabpanel"
                        :aria-labelledby="'list-' + taskRun.id + '-' + step.container + '-list'"
                      >
                        <div class="is-loading" v-if="!logs[getActiveIndex(taskRun.status.podName, step.container)]" role="status">
                          <i class="pi pi-spin pi-spinner"></i>
                          <span>Loading...</span>
                        </div>
                        <div class="code-block-view">
                          <label>Logs</label>
                          <VCodeBlock
                            prismjs
                            lang="log"
                            theme="tomorrow"
                            v-if="logs[getActiveIndex(taskRun.status.podName, step.container)]"
                            :code="logs[getActiveIndex(taskRun.status.podName, step.container)]"
                          />
                        </div>
                      </div>
                    </template>
                  </div>
                  <div class="tab-content" id="nav-tabContent-error" v-if="!data.status['taskRuns']">
                    <div
                      class="tab-pane fade active show"
                      :id="'list-' + data.info.name"
                      role="tabpanel"
                      :aria-labelledby="'list-' + data.info.name + '-list'"
                    >
                      <div class="code-block-view">
                        <label>Status</label>
                        <VCodeBlock prismjs lang="json" theme="tomorrow" :code="getStatusJson(data.status)" />
                      </div>
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
import Column from "primevue/column";
import DataTable, { type DataTableCellEditInitEvent, type DataTablePageEvent, type DataTableRowExpandEvent } from "primevue/datatable";
import VCodeBlock from "@wdns/vue-code-block";
import "prismjs";
import "prismjs/components/prism-markup-templating";
import "prismjs/components/prism-json";
import "prismjs/components/prism-log";
import { forkJoin, from, Subscription, timer } from "rxjs";
import { ref, reactive, onMounted, computed, watch, onBeforeUnmount } from "vue";
import { map } from "rxjs/operators";
import { useRoute } from "vue-router";
import { toast } from "vue3-toastify";
import type { PIPELINE_BASE_STATUS, PIPELINE_RUN, TASK_RUN } from "@/types/pipeline";
import { useMainStore } from "@/stores/store";
import Button from "primevue/button";

const STATUS_QUERY_INTERVAL = 10 * 1000;
const LOG_QUERY_INTERVAL = 5 * 1000;
const subscriptions: Subscription[] = [];

const store = useMainStore();
const route = useRoute();

const params = reactive({
  account: (route.query.account || "") as string,
  action: (route.query.action || "all") as string
});
const expandingRows = reactive<{ [key: string]: boolean }>({});
const expandedRowMap = reactive<{ [key: string]: boolean }>({});

// Cannot change expandedRows from ref to reactive, because vue cannot detect the change of expandedRows when reset it.
const items = ref<PIPELINE_RUN[]>([]);
const expandedRows = ref<{ [key: string]: PIPELINE_RUN }>({});
const logs = ref<{ [key: string]: string }>({});
const isAccountEmpty = ref(!route.query.account);
const isCleanUpAvailable = ref(false);
const PIPELINE_TEMPLATE_LABEL_KEY_ACCOUNT = ref("");
const PIPELINE_TEMPLATE_LABEL_KEY_ACTION = ref("");
const PIPELINE_TEMPLATE_LABEL_KEY_CREATE_BY = ref("");
const PIPELINE_TEMPLATE_LABEL_KEY_NOTE = ref("");
const order = ref("desc");
const page = ref(1);
const pageSize = ref(10);

const isCleanUpEnabled = computed(() => {
  return items.value.some((item) => item.finished);
});

const onRowExpand = (event: DataTableRowExpandEvent) => {
  let data = event.data;
  expandedRowMap[data.metadata.name] = true;

  // only show expanding icon when the row is never expanded
  if (expandingRows[data.metadata.name] === undefined) {
    expandingRows[data.metadata.name] = true;
  }
  subscriptions.push(loopTaskRuns(data.metadata.name));
};

const onPageChange = (event: DataTablePageEvent) => {
  page.value = event.page + 1;
};

const onRowCollapse = (event: DataTableCellEditInitEvent) => {
  let data = event.data;
  expandedRowMap[data.metadata.name] = false;

  delete expandedRows.value[data.metadata.name];
};

const processItem = (_item: PIPELINE_RUN) => {
  const item = { ..._item };
  item.info = {
    name: item.metadata.name,
    pipeline: item.metadata.labels["tekton.dev/pipeline"],
    note: item.metadata.labels[`${PIPELINE_TEMPLATE_LABEL_KEY_NOTE.value}`],
    namespace: item.metadata.namespace,
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
  let label = `labelSelector=${PIPELINE_TEMPLATE_LABEL_KEY_ACCOUNT.value}=${params.account}`;
  if (params.action !== "all") {
    label += `,${PIPELINE_TEMPLATE_LABEL_KEY_ACTION.value}=${params.action}`;
  }
  utils.httpGet(`/cic2-ws/v1/pipelineruns?${label}`).then((response: PIPELINE_RUN) => {
    if (response.items) {
      // sort the items by creationTimestamp desc
      response.items.sort((a, b) => new Date(b.metadata.creationTimestamp).getTime() - new Date(a.metadata.creationTimestamp).getTime());

      items.value = [ ...response.items ];

      for (let i = 0; i < items.value.length; i++) {
        items.value[i] = processItem(items.value[i]);
        if (isStatusPending(items.value[i]?.status)) {
          console.log("Start fetching for item: ", items.value[i].metadata.name);
          loopPipelineById(items.value[i].metadata.name);
        }
      }
    }
  });
};

const loopTaskRuns = (expandPipelineName: string): Subscription => {
  const index = items.value.findIndex((item) => item.metadata.name === expandPipelineName);
  let data = items.value[index];
  if (!data.status.childReferences) {
    return new Subscription();
  }

  const observables = data.status.childReferences.map((child) => {
    const taskId = child.name;
    return from(utils.getTaskRunById(taskId)).pipe(
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

  // Store the result of each asynchronous call utils.getTaskRunById(taskId) in an array.
  // Use Promise.all to ensure all asynchronous calls are completed and process the results in order.
  // Ensure that the order of the data.status["taskRuns"] array is consistent with the taskId order of data.status.childReferences.
  return forkJoin(observables).subscribe((results) => {
    if (!expandedRowMap[expandPipelineName]) {
      return;
    }
    if (isStatusPending(data?.status)) {
      console.log("Status is 'Unknown', continuing to fetch task run", data.metadata.name);
      subscriptions.push(
        timer(STATUS_QUERY_INTERVAL).subscribe(() => {
          subscriptions.push(loopTaskRuns(expandPipelineName));
        })
      );
    } else {
      console.log("Status is not 'Unknown', stop fetching task run", data.metadata.name);
    }
    data.status["taskRuns"] = results;
    items.value[index] = processItem(data);
    expandingRows[data.metadata.name] = false;

    expandedRows.value[data.metadata.name] = items.value[index];
  });
};

const loopPipelineById = (pipelineId: string) => {
  utils
    .getPipelineById(pipelineId)
    .then((response) => {
      const itemIndex = items.value.findIndex((_item) => _item.metadata.name === pipelineId);
      // always update the status to UI
      items.value[itemIndex] = processItem(response);

      if (isStatusPending(response?.status)) {
        // the status is "Unknown", call recursively after a delay
        subscriptions.push(
          timer(STATUS_QUERY_INTERVAL).subscribe(() => {
            loopPipelineById(pipelineId);
          })
        );
      }
    })
    .catch((error) => {
      // error occurs, clear interval
      console.error("Error occurred while fetching logs for item", error);
    });
};
const getTaskStatusPendingReason = (status: PIPELINE_BASE_STATUS) => {
  return ["Started", "Running"].includes(status.conditions[0].reason) ? status.conditions[0].reason : "Pending";
};
const getStatusJson = (status: PIPELINE_BASE_STATUS) => {
  return status ? JSON.stringify(status, null, 2) : "{}";
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
  if (!currentItem) {
    return;
  }
  const status: PIPELINE_BASE_STATUS = currentItem.status.taskRuns[taskIndex].status;
  const activeIndex = getActiveIndex(pod, container);
  // if the log is not pending and logs have activeIndex value, do not fetch the log
  if ((!isStatusPending(status) && logs.value[activeIndex]) || !expandedRowMap[pipelineName]) {
    return;
  }
  utils
    .httpGet(`/cic2-ws/v1/pod/${pod}/${container}/log`)
    .then((response) => {
      // When loading the log for the first time, display "Loading..." first,
      // then display the log after 100 milliseconds to avoid displaying a blank page when the log is large.
      logs.value[activeIndex] = logs.value[activeIndex] || "Loading...";
      timer(100).subscribe(() => {
        logs.value[activeIndex] = response || "No logs";
        timer(300).subscribe(() => scrollLogToBottom(pipelineName));
      });
      if (isStatusPending(status)) {
        subscriptions.push(
          timer(LOG_QUERY_INTERVAL).subscribe(() => {
            loopPodLog(pod, container, pipelineName, taskIndex);
          })
        );
      }
    })
    .catch((error) => {
      // in case pod is not created, so no logs on pod
      let errorMsg = `Fail to get log of pod: ${pod}`;
      if (error.response && error.response.data && error.response.data.message) {
        errorMsg = error.response.data.message;
      }
      logs.value[activeIndex] = errorMsg;
      subscriptions.push(
        timer(LOG_QUERY_INTERVAL).subscribe(() => {
          loopPodLog(pod, container, pipelineName, taskIndex);
        })
      );
    });
};

const onSubmit = () => {
  expandedRows.value = {};

  // the reactive value cannot be reset directly, so we need to delete the key one by one
  Object.keys(expandingRows).forEach((key) => delete expandingRows[key]);
  Object.keys(expandedRowMap).forEach((key) => delete expandedRowMap[key]);
  getStatus();
};

const scrollLogToBottom = (pipelineName: string) => {
  const element = document.querySelector(`[id^="list-${pipelineName}"].tab-pane.show .code-block-view pre`);
  if (element) {
    element.scrollTop = element.scrollHeight;
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
  unsubscribeFilterQuery();
});

watch(
  () => store.changedPipelineDeployParams.account,
  (newValue) => {
    params.account = newValue;
    isAccountEmpty.value = !newValue;
  }
);
</script>

<style lang="less" scoped>
.pv-status-view {
  padding-top: 15px;
  .action-btn-group {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    margin-bottom: 1rem;
    .action-btn {
      margin-left: 10px;
    }
    :deep(.pv-field-horizontal) {
      padding: 0;
      &:hover {
        background: none;
      }
      .label-title {
        width: auto;
      }
    }
  }
  .is-loading {
    i {
      display: inline-block;
      margin-right: 8px;
    }
  }
  .is-expanding {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100px;
    background-color: #efefef;
    i {
      margin-right: 1em;
    }
  }
  #tasks-status {
    min-width: 1440px;
    .card-body {
      overflow-y: auto;
      .row {
        margin: 0;
      }
    }

    .pipeline-task-name {
      font-weight: 500;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .task-actions-row {
      flex-wrap: nowrap;
      display: flex;
      margin-right: -15px;
      margin-left: -15px;
    }

    .pipeline-task-step {
      display: flex;
      justify-content: space-between;
      align-items: center;
      .badge {
        margin-right: 8px;
      }
      .pi-external-link:hover {
        color: #007bff;
      }
      &.active .pi-external-link {
        color: #cecece;
        &:hover {
          color: #fff;
        }
      }
    }
    .p-column-title {
      width: calc(100% - 25px);
      display: block;
    }
    .tab-pane {
      position: relative;
      :deep(pre) {
        max-height: 680px;
        min-height: 400px;
        max-width: 70vw;
        min-width: calc(1440px - 410px);
        overflow-x: auto;
        code {
          white-space: pre-wrap;
          word-break: break-all;
          &::selection {
            background: #757575 !important;
          }

          *::selection {
            background: #757575 !important;
          }
        }
      }
      .is-loading {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        min-height: 300px;
        background: #efefef;
        z-index: 9;
        display: flex;
        justify-content: center;
        align-items: center;
      }
      .code-block-view {
        min-height: 300px;
      }
    }
  }
}
</style>
