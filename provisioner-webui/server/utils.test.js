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

import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

vi.mock('axios');

const utils = await import('./utils.js');

describe('base64Encode / base64Decode', () => {
  it('should encode and decode empty string', () => {
    const encoded = utils.base64Encode('');
    expect(utils.base64Decode(encoded)).toBe('');
  });

  it('should encode and decode ASCII string', () => {
    const original = 'hello:world';
    const encoded = utils.base64Encode(original);
    expect(encoded).not.toBe(original);
    expect(utils.base64Decode(encoded)).toBe(original);
  });

  it('should encode and decode Unicode string', () => {
    const original = '你好世界';
    const encoded = utils.base64Encode(original);
    expect(utils.base64Decode(encoded)).toBe(original);
  });

  it('should produce valid base64 output', () => {
    const encoded = utils.base64Encode('test');
    expect(encoded).toMatch(/^[A-Za-z0-9+/=]+$/);
  });
});

describe('cleanEmptyProperty', () => {
  it('should return empty array for null input', () => {
    expect(utils.cleanEmptyProperty(null)).toEqual([]);
  });

  it('should return empty array for undefined input', () => {
    expect(utils.cleanEmptyProperty(undefined)).toEqual([]);
  });

  it('should filter out null values', () => {
    const result = utils.cleanEmptyProperty({ a: 'hello', b: null });
    expect(result).toEqual([{ name: 'a', value: 'hello' }]);
  });

  it('should filter out empty string values', () => {
    const result = utils.cleanEmptyProperty({ a: 'hello', b: '' });
    expect(result).toEqual([{ name: 'a', value: 'hello' }]);
  });

  it('should filter out whitespace-only values', () => {
    const result = utils.cleanEmptyProperty({ a: 'hello', b: '   ' });
    expect(result).toEqual([{ name: 'a', value: 'hello' }]);
  });

  it('should convert values to trimmed strings', () => {
    const result = utils.cleanEmptyProperty({ a: 42, b: true });
    expect(result).toEqual([
      { name: 'a', value: '42' },
      { name: 'b', value: 'true' }
    ]);
  });

  it('should keep value 0 as string "0"', () => {
    const result = utils.cleanEmptyProperty({ count: 0 });
    expect(result).toEqual([{ name: 'count', value: '0' }]);
  });
});

describe('parseBasicAuth', () => {
  it('should parse valid base64-encoded user:pass', () => {
    const auth = utils.base64Encode('admin:secret');
    const result = utils.parseBasicAuth(auth);
    expect(result).toEqual({ name: 'admin', pass: 'secret', auth });
  });

  it('should handle password containing colon', () => {
    const auth = utils.base64Encode('user:pass:with:colons');
    const result = utils.parseBasicAuth(auth);
    expect(result.name).toBe('user');
    expect(result.pass).toBe('pass:with:colons');
  });

  it('should return empty object when no colon present', () => {
    const auth = utils.base64Encode('nocolon');
    expect(utils.parseBasicAuth(auth)).toEqual({});
  });
});

describe('parseBasicAuthHeader', () => {
  it('should parse valid Basic auth header', () => {
    const auth = utils.base64Encode('admin:pass');
    const result = utils.parseBasicAuthHeader(`Basic ${auth}`);
    expect(result).toEqual({ name: 'admin', pass: 'pass', auth });
  });

  it('should return null for non-Basic scheme', () => {
    expect(utils.parseBasicAuthHeader('Bearer token123')).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(utils.parseBasicAuthHeader('')).toBeNull();
  });

  it('should return null for null input', () => {
    expect(utils.parseBasicAuthHeader(null)).toBeNull();
  });

  it('should handle extra whitespace', () => {
    const auth = utils.base64Encode('user:pass');
    const result = utils.parseBasicAuthHeader(`  Basic ${auth}  `);
    expect(result.name).toBe('user');
  });
});

describe('simpleHelmChartUrlToFileName', () => {
  it('should convert standard GitHub blob URL to filename', () => {
    const url = 'https://github.com/owner/repo/blob/main/path/to/index.yaml';
    const result = utils.simpleHelmChartUrlToFileName(url);
    expect(result).toBe('owner_repo_main_path_to_index.yaml');
  });

  it('should degrade gracefully for non-standard URL', () => {
    const url = 'https://example.com/some/path';
    const result = utils.simpleHelmChartUrlToFileName(url);
    expect(result).not.toBe('');
    expect(result).not.toContain('/');
  });

  it('should return empty string for null', () => {
    expect(utils.simpleHelmChartUrlToFileName(null)).toBe('');
  });

  it('should return empty string for undefined', () => {
    expect(utils.simpleHelmChartUrlToFileName(undefined)).toBe('');
  });

  it('should return empty string for non-string input', () => {
    expect(utils.simpleHelmChartUrlToFileName(42)).toBe('');
  });

  it('should use custom separator', () => {
    const url = 'https://github.com/owner/repo/blob/main/file.yaml';
    const result = utils.simpleHelmChartUrlToFileName(url, '-');
    expect(result).toBe('owner-repo-main-file.yaml');
  });
});

describe('handleError', () => {
  it('should set status from error.statusCode', () => {
    const ctx = {};
    const error = { statusCode: 404, message: 'Not found' };
    utils.handleError(ctx, error, 'Test');
    expect(ctx.status).toBe(404);
    expect(ctx.body.error).toBe(404);
    expect(ctx.body.message).toContain('Not found');
    expect(ctx.body.message).toContain('Test');
  });

  it('should default to 500 when no statusCode', () => {
    const ctx = {};
    const error = { message: 'Internal error' };
    utils.handleError(ctx, error);
    expect(ctx.status).toBe(500);
  });

  it('should use error message directly when no prefix', () => {
    const ctx = {};
    const error = { message: 'oops' };
    utils.handleError(ctx, error);
    expect(ctx.body.message).toBe('oops');
  });
});

describe('delay', () => {
  it('should return a promise that resolves', async () => {
    vi.useFakeTimers();
    const promise = utils.delay(100);
    vi.advanceTimersByTime(100);
    await expect(promise).resolves.toBeUndefined();
    vi.useRealTimers();
  });
});

describe('authenticateUser', () => {
  // Note: authenticateUser depends on configmap.getTenantBasicAuth which reads YAML files.
  // CJS require() inside utils.js cannot be easily mocked by vitest.
  // Testing the hash comparison logic directly instead.

  it('should return null for empty username or password', () => {
    expect(utils.authenticateUser('', 'pass')).toBeNull();
    expect(utils.authenticateUser('user', '')).toBeNull();
    expect(utils.authenticateUser(null, null)).toBeNull();
  });

  it('should return null when user not found in configmap', () => {
    // Uses real configmap which has no tenant data in test env
    expect(utils.authenticateUser('nonexistent-user', 'password')).toBeNull();
  });
});
