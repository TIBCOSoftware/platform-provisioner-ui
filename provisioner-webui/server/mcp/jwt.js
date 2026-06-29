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

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const SECRET = process.env.MCP_JWT_SECRET || process.env.GIT_COMMIT || 'dev';
const ACCESS_TOKEN_EXPIRY = '8h';
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const refreshTokens = new Map();

function createAccessToken(payload) {
  return jwt.sign(
    {
      sub: payload.email,
      email: payload.email,
      name: payload.name,
      client_id: payload.client_id,
      scope: payload.scope,
    },
    SECRET,
    { algorithm: 'HS256', expiresIn: ACCESS_TOKEN_EXPIRY },
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, SECRET, { algorithms: ['HS256'] });
}

function createRefreshToken(email, clientId) {
  const token = crypto.randomBytes(48).toString('hex');
  refreshTokens.set(token, {
    email,
    clientId,
    expiresAt: Date.now() + REFRESH_TOKEN_TTL_MS,
  });
  return token;
}

function consumeRefreshToken(token) {
  const entry = refreshTokens.get(token);
  if (!entry) return null;
  refreshTokens.delete(token);
  if (Date.now() > entry.expiresAt) return null;
  return { email: entry.email, clientId: entry.clientId };
}

module.exports = {
  createAccessToken,
  verifyAccessToken,
  createRefreshToken,
  consumeRefreshToken,
};
