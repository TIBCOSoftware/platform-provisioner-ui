/*
 * Copyright © 2025. Cloud Software Group, Inc.
 * This file is subject to the license terms contained
 * in the license file that is distributed with this file.
 */

import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vitejs.dev/config/
export default defineConfig({
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
    rollupOptions: {
      output: {
        manualChunks: {
          'ace-builds': ['ace-builds'],
          'axios': ['axios'],
          'bootstrap': ['bootstrap'],
          'dayjs': ['dayjs'],
          'dompurify': ['dompurify'],
          'highlight.js': ['highlight.js'],
          'js-yaml': ['js-yaml'],
          'json-editor-vue3': ['json-editor-vue3'],
          'lodash': ['lodash'],
          'prismjs': ['prismjs'],
          'rxjs': ['rxjs'],
          'vue3-markdown': ['vue3-markdown'],
          'vue3-toastify': ['vue3-toastify'],
        }
      }
    }
  },
  preview: {
    port: 8081
  }
})
