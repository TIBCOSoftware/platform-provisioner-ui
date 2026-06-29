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

const jwt = require('./jwt');

function getBaseUrl(ctx) {
  const proto = ctx.get('x-forwarded-proto') || ctx.protocol;
  const host = ctx.get('x-forwarded-host') || ctx.host;
  return process.env.MCP_BASE_URL || `${proto}://${host}`;
}

function reject(ctx, description) {
  const resourceMetadata = `${getBaseUrl(ctx)}/.well-known/oauth-protected-resource/mcp`;
  ctx.status = 401;
  ctx.set('WWW-Authenticate', `Bearer resource_metadata="${resourceMetadata}"`);
  ctx.body = { error: 'invalid_token', error_description: description };
}

async function mcpAuthMiddleware(ctx, next) {
  const header = ctx.get('Authorization');
  if (!header || !header.startsWith('Bearer ')) {
    return reject(ctx, 'Missing or malformed Authorization header');
  }

  const token = header.slice(7);
  try {
    const decoded = jwt.verifyAccessToken(token);
    ctx.state.mcpUser = {
      email: decoded.email,
      name: decoded.name,
      client_id: decoded.client_id,
      scope: decoded.scope,
    };
    await next();
  } catch (err) {
    const description =
      err.name === 'TokenExpiredError' ? 'Token has expired' : 'Invalid token';
    return reject(ctx, description);
  }
}

module.exports = mcpAuthMiddleware;
