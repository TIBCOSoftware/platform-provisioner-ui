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

'use strict';

const yaml = require('js-yaml');
const path = require('path');
const fs = require('fs');
const nconf = require('nconf');
const isOnPrem = process.env.ON_PREM_MODE === 'true';
const isFromSource = process.env.DEV_START_FROM_SOURCE === 'true';

let tenantListPath;
let templatesPath;
let menuContentPath;
let mockUserPath;
let pipelinesTemplatesPath;
let ssoPath;
// PIPELINE_MENU_CONFIG is the path to the data folder, which contains the YAML files
// PIPELINE_MENU_CONFIG could be an absolute path or a relative path to the root of the project
// e.g., PIPELINE_MENU_CONFIG=charts/provisioner-config-cloud/config
// e.g. PIPELINE_MENU_CONFIG=~/provisioner-webui/server/data
let dataPath = process.env.PIPELINE_MENU_CONFIG || path.resolve(__dirname, `data`);
if (path.isAbsolute(dataPath) === false) {
  dataPath = path.resolve(__dirname, "../..", dataPath);
}
// download folder path for any temporary downloaded files
let downloadFolderPath = "/tmp";
// if it is windows, use %TEMP% environment variable
if (process.platform === "win32") {
  downloadFolderPath = process.env.TEMP || "C:\\Temp";
}

exports.init = function() {
  if (isFromSource) {
    tenantListPath = `${dataPath}/tenantList.yaml`;
    templatesPath = `${dataPath}/templates.yaml`;
    menuContentPath = `${dataPath}/menuContent.yaml`;
    pipelinesTemplatesPath = `${dataPath}/pipelinesTemplates.yaml`;
    mockUserPath = path.resolve(__dirname, `mockData/mockUser.yaml`);
  } else {
    tenantListPath = nconf.get('configmap:tenantList');
    templatesPath = nconf.get('configmap:templates');
    menuContentPath = nconf.get('configmap:menuContent');
    pipelinesTemplatesPath = nconf.get('configmap:pipelinesTemplates');
    mockUserPath = nconf.get('configmap:mockUser');
  }
  if (!isOnPrem) {
    ssoPath = isFromSource ? `${dataPath}/sso.yaml` : nconf.get('configmap:sso');
  }
};

const readYaml = function(yamlFile) {
  try {
    const doc = yaml.load(fs.readFileSync(yamlFile, 'utf8'));
    console.log('Loading YAML content from ' + yamlFile);
    return doc;
  } catch (e) {
    console.error("Error reading YAML file: " +  yamlFile + ", error: " + e.message);
  }
  return null;
};

exports.dataFolderPath = dataPath;
exports.downloadFolderPath = downloadFolderPath;

exports.loadYamlContent = function(yamlFileContent) {
  try {
    return yaml.load(yamlFileContent);
  } catch (e) {
    console.error("Error reading YAML file content, error: " + e.message);
  }
  return null;
};

exports.readYaml = function(yamlFileName, isFullPath = false) {
  if (isFullPath) {
    return readYaml(yamlFileName);
  }
  let yamlConfigFile = nconf.get('configmap:yamlConfigFolderPath') + yamlFileName;
  if (isFromSource) {
    yamlConfigFile = `${dataPath}/${yamlFileName}`;
  }
  return readYaml(yamlConfigFile);
};

exports.getTemplates = function() {
  return readYaml(templatesPath);
};

exports.getMenuContent = function() {
  return readYaml(menuContentPath);
};

exports.getPipelinesTemplates = function() {
  return readYaml(pipelinesTemplatesPath);
};

exports.getSsoConfig = function() {
  return readYaml(ssoPath);
};

exports.getMockUser = function() {
  const mockUserData = readYaml(mockUserPath);
  mockUserData["mockUser"]["sessionIndex"] = "id" + (new Date()).getTime() + "." + Math.floor(Number(process.hrtime.bigint()) / 1e8);
  return mockUserData;
};

exports.getPageContent = function(mdFile) {
  let configMapPath = nconf.get('configmap:md:' + mdFile);
  if (isFromSource) {
    configMapPath = `${dataPath}/${mdFile}.md`;
  }
  if (fs.existsSync(configMapPath)) {
    return fs.readFileSync(configMapPath, 'utf8');
  } else {
    console.error('Error reading MD file: ' + mdFile);
    return null;
  }
};

function getTenantAccounts(tenantId, doc) {
  const accounts = [];
  if (tenantId && doc.tenants) {
    if (tenantId === 'admin') {
      // return all accounts
      Object.keys(doc.tenants).forEach((id) => {
        accounts.push({
          id: id,
          roles: doc.tenants[id].accounts
        });
      });
    } else {
      for (const tId in doc.tenants) {
        if (tId === tenantId) {
          accounts.push({
            id: tenantId,
            roles: doc.tenants[tenantId].accounts
          });
          break;
        }
      }
    }
  }
  return accounts;
}

