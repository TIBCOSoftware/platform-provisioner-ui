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

const PIPELINE_URL = `${BASE_URL}/pipelines/generic-runner?title=deploy-tp-on-prem-gcp-k3s`;

test.describe('Unreleased feature flag', () => {
  test('hides fields with unreleasedFeature when ENABLE_UNRELEASED_FEATURE is true', async ({ loggedInPage: page }) => {
    // Check that the server has ENABLE_UNRELEASED_FEATURE set
    const response = await page.request.get(`${BASE_URL}/cic2-ws/v1/ui-properties`);
    const properties = await response.json();
    const flagEnabled = properties['ENABLE_UNRELEASED_FEATURE'] === 'true';

    // Navigate to the pipeline page
    await page.goto(PIPELINE_URL);
    await page.waitForSelector('.pv-field-horizontal, .p-stepper', { timeout: 15_000 });

    // Navigate to step #2 (Cloud Provider) where GCP Region lives
    const step2 = page.locator('.p-step').filter({ hasText: /Cloud Provider/ });
    if (await step2.isVisible()) {
      await step2.click();
      await page.waitForTimeout(500);
    }

    const gcpRegionField = page.locator('.pv-field-horizontal').filter({ hasText: 'GCP Region' });

    if (flagEnabled) {
      // When flag is enabled, fields with unreleasedFeature: true should be hidden
      await expect(gcpRegionField).toHaveCount(0);
    } else {
      // When flag is not set, all fields should be visible (no filtering)
      await expect(gcpRegionField).toBeVisible();
    }
  });
});
