# MCP Server for Platform Provisioner

## Overview

The platform-provisioner-ui includes an MCP (Model Context Protocol) server that allows Claude Code to directly manage recipes and pipelines. It uses OAuth 2.1 with PKCE for authentication, integrated with the existing SAML SSO system.

**Key benefit**: When Claude creates pipelines via MCP, it uses `createdBy: { email }` — the `created-by` K8s label shows the individual user (e.g., `tao.peng`), not a group name like `tropos-team`.

## Architecture

```
Claude Code → POST /mcp [Bearer JWT]
  → auth-middleware verifies JWT → extracts user email
  → MCP tool handler → k8s.runPipeline({ createdBy: { email } })
  → K8s labels: created-by = "tao.peng"
```

## Authentication Flow

### SAML Mode (staging / production, `ON_PREM_MODE=false`)

```
Claude Code → GET /oauth/authorize?client_id=X&redirect_uri=Y&code_challenge=Z&state=S
  → No SAML session → 302 /auth/login?callbackUrl=/oauth/authorize?...
  → SAML IdP authentication → POST /saml/acscallback → create session
  → 302 /oauth/authorize?... (with SAML session cookie)
  → Has SAML session → generateAuthCode(email) → 302 redirect_uri?code=C&state=S
  → POST /oauth/token → JWT access_token
```

### Local Mode (on-prem, `ON_PREM_MODE=true`)

```
Claude Code → GET /oauth/authorize?client_id=X&redirect_uri=Y&code_challenge=Z&state=S
  → Read mock user (admin@cloud.com)
  → generateAuthCode(email) → 302 redirect_uri?code=C&state=S
  → POST /oauth/token → JWT access_token
```

### Token Lifecycle

| Token | Lifetime | Behavior |
|-------|----------|----------|
| Access token | 8 hours | Auto-refreshed by Claude Code MCP SDK — transparent to user |
| Refresh token | 30 days | On expiry, user must re-authorize via SAML SSO |

Daily use is seamless — Claude Code handles token refresh automatically. Users only need to re-authorize when the refresh token expires (30 days) or when the server pod restarts (refresh tokens are stored in memory).

Re-authorization is quick: if the user's SAML IdP session is still active, the browser redirect completes in seconds without entering credentials.

## Server Components

### Files

| File | Purpose |
|------|---------|
| `server/mcp/jwt.js` | JWT token management (access: 8h, refresh: 30d) |
| `server/mcp/oauth.js` | OAuth2 authorization server (metadata, registration, auth code, token exchange) |
| `server/mcp/auth-middleware.js` | Bearer token validation with RFC 9728 `resource_metadata` discovery |
| `server/mcp/server.js` | MCP server with 14 tools via Streamable HTTP transport |
| `server/routes/mcp.js` | Koa route mounting (public OAuth + secure MCP endpoints) |

### OAuth Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/.well-known/oauth-protected-resource/mcp` | GET | RFC 9728 Protected Resource Metadata |
| `/.well-known/oauth-authorization-server` | GET | RFC 8414 Authorization Server Metadata |
| `/oauth/register` | POST | Dynamic Client Registration (RFC 7591) |
| `/oauth/authorize` | GET | Authorization Code + PKCE (SAML SSO or mock user) |
| `/oauth/token` | POST | Token exchange + refresh |

### MCP Tools (14)

