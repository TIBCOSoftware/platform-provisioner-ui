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

process.env.MCP_JWT_SECRET = 'test-secret';

import { describe, it, expect, vi } from 'vitest';
import jsonwebtoken from 'jsonwebtoken';

const jwt = await import('./jwt.js');

describe('createAccessToken', () => {
  it('should return a non-empty string', () => {
    const token = jwt.createAccessToken({
      email: 'user@example.com',
      name: 'Test User',
      client_id: 'test-client',
      scope: 'mcp',
    });
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
  });

  it('should be verifiable with verifyAccessToken', () => {
    const token = jwt.createAccessToken({
      email: 'user@example.com',
      name: 'Test User',
      client_id: 'test-client',
      scope: 'mcp',
    });
    const decoded = jwt.verifyAccessToken(token);
    expect(decoded).toBeDefined();
  });

  it('should contain email, name, client_id, scope, sub, exp, iat in decoded token', () => {
    const token = jwt.createAccessToken({
      email: 'user@example.com',
      name: 'Test User',
      client_id: 'test-client',
      scope: 'mcp',
    });
    const decoded = jwt.verifyAccessToken(token);
    expect(decoded.email).toBe('user@example.com');
    expect(decoded.name).toBe('Test User');
    expect(decoded.client_id).toBe('test-client');
    expect(decoded.scope).toBe('mcp');
    expect(decoded.sub).toBe('user@example.com');
    expect(decoded.exp).toEqual(expect.any(Number));
    expect(decoded.iat).toEqual(expect.any(Number));
  });
});

describe('verifyAccessToken', () => {
  it('should return decoded payload for valid token', () => {
    const token = jwt.createAccessToken({
      email: 'verify@example.com',
      name: 'Verify User',
      client_id: 'verify-client',
      scope: 'mcp',
    });
    const decoded = jwt.verifyAccessToken(token);
    expect(decoded.email).toBe('verify@example.com');
    expect(decoded.name).toBe('Verify User');
  });

  it('should throw for invalid token', () => {
    expect(() => jwt.verifyAccessToken('not-a-valid-token')).toThrow();
  });

  it('should throw for token signed with different secret', () => {
    const token = jsonwebtoken.sign(
      { email: 'wrong@example.com', sub: 'wrong@example.com' },
      'wrong-secret',
      { algorithm: 'HS256' },
    );
    expect(() => jwt.verifyAccessToken(token)).toThrow();
  });
});

describe('createRefreshToken / consumeRefreshToken', () => {
  it('should create a non-empty string token', () => {
    const token = jwt.createRefreshToken('refresh@example.com', 'client-1');
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
  });

  it('should return { email, clientId } for valid token', () => {
    const token = jwt.createRefreshToken('refresh@example.com', 'client-1');
    const result = jwt.consumeRefreshToken(token);
    expect(result).toEqual({
      email: 'refresh@example.com',
      clientId: 'client-1',
    });
  });

  it('should return null after first consumption (single-use)', () => {
    const token = jwt.createRefreshToken('once@example.com', 'client-2');
    jwt.consumeRefreshToken(token);
    const second = jwt.consumeRefreshToken(token);
    expect(second).toBeNull();
  });

  it('should return null for unknown token', () => {
    const result = jwt.consumeRefreshToken('nonexistent-token');
    expect(result).toBeNull();
  });
});
