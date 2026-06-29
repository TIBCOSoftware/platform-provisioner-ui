# PCP-17587: Streaming Log Output & Task List UX Improvements

PR: https://github.com/tibco/platform-provisioner-ui/pull/39
Branch: `wip/PCP-17587`

## Summary

This PR replaces the polling-based log fetching mechanism with a streaming approach using the Fetch API, adds large log handling with truncation banners, improves the task list sidebar UX with parent/child highlighting, and adds comprehensive e2e tests.

## Commits

| Commit | Description |
|--------|-------------|
| `e66e49d` | Add streaming log support and improve task list UX |
| `c182c1a` | Add tailLines support and log truncation banner with tooltips |

## Changed Files

| File | Change Type | Description |
|------|-------------|-------------|
| `provisioner-webui/src/views/TaskStatusView.vue` | Modified | Core changes: streaming log via Fetch API, polling optimization, truncation banner, parent/child highlighting logic |
| `provisioner-webui/src/assets/global.less` | Modified | CSS for parent/child active states, log truncation banner, copy button tooltip |
| `provisioner-webui/server/k8s.js` | Modified | Add `follow` and `tailLines` parameters to `getContainerLog`, support `stream` responseType |
| `provisioner-webui/server/routes/ws.js` | Modified | Parse `follow` and `tailLines` query params, set chunked transfer headers for streaming |
| `provisioner-webui/server/routes/api.js` | Modified | Parse `follow` and `tailLines` query params for legacy API route |
| `provisioner-webui/e2e/streaming-log.spec.ts` | Added | E2E tests for dual-pipeline streaming and collapse/re-expand behavior |
| `provisioner-webui/eslint.config.ts` | Modified | Add `TextDecoder`, `fetch`, `AbortController` as ESLint globals |
| `provisioner-webui/playwright.config.ts` | Modified | Set viewport to 1920x1080 for all browsers |

---

## Feature 1: Streaming Log Output

### Problem

Previously, log fetching used an Axios-based polling approach: every `LOG_QUERY_INTERVAL` (5s), the client made a full HTTP GET request to retrieve the entire log content. This had two major drawbacks:

1. **Redundant data transfer** - Each poll re-fetched the entire log, wasting bandwidth
2. **Delayed output** - Users had to wait up to 5 seconds to see new log lines

### Solution

Replaced polling with the **Fetch Streaming API** (`response.body.getReader()` + `TextDecoder`) to receive log output in real-time chunks.

### Key Implementation Details

**Frontend (`TaskStatusView.vue`)**

```typescript
// Old approach: Axios polling every 5 seconds
utils.httpGet(`/cic2-ws/v1/pod/${pod}/${container}/log`)
  .then(response => { ... });

// New approach: Fetch API with streaming
const controller = new AbortController();
fetchingLogs[activeIndex] = controller;
fetch(`/cic2-ws/v1/pod/${pod}/${container}/log?follow=${follow}&tailLines=${LOG_TAIL_LINES}`, {
  signal: controller.signal
}).then(response => {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  // Process chunks recursively
  const processChunk = async () => {
    const { done, value } = await reader.read();
    if (done) { /* cleanup and refresh pipeline status */ return; }
    logs.value[activeIndex] += decoder.decode(value, { stream: true });
    return processChunk();
  };
  return processChunk();
});
```

**Backend (`k8s.js`)**

```javascript
// Added follow and tailLines parameters
const getContainerLog = async function(params, follow, tailLines) {
  const responseType = follow ? 'stream' : 'json';
  let url = `/api/v1/namespaces/${namespace}/pods/${pod}/log?container=${container}&follow=${follow}`;
  if (tailLines) {
    url += `&tailLines=${tailLines}`;
  }
  return await get(url, responseType);
};
```

**Route handler (`ws.js`)**

```javascript
// Set chunked transfer headers for streaming responses
if (follow) {
  ctx.set('Content-Type', 'text/plain');
  ctx.set('Transfer-Encoding', 'chunked');
} else {
  await next();
}
```