| Tool | Input | Purpose |
|------|-------|---------|
| `whoami` | `{}` | Returns user identity from JWT |
| `listAccounts` | `{}` | User's accessible accounts |
| `listPipelines` | `{}` | Available pipeline templates |
| `listPipelineRuns` | `{ labelSelector?, allUsers? }` | Pipeline runs (default: current user only; `allUsers: true` for all) |
| `getPipelineRun` | `{ pipelineRunId }` | Full run details |
| `createPipelineRun` | `{ pipeline, account, region, content, note? }` | Create and run a pipeline |
| `stopPipelineRun` | `{ pipelineRunId }` | Cancel running pipeline |
| `deletePipelineRun` | `{ pipelineRunId }` | Delete pipeline run |
| `loadRecipe` | `{ deployType }` | Load a **user-draft** recipe from a `deploy-<type>` ConfigMap (only recipes previously written by `saveRecipe`) |
| `listRecipes` | `{}` | List the **published** recipe templates by title (mirrors the UI catalog); pass a title to `getRecipe` |
| `getRecipe` | `{ title, pipeline? }` | Fetch a **published** recipe template by title — same payload as REST `GET /cic2/public/v1/recipe?title=`, over per-user OAuth (no team `PROVISIONER_API_KEY`). **Large response** (~22KB bundled, ~88KB for `deploy-tp-on-prem-gcp-k3s`, may grow): consume via the `provisioner-mcp.py get-recipe --title … -o <file>` subprocess wrapper, not as an inline agent call |
| `saveRecipe` | `{ account, region, deployType, content }` | Save recipe configuration |
| `getTaskRunDetails` | `{ taskRunId }` | Task run details |
| `getContainerLog` | `{ pod, container, tailLines? }` | Container logs |

> **`getRecipe` vs `loadRecipe`:** `getRecipe` reads the **published** recipe catalog (the templates the UI lists, served by the same in-process lookup as the REST `/recipe` endpoint — `menuContent` → recipe YAML). `loadRecipe` reads a **user draft** previously persisted by `saveRecipe`. `getRecipe` closes the one-auth gap: a caller holding only per-user MCP OAuth can now fetch the template (then trigger + monitor) without the shared team key.

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MCP_ENABLED` | No | `true` | Kill switch to disable MCP |
| `MCP_JWT_SECRET` | Recommended | `GIT_COMMIT` or `dev` | JWT signing secret |
| `MCP_BASE_URL` | No | Auto from Host header | Base URL for OAuth metadata |

### Helm Chart

The Helm chart exposes MCP config via `values.yaml`:

```yaml
guiConfig:
  mcpEnabled: "true"
  mcpJwtSecret: ""    # defaults to GIT_COMMIT in code
```

Staging does not need explicit configuration — defaults are sufficient.

## How `created-by` Label Works

The server determines identity based on the authentication method:

| Auth Method | Identity | Example Label |
|-------------|----------|---------------|
| Basic Auth API | `createdBy.tenant` | `tropos-team` |
| SAML SSO web login | `createdBy.email` | `shuhuan.yan` |
| Form Auth web login | `createdBy.email` | `tao.peng` |
| **MCP OAuth2** | **`createdBy.email`** | **`tao.peng`** |

Label value is the email prefix (before `@`), sanitized for K8s label rules (alphanumeric, `-`, `_`, `.`; max 63 chars).

## Deployment

### Staging Deployment

1. Commit code to branch, push to remote
2. Trigger GitHub Actions workflow `docker-image-ghcr-build-push.yml` (default params)
3. After build succeeds, restart `cic2-provisioner-webui` in ArgoCD:
   https://provisioner-argocd-staging.cic2.tibcocloud.com/

### Staging-Specific Notes

- `MCP_ENABLED` and `MCP_JWT_SECRET` do not need ArgoCD config (defaults work)
- Docker image build injects `GIT_COMMIT` as build arg, used as JWT secret fallback

## User Setup Guide

### Prerequisites

- Claude Code installed and working
- Network access to provisioner staging (VPN if required)
- SAML SSO credentials for the staging IdP

### Step 1: Enterprise Whitelist (IT admin, one-time)

The MCP server name `tibco-platform-provisioner` must be in the enterprise managed settings file. Without this, Claude Code silently rejects the MCP server.

**Windows**: `C:\Program Files\ClaudeCode\managed-settings.json`
**macOS**: `/Library/Application Support/ClaudeCode/managed-settings.json`

```json
{
  "allowedMcpServers": ["tibco-platform-provisioner"]
}
```

If `claude mcp add` reports "not allowed by enterprise policy", this whitelist is missing.

### Step 2: Add MCP Server (each user, one-time)

**Option A: User scope (recommended, works across all projects)**
```bash
claude mcp add --transport http --scope user tibco-platform-provisioner https://provisioner-staging.cic2.tibcocloud.com/mcp
```
Stored in `~/.claude.json` top-level `mcpServers`.

**Option B: Project scope (current project only)**
Create `.mcp.json` at project root (add to `.gitignore`):
```json
{
  "mcpServers": {
    "tibco-platform-provisioner": {
      "type": "http",
      "url": "https://provisioner-staging.cic2.tibcocloud.com/mcp"
    }
  }
}
```

**Note**: `~/.claude/.mcp.json` is NOT a valid path — Claude Code does not recognize it.

**Precedence**: local (per-project in `~/.claude.json`) > project (`.mcp.json`) > user (`~/.claude.json` top-level). Same-named server connects only once using the highest precedence definition.

### Step 3: First Authentication

1. In Claude Code, call any MCP tool (e.g., ask "what pipelines are running?")
2. Claude Code detects 401 → discovers OAuth metadata → shows an authorization URL
3. Open the URL in a browser (see Known Issues below for Windows)
4. Complete SAML SSO login in the browser
5. Browser redirects back — Claude Code receives the auth code and exchanges it for a JWT
6. MCP tools are now available

After first auth, token refresh is automatic. You won't need to re-authorize until the refresh token expires (30 days) or the server restarts.

### Step 4: Verify

```
# Check identity
whoami → returns current user info

