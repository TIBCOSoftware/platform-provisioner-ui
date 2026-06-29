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

// Capture tool registrations by stubbing the MCP SDK's McpServer.
const registered = new Map();
vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: class {
    tool(name, description, schema, handler) {
      registered.set(name, { description, schema, handler });
    }
  },
}));

const { createMcpServer } = await import('./server.js');

// The recipe-payload logic (getRecipeByTitle / listRecipes against real recipe
// files) is covered in server/configmap.test.js — the same lookup the REST
// /recipe endpoint uses. These tests cover what the MCP layer itself owns:
// tool registration, input contract, the large-payload docs, and that the
// handlers wrap the shared lookup (success → text content, failure → isError).
describe('MCP recipe tools', () => {
  beforeEach(async () => {
    registered.clear();
    await createMcpServer({ email: 'user@example.com', name: 'User' });
  });

  it('registers getRecipe and listRecipes', () => {
    expect(registered.has('getRecipe')).toBe(true);
    expect(registered.has('listRecipes')).toBe(true);
  });

  it('getRecipe declares a required title and an optional pipeline input', () => {
    const { schema } = registered.get('getRecipe');
    expect(Object.keys(schema)).toEqual(expect.arrayContaining(['title', 'pipeline']));
  });

  it('getRecipe documents per-user OAuth and the large-payload subprocess pattern', () => {
    const { description } = registered.get('getRecipe');
    expect(description).toMatch(/per-user OAuth/i);
    expect(description).toMatch(/provisioner-mcp\.py/);
    expect(description).toMatch(/88KB/);
  });

  it('getRecipe surfaces an unresolvable title as an MCP error', async () => {
    const { handler } = registered.get('getRecipe');
    const res = await handler({ title: '__no_such_recipe__' });
    expect(res.isError).toBe(true);
    expect(res.content[0].type).toBe('text');
    expect(res.content[0].text).toMatch(/^Error: /);
  });

  it('listRecipes takes no input and returns JSON text content', async () => {
    const { schema, handler } = registered.get('listRecipes');
    expect(schema).toEqual({});
    const res = await handler({});
    expect(res.isError).toBeFalsy();
    expect(res.content[0].type).toBe('text');
    // Always valid JSON (an array), even when the menu config is unavailable.
    expect(Array.isArray(JSON.parse(res.content[0].text))).toBe(true);
  });
});
