/*
 * Copyright © 2025. Cloud Software Group, Inc.
 * This file is subject to the license terms contained
 * in the license file that is distributed with this file.
 */

'use strict';

const configMap = require('./configmap');

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

const handelError = function (ctx, e, message) {
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

module.exports = {
  base64Encode: base64Encode,
  base64Decode: base64Decode,
  delay: delay,
  cleanEmptyProperty: cleanEmptyProperty,
  handelError: handelError,
  parseBasicAuthHeader: parseBasicAuthHeader,
  parseBasicAuth: parseBasicAuth,
  authenticateUser: authenticateUser
};
