/*
 * Copyright © 2025. Cloud Software Group, Inc.
 * This file is subject to the license terms contained
 * in the license file that is distributed with this file.
 */

import js from '@eslint/js';
import vue from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';
import typescript from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';
import { modernModuleResolution } from '@rushstack/eslint-patch/modern-module-resolution';

// Apply the patch for modern module resolution
modernModuleResolution();
export default [
  {
    files: ['server/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        __dirname: 'readonly',
        module: 'readonly',
      },
    },
    rules: {
      // Incorporating the recommended ESLint rules
      // ...js.configs.recommended.rules,
      'no-console': 'off',
    },
  },
  {
    files: ['src/**/*.{vue,js,jsx,cjs,mjs}'],
    languageOptions: {
      parser: vueParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        __dirname: 'readonly',
        __filename: 'readonly',
        exports: 'readonly',
        module: 'readonly',
        require: 'readonly',
        process: 'readonly',
        console: 'readonly',
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        Buffer: "readonly",
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    plugins: {
      vue: vue,
      typescript: typescript,
    },
    rules: {
      // Incorporating the recommended rules from 'plugin:vue/vue3-essential'
      ...vue.configs['vue3-essential'].rules,
      // Incorporating the recommended ESLint rules
      ...js.configs.recommended.rules,
      ...typescript.configs['recommended'].rules,

      // TypeScript configuration from @vue/eslint-config-typescript
      '@typescript-eslint/no-unused-vars': ['error'],

      // Disallow console.log statements in production
      'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',

      // Enforce semicolons at the end of statements
      "semi": ["error", "always"],

      // Enforce consistent indentation (2 spaces)
      "indent": ["error", 2, { "SwitchCase": 1 }],

      // Disallow unused variables
      "no-unused-vars": ["error"],

      // Enforce strict equality (===) and inequality (!==)
      "eqeqeq": ["error", "always"],

      // Disallow the use of undeclared variables
      "no-undef": ["error"],
      //
      // // Enforce curly braces for all control statements
      "curly": ["error", "all"],

      // Enforce consistent return values in functions
      "consistent-return": ["error"],

      // Enforce consistent spacing inside braces of object literals
      "object-curly-spacing": ["error", "always"],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    plugins: {
      typescript: typescript,
    },
    rules: {
      ...typescript.configs['recommended'].rules,
      '@typescript-eslint/no-unused-vars': ['error'],
    },
  },
  {
    files: ['e2e/**/*.{test,spec}.{js,ts,jsx,tsx}'],
    plugins: {
      playwright: require('eslint-plugin-playwright'),
    },
    rules: {
      ...require('eslint-plugin-playwright').configs.recommended.rules,
    },
  },
  {
    ignores: ['**/*.d.ts']
  },
  {
    settings: {
      prettier: {
        skipFormat: true,
      },
    },
    rules: {
      ...prettier.configs['skip-formatting'].rules,
    },
  },
];
