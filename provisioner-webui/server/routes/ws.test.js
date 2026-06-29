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

import { describe, it, expect, vi } from 'vitest';
import crypto from 'crypto';

vi.mock('../configmap', () => ({
  getMockUser: vi.fn(() => ({ mockUser: { email: 'mock@test.com', tenant: 'mock-tenant' } })),
  getMenuContent: vi.fn(() => []),
  getAWSRegions: vi.fn(() => ({ values: [], defaultValue: '' })),
  getTenantBasicAuth: vi.fn(() => null)
}));

vi.mock('../k8s', () => ({}));
vi.mock('../utils', () => ({
  handleError: vi.fn(),
  httpGet: vi.fn()
}));

const ws = await import('./ws.js');

describe('generateEtag', () => {
  it('should generate a quoted MD5 hash', () => {
    const result = ws.generateEtag({ key: 'value' });
    expect(result).toMatch(/^"[a-f0-9]{32}"$/);
  });

  it('should return same ETag for same content', () => {
    const a = ws.generateEtag({ x: 1 });
    const b = ws.generateEtag({ x: 1 });
    expect(a).toBe(b);
  });

  it('should return different ETag for different content', () => {
    const a = ws.generateEtag({ x: 1 });
    const b = ws.generateEtag({ x: 2 });
    expect(a).not.toBe(b);
  });

  it('should match manual MD5 computation', () => {
    const content = { hello: 'world' };
    const expected = `"${crypto.createHash('md5').update(JSON.stringify(content)).digest('hex')}"`;
    expect(ws.generateEtag(content)).toBe(expected);
  });

  it('should handle empty object', () => {
    const result = ws.generateEtag({});
    expect(result).toMatch(/^"[a-f0-9]{32}"$/);
  });

  it('should handle string content', () => {
    const result = ws.generateEtag('simple string');
    expect(result).toMatch(/^"[a-f0-9]{32}"$/);
  });
});

describe('getSsoUser', () => {
  it('should return passport user when session has passport data', () => {
    const ctx = {
      session: {
        passport: {
          user: { email: 'user@example.com', tenant: 'tenant1' }
        }
      }
    };
    const result = ws.getSsoUser(ctx);
    expect(result).toEqual({ email: 'user@example.com', tenant: 'tenant1' });
  });

  it('should return null when session has no passport', () => {
    const ctx = { session: {} };
    const result = ws.getSsoUser(ctx);
    expect(result).toBeNull();
  });

  it('should return null when session is undefined', () => {
    const ctx = {};
    const result = ws.getSsoUser(ctx);
    expect(result).toBeNull();
  });
});

function getRouteHandler(router, path) {
  const fullPath = '/cic2-ws/v1' + path;
  const layer = router.stack.find(
    (l) => l.path === fullPath && l.methods.includes('GET')
  );
  return layer ? layer.stack[0] : null;
}

describe('ui-properties route', () => {
  it('should have a GET /ui-properties route', () => {
    const handler = getRouteHandler(ws.public, '/ui-properties');
    expect(handler).toBeDefined();
  });

  it('should return ENABLE_UNRELEASED_FEATURE value from env', async () => {
    const originalValue = process.env.ENABLE_UNRELEASED_FEATURE;
    process.env.ENABLE_UNRELEASED_FEATURE = 'true';

    const ctx = { query: {}, status: 0, body: null };
    const next = vi.fn();
    await getRouteHandler(ws.public, '/ui-properties')(ctx, next);

    expect(ctx.status).toBe(200);
    expect(ctx.body).toHaveProperty('ENABLE_UNRELEASED_FEATURE', 'true');

    if (originalValue === undefined) {
      delete process.env.ENABLE_UNRELEASED_FEATURE;
    } else {
      process.env.ENABLE_UNRELEASED_FEATURE = originalValue;
    }
  });

  it('should return empty string when ENABLE_UNRELEASED_FEATURE is not set', async () => {
    const originalValue = process.env.ENABLE_UNRELEASED_FEATURE;
    delete process.env.ENABLE_UNRELEASED_FEATURE;

    const ctx = { query: {}, status: 0, body: null };
    const next = vi.fn();
    await getRouteHandler(ws.public, '/ui-properties')(ctx, next);

    expect(ctx.status).toBe(200);
    expect(ctx.body).toHaveProperty('ENABLE_UNRELEASED_FEATURE', '');

    if (originalValue !== undefined) {
      process.env.ENABLE_UNRELEASED_FEATURE = originalValue;
    }
  });
});

describe('module exports', () => {
  it('should export public router', () => {
    expect(ws.public).toBeDefined();
  });

  it('should export secure router', () => {
    expect(ws.secure).toBeDefined();
  });

  it('should export generateEtag function', () => {
    expect(typeof ws.generateEtag).toBe('function');
  });

  it('should export getSsoUser function', () => {
    expect(typeof ws.getSsoUser).toBe('function');
  });
});
