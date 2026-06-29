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

import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

/**
 * E2E tests run against a deployed instance (local K8s or staging).
 * Set BASE_URL via environment variable or e2e/.env file.
 *
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './e2e',
  /* Only match *.spec.ts files (exclude *.test.ts unit tests) */
  testMatch: /.*\.spec\.ts/,
  /* Maximum time one test can run for */
  timeout: 120_000,
  expect: {
    timeout: 15_000
  },
  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Parallel workers */
  workers: process.env.CI ? 1 : 3,
  /* Reporter: list for terminal + HTML report */
  reporter: [['list'], ['html', { open: 'never' }]],
  /* Shared settings for all projects */
  use: {
    /* Action and navigation timeouts */
    actionTimeout: 15_000,
    navigationTimeout: 30_000,

    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',

    /* Only on CI systems run the tests headless */
    headless: !!process.env.CI,

    /* Use 1920×1080 viewport for consistent screenshots and layout testing */
    viewport: { width: 1920, height: 1080 },

    /* Capture artifacts on failure */
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },

  projects: [
    /* Auth setup: runs once, saves session to e2e/.auth/user.json */
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/
    },
    /* Main test project: depends on auth setup */
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        storageState: 'e2e/.auth/user.json'
      },
      dependencies: ['setup']
    },
    ...(process.env.ALL_BROWSERS
      ? [
          {
            name: 'firefox',
            use: {
              ...devices['Desktop Firefox'],
              viewport: { width: 1920, height: 1080 },
              storageState: 'e2e/.auth/user.json'
            },
            dependencies: ['setup']
          },
          {
            name: 'webkit',
            use: {
              ...devices['Desktop Safari'],
              viewport: { width: 1920, height: 1080 },
              storageState: 'e2e/.auth/user.json'
            },
            dependencies: ['setup']
          }
        ]
      : [])
  ]
})
