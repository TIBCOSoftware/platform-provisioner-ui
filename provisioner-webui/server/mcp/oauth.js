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

const crypto = require('crypto');

const clients = new Map();
const authCodes = new Map();

const deps = {
  configMap: require('../configmap'),
  jwt: require('./jwt'),
};

exports.getProtectedResourceMetadata = function (baseUrl) {
  return {
    resource: baseUrl + '/mcp',
    authorization_servers: [baseUrl],
    bearer_methods_supported: ['header'],
  };
};

exports.getAuthorizationServerMetadata = function (baseUrl) {
  return {
    issuer: baseUrl,
    authorization_endpoint: baseUrl + '/oauth/authorize',
    token_endpoint: baseUrl + '/oauth/token',
    registration_endpoint: baseUrl + '/oauth/register',
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: ['mcp'],
  };
};

exports.registerClient = function (body) {
  if (!Array.isArray(body.redirect_uris) || body.redirect_uris.length === 0) {
    return { error: 'invalid_client_metadata', error_description: 'redirect_uris must be a non-empty array' };
  }

  const clientId = crypto.randomUUID();
  const client = {
    client_id: clientId,
    redirect_uris: body.redirect_uris,
    client_name: body.client_name,
  };
  clients.set(clientId, client);
  return client;
};

exports.generateAuthCode = function (params) {
  const client = clients.get(params.client_id);
  if (!client) {
    return { error: 'invalid_request', error_description: 'Unknown client_id' };
  }

  if (!client.redirect_uris.includes(params.redirect_uri)) {
    return { error: 'invalid_request', error_description: 'redirect_uri does not match registered URIs' };
  }

  const accounts = deps.configMap.getAccountBySsoUser(params.email);
  if (!accounts || accounts.length === 0) {
    return { error: 'access_denied', error_description: 'No accounts found for this user' };
  }

  const code = crypto.randomBytes(32).toString('hex');
  authCodes.set(code, {
    email: params.email,
    clientId: params.client_id,
    redirectUri: params.redirect_uri,
    codeChallenge: params.code_challenge,
    codeChallengeMethod: params.code_challenge_method,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });

  return {
    code,
    redirectUri: params.redirect_uri,
    state: params.state,
  };
};

exports.exchangeToken = function (body) {
  if (body.grant_type === 'authorization_code') {
    const stored = authCodes.get(body.code);
    if (!stored || stored.expiresAt < Date.now()) {
      authCodes.delete(body.code);
      return { error: 'invalid_grant', error_description: 'Authorization code is invalid or expired' };
    }

    if (body.client_id !== stored.clientId) {
      return { error: 'invalid_grant', error_description: 'client_id mismatch' };
    }

    if (body.redirect_uri !== stored.redirectUri) {
      return { error: 'invalid_grant', error_description: 'redirect_uri mismatch' };
    }

    const hash = crypto.createHash('sha256').update(body.code_verifier).digest();
    const computed = hash.toString('base64url');
    if (computed !== stored.codeChallenge) {
      return { error: 'invalid_grant', error_description: 'PKCE verification failed' };
    }

    authCodes.delete(body.code);

    const accessToken = deps.jwt.createAccessToken({
      email: stored.email,
      name: stored.email,
      client_id: stored.clientId,
      scope: 'mcp',
    });
    const refreshToken = deps.jwt.createRefreshToken(stored.email, stored.clientId);

    return {
      access_token: accessToken,
      token_type: 'bearer',
      expires_in: 28800,
      refresh_token: refreshToken,
      scope: 'mcp',
    };
  }

  if (body.grant_type === 'refresh_token') {
    const payload = deps.jwt.consumeRefreshToken(body.refresh_token);
    if (!payload) {
      return { error: 'invalid_grant', error_description: 'Refresh token is invalid or expired' };
    }

    const accessToken = deps.jwt.createAccessToken({
      email: payload.email,
      name: payload.email,
      client_id: payload.clientId,
      scope: 'mcp',
    });
    const refreshToken = deps.jwt.createRefreshToken(payload.email, payload.clientId);

    return {
      access_token: accessToken,
      token_type: 'bearer',
      expires_in: 28800,
      refresh_token: refreshToken,
      scope: 'mcp',
    };
  }

  return { error: 'unsupported_grant_type' };
};

exports._deps = deps;
