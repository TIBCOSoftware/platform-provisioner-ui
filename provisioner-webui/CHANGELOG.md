## [3.4.0] - 2026-05-20
### Added
- Add MCP (Model Context Protocol) server for Claude Code integration
  - OAuth 2.1 with PKCE authentication, integrated with SAML SSO
  - 12 MCP tools: whoami, listAccounts, listPipelines, listPipelineRuns, getPipelineRun, createPipelineRun, stopPipelineRun, deletePipelineRun, loadRecipe, saveRecipe, getTaskRunDetails, getContainerLog
  - Per-user `created-by` K8s labels via JWT email identity
  - Token lifecycle: access token 8h (auto-refresh), refresh token 30d
  - `listPipelineRuns` defaults to current user's runs with auto-prefixed label selectors
  - RFC 9728 `resource_metadata` discovery for automatic OAuth flow
  - On-prem mode support with mock user auto-authorization
- Add `@modelcontextprotocol/sdk`, `jsonwebtoken`, `zod` dependencies
- Add `make bump-changelog` target for automated Helm chart version bump and CHANGELOG generation
### Fixed
- Fix SAML callbackUrl for MCP OAuth
### Changed
- Rename MCP server to `tibco-platform-provisioner`
- Update README.md and docs/ai/mcp.md with MCP setup and usage instructions

## [3.3.1] - 2026-04-03
### Fixed
- [PCP-18597] Fix browser auto-fill on pipeline and welcome page password fields
  - Replace `autocomplete="off"` with `autocomplete="new-password"` (Chrome ignores `off` on password fields)
  - Use PrimeVue `inputProps` to pass `autocomplete` to the inner `<input>` element instead of the wrapper div
### Added
- Add YAML change tracking with confirmation dialog before pipeline deployment
  - Show GUI environment changes grouped by pipeline step with friendly field names
  - Show non-guiEnv YAML changes as color-coded unified diff
  - Track uploaded file names for display in change summary
  - Integrate confirmation dialog in both pipeline options and YAML editor views
  - Add `changeTracker.ts` utility module with comprehensive unit tests
  - Add `RunConfirmChanges.vue` component for change preview display
- Add `"diff": "7.0.0"` dependency for unified diff generation
- Fix markdown styling in docs pages — `.markdown-body` class was not inheriting styles due to invalid LESS `@extend` syntax
### Fixed
- Fix invalid LESS `@extend` syntax in `global.less` and `DocsView.vue` — replaced with proper selector grouping
- Fix outdated `vue3-markdown` reference in docs README — updated to `markdown-it`
- [PCP-17321] Add unreleased feature flag for pipeline options
  - Hide pipeline option fields with `unreleasedFeature: true` when pod env var `ENABLE_UNRELEASED_FEATURE=true` is set
  - Expose `ENABLE_UNRELEASED_FEATURE` via `/cic2-ws/v1/ui-properties` endpoint
  - Add unit tests for filtering logic and e2e test for field visibility

## [3.3.0] - 2026-03-31
### Added
- [PCP-17957] Open-source readiness, security fixes, and UX improvements
  - Add run confirmation dialog before pipeline execution, showing Account (with description), Region, and Pipeline
  - Add "Back to Login" button on 403 error page
  - Replace unlicensed `vue3-markdown` with MIT-licensed `markdown-it` + thin Vue wrapper (`MarkdownView.vue`)
  - Add comprehensive unit tests for UI components, Pinia stores, and server utilities
  - Refactor e2e tests with Playwright auth setup project, custom fixtures, and modular helpers
  - Add CONTRIBUTING.md, SECURITY.md, and improved README.md
  - Add Apache-2.0 license field to package.json and BSD-3-Clause LICENSE for vendored ace-builds
  - Fix multi-panel log display — expanding one pipeline row no longer collapses another's log panel
  - Fix `handelError` typo → `handleError` across server files
  - Fix Makefile missing `--build-arg GIT_COMMIT` for local Docker builds
  - Fix `supervisord.conf` cross-env dependency and hardcoded session key
- [PCP-17954] License headers update for open source publication
  - Standardize all copyright headers to Apache 2.0 format
  - Update NOTICE file with third-party attributions