exports.getTenantBasicAuth = function(tenant) {
  const doc = readYaml(tenantListPath);
  if(doc && doc.tenants) {
    const idArray = Object.keys(doc.tenants);
    for(let i = 0; i < idArray.length; i++) {
      // The basicAuth value stored in the ConfigMap is a base64 encoded value in the following format:
      // <username>:<salted password hash>:<salt used to generate hash>
      const authInfo = Buffer.from(doc.tenants[idArray[i]].basicAuth, 'base64').toString().split(':');
      if(authInfo && (authInfo.length === 3)) {
        const username = authInfo[0];
        if(tenant === username) {
          return {
            username: username,
            sha: authInfo[1],
            salt: authInfo[2],
            basicAuth: doc.tenants[idArray[i]].basicAuth,
            accounts: getTenantAccounts(username, doc)
          };
        }
      }
    }
  }
  return null;
};

exports.getAccountBySsoUser = function(userEmail) {
  const email = userEmail.trim().toLowerCase();
  const doc = readYaml(tenantListPath);
  if(doc && doc.tenants && doc.users) {
    const users = doc.users;

    // lookup user
    let groups = null;
    for(const user of users) {
      if (user.email && user.email.toLowerCase() === email) {
        groups = user.groups;
        break;
      }
    }

    if (groups && groups.length > 0) {

      if (groups.indexOf('admin') !== -1) {
        return getTenantAccounts('admin', doc);
      } else {
        let accounts = [];
        for (const tenantId in doc.tenants) {
          if (groups.indexOf(tenantId) !== -1) {
            accounts = accounts.concat(getTenantAccounts(tenantId, doc));
          }
        }
        return accounts;
      }

    }
  }
  return [];
};

/**
 * Recursively search menu config items for a matching recipe title.
 * A recipe is title-addressable when its menu item carries both a `config`
 * file and a `title=<title>` query parameter in its `url`.
 * @param {Array} items - Menu config items
 * @param {string} title - Recipe title to search for
 * @param {string} [pipeline] - Optional pipeline type to narrow the search
 * @returns {string|null} Config filename or null
 */
function findConfigByTitle(items, title, pipeline) {
  if (!items) return null;
  for (const item of items) {
    if (item.url) {
      const urlMatch = item.url.includes(`title=${title}`);
      const pipelineMatch = !pipeline || item.url.includes(`/pipelines/${pipeline}`);
      if (urlMatch && pipelineMatch && item.config) {
        return item.config;
      }
    }
    if (item.items) {
      const found = findConfigByTitle(item.items, title, pipeline);
      if (found) return found;
    }
  }
  return null;
}
exports.findConfigByTitle = findConfigByTitle;

/**
 * Look up a published recipe template by title. Shared by the REST
 * `GET /cic2/public/v1/recipe` endpoint and the MCP `getRecipe` tool so both
 * return the identical payload. This is a pure config-file lookup (menu config
 * + recipe YAML on disk) — it needs no shared team API key, only that the
 * caller is already authenticated (Basic/SSO for REST, per-user OAuth for MCP).
 * @param {string} title - Recipe title (e.g. "deploy-tp-on-prem-gcp-k3s")
 * @param {string} [pipeline] - Optional pipeline type to narrow the lookup
 * @returns {{recipe: object} | {error: string, reason: 'no-menu'|'title-not-found'|'file-not-found'}}
 */
exports.getRecipeByTitle = function(title, pipeline) {
  const menuContent = exports.getMenuContent();
  if (!menuContent || !menuContent.menuConfig) {
    return { error: 'Menu configuration not available', reason: 'no-menu' };
  }
  const configFile = findConfigByTitle(menuContent.menuConfig, title, pipeline || null);
  if (!configFile) {
    return { error: `Recipe not found for title: ${title}`, reason: 'title-not-found' };
  }
  const recipe = exports.readYaml(configFile);
  if (!recipe) {
    return { error: `Recipe file not found: ${configFile}`, reason: 'file-not-found' };
  }
  return { recipe };
};

/**
 * List the title-addressable published recipes (menu items that expose a recipe
 * via a `title=` query param + a `config` file). Mirrors the UI catalog so a
 * caller can discover the titles accepted by getRecipeByTitle.
 * @returns {Array<{title: string, label: string|null, pipeline: string|null, config: string}>}
 */
exports.listRecipes = function() {
  const menuContent = exports.getMenuContent();
  const recipes = [];
  const walk = (items) => {
    if (!items) return;
    for (const item of items) {
      if (item.url && item.config) {
        const titleMatch = item.url.match(/[?&]title=([^&]+)/);
        if (titleMatch) {
          const pipelineMatch = item.url.match(/\/pipelines\/([^/?]+)/);
          recipes.push({
            title: decodeURIComponent(titleMatch[1]),
            label: item.label || null,
            pipeline: pipelineMatch ? pipelineMatch[1] : null,
            config: item.config,
          });
        }
      }
      if (item.items) walk(item.items);
    }
  };
  if (menuContent && menuContent.menuConfig) {
    walk(menuContent.menuConfig);
  }
  return recipes;
};

