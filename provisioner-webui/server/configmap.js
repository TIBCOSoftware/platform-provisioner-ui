/*
 * Copyright © 2025. Cloud Software Group, Inc.
 * This file is subject to the license terms contained
 * in the license file that is distributed with this file.
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

exports.readYaml = function(yamlFileName) {
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

