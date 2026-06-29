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
const configMap = require('../configmap');
const k8s = require('../k8s');

const sessions = new Map();
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;
const SESSION_CLEANUP_INTERVAL_MS = 30 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of sessions) {
    if (now - entry.createdAt > SESSION_MAX_AGE_MS) {
      entry.transport.close().catch(() => {});
      sessions.delete(id);
    }
  }
}, SESSION_CLEANUP_INTERVAL_MS).unref();

async function createMcpServer(user) {
  const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
  const { z } = await import('zod');

  const server = new McpServer({
    name: 'tibco-platform-provisioner',
    version: '1.0.0',
  });

  // whoami — Get current user identity
  server.tool('whoami', 'Get current user identity', {}, async () => {
    return { content: [{ type: 'text', text: JSON.stringify(user) }] };
  });

  // listAccounts — List accounts accessible by the current user
  server.tool('listAccounts', 'List accounts accessible by the current user', {}, async () => {
    try {
      const accounts = configMap.getAccountBySsoUser(user.email);
      return { content: [{ type: 'text', text: JSON.stringify(accounts, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
    }
  });

  // listPipelines — List available pipeline templates
  server.tool('listPipelines', 'List available pipeline templates', {}, async () => {
    try {
      const accounts = configMap.getAccountBySsoUser(user.email);
      const templates = await k8s.getPipelineTemplates(accounts);
      return { content: [{ type: 'text', text: JSON.stringify(templates, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
    }
  });

  // listPipelineRuns — List pipeline runs with optional label selector
  server.tool(
    'listPipelineRuns',
    'List pipeline runs with optional label selector. By default returns only runs created by the current user. Set allUsers=true to list all runs.',
    {
      labelSelector: z.string().optional().describe(
        'K8s label selector. Short keys like "create-by", "account", "name" are auto-prefixed with the configured label domain.'
      ),
      allUsers: z.boolean().optional().describe(
        'If true, list all pipeline runs. If false/omitted, only list runs created by the current user.'
      ),
    },
    async ({ labelSelector, allUsers }) => {
      try {
        let selector = labelSelector || '';
        // Auto-prefix short label keys with the configured domain
        const labelPrefix = (process.env.PIPELINE_TEMPLATE_LABEL_KEY_CREATE_BY || 'created-by').replace(/\/create-by$/, '');
        if (selector) {
          selector = selector.replace(/(?<![a-zA-Z0-9./])(?:create-by|account|action|name|note)(?==)/g, (key) => {
            const envMap = {
              'create-by': process.env.PIPELINE_TEMPLATE_LABEL_KEY_CREATE_BY,
              'account': process.env.PIPELINE_TEMPLATE_LABEL_KEY_ACCOUNT,
              'action': process.env.PIPELINE_TEMPLATE_LABEL_KEY_ACTION,
              'name': process.env.PIPELINE_TEMPLATE_LABEL_KEY_NAME,
              'note': process.env.PIPELINE_TEMPLATE_LABEL_KEY_NOTE,
            };
            return envMap[key] || key;
          });
        }
        if (!allUsers && !selector.includes(process.env.PIPELINE_TEMPLATE_LABEL_KEY_CREATE_BY || 'created-by')) {
          const emailPrefix = user.email.split('@')[0].replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 63);
          const createByKey = process.env.PIPELINE_TEMPLATE_LABEL_KEY_CREATE_BY || 'created-by';
          const userFilter = `${createByKey}=${emailPrefix}`;
          selector = selector ? `${selector},${userFilter}` : userFilter;
        }
        const result = await k8s.getPipelineRuns({}, { labelSelector: selector || undefined });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  // getPipelineRun — Get details of a specific pipeline run
  server.tool(
    'getPipelineRun',
    'Get details of a specific pipeline run',
    { pipelineRunId: z.string() },
    async ({ pipelineRunId }) => {
      try {
        const result = await k8s.getPipelineRun({}, { pipelineRunId });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  // createPipelineRun — Create and run a new pipeline
  server.tool(
    'createPipelineRun',
    'Create and run a new pipeline',
    {
      pipeline: z.string(),
      account: z.string(),
      region: z.string(),
      content: z.string(),
      note: z.string().optional(),
    },
    async ({ pipeline, account, region, content, note }) => {
      try {
        const accounts = configMap.getAccountBySsoUser(user.email);
        const contentObj = JSON.parse(content);
        if (note) {
          contentObj.meta = contentObj.meta || {};
          contentObj.meta.guiEnv = contentObj.meta.guiEnv || {};
          contentObj.meta.guiEnv.note = note;
        }
        const body = {
          aws: { pipeline, account, region },
          createdBy: { email: user.email },
          content: contentObj,
        };
        const result = await k8s.runPipeline(body, {}, accounts);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  // stopPipelineRun — Stop a running pipeline
  server.tool(
    'stopPipelineRun',
    'Stop a running pipeline',
    { pipelineRunId: z.string() },
    async ({ pipelineRunId }) => {
      try {
        const result = await k8s.stopPipelineRun({}, { pipelineRunId });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  // deletePipelineRun — Delete a pipeline run
  server.tool(
    'deletePipelineRun',
    'Delete a pipeline run',
    { pipelineRunId: z.string() },
    async ({ pipelineRunId }) => {
      try {
        const result = await k8s.deletePipelineRun({}, { pipelineRunId });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  // loadRecipe — Load a recipe configuration
  server.tool(
    'loadRecipe',
    'Load a recipe configuration by deployType (e.g. "tp-base" loads ConfigMap "deploy-tp-base")',
    {
      deployType: z.string(),
    },
    async ({ deployType }) => {
      try {
        const result = await k8s.loadPayload({}, { configMapName: 'deploy-' + deployType });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  // getRecipe — Fetch a published recipe template by title (per-user OAuth; no team API key)
  server.tool(
    'getRecipe',
    'Fetch a published recipe template by title — the same payload as REST GET /cic2/public/v1/recipe?title=, served over per-user OAuth (no shared PROVISIONER_API_KEY needed). Returns the recipe config: UI form metadata plus the full pipeline recipe as a YAML string under "recipe". ' +
      'LARGE RESPONSE: ~22KB for the biggest bundled recipe, ~88KB for production deploy-tp-on-prem-gcp-k3s, and may grow. Consume it via the provisioner-mcp.py subprocess wrapper writing to a file (get-recipe --title ... -o recipe.json) so the payload stays out of the agent context — do not inline it. Use listRecipes to discover valid titles.',
    {
      title: z.string().describe(
        'Recipe title, e.g. "deploy-tp-on-prem-gcp-k3s" (as listed by listRecipes / shown in the UI catalog).'
      ),
      pipeline: z.string().optional().describe(
        'Optional pipeline type to narrow the lookup, e.g. "generic-runner".'
      ),
    },
    async ({ title, pipeline }) => {
      try {
        const result = configMap.getRecipeByTitle(title, pipeline || null);
        if (result.error) {
          return { content: [{ type: 'text', text: 'Error: ' + result.error }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result.recipe, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  // listRecipes — List published recipe titles (mirrors the UI catalog)
  server.tool(
    'listRecipes',
    'List the published recipe templates available by title (mirrors the UI catalog). Returns title/label/pipeline/config for each entry; pass a title to getRecipe to fetch the full template. Authenticated by per-user OAuth (no team API key). Small response (one line per recipe).',
    {},
    async () => {
      try {
        const recipes = configMap.listRecipes();
        return { content: [{ type: 'text', text: JSON.stringify(recipes, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  // saveRecipe — Save a recipe configuration
  server.tool(
    'saveRecipe',
    'Save a recipe configuration',
    {
      account: z.string(),
      region: z.string(),
      deployType: z.string(),
      content: z.string(),
    },
    async ({ account, region, deployType, content }) => {
      try {
        const contentObj = JSON.parse(content);
        const body = {
          aws: { account, region },
          createdBy: { email: user.email },
          content: contentObj,
        };
        const result = await k8s.savePayload(body, { deployType });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  // getTaskRunDetails — Get details of a specific task run
  server.tool(
    'getTaskRunDetails',
    'Get details of a specific task run',
    { taskRunId: z.string() },
    async ({ taskRunId }) => {
      try {
        const result = await k8s.getTaskRun({}, { taskRunId });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  // getContainerLog — Get logs from a container
  server.tool(
    'getContainerLog',
    'Get logs from a container',
    {
      pod: z.string(),
      container: z.string(),
      tailLines: z.number().optional(),
    },
    async ({ pod, container, tailLines }) => {
      try {
        const result = await k8s.getContainerLog({ pod, container }, false, tailLines || 1000);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  return server;
}

async function handleMcpRequest(ctx) {
  const { StreamableHTTPServerTransport } = await import(
    '@modelcontextprotocol/sdk/server/streamableHttp.js'
  );

  const sessionId = ctx.get('mcp-session-id');
  const user = ctx.state.mcpUser;

  if (ctx.method === 'GET') {
    // SSE connection for notifications
    const existing = sessions.get(sessionId);
    if (!existing) {
      ctx.status = 400;
      ctx.body = { error: 'Invalid session' };
      return;
    }
    ctx.respond = false;
    await existing.transport.handleRequest(ctx.req, ctx.res);
    return;
  }

  if (ctx.method === 'DELETE') {
    const existing = sessions.get(sessionId);
    if (existing) {
      await existing.transport.close();
      sessions.delete(sessionId);
    }
    ctx.status = 200;
    ctx.body = { ok: true };
    return;
  }

  // POST — existing session
  if (sessionId && sessions.has(sessionId)) {
    const existing = sessions.get(sessionId);
    ctx.respond = false;
    await existing.transport.handleRequest(ctx.req, ctx.res, ctx.request.body);
    return;
  }

  // POST — new session (initialize message)
  const server = await createMcpServer(user);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
    onsessioninitialized: (id) => {
      sessions.set(id, { transport, server, user, createdAt: Date.now() });
    },
  });

  await server.connect(transport);
  ctx.respond = false;
  await transport.handleRequest(ctx.req, ctx.res, ctx.request.body);
}

module.exports = {
  handleMcpRequest,
  createMcpServer,
};
