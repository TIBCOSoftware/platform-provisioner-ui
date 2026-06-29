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

import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BASE_URL, POLL_INTERVAL } from './constants';

/**
 * Wait for a vue3-toastify toast to appear and return its text content.
 * The toast auto-closes after 3 s, so callers should invoke this promptly.
 */
export async function waitForToast(
  page: Page,
  type: 'success' | 'error',
): Promise<string> {
  const selector = `.Toastify__toast--${type}`;
  const toast = page.locator(selector).first();
  await expect(toast).toBeVisible({ timeout: 15_000 });
  const text = (await toast.textContent()) ?? '';
  return text.trim();
}

/**
 * Click a top-level item in the PrimeVue Menubar (`.nav-menu`).
 * @param menuLabel – visible text of the menu item, e.g. "Status"
 */
export async function navigateViaMenu(
  page: Page,
  menuLabel: string,
): Promise<void> {
  const menuItem = page
    .locator('.nav-menu .p-menubar-item')
    .filter({ hasText: menuLabel });
  await expect(menuItem).toBeVisible({ timeout: 10_000 });
  await menuItem.click();
}

/**
 * Extract the pipeline name from a deployment-success toast message.
 * Expected format: "Succeed to deploy pipeline. <name>"
 */
export function extractPipelineName(toastText: string): string {
  const match = toastText.match(/Succeed to deploy pipeline\.\s*(.+)/);
  if (!match) {
    throw new Error(
      `Could not extract pipeline name from toast: "${toastText}"`,
    );
  }
  return match[1].trim();
}

/**
 * Submit a pipeline with optional custom script content.
 * Navigates to /pipelines, optionally replaces the script content, and clicks Run.
 * Returns the pipeline name from the success toast.
 */
export async function submitPipeline(
  page: Page,
  script?: string,
): Promise<string> {
  await page.goto(`${BASE_URL}/pipelines`);
  await page.waitForSelector('#yaml-editor-container, .form-buttons', {
    timeout: 30_000,
  });

  const editorContainer = page.locator('#yaml-editor-container');
  await expect(editorContainer).toBeVisible();

  if (script) {
    // Replace script content and verify — retry if regex replacement silently fails
    await expect(async () => {
      await page.evaluate((s) => {
        const editorEl = document.getElementById('yaml-editor-container');
        if (!editorEl) throw new Error('Editor container not found');
        const editor = (window as any).ace.edit(editorEl);
        const content = editor.getValue();
        const updated = content.replace(
          /content:\s*\|\n([\s\S]*?)(?=\n\s{4}\w|\n\s{2}\w|\s*$)/,
          `content: |\n${s
            .split('\n')
            .map((line: string) => '            ' + line)
            .join('\n')}`,
        );
        editor.setValue(updated, -1);
      }, script);
      // Verify the first line of our script is in the editor
      const firstLine = script.split('\n')[0];
      const editorContent = await page.evaluate(() => {
        const editorEl = document.getElementById('yaml-editor-container');
        return (window as any).ace.edit(editorEl).getValue();
      });
      expect(editorContent).toContain(firstLine);
    }).toPass({ timeout: 10_000, intervals: [1_000] });
  }

  const runButton = page
    .locator('.form-buttons Button')
    .filter({ hasText: 'Run' });
  await expect(runButton).toBeEnabled({ timeout: 5_000 });
  await runButton.click();

  // Confirm in the dialog
  const confirmDialog = page.locator('.p-dialog');
  const confirmVisible = await confirmDialog.isVisible().catch(() => false);
  if (confirmVisible) {
    const confirmBtn = confirmDialog
      .locator('button')
      .filter({ hasText: 'Run' });
    await confirmBtn.click();
  }

  const toastText = await waitForToast(page, 'success');
  return extractPipelineName(toastText);
}

/**
 * Navigate to Status page and click Filter to load pipeline rows.
 */
export async function goToStatusAndFilter(page: Page): Promise<void> {
  await navigateViaMenu(page, 'Status');
  await expect(page).toHaveURL(/\/status/);

  const filterButton = page.getByRole('button', { name: 'Filter' });
  await expect(filterButton).toBeVisible({ timeout: 10_000 });
  await filterButton.click();
  await page.waitForSelector('.p-datatable-tbody tr', { timeout: 15_000 });
}

/**
 * Expand a pipeline row and click step-generic-runner to open the log panel.
 */
export async function expandAndOpenLog(
  page: Page,
  pipelineName: string,
): Promise<void> {
  const pipelineRow = page
    .locator('.p-datatable-tbody tr:not(.p-datatable-row-expansion)')
    .filter({ hasText: pipelineName });

  // Retry Filter if the row isn't found (Name column may be empty on first load)
  const filterButton = page.getByRole('button', { name: 'Filter' });
  await expect(async () => {
    await filterButton.click();
    await expect(pipelineRow).toBeVisible();
  }).toPass({ timeout: 30_000, intervals: [POLL_INTERVAL] });

  const toggler = pipelineRow.locator(
    'button.p-datatable-row-toggle-button',
  );
  await toggler.click();

  await page.waitForSelector('.pipeline-task-name', { timeout: 60_000 });

  // Find step-generic-runner under the "generic-runner" task
  const expansion = pipelineRow.locator('xpath=following-sibling::tr[1]');
  const step = expansion
    .locator('.pipeline-task-name')
    .filter({ hasText: /^generic-runner/ })
    .locator('xpath=following-sibling::div[contains(@class, "pipeline-task-step")][1]');
  await expect(step).toBeVisible({ timeout: 60_000 });
  await step.click();
}

/**
 * Get the currently visible log code element.
 */
export function getLogCode(page: Page) {
  return page.locator('code.language-log:visible').first();
}

/**
 * Count how many streaming-counter lines are in the log text.
 */
export function countStreamingLines(text: string): number {
  return (text.match(/streaming-counter: \d+ \/ \d+/g) || []).length;
}
