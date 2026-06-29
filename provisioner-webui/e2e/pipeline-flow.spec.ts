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
  BASE_URL,
  PIPELINE_TIMEOUT,
  POLL_INTERVAL,
  waitForToast,
  navigateViaMenu,
  extractPipelineName,
} from './helpers';

test.describe('Pipeline flow – submit, monitor, view logs', () => {
  test('full pipeline lifecycle', async ({ loggedInPage: page }) => {
    test.setTimeout(PIPELINE_TIMEOUT);

    // ── Step 1: Open the pipeline page ──────────────────────────────
    await page.goto(`${BASE_URL}/pipelines`);
    await page.waitForSelector('#yaml-editor-container, .form-buttons', {
      timeout: 30_000,
    });

    // ── Step 2: Remove the `aws sts` line from the YAML editor ─────
    const editorContainer = page.locator('#yaml-editor-container');
    await expect(editorContainer).toBeVisible();

    await page.evaluate(() => {
      const editorEl = document.getElementById('yaml-editor-container');
      if (!editorEl) throw new Error('Editor container not found');
      const editor = (window as any).ace.edit(editorEl);
      const content = editor.getValue();
      const updated = content.replace(
        /^\s*aws sts get-caller-identity --no-cli-pager\s*$/m,
        '',
      );
      editor.setValue(updated, -1);
    });

    // ── Step 3: Click Run and capture the pipeline name from toast ──
    const runButton = page
      .locator('.form-buttons Button')
      .filter({ hasText: 'Run' });
    await expect(runButton).toBeEnabled({ timeout: 5_000 });
    await runButton.click();

    // Handle confirmation dialog if it appears
    const confirmDialog = page.locator('.p-dialog');
    const confirmVisible = await confirmDialog.isVisible().catch(() => false);
    if (confirmVisible) {
      const confirmBtn = confirmDialog
        .locator('button')
        .filter({ hasText: 'Run' });
      await confirmBtn.click();
    }

    const toastText = await waitForToast(page, 'success');
    const pipelineName = extractPipelineName(toastText);
    console.log('Pipeline submitted:', pipelineName);

    // ── Step 4: Navigate to the Status page via the navbar ──────────
    await navigateViaMenu(page, 'Status');
    await expect(page).toHaveURL(/\/status/);

    // ── Step 5: Click Filter and find the pipeline row ──────────────
    // Retry filtering — the row may not appear on the first attempt
    // if data is still loading or processItem hasn't completed yet.
    const filterButton = page.getByRole('button', { name: 'Filter' });
    await expect(filterButton).toBeVisible({ timeout: 10_000 });

    const pipelineRow = page
      .locator('.p-datatable-tbody tr:not(.p-datatable-row-expansion)')
      .filter({ hasText: pipelineName });

    await expect(async () => {
      await filterButton.click();
      await page.waitForSelector('.p-datatable-tbody tr', { timeout: 15_000 });
      await expect(pipelineRow).toBeVisible();
    }).toPass({ timeout: 30_000, intervals: [POLL_INTERVAL] });

    // ── Step 7: Expand the row and wait for pipeline to succeed ─────
    const toggler = pipelineRow.locator('button.p-datatable-row-toggle-button');
    await toggler.click();
    await page.waitForSelector('.pipeline-task-name', { timeout: 60_000 });

    // Poll by re-clicking Filter until the row shows "Succeeded"
    await expect(async () => {
      await filterButton.click();
      const statusCell = pipelineRow.locator('td').nth(1);
      await expect(statusCell).toContainText('Succeeded');
    }).toPass({
      timeout: PIPELINE_TIMEOUT,
      intervals: [POLL_INTERVAL],
    });
    console.log('Pipeline status: Succeeded');

    // Re-expand the row (Filter refresh collapses it)
    const expandedToggler = pipelineRow.locator(
      'button.p-datatable-row-toggle-button',
    );
    await expandedToggler.click();
    await page.waitForSelector('.pipeline-task-name', { timeout: 60_000 });

    // ── Step 8: Click step-generic-runner and verify final log ──────
    const expansion = pipelineRow.locator('xpath=following-sibling::tr[1]');
    const stepGenericRunner = expansion
      .locator('.pipeline-task-name')
      .filter({ hasText: /^generic-runner/ })
      .locator('xpath=following-sibling::div[contains(@class, "pipeline-task-step")][1]');
    await expect(stepGenericRunner).toBeVisible({ timeout: 15_000 });
    await stepGenericRunner.click();

    const expectedLogText =
      'A normal case to test assume role and conditions';
    const logCode = expansion.locator('code.language-log');
    await expect(async () => {
      const logContent = await logCode.first().textContent();
      expect(logContent).toContain(expectedLogText);
    }).toPass({
      timeout: 30_000,
      intervals: [POLL_INTERVAL],
    });
    console.log('Inline log verified');

    // ── Step 9: Open log in new tab and verify ──────────────────────
    const [newPage] = await Promise.all([
      page.context().waitForEvent('page'),
      stepGenericRunner.locator('.open-log-btn').click(),
    ]);
    await newPage.waitForLoadState('domcontentloaded');
    const newTabContent = await newPage.textContent('body');
    expect(newTabContent).toContain(expectedLogText);
    console.log('New-tab log verified');

    await newPage.close();
  });
});
