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

import type { PIPELINE_GROUPS, PIPELINE_OPTION } from "@/types/pipeline";
import type { MenuItem } from "primevue/menuitem";

export interface RES_MENU_CONTENT {
  aws: RES_AWS;
  chartConfig?: RES_CHART_CONFIG;
  menuConfig: RES_MENU_CONFIG_ITEM[];
}
export interface RES_AWS {
  region: RES_AWS_REGION;
}
export interface RES_AWS_REGION {
  defaultValue: string;
  values: string[];
}
export interface RES_CHART_CONFIG {
  chartUrls: RES_CHART_URL[];
}
export interface RES_CHART_URL {
  url: string;
  description: string;
}
export interface RES_MENU_CONFIG_ITEM extends MenuItem {
  config: string;
  routePath?: string;
  items?: RES_MENU_CONFIG_ITEM[];
}

export interface RES_PAGE_CONTENT {
  pipelineName: string;
  description: string;
  options: PIPELINE_OPTION[];
  groups?: PIPELINE_GROUPS[];
  recipe?: string;
}

export interface RES_USER {
  firstName: string;
  lastName: string;
  email: string;
  tenantId: string;
  noLogout: boolean;
}
export interface RES_ACCOUNT_ROLE {
  id: string;
  description: string;
}
export interface RES_ACCOUNT {
  id: string;
  roles: RES_ACCOUNT_ROLE[];
}

export interface CP_VERSION_ENTRY {
  apiVersion: string;
  appVersion: string;
  name: string;
  version: string;
}

export interface CP_VERSION_ENTRIES {
  [key: string]: CP_VERSION_ENTRY[];
}

export interface CP_VERSION {
  apiVersion: string;
  entries: CP_VERSION_ENTRIES;
  generated: string;
  etag: string;
}

export interface GITHUB_INFO {
  token: string;
  helmChartUrl: RES_CHART_URL | string;
}

export interface HELM_CHART_VERSIONS {
  token: string;
  helmChartUrl: RES_CHART_URL | string;
  generated: string;
  chartName: string;
  version: string;
  successMsg: string;
  errorMsg: string;
}
