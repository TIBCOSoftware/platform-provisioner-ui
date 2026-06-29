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

test.describe('Theme Switcher', () => {
  test.beforeEach(async ({ loggedInPage: page }) => {
    await page.waitForSelector('.theme-toggle-btn', { timeout: 10_000 });
  });

  test('navbar shows theme toggle button', async ({ loggedInPage: page }) => {
    const btn = page.locator('.theme-toggle-btn');
    await expect(btn).toBeVisible();
    await page.screenshot({ path: 'e2e/screenshots/theme-navbar-button.png', fullPage: false });
  });

  test('theme menu opens with palette options', async ({ loggedInPage: page }) => {
    await page.locator('.theme-toggle-btn').click();
    const menu = page.locator('#theme-menu-overlay');
    await expect(menu).toBeVisible();

    await expect(menu.locator('.theme-swatch').first()).toBeVisible();

    await expect(menu.locator('text=Default')).toBeVisible();
    await expect(menu.locator('text=Tropical')).toBeVisible();
    await expect(menu.locator('text=Azure')).toBeVisible();
    await expect(menu.locator('text=Tibco')).toBeVisible();

    await page.screenshot({ path: 'e2e/screenshots/theme-menu-open.png', fullPage: false });
  });

  test('selecting Tropical theme changes colors', async ({ loggedInPage: page }) => {
    await page.locator('.theme-toggle-btn').click();
    const menu = page.locator('#theme-menu-overlay');
    await expect(menu).toBeVisible();

    await menu.locator('text=Tropical').click();

    const navyColor = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--palette-navy').trim()
    );
    expect(navyColor).not.toBe('#2f4052');

    await page.screenshot({ path: 'e2e/screenshots/theme-tropical-applied.png', fullPage: false });
  });

  test('theme persists in localStorage', async ({ loggedInPage: page }) => {
    await page.locator('.theme-toggle-btn').click();
    const menu = page.locator('#theme-menu-overlay');
    await expect(menu).toBeVisible();
    await menu.locator('text=Tibco').click();

    const storedTheme = await page.evaluate(() => localStorage.getItem('app-color-theme'));
    expect(storedTheme).toBe('tibco');
  });

  test('default theme shows checkmark', async ({ loggedInPage: page }) => {
    await page.locator('.theme-toggle-btn').click();
    const menu = page.locator('#theme-menu-overlay');
    await expect(menu).toBeVisible();

    const defaultItem = menu.locator('.theme-menu-item').filter({ hasText: 'Default' });
    await expect(defaultItem.locator('.pi-check')).toBeVisible();

    await page.screenshot({ path: 'e2e/screenshots/theme-default-checked.png', fullPage: false });
  });
});
