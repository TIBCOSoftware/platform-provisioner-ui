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

import { test, expect } from '@playwright/test';
import { BASE_URL } from './helpers/constants';

const screenshotDir = 'e2e/screenshots/temp';

/**
 * Login page visual tests.
 * These mock the /auth/config endpoint to test different login mode rendering.
 * No auth setup needed — we are testing the login page itself.
 */
test.describe('Login page modes', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    // Mock whoami to return 401 so LoginView doesn't auto-redirect to /
    await page.route('**/cic2-ws/v1/whoami', async (route) => {
      await route.fulfill({ status: 401, body: 'Unauthorized' });
    });
  });

  test('dual login mode (SSO + form)', async ({ page }) => {
    await page.route('**/auth/config', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ formAuthEnabled: true, samlEnabled: true }),
      });
    });

    await page.goto(`${BASE_URL}/login`);
    await expect(page.locator('.login-view')).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: `${screenshotDir}/dual-login.png`, fullPage: true });
  });

  test('form auth only', async ({ page }) => {
    await page.route('**/auth/config', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ formAuthEnabled: true, samlEnabled: false }),
      });
    });

    await page.goto(`${BASE_URL}/login`);
    await expect(page.locator('.login-view')).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: `${screenshotDir}/form-only-login.png`, fullPage: true });
  });

  test('SAML only', async ({ page }) => {
    await page.route('**/auth/config', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ formAuthEnabled: false, samlEnabled: true }),
      });
    });

    await page.goto(`${BASE_URL}/login`);
    await expect(page.locator('.login-view')).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: `${screenshotDir}/saml-only-login.png`, fullPage: true });
  });
});
