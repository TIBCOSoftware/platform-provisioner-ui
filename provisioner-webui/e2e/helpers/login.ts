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
import { BASE_URL } from './constants';

/**
 * Ensure the browser session is logged in.
 * If form auth is enabled, posts credentials to /auth/local-login.
 * If not (mock-user / on-prem mode), visiting /auth/login auto-creates a session.
 */
export async function ensureLoggedIn(page: Page): Promise<void> {
  const configRes = await page.request.get(`${BASE_URL}/auth/config`);
  const config = await configRes.json();
  const formAuthEnabled =
    config.formAuthEnabled ?? config.localAuthEnabled ?? false;

  if (formAuthEnabled) {
    const email = process.env.FORM_AUTH_USER ?? '';
    const password = process.env.FORM_AUTH_PASSWORD ?? '';
    if (!email || !password) {
      throw new Error(
        'FORM_AUTH_USER and FORM_AUTH_PASSWORD are required when form auth is enabled.\n' +
        'Create provisioner-webui/e2e/.env with:\n' +
        '  FORM_AUTH_USER=<email>\n' +
        '  FORM_AUTH_PASSWORD=<password>',
      );
    }
    const loginRes = await page.request.post(`${BASE_URL}/auth/local-login`, {
      data: { email, password },
    });
    if (!loginRes.ok()) {
      const body = await loginRes.text();
      throw new Error(
        `Login failed (${loginRes.status()}): ${body}. ` +
        'Check FORM_AUTH_USER and FORM_AUTH_PASSWORD.',
      );
    }
  } else {
    // Mock-user mode: visiting /auth/login creates a session automatically
    await page.goto(`${BASE_URL}/auth/login`);
  }
}