### AbortController for Cleanup

Each streaming fetch is tracked with an `AbortController`. When a row is collapsed or a new query is submitted, the controller aborts the in-flight request:

```typescript
const fetchingLogs = reactive<{ [key: string]: AbortController }>({});

// On collapse or submit
fetchingLogs[activeIndex]?.abort();
delete fetchingLogs[activeIndex];
```

---

## Feature 2: Polling Optimization

### Problem

The original polling logic had issues:
1. `loopTaskRuns` polled independently with its own timer, duplicating polling work
2. No guard against duplicate polling chains for the same pipeline
3. Task run steps might not appear if the task started after the initial expand

### Solution

**`pollingPipelines` guard** prevents duplicate polling chains:

```typescript
const pollingPipelines = reactive<{ [key: string]: boolean }>({});

const loopPipelineById = (pipelineId: string) => {
  if (pollingPipelines[pipelineId]) return;  // prevent duplicate chains
  pollingPipelines[pipelineId] = true;
  // ... fetch and schedule next poll
};
```

**`loopTaskRuns` no longer self-polls.** It runs once on expand, and is re-triggered by `loopPipelineById` when:
- Pipeline is still pending and row is expanded
- Pipeline just completed while row is expanded

**`hasActiveStreaming` check** skips redundant polling when streaming is active:

```typescript
const hasActiveStreaming = (pipelineId: string): boolean => {
  // Returns true if any step has an active fetchingLogs entry
};
```

**`Object.assign` for in-place mutation** preserves PrimeVue `expandedRows` references:

```typescript
// Old: items.value[index] = processItem(data);  // breaks expandedRows reference
// New:
Object.assign(items.value[index], processItem(data));
```

**Polling interval increased** from 10s to 20s (`STATUS_QUERY_INTERVAL`), since streaming provides real-time updates and polling is only needed for status badge refresh.

---

## Feature 3: Large Log Handling (tailLines + Truncation Banner)

### Problem

Logs can be very large (50MB+). Loading and rendering the entire log in the browser causes extreme slowness.

### Solution

**Kubernetes native `tailLines` parameter** limits output to the last N lines (default: 2000). This works for both completed logs (`follow=false`) and streaming logs (`follow=true`, where K8s returns the last N lines then continues streaming new output).

```typescript
const LOG_TAIL_LINES = 2000;
// URL: /cic2-ws/v1/pod/${pod}/${container}/log?follow=${follow}&tailLines=${LOG_TAIL_LINES}
```

**Truncation detection** counts newlines in received chunks:

```typescript
let lineCount = 0;
let initialChunk = true;

const processChunk = async () => {
  const { done, value } = await reader.read();
  if (done) {
    if (lineCount >= LOG_TAIL_LINES) truncatedLogs[activeIndex] = true;
    return null;
  }
  const text = decoder.decode(value, { stream: true });
  lineCount += (text.match(/\n/g) || []).length;
  if (initialChunk && lineCount >= LOG_TAIL_LINES) {
    truncatedLogs[activeIndex] = true;
  }
  initialChunk = false;
  // ...
};
```

**Truncation banner** (warning style) appears above the log when truncated:

```html
<div v-if="truncatedLogs[...]" class="log-truncated-banner">
  <i class="bi bi-exclamation-triangle"></i>
  <span>Showing last 2000 lines.
    <button class="open-log-link" @click="openLogInNewTab(...)">
      View full log <i class="bi bi-box-arrow-up-right"></i>
    </button>
  </span>
</div>
```

The banner uses amber/warning colors with a left accent border, making it visually prominent without being alarming.

---

## Feature 4: Parent/Child Highlighting in Task List

### Problem

When a child step (e.g., `step-generic-runner`) is selected in the sidebar, its parent task (e.g., `generic-runner`) had no visual indication that one of its children was active.

### Solution

Three visual states for parent task items:

