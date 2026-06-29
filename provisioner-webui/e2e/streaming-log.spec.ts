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

import { test, expect } from './fixtures/auth.fixture';
import {
  POLL_INTERVAL,
  submitPipeline,
  goToStatusAndFilter,
  expandAndOpenLog,
  getLogCode,
  countStreamingLines,
} from './helpers';

/**
 * Streaming log e2e tests.
 *
 * Uses a counter script that prints every 1 second (5 iterations, ~5 s).
 * Two test cases:
 *   1. Two pipelines run simultaneously — expand both and verify both logs stream.
 *   2. Expand to see streaming log, collapse (no more log API calls),
 *      wait for completion, re-expand to see full log.
 */

const COUNTER_SCRIPT = [
  'echo "=== streaming-log e2e test start ==="',
  'for i in $(seq 1 5); do',
  '  echo "streaming-counter: $i / 5"',
  '  sleep 1',
  'done',
  'echo "=== streaming-log e2e test done ==="',
].join('\n');

const TOTAL_LINES = 5;
const TEST_TIMEOUT = 3 * 60 * 1000;

test.describe('Streaming log output', () => {
  test('two pipelines stream logs simultaneously when both rows are expanded', async ({
    loggedInPage: page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);

    // ── Submit two pipelines back-to-back ──────────────────────────
    const pipeline1 = await submitPipeline(page, COUNTER_SCRIPT);
    console.log('Pipeline 1 submitted:', pipeline1);

    const pipeline2 = await submitPipeline(page, COUNTER_SCRIPT);
    console.log('Pipeline 2 submitted:', pipeline2);

    // ── Navigate to Status and expand both ─────────────────────────
    await goToStatusAndFilter(page);

    // Use :not(.p-datatable-row-expansion) to only match data rows, not expansion rows
    const row1 = page
      .locator('.p-datatable-tbody tr:not(.p-datatable-row-expansion)')
      .filter({ hasText: pipeline1 });
    const row2 = page
      .locator('.p-datatable-tbody tr:not(.p-datatable-row-expansion)')
      .filter({ hasText: pipeline2 });

    // Retry Filter if rows aren't found (Name column may be empty on first load)
    const filterButton = page.getByRole('button', { name: 'Filter' });
    await expect(async () => {
      await filterButton.click();
      await expect(row1).toBeVisible();
      await expect(row2).toBeVisible();
    }).toPass({ timeout: 30_000, intervals: [POLL_INTERVAL] });
    console.log('Both pipeline rows visible in table');

    // Expand pipeline 1
    const toggler1 = row1.locator('button.p-datatable-row-toggle-button');
    await toggler1.click();
    await page.waitForSelector('.pipeline-task-name', { timeout: 60_000 });
    console.log('Pipeline 1 expanded');

    // Expand pipeline 2
    const toggler2 = row2.locator('button.p-datatable-row-toggle-button');
    await toggler2.click();
    // Wait for the second expansion content to appear
    await expect(page.locator('.pipeline-task-name').nth(1)).toBeVisible({
      timeout: 60_000,
    });
    console.log('Pipeline 2 expanded');

    // Scope step locators to each pipeline's expansion row (next sibling tr)
    const expansion1 = row1.locator('xpath=following-sibling::tr[1]');
    const expansion2 = row2.locator('xpath=following-sibling::tr[1]');

    // Find step-generic-runner under the "generic-runner" task (not send-notification-start)
    const step1 = expansion1
      .locator('.pipeline-task-name')
      .filter({ hasText: /^generic-runner/ })
      .locator('xpath=following-sibling::div[contains(@class, "pipeline-task-step")][1]');
    const step2 = expansion2
      .locator('.pipeline-task-name')
      .filter({ hasText: /^generic-runner/ })
      .locator('xpath=following-sibling::div[contains(@class, "pipeline-task-step")][1]');

    // Wait for steps to appear in both expansions
    await expect(step1).toBeVisible({ timeout: 60_000 });
    await expect(step2).toBeVisible({ timeout: 60_000 });
    console.log('Both step-generic-runner elements found in their expansion rows');

    await step1.click();
    await step2.click();
    console.log('Both steps clicked');

    // ── Both log panels are now visible simultaneously ─────────────
    const log1 = expansion1.locator('code.language-log');
    const log2 = expansion2.locator('code.language-log');

    // Wait until both log panels appear with streaming content
    await expect(async () => {
      const text1 = (await log1.textContent()) ?? '';
      const text2 = (await log2.textContent()) ?? '';
      expect(text1).toContain('streaming-counter:');
      expect(text2).toContain('streaming-counter:');
    }).toPass({ timeout: 120_000, intervals: [POLL_INTERVAL] });

    // Snapshot 1: capture counter line counts from both panels
    const snap1_text1 = (await log1.textContent()) ?? '';
    const snap1_text2 = (await log2.textContent()) ?? '';
    const snap1_count1 = countStreamingLines(snap1_text1);
    const snap1_count2 = countStreamingLines(snap1_text2);
    console.log(
      `Snapshot 1 — Panel 1: ${snap1_count1} lines, Panel 2: ${snap1_count2} lines`,
    );

    await page.screenshot({
      path: 'e2e/screenshots/streaming-log-dual-streaming.png',
      fullPage: true,
    });

    // Wait for both to complete (all counter lines)
    await expect(async () => {
      const text1 = (await log1.textContent()) ?? '';
      const text2 = (await log2.textContent()) ?? '';
      expect(countStreamingLines(text1)).toBeGreaterThanOrEqual(TOTAL_LINES);
      expect(countStreamingLines(text2)).toBeGreaterThanOrEqual(TOTAL_LINES);
    }).toPass({ timeout: 120_000, intervals: [POLL_INTERVAL] });

    const final1 = (await log1.textContent()) ?? '';
    const final2 = (await log2.textContent()) ?? '';
    expect(countStreamingLines(final1)).toBe(TOTAL_LINES);
    expect(countStreamingLines(final2)).toBe(TOTAL_LINES);
    console.log(`Both panels: all ${TOTAL_LINES} counter lines present`);

    await page.screenshot({
      path: 'e2e/screenshots/streaming-log-dual-completed.png',
      fullPage: true,
    });
  });

  test('collapse stops log API calls, re-expand after completion shows full log', async ({
    loggedInPage: page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);

    // ── Submit pipeline ────────────────────────────────────────────
    const pipelineName = await submitPipeline(page, COUNTER_SCRIPT);
    console.log('Pipeline submitted:', pipelineName);

    // ── Go to Status, expand, and see streaming log ────────────────
    await goToStatusAndFilter(page);
    await expandAndOpenLog(page, pipelineName);
    const logCode = getLogCode(page);

    // Wait for first counter line
    await expect(async () => {
      const text = await logCode.textContent();
      expect(text).toContain('streaming-counter: 1 / 5');
    }).toPass({ timeout: 120_000, intervals: [POLL_INTERVAL] });
    console.log('Streaming log visible — first line appeared');

    const firstSnap = (await logCode.textContent()) ?? '';
    const firstCount = countStreamingLines(firstSnap);
    console.log(`Before collapse: ${firstCount} counter lines`);

    await page.screenshot({
      path: 'e2e/screenshots/streaming-log-before-collapse.png',
      fullPage: false,
    });

    // ── Collapse the row ───────────────────────────────────────────
    const pipelineRow = page
      .locator('.p-datatable-tbody tr:not(.p-datatable-row-expansion)')
      .filter({ hasText: pipelineName });
    const toggler = pipelineRow.locator(
      'button.p-datatable-row-toggle-button',
    );
    await toggler.click();
    console.log('Row collapsed');

    // ── Monitor network: no log API calls should happen after collapse ──
    const logApiCalls: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/log')) {
        logApiCalls.push(url);
      }
    });

    // Wait 10 seconds — no log API should be called
    await page.waitForTimeout(10_000);
    console.log(`Log API calls during collapse: ${logApiCalls.length}`);
    expect(logApiCalls.length).toBe(0);
    console.log('Verified: no log API calls while row is collapsed');

    // ── Wait for pipeline to complete ──────────────────────────────
    const filterButton = page.getByRole('button', { name: 'Filter' });
    await expect(async () => {
      await filterButton.click();
      const statusCell = pipelineRow.locator('td').nth(1);
      await expect(statusCell).toContainText('Succeeded');
    }).toPass({ timeout: TEST_TIMEOUT, intervals: [10_000] });
    console.log('Pipeline completed: Succeeded');

    // ── Re-expand and verify full log ──────────────────────────────
    const expandToggler = pipelineRow.locator(
      'button.p-datatable-row-toggle-button',
    );
    await expandToggler.click();
    await page.waitForSelector('.pipeline-task-name', { timeout: 60_000 });

    const reExpansion = pipelineRow.locator('xpath=following-sibling::tr[1]');
    const stepAfter = reExpansion
      .locator('.pipeline-task-name')
      .filter({ hasText: /^generic-runner/ })
      .locator('xpath=following-sibling::div[contains(@class, "pipeline-task-step")][1]');
    await expect(stepAfter).toBeVisible({ timeout: 60_000 });
    await stepAfter.click();

    const finalLogCode = getLogCode(page);

    await expect(async () => {
      const text = (await finalLogCode.textContent()) ?? '';
      expect(countStreamingLines(text)).toBeGreaterThanOrEqual(TOTAL_LINES);
    }).toPass({ timeout: 30_000, intervals: [POLL_INTERVAL] });

    const finalText = (await finalLogCode.textContent()) ?? '';
    const finalCount = countStreamingLines(finalText);
    console.log(`After re-expand: ${finalCount} counter lines`);
    expect(finalCount).toBe(TOTAL_LINES);
    expect(finalText).toContain('=== streaming-log e2e test done ===');
    console.log('Full log verified after re-expand');

    await page.screenshot({
      path: 'e2e/screenshots/streaming-log-reexpand-full.png',
      fullPage: false,
    });
  });
});
