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

const Router = require('koa-router');
const oauth = require('../mcp/oauth');
const mcpAuth = require('../mcp/auth-middleware');
const configMap = require('../configmap');
const { handleMcpRequest } = require('../mcp/server');

const isOnPrem = process.env.ON_PREM_MODE === 'true';

function getBaseUrl(ctx) {
  const proto = ctx.get('x-forwarded-proto') || ctx.protocol;
  const host = ctx.get('x-forwarded-host') || ctx.host;
  return process.env.MCP_BASE_URL || `${proto}://${host}`;
}

function buildOAuthCallbackUrl(ctx) {
  const params = new URLSearchParams();
  for (const key of ['client_id', 'redirect_uri', 'state', 'code_challenge',
                      'code_challenge_method', 'scope', 'response_type']) {
    if (ctx.query[key]) params.set(key, ctx.query[key]);
  }
  return '/oauth/authorize?' + params.toString();
}

const publicRouter = new Router();

publicRouter.get('/.well-known/oauth-protected-resource/mcp', async (ctx) => {
  ctx.body = oauth.getProtectedResourceMetadata(getBaseUrl(ctx));
});

publicRouter.get('/.well-known/oauth-authorization-server', async (ctx) => {
  ctx.body = oauth.getAuthorizationServerMetadata(getBaseUrl(ctx));
});

publicRouter.post('/oauth/register', async (ctx) => {
  const result = oauth.registerClient(ctx.request.body);
  ctx.body = result;
  ctx.status = result.error ? 400 : 201;
});

publicRouter.get('/oauth/authorize', async (ctx) => {
  let email;

  if (isOnPrem) {
    email = configMap.getMockUser().mockUser.email;
  } else if (ctx.session && ctx.session.passport && ctx.session.passport.user) {
    email = ctx.session.passport.user.email;
  } else {
    const callbackUrl = buildOAuthCallbackUrl(ctx);
    ctx.redirect('/auth/login?callbackUrl=' + encodeURIComponent(callbackUrl));
    return;
  }

  const result = oauth.generateAuthCode({
    email,
    client_id: ctx.query.client_id,
    redirect_uri: ctx.query.redirect_uri,
    code_challenge: ctx.query.code_challenge,
    code_challenge_method: ctx.query.code_challenge_method,
    state: ctx.query.state,
  });

  if (result.error) {
    ctx.status = 400;
    ctx.body = result;
    return;
  }

  const url = new URL(result.redirectUri);
  url.searchParams.set('code', result.code);
  if (result.state) {
    url.searchParams.set('state', result.state);
  }
  ctx.redirect(url.toString());
});

publicRouter.post('/oauth/token', async (ctx) => {
  const result = oauth.exchangeToken(ctx.request.body);
  if (result.error) {
    ctx.status = 400;
  }
  ctx.body = result;
});

const secureRouter = new Router();

secureRouter.all('/mcp', mcpAuth, async (ctx) => {
  await handleMcpRequest(ctx);
});

module.exports = {
  public: publicRouter,
  secure: secureRouter,
};
