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

// Default environment variables for server tests
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.ON_PREM_MODE = process.env.ON_PREM_MODE || 'false';
process.env.PIPELINE_TEMPLATE_LABEL_KEY_ACCOUNT = process.env.PIPELINE_TEMPLATE_LABEL_KEY_ACCOUNT || 'account';
process.env.PIPELINE_TEMPLATE_LABEL_KEY_ACTION = process.env.PIPELINE_TEMPLATE_LABEL_KEY_ACTION || 'action';
process.env.PIPELINE_TEMPLATE_LABEL_KEY_NOTE = process.env.PIPELINE_TEMPLATE_LABEL_KEY_NOTE || 'note';
process.env.PIPELINE_TEMPLATE_LABEL_KEY_NAME = process.env.PIPELINE_TEMPLATE_LABEL_KEY_NAME || 'name';
process.env.PIPELINE_TEMPLATE_LABEL_KEY_CREATE_BY = process.env.PIPELINE_TEMPLATE_LABEL_KEY_CREATE_BY || 'created-by';
process.env.PIPELINE_TEMPLATE_LABEL_KEY_CONFIG = process.env.PIPELINE_TEMPLATE_LABEL_KEY_CONFIG || 'config';
process.env.PIPELINE_TEMPLATE_LABEL_KEY_CONFIG_GROUPS = process.env.PIPELINE_TEMPLATE_LABEL_KEY_CONFIG_GROUPS || 'config-groups';
process.env.PIPELINE_TEMPLATE_LABEL_VALUE = process.env.PIPELINE_TEMPLATE_LABEL_VALUE || 'pipeline-gui-config';
