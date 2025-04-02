/*
 * Copyright © 2025. Cloud Software Group, Inc.
 * This file is subject to the license terms contained
 * in the license file that is distributed with this file.
 */

import type { YAML_EDITOR_CONTENT } from "@/types/props";

export interface PIPELINE_OPTION {
  value: any;
  name: string;
  type: string;
  guiType: string;
  reference: string;
  groupIndex?: number;
  required?: boolean;
  lang?: string;
  description?: string;
  labels?: string[];
  values?: string[];
  error?: string;
  // for guiType: file, accept is the file type
  // see: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/file#accept
  accept?: string;
  fileSize?: number;  // in kilobytes
  // array, reference to other reference, e.g. ["meta.fileContent", "meta.deploymentAction"]
  // when current reference is set, the target reference will be disabled
  disableOtherFieldsWhenSet?: [];
}
export interface PIPELINE_GROUPS {
  index: string | number;
  title: string;
  description: string;
  isValid: boolean;
  options: PIPELINE_OPTION[];
}
export interface PIPELINE {
  id: string;
  name: string;
  description: string;
  defaultValue: string;
  pipelineRun: PIPELINE_RUN;
}
export interface PIPELINES {
  [key: string]: PIPELINE;
}

export interface PIPELINE_RUN {
  apiVersion: string;
  kind: string;
  metadata: PIPELINE_RUN_METADATA;
  spec?: any;
  items?: any[];
  status: PIPELINE_RUN_STATUS;
  info: PIPELINE_RUN_INFO;
  showTaskStatus: { [key: string]: PIPELINE_BASE_STATUS };
  finished: boolean;
  showStatus: PIPELINE_BASE_STATUS;
}

export interface PIPELINE_BASE_STATUS {
  completionTime: Date;
  conditions: TASK_STATUS_CONDITION[];
  podName: string;
  startTime: Date;
}
export interface PIPELINE_RUN_INFO {
  name: string;
  pipeline: string;
  note: string;
  namespace: string;
  created: string;
  duration: string;
}
export interface PIPELINE_RUN_METADATA {
  creationTimestamp: Date;
  labels: {
    [key: string]: string;
  };
  name: string;
  namespace: string;
  resourceVersion: string;
  uid: string;
}
export interface PIPELINE_RUN_STATUS extends PIPELINE_BASE_STATUS {
  childReferences: PIPELINE_RUN_STATUS_CHILD_REFERENCES[];
  pipelineSpec: any;
  provenance: any;
  taskRuns: TASK_RUN[];
}
export interface PIPELINE_RUN_STATUS_CHILD_REFERENCES {
  apiVersion: string;
  kind: string;
  name: string;
  pipelineTaskName: string;
}
interface TASK_STATUS_CONDITION {
  status: string;
  reason: string;
}
export interface TASKS_STATUS extends PIPELINE_BASE_STATUS {
  provenance: any;
  sidecars: any[];
  steps: TASK_STATUS_STEP[];
  taskSpec: TASK_STATUS_TASK_SPEC;
}
interface TASK_STATUS_STEP {
  container: string;
  imageID: string;
  name: string;
  terminated: any;
  terminationReason: string;
}
interface TASK_STATUS_TASK_SPEC {
  params: {
    name: string;
    type: string;
  }[];
  sidecars: any[];
  steps: any[];
  volumes: any[];
}
export interface TASK_RUN {
  id: string;
  pipelineTaskName: string;
  status: TASKS_STATUS;
}
export interface PIPELINE_DEPLOY_PARAMS_AWS {
  account: string;
  region: string;
  pipeline: string;
}

export interface PIPELINE_DEPLOY_PARAMS {
  aws: PIPELINE_DEPLOY_PARAMS_AWS;
  content: YAML_EDITOR_CONTENT;
}
export interface PIPELINE_EDITOR_TYPE {
  editor: any;
}