- [PCP-17920] UI improvements and cache fix
  - Add environment indicator ([Staging]/[Local]) in navbar and page title
  - Add striped rows, row hover effect, loading state, and select-all columns to pipeline status table
  - Fix browser cache issue by adding no-cache header for root path `/`
### Changed
- Upgrade "vite" from "5.4.21" to "6.4.1", "vitest" from "2.1.8" to "3.2.4"
- Upgrade "markdown-it" from "14.1.0" to "14.1.1"
- Upgrade "@primevue/themes" from "4.3.3" to "4.5.4"
- Upgrade "helm/chart-testing-action" to v2.8.0
### Fixed
- Fixed security vulnerabilities in "flatted" (DoS/prototype-pollution), "picomatch" (ReDoS/method injection)
- [PCP-18066] Fix selected log step not cleared after clicking Filter on status page; refactor markdown-body to extend markdown-content mixin

## [3.2.0] - 2026-03-13
### Added
- [PCP-17794] Add form-based authentication (dual login: SAML + email/password)
- [PCP-17587] Add streaming log support and improve task list UX
### Changed
- [PCP-17787] Migrate passport-saml 3.2.4 to @node-saml/passport-saml 5.1.0
- [PCP-17446] UI improvements
  - Restyle UI with Aura preset, custom color palette, and Inter font
  - Add theme switcher with 4 color palettes
  - Add version badge and login logo
  - Pin all dependency versions (remove ^ and ~ prefixes)
  - Upgrade "koa" to "2.16.4", "dompurify" to "3.3.3", "axios" to "1.13.6"
  - Upgrade "sass" to "1.98.0", "@playwright/test" to "1.58.2"
- Bump Helm chart version to 1.0.12
### Fixed
- [PCP-17158] Fix menu navigation highlighting and prevent page flash on route change
- [PCP-17142] Revert eslint from 9.26.0 to 8.57.0 to fix CI build

## [3.1.7] - 2026-02-12
### Added
- [PCP-16870] Implement ETag-based content update detection with client polling
- [PCP-16910] Onboard provisioner-ui project to AI-Assisted SDLC
- [PCP-17142] Add Account and Region columns to pipeline status table
  - Add column toggle control to pipeline status table with localStorage persistence
### Changed
- [PCP-17031] Reduce vertical space waste in pipeline form and stepper sidebar
- Clean up UI spacing, editor font, dropdown menus, and Makefile targets
- Modernize provisioner-webui interface with UI/UX improvements
- Upgrade "eslint" from "8.57.0" to "9.26.0"
- Upgrade "lodash, @types/lodash" from "4.17.21" to "4.17.23"
- Add "shx": "0.4.0" for cross-platform shell commands in npm scripts
### Fixed
- Fixed build scripts (`build`, `build:server`) failing in Windows PowerShell/CMD by replacing Unix commands with `shx`
- [PCP-16360] Fixed inject user email from LDAP to the recipe in provisioner SaaS

## [3.1.6] - 2025-11-25
### Added
- Support for config Helm Charts Url in landing page
  - Support for loading Helm Chart name from custom Url
  - Support for loading Helm Chart version from custom Url
- Support for autocomplete guiType
- Added some of npm dependencies
  - Add "dayjs-plugin-utc": "0.1.2"
  - Add "semver": "7.7.3"
  - Add "sha256-es": "1.8.2"
  - Add "@types/semver": "7.7.1",
  - Add "cross-env": "10.1.0",
### Changed
- Fixed some of npm audit issues after upgrade dependencies
  - Upgrade "js-yaml" from "4.1.0" to "4.1.1"
  - Upgrade "vite" from "5.4.8" to "5.4.21"
### Fixed
- Fixed dev process issue in Windows system
  - Use "cross-env" to replace "export" to set environment variables in npm scripts

## [3.1.5] - 2025-10-22
### Added
- Support for store original yaml json from API server
- Support for enableOtherFieldsWhenSet in yaml file
  - when current reference is set, the target reference will be enabled, default is disabled
### Changed
- Fixed some of npm audit issues after upgrade dependencies
  - Upgrade "axios" from "1.8.3" to "1.12.2"
  - Upgrade "koa" from "2.15.4" to "2.16.3"
  - Upgrade "@playwright/test" from "1.47.2" to "1.56.1"

