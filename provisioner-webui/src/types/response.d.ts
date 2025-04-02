/*
 * Copyright © 2025. Cloud Software Group, Inc.
 * This file is subject to the license terms contained
 * in the license file that is distributed with this file.
 */

import type { PIPELINE_GROUPS, PIPELINE_OPTION } from "@/types/pipeline";
import type { MenuItem } from "primevue/menuitem";

export interface RES_MENU_CONTENT {
  aws: RES_AWS;
  menuConfig: RES_MENU_CONFIG_ITEM[];
}
export interface RES_AWS {
  region: RES_AWS_REGION;
}
export interface RES_AWS_REGION {
  defaultValue: string;
  values: string[];
}
export interface RES_MENU_CONFIG_ITEM extends MenuItem {
  config: string;
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
