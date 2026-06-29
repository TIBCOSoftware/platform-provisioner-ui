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

import { fileURLToPath, URL } from 'node:url'
import { execSync } from 'node:child_process'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'
// https://vitejs.dev/config/
const noHash = process.env.NO_HASH === 'true';
const gitHash = (() => {
  // CI passes GIT_COMMIT as env var (full SHA); use first 7 chars
  if (process.env.GIT_COMMIT) {
    return process.env.GIT_COMMIT.substring(0, 7);
  }
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'unknown';
  }
})();

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(`v${process.env.npm_package_version || ''} (${gitHash})`),
  },
  plugins: [
    vue(),
    vueJsx(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    chunkSizeWarningLimit: 2048, // default is 500
    // change the client build target folder
    outDir: 'dist/client',
    sourcemap: true, // equivalent to devtool: 'source-map'
    minify: false,
    cssMinify: false,
    rollupOptions: {
      output: {
        ...(noHash ? {
          entryFileNames: 'assets/[name].js',
          chunkFileNames: 'assets/[name].js',
          assetFileNames: 'assets/[name][extname]',
        } : {}),
        manualChunks: {
          'ace-builds': ['ace-builds'],
          'axios': ['axios'],
          'dayjs': ['dayjs'],
          'dompurify': ['dompurify'],
          'highlight.js': ['highlight.js'],
          'js-yaml': ['js-yaml'],
          'json-editor-vue3': ['json-editor-vue3'],
          'lodash': ['lodash'],
          'prismjs': ['prismjs'],
          'rxjs': ['rxjs'],
          'markdown-it': ['markdown-it'],
          'vue-json-pretty': ['vue-json-pretty'],
          'vue3-toastify': ['vue3-toastify'],
        }
      }
    }
  },
  preview: {
    port: 8081
  }
})