## [3.1.4] - 2025-03-24
### Changed
- Support for build local dev image with supervisord
- Support for deploy local dev image or remote image to local docker
- Support for update server code
- Rename project name from "provisioner-vue3" to "provisioner-webui"
- Upgrade "@kubernetes/client-node" from "0.22.0" to "1.1.1"
  - make required changes in the code to use the new version of "@kubernetes/client-node"
- Remove "@types/vuelidate": "0.7.21",
- Upgrade "axios" from "1.7.7" to "1.8.3"
- Upgrade "dompurify" from "3.1.7" to "3.2.4"
- Upgrade "highlight.js" from "11.10.0" to "11.11.1"
- Upgrade "koa" from "2.15.3" to "2.15.4"
- Upgrade "prismjs" from "1.29.0" to "1.30.0"
- Upgrade "vitest" from "1.6.0" to "1.6.1"

## [3.1.3] - 2025-03-06
### Changed
- Remove unused files and code

## [3.1.2] - 2025-01-29
### Added
- Support for field mutual exclusion in pipeline option items for any field type

### Changed
- Update readme file for field mutual exclusion feature
- Update the pipeline option example pp-testing.yaml file

### Fixed
- Fix bug for radio button can not be selected by default.

## [3.1.1] - 2025-01-18
### Added
- Support for file upload in pipeline option items
- Support for split pipeline option view and YAML editor view

### Changed
- Update readme file for file upload feature
- Update the pipeline option example pp-testing.yaml file

## [3.1.0] - 2024-10-09
### Added
- Support for grouping pipeline options
- Support for showing YAML editor in Drawer or right side of the page
- Support for adjust YAML/JSON editor height dynamically when browser window size changes
- Support for highlight the active menu item
- Support for `typescript`, change js to ts
- Support for a dropdown list, password input in pipeline option items
- Support for showing pipeline description in Drawer
- Add primevue stepper component to split large pipeline option items.
- Add interface for all types of data
- Add unit/e2e test case example, use `jest` and `playwright`
- Add `"bootstrap-icons": "1.11.3"` for more icon options
- Use `pinia` instead of `vuex`, to support for pass data between a different component
- Use `prettier` format code

### Changed
- Change pipeline option field style
- Change all the button style
- Change vue code style from Vue2 Options API to Vue3 Composition API
- Optimize the CSS class namespace
- Optimize the code logic and disable the run button when there is an error

### Fixed
- Fixed dysfunctional CSS styles for menubar in different screen sizes
- Fixed security issue for node module "npm audit fix"
- Fixed dev script issue

## [3.0.1] - 2024-09-17
### Added
- Add "@eslint/js" node_module for code validation
- Add "Expanding..." when the row is expanding

### Changed
- Change log highlight language from bash to log
- Change the git action to get current git commit id
- Disable index.html cache in browser
- Remove used logic for v1beta
- Do not fetch log data if row is collapsed

### Fixed
- Fixed PCP-7338: show loading icon in status log page
* Fixed PCP-7338: The log cannot be loaded correctly when the page is later than page 1

## [3.0.0] - 2024-08-30
### Added
- Use `ajv:8.17.1` override `ajv:6.12.6` in `package.json`
- Use `vite` to build the front-end project
- Add `json-editor-vue3, vue3-markdown, vue3-toastify` to the frontend project

### Changed
- Upgrade `node:16` to `node:22` in Dockerfile
- Upgrade front-end `vue2` to `vue3`, and related all node modules to the latest version.
- Upgrade back-end `@kubernetes/client-node` from `^0.15.1` to `0.21.0`, and related all node modules to the latest version.
- Use `koa-session` to replace `koa-generic-session`
- Replace the soon-to-be deprecated Node module `moment` with `dayjs` to ensure future compatibility and optimized performance.
- Change `NODE_ENV` value from `local` to `development`
- Remove `request-promise` in backend side, use `axios` instead of it.
- Remove `jquery, core-js, v-jsoneditor, vue-code-highlight, vue-toasted, vuelidate` in frontend side.

### Fixed
- Fixed UI issue, CSS issue, Eslint issue, `ace-builds` runtime warning and Build issue after upgrade `vue2` to `vue3`.
- change `to` to `url` for the higher version of primeng nav menu component. 
- Fixed issue `req.session.regenerate` is not a function
- Fixed double refresh page issue when switch page in the webui
