/*
 * Copyright © 2025. Cloud Software Group, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { PIPELINE_GROUPS } from "@/types/pipeline";

export interface ACCOUNT_PROP_TYPES {
  account: string;
}
export interface REGION_PROP_TYPES {
  region: string;
}
export interface PIPELINE_LIST_PROP_TYPES {
  isInValid: boolean;
  isShowYamlInPage: boolean;
  pipelineGroups: PIPELINE_GROUPS[];
}

export interface PIPELINE_OPTIONS_PROP_TYPES extends PIPELINE_LIST_PROP_TYPES {}

export interface YAML_VIEW_PROP_TYPES {
  isInValid: boolean;
  pipelineGroups: PIPELINE_GROUPS[];
}

export type YAML_EDITOR_CONTENT = Record<string, any>;
export type JSON_EDITOR_CONTENT = YAML_EDITOR_CONTENT;

export interface YAML_EDITOR_PROP_TYPES {
  content: YAML_EDITOR_CONTENT;
  id?: string;
  lang?: string;
  readOnly?: boolean;
}
