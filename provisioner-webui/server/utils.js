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

const configMap = require('./configmap');
const axios = require("axios");
const fs = require("fs");

const base64Encode = function(str) {
  const buff = Buffer.from(str);
  return buff.toString('base64');
};

const base64Decode = function(str) {
  const buff = Buffer.from(str, 'base64');
  return buff.toString();
};

/**
 * The value will be converted to string.
 * @param {Object} jsonObj
 */
const cleanEmptyProperty = function(jsonObj) {
  if(jsonObj) {
    const objArray = [];
    Object.keys(jsonObj).forEach(key => {
      if(jsonObj[key] !== null && (jsonObj[key]+'').trim() !== '') {
        objArray.push({
          name: key,
          value: (jsonObj[key]+'').trim()
        });
      }
    });
    return objArray;
  }
  return [];
};

const parseBasicAuth = function(auth) {
  const decodedAuth = base64Decode(auth);
  const p = decodedAuth.indexOf(':');
  if(p > 0) {
    return {
      name: decodedAuth.substring(0, p),
      pass: decodedAuth.substring(p+1),
      auth: auth
    };
  } else {
    return {};
  }
};

const parseBasicAuthHeader = function(auth) {
  if(auth && auth.trim()) {
    auth = auth.trim();
    const values = auth.split(" ");
    if(values.length === 2 && values[0] === 'Basic') {
      return parseBasicAuth(values[1]);
    }
  }
  return null;
};

const authenticateUser = function(username, password) {
  if(username && password) {
    // Passwords are not stored on the server, only the hash of the password and the salt used to generate the hash
    // The basicAuth value is a base64 encoded value in the following format:
    // <username>:<salted password hash>:<salt used to generate hash>
    const authInfo = configMap.getTenantBasicAuth(username);
    if(authInfo) {
      // Using the password from the request, apply salt and perform the same hash logic
      const crypto = require('crypto');
      const generatedHash = crypto.createHash('sha512').update(password + authInfo.salt).digest('hex');
      // If the generated hash matches the stored hash, the user is authenticated
      if(generatedHash === authInfo.sha) {
        return authInfo;
      }
    }
    else {
      console.error('Username ' + username + ' was not found in ConfigMap');
    }
  }
  return null;
};

const handleError = function (ctx, e, message) {
  message = message ? message + ", error: " + e.message : e.message;
  console.error(message);
  ctx.status = e.statusCode || 500;
  ctx.body = {
    error: ctx.status,
    message: message
  };
};

const delay = function (ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const simpleHelmChartUrlToFileName = function(helmChartUrl, sep = "_") {
  if (!helmChartUrl || typeof helmChartUrl !== "string") {
    return "";
  }
  const url = new URL(helmChartUrl);
  // Extract owner/repo/blob/branch/path/to/file.ext
  const parts = url.pathname.split("/").filter(p => p);
  // If the structure is abnormal, degrade to a sanitized entire URL
  if (parts.length < 5 || parts[2] !== "blob") {
    return helmChartUrl.replace(/[^A-Za-z0-9]+/g, sep);
  }
  const owner = parts[0];
  const repo = parts[1];
  const branch = parts[3];
  const fileParts = parts.slice(4);
  const fileName = fileParts.join(sep);
  return `${owner}${sep}${repo}${sep}${branch}${sep}${fileName}`.toLowerCase();
}

/**
 * Fetch a helm chart file from GitHub, supports ETag for caching
 * @param {string} helmChartUrl - The URL of the helm chart file from GitHub to fetch,
 * can be a standard GitHub URL or a raw.githubusercontent.com URL.
 * @param {string} [token] - Optional GitHub access token for authentication.
 * @param {string} [etag] - Optional ETag value for caching.
 * @returns {Promise<axios.AxiosResponse<any>>}
 */
const fetchHelmChartFile = async function(helmChartUrl, token = "", etag = "") {
  // if the url is a GitHub url, change it to raw.githubusercontent.com format
  if (!helmChartUrl.includes("raw.githubusercontent.com")) {
    helmChartUrl = helmChartUrl
      .replace("https://github.com/", "https://raw.githubusercontent.com/")
      .replace("/blob/", "/");
  }
  const headers = {
    Accept: "application/vnd.github.raw"
  };
  if (token) {
    headers["Authorization"] = `token ${token}`;
  }
  if (etag) {
    headers["If-None-Match"] = etag;
  }
  console.log(`Fetching Helm chart file from Github: ${helmChartUrl}`);
  return axios.get(helmChartUrl, {
    headers: headers,
    responseType: "text",
    validateStatus: (status) => {
      return status === 200 || status === 304;
    }
  });
}

const saveHelmChartFile = function(filePath, content, newEtag = "") {
  // if file exists, remove it first
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  if (newEtag) {
    // add etag as the last line of the file
    content += `\netag: ${newEtag}\n`;
  }
  let generatedAt = configMap.loadYamlContent(content)?.generated;
  if (!generatedAt) {
    generatedAt = new Date().toISOString();
    content += `\ngenerated: ${generatedAt}\n`;
  }
  console.log("Saved Helm chart file to " + filePath);
  fs.writeFileSync(filePath, content, 'utf8');
  return generatedAt;
}

module.exports = {
  base64Encode: base64Encode,
  base64Decode: base64Decode,
  delay: delay,
  cleanEmptyProperty: cleanEmptyProperty,
  handleError: handleError,
  parseBasicAuthHeader: parseBasicAuthHeader,
  parseBasicAuth: parseBasicAuth,
  authenticateUser: authenticateUser,
  simpleHelmChartUrlToFileName: simpleHelmChartUrlToFileName,
  fetchHelmChartFile: fetchHelmChartFile,
  saveHelmChartFile: saveHelmChartFile,
};
