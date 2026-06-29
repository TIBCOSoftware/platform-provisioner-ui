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
import { BASE_URL } from './helpers';

test.describe('Run confirmation dialog – change preview', () => {
  test.beforeEach(async ({ loggedInPage: page }) => {
    await page.goto(`${BASE_URL}/pipelines`);
    await page.waitForSelector('#yaml-editor-container, .form-buttons', {
      timeout: 30_000,
    });
  });

  test('confirmation dialog shows Account, Region, and Pipeline', async ({
    loggedInPage: page,
  }) => {
    const runButton = page
      .locator('.form-buttons Button')
      .filter({ hasText: 'Run' });
    await expect(runButton).toBeEnabled({ timeout: 5_000 });
    await runButton.click();

    const dialog = page.locator('.p-dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await expect(dialog.locator('text=Confirm Pipeline Run')).toBeVisible();

    // Use exact label selectors to avoid matching description text
    const labels = dialog.locator('.run-confirm-label');
    await expect(labels.filter({ hasText: /^Account$/ })).toBeVisible();
    await expect(labels.filter({ hasText: /^Region$/ })).toBeVisible();
    await expect(labels.filter({ hasText: /^Pipeline$/ })).toBeVisible();

    // Verify values are populated
    const values = dialog.locator('.run-confirm-value');
    await expect(values).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      const text = await values.nth(i).textContent();
      expect(text?.trim()).not.toBe('');
    }
  });

  test('confirmation dialog can be cancelled', async ({
    loggedInPage: page,
  }) => {
    const runButton = page
      .locator('.form-buttons Button')
      .filter({ hasText: 'Run' });
    await expect(runButton).toBeEnabled({ timeout: 5_000 });
    await runButton.click();

    const dialog = page.locator('.p-dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    const cancelBtn = dialog
      .locator('button')
      .filter({ hasText: 'Cancel' });
    await cancelBtn.click();
    await expect(dialog).not.toBeVisible();
  });

  test('confirmation dialog shows diff when YAML value is changed', async ({
    loggedInPage: page,
  }) => {
    const editorContainer = page.locator('#yaml-editor-container');
    await expect(editorContainer).toBeVisible();

    // Change an actual YAML value (not a comment) so computeYamlChanges detects it
    await page.evaluate(() => {
      const editorEl = document.getElementById('yaml-editor-container');
      if (!editorEl) throw new Error('Editor container not found');
      const editor = (window as any).ace.edit(editorEl);
      const content = editor.getValue();
      const updated = content.replace(
        'PIPELINE_LOG_DEBUG: false',
        'PIPELINE_LOG_DEBUG: true',
      );
      editor.setValue(updated, -1);
    });

    const runButton = page
      .locator('.form-buttons Button')
      .filter({ hasText: 'Run' });
    await expect(runButton).toBeEnabled({ timeout: 5_000 });
    await runButton.click();

    const dialog = page.locator('.p-dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // The dialog should show the "Changes" section since a YAML value was modified
    const changesSection = dialog.locator('.run-confirm-changes');
    await expect(changesSection).toBeVisible();

    // Should show diff with the changed value
    const otherChanges = dialog.locator('.other-changes');
    await expect(otherChanges).toBeVisible();
    await expect(otherChanges.locator('.other-changes-diff')).toBeVisible();

    const diffText = await otherChanges.locator('.other-changes-diff').textContent();
    expect(diffText).toContain('PIPELINE_LOG_DEBUG');

    // Verify diff lines have correct CSS classes
    const diffBlock = otherChanges.locator('.other-changes-diff');
    await expect(diffBlock.locator('.diff-added').first()).toBeVisible();
    await expect(diffBlock.locator('.diff-removed').first()).toBeVisible();
    await expect(diffBlock.locator('.diff-hunk').first()).toBeVisible();

    // Cancel to avoid deploying
    await dialog.locator('button').filter({ hasText: 'Cancel' }).click();
  });
});