# List my pipeline runs (default: current user only)
listPipelineRuns → returns runs created by the current user
# Use allUsers=true to list all pipeline runs
# Short label keys are auto-prefixed: "create-by=X" → "env.cloud.tibco.com/create-by=X"

# Create pipeline run
createPipelineRun → pass pipeline/account/region/content params
# content is a JSON string containing the full recipe structure (apiVersion, kind, meta, tasks)

# Check pipeline run status
getPipelineRun → pass pipelineRunId, check status.conditions
```

## Known Issues

### Windows Browser Auto-Open

Claude Code v2.1.141+ has a known bug where the browser does not auto-open for OAuth on Windows ([#59194](https://github.com/anthropics/claude-code/issues/59194), status: OPEN). Setting `BROWSER` env var does not help — Claude Code does not read it. You must manually copy the URL and open it in a browser. Waiting for upstream fix.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `claude mcp add` says "not allowed by enterprise policy" | MCP server name not in enterprise whitelist | Ask IT admin to add `tibco-platform-provisioner` to `managed-settings.json` `allowedMcpServers` |
| MCP tools not appearing in Claude Code | Server not registered or name mismatch | Run `claude mcp list` to check; re-add with correct name |
| 401 error on every MCP call | Token expired or server restarted | Re-authorize: run `/mcp` in Claude Code, select the server, authenticate |
| Browser doesn't open on Windows | Claude Code bug [#59194](https://github.com/anthropics/claude-code/issues/59194) | Manually copy the URL from Claude Code output and paste into browser |
| First OAuth paste goes to homepage | SAML callback URL lost | Fixed in commit `994fe4d`; ensure staging is up to date |
| `listPipelineRuns` returns empty for `created-by` filter | Using full email instead of username prefix | Use `tao.peng` not `tao.peng@tibco.com` |

## Dependencies

| Package | Purpose |
|---------|---------|
| `@modelcontextprotocol/sdk` | MCP server + StreamableHTTPServerTransport |
| `jsonwebtoken` | JWT sign/verify |
| `zod` | Tool input schema validation (required by MCP SDK) |

## Tests

| Test File | Coverage |
|-----------|----------|
| `server/mcp/jwt.test.js` | Token create/verify, expiry, wrong secret, refresh token lifecycle |
| `server/mcp/oauth.test.js` | Metadata, client registration, auth code, PKCE, token exchange |
| `server/mcp/auth-middleware.test.js` | Valid token, missing/invalid/expired token → 401, resource_metadata header |
| `server/mcp/server.test.js` | `getRecipe`/`listRecipes` tool registration, arg forwarding, payload + not-found error mapping |
| `server/configmap.test.js` | `findConfigByTitle` / `getRecipeByTitle` / `listRecipes` recipe lookup (shared by REST + MCP) |

Run: `npx vitest run --config vitest.server.config.ts` (from `provisioner-webui/`)
