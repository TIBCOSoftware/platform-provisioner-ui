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

const oauth = await import('./oauth.js');

const mockGetAccountBySsoUser = vi.fn();
oauth._deps.configMap = { getAccountBySsoUser: mockGetAccountBySsoUser };

const mockCreateAccessToken = vi.fn(() => 'mock-access-token');
const mockCreateRefreshToken = vi.fn(() => 'mock-refresh-token');
const mockConsumeRefreshToken = vi.fn();
oauth._deps.jwt = {
  createAccessToken: mockCreateAccessToken,
  createRefreshToken: mockCreateRefreshToken,
  consumeRefreshToken: mockConsumeRefreshToken,
};

describe('getProtectedResourceMetadata', () => {
  it('should return correct structure', () => {
    const result = oauth.getProtectedResourceMetadata('https://example.com');
    expect(result).toEqual({
      resource: 'https://example.com/mcp',
      authorization_servers: ['https://example.com'],
      bearer_methods_supported: ['header'],
    });
  });
});

describe('getAuthorizationServerMetadata', () => {
  it('should return correct endpoints structure', () => {
    const result = oauth.getAuthorizationServerMetadata('https://example.com');
    expect(result).toEqual({
      issuer: 'https://example.com',
      authorization_endpoint: 'https://example.com/oauth/authorize',
      token_endpoint: 'https://example.com/oauth/token',
      registration_endpoint: 'https://example.com/oauth/register',
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      scopes_supported: ['mcp'],
    });
  });
});

describe('registerClient', () => {
  it('should return client with client_id and redirect_uris', () => {
    const result = oauth.registerClient({
      redirect_uris: ['https://example.com/callback'],
      client_name: 'Test Client',
    });
    expect(result).toHaveProperty('client_id');
    expect(typeof result.client_id).toBe('string');
    expect(result.redirect_uris).toEqual(['https://example.com/callback']);
    expect(result.client_name).toBe('Test Client');
  });

  it('should return error for missing redirect_uris', () => {
    const result = oauth.registerClient({});
    expect(result).toHaveProperty('error', 'invalid_client_metadata');
  });

  it('should return error for empty redirect_uris', () => {
    const result = oauth.registerClient({ redirect_uris: [] });
    expect(result).toHaveProperty('error', 'invalid_client_metadata');
  });
});

function registerTestClient() {
  return oauth.registerClient({
    redirect_uris: ['https://example.com/callback'],
    client_name: 'Test Client',
  });
}

describe('generateAuthCode', () => {
  it('should return error for unknown client_id', () => {
    const result = oauth.generateAuthCode({
      email: 'user@example.com',
      client_id: 'unknown-client',
      redirect_uri: 'https://example.com/callback',
    });
    expect(result).toHaveProperty('error', 'invalid_request');
    expect(result).toHaveProperty('error_description', 'Unknown client_id');
  });

  it('should return error for mismatched redirect_uri', () => {
    const client = registerTestClient();
    const result = oauth.generateAuthCode({
      email: 'user@example.com',
      client_id: client.client_id,
      redirect_uri: 'https://evil.com/steal',
    });
    expect(result).toHaveProperty('error', 'invalid_request');
    expect(result).toHaveProperty('error_description', 'redirect_uri does not match registered URIs');
  });

  it('should return error when user has no accounts', () => {
    mockGetAccountBySsoUser.mockReturnValue([]);
    const client = registerTestClient();
    const result = oauth.generateAuthCode({
      email: 'user@example.com',
      client_id: client.client_id,
      redirect_uri: 'https://example.com/callback',
    });
    expect(result).toHaveProperty('error', 'access_denied');
    expect(result).toHaveProperty('error_description', 'No accounts found for this user');
  });

  it('should return code and state on success', () => {
    mockGetAccountBySsoUser.mockReturnValue([{ roles: [] }]);
    const client = registerTestClient();
    const result = oauth.generateAuthCode({
      email: 'user@example.com',
      client_id: client.client_id,
      redirect_uri: 'https://example.com/callback',
      state: 'test-state',
      code_challenge: 'test-challenge',
      code_challenge_method: 'S256',
    });
    expect(result).toHaveProperty('code');
    expect(typeof result.code).toBe('string');
    expect(result.code.length).toBeGreaterThan(0);
    expect(result).toHaveProperty('state', 'test-state');
    expect(result).toHaveProperty('redirectUri', 'https://example.com/callback');
  });
});

describe('exchangeToken', () => {
  it('should return error for unsupported_grant_type', () => {
    const result = oauth.exchangeToken({ grant_type: 'client_credentials' });
    expect(result).toHaveProperty('error', 'unsupported_grant_type');
  });

  it('should return access_token for valid authorization_code flow with PKCE', () => {
    mockGetAccountBySsoUser.mockReturnValue([{ roles: [] }]);
    const client = registerTestClient();

    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

    const authResult = oauth.generateAuthCode({
      email: 'user@example.com',
      client_id: client.client_id,
      redirect_uri: 'https://example.com/callback',
      state: 'test-state',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    expect(authResult).toHaveProperty('code');

    const tokenResult = oauth.exchangeToken({
      grant_type: 'authorization_code',
      code: authResult.code,
      code_verifier: codeVerifier,
      redirect_uri: 'https://example.com/callback',
      client_id: client.client_id,
    });
    expect(tokenResult).toHaveProperty('access_token', 'mock-access-token');
    expect(tokenResult).toHaveProperty('token_type', 'bearer');
    expect(tokenResult).toHaveProperty('expires_in', 28800);
    expect(tokenResult).toHaveProperty('refresh_token', 'mock-refresh-token');
    expect(tokenResult).toHaveProperty('scope', 'mcp');
  });

  it('should return error for invalid code', () => {
    const result = oauth.exchangeToken({
      grant_type: 'authorization_code',
      code: 'invalid-code',
      code_verifier: 'some-verifier',
    });
    expect(result).toHaveProperty('error', 'invalid_grant');
  });

  it('should return new tokens for valid refresh_token flow', () => {
    mockConsumeRefreshToken.mockReturnValue({
      email: 'user@example.com',
      clientId: 'test-client',
    });
    const result = oauth.exchangeToken({
      grant_type: 'refresh_token',
      refresh_token: 'valid-refresh-token',
    });
    expect(result).toHaveProperty('access_token', 'mock-access-token');
    expect(result).toHaveProperty('token_type', 'bearer');
    expect(result).toHaveProperty('refresh_token', 'mock-refresh-token');
    expect(result).toHaveProperty('scope', 'mcp');
  });
});
