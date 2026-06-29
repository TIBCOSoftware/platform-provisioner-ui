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

import { test as base, type Page } from '@playwright/test';
import { BASE_URL } from '../helpers/constants';

/**
 * Custom fixture that provides a logged-in page navigated to the app root.
 * Usage: import { test, expect } from './fixtures/auth.fixture';
 */
export const test = base.extend<{ loggedInPage: Page }>({
  loggedInPage: async ({ page }, use) => {
    await page.goto(BASE_URL);
    await page.waitForSelector('.welcome-view, .nav-menu', { timeout: 15_000 });
    await use(page);
  },
});

export { expect } from '@playwright/test';
