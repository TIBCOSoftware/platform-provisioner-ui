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

process.env.MCP_JWT_SECRET = 'test-secret-middleware';

import { describe, it, expect, vi } from 'vitest';

const jwt = await import('./jwt.js');
const { default: mcpAuthMiddleware } = await import('./auth-middleware.js');

function createCtx(authHeader) {
  return {
    get: vi.fn((name) => {
      if (name === 'Authorization') return authHeader;
      return undefined;
    }),
    set: vi.fn(),
    protocol: 'http',
    host: 'localhost:8080',
    state: {},
    status: undefined,
    body: undefined,
  };
}

describe('mcpAuthMiddleware', () => {
  it('should call next and populate ctx.state.mcpUser for a valid token', async () => {
    const token = jwt.createAccessToken({
      email: 'user@example.com',
      name: 'Test User',
      client_id: 'test-client',
      scope: 'mcp',
    });
    const ctx = createCtx(`Bearer ${token}`);
    const next = vi.fn();

    await mcpAuthMiddleware(ctx, next);

    expect(next).toHaveBeenCalledOnce();
    expect(ctx.state.mcpUser).toEqual({
      email: 'user@example.com',
      name: 'Test User',
      client_id: 'test-client',
      scope: 'mcp',
    });
  });

  it('should return 401 with resource_metadata when Authorization header is missing', async () => {
    const ctx = createCtx(undefined);
    const next = vi.fn();

    await mcpAuthMiddleware(ctx, next);

    expect(ctx.status).toBe(401);
    expect(ctx.body.error).toBe('invalid_token');
    expect(ctx.set).toHaveBeenCalledWith(
      'WWW-Authenticate',
      'Bearer resource_metadata="http://localhost:8080/.well-known/oauth-protected-resource/mcp"'
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 for an invalid token', async () => {
    const ctx = createCtx('Bearer invalid-token');
    const next = vi.fn();

    await mcpAuthMiddleware(ctx, next);

    expect(ctx.status).toBe(401);
    expect(ctx.body.error).toBe('invalid_token');
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 for non-Bearer auth scheme', async () => {
    const ctx = createCtx('Basic abc123');
    const next = vi.fn();

    await mcpAuthMiddleware(ctx, next);

    expect(ctx.status).toBe(401);
    expect(ctx.body.error).toBe('invalid_token');
    expect(next).not.toHaveBeenCalled();
  });
});
