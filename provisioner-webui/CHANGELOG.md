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
