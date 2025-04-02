/*
 * Copyright © 2025. Cloud Software Group, Inc.
 * This file is subject to the license terms contained
 * in the license file that is distributed with this file.
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