| State | Background | Border | Description |
|-------|-----------|--------|-------------|
| Default | transparent | none | No selection |
| Active (self) | `--primary-color` (solid blue) | none | Parent itself is clicked |
| Child-active | `--palette-light` | 3px left `--primary-color` | A child step is selected |

```typescript
const isChildStepActive = (pipelineName: string, taskRunId: string, steps: any[]): boolean => {
  const current = getActiveTab(pipelineName);
  if (!current || !steps) return false;
  return steps.some(step => current === `${taskRunId}-${step.container}`);
};
```

```html
<div class="pipeline-task-name"
  :class="{
    active: getActiveTab(name) === taskRun.id,
    'child-active': isChildStepActive(name, taskRun.id, taskRun.status.steps)
  }">
```

CSS:

```less
.pipeline-task-name {
  &.active {
    background-color: var(--primary-color);
    color: var(--primary-light);
    &:hover { background-color: var(--primary-hover); }
  }
  &.child-active {
    background-color: var(--palette-light);
    border-left: 3px solid var(--primary-color);
    &:hover { background-color: var(--palette-medium); }
  }
}
```

Child steps also have consistent hover behavior:

```less
.pipeline-task-step {
  &:hover { background: var(--palette-lighter); }
  &.active {
    background: var(--primary-color);
    color: var(--primary-light);
    &:hover { background: var(--primary-hover); }
  }
}
```

---

## Feature 5: Tooltips

### Open Log Button

Added native `title` attribute for browser tooltip:

```html
<button class="open-log-btn" title="Open full log in new tab" />
```

### Copy Button (VCodeBlock)

VCodeBlock's copy button doesn't support tooltip props, so a CSS `::after` pseudo-element tooltip was added:

```less
.v-code-block--button-copy-icon {
  position: relative;
  &::after {
    content: "Copy to clipboard";
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    opacity: 0;
    transition: opacity 0.15s;
    // tooltip styling...
  }
  &:hover::after { opacity: 1; }
}
```

---

## E2E Tests

New test file: `provisioner-webui/e2e/streaming-log.spec.ts`

### Test 1: Dual Pipeline Streaming

Verifies that two pipelines can stream logs simultaneously:

1. Submit two pipelines with a counter script (prints every 10s, 6 iterations)
2. Navigate to Status page, expand both rows
3. Click `step-generic-runner` on both
4. Verify both log panels show streaming content
5. Wait 25 seconds, verify both panels grew (more counter lines)
6. Wait for completion, verify both have all 6 counter lines

### Test 2: Collapse Stops Streaming

Verifies that collapsing a row stops log API calls:

1. Submit pipeline, expand, open log
2. Wait for first counter line to appear
3. Collapse the row
4. Monitor network for 15 seconds - verify zero log API calls
5. Wait for pipeline to complete
6. Re-expand, verify full log with all 6 counter lines

### Test Helpers

- `submitPipeline()` - Injects counter script into recipe editor and clicks Run
- `goToStatusAndFilter()` - Navigates to Status page and clicks Filter
- `expandAndOpenLog()` - Expands a pipeline row and clicks `step-generic-runner`
- `countStreamingLines()` - Counts `streaming-counter: N / 6` occurrences

---

## Configuration Changes

### ESLint (`eslint.config.ts`)

Added browser globals required by the Fetch Streaming API:

```typescript
globals: {
  TextDecoder: 'readonly',
  fetch: 'readonly',
  AbortController: 'readonly',
}
```

### Playwright (`playwright.config.ts`)

Set explicit viewport size `1920x1080` for all browser projects to ensure consistent screenshot dimensions and element visibility in e2e tests.

---

## Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `STATUS_QUERY_INTERVAL` | 20,000 ms | Pipeline status polling interval (increased from 10s) |
| `LOG_QUERY_INTERVAL` | 5,000 ms | Log retry interval on error (unchanged) |
| `LOG_TAIL_LINES` | 2,000 | Maximum initial lines to load from K8s API |
