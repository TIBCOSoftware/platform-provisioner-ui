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

import { describe, it, expect } from 'vitest';

// Read recipes from the bundled server/data files (same path the dev server uses).
// Must be set before configmap.js is imported — isFromSource is evaluated at load.
process.env.DEV_START_FROM_SOURCE = 'true';
const configMap = await import('./configmap.js');
configMap.init();

describe('findConfigByTitle', () => {
  const menu = [
    // has a config but no title= query param -> not title-addressable
    { label: 'Plain', url: '/pipelines/generic-runner', config: 'plain.yaml' },
    { label: 'A', url: '/pipelines/generic-runner?title=alpha', config: 'alpha.yaml' },
    { label: 'B', url: '/pipelines/helm-install?title=beta', config: 'beta.yaml' },
    // title= present but no config -> cannot be resolved to a file
    { label: 'NoConfig', url: '/pipelines/generic-runner?title=gamma' },
    {
      label: 'Group',
      items: [{ label: 'Nested', url: '/pipelines/generic-runner?title=nested', config: 'nested.yaml' }],
    },
  ];

  it('returns the config file for a matching title', () => {
    expect(configMap.findConfigByTitle(menu, 'alpha')).toBe('alpha.yaml');
  });

  it('narrows the match by pipeline when provided', () => {
    expect(configMap.findConfigByTitle(menu, 'beta', 'helm-install')).toBe('beta.yaml');
    expect(configMap.findConfigByTitle(menu, 'beta', 'generic-runner')).toBeNull();
  });

  it('searches nested sub-menu items recursively', () => {
    expect(configMap.findConfigByTitle(menu, 'nested')).toBe('nested.yaml');
  });

  it('ignores items that have a title but no config file', () => {
    expect(configMap.findConfigByTitle(menu, 'gamma')).toBeNull();
  });

  it('returns null when no item matches', () => {
    expect(configMap.findConfigByTitle(menu, 'no-such-title')).toBeNull();
  });

  it('returns null for empty or undefined item lists', () => {
    expect(configMap.findConfigByTitle(undefined, 'alpha')).toBeNull();
    expect(configMap.findConfigByTitle([], 'alpha')).toBeNull();
  });
});

describe('getRecipeByTitle (bundled dev recipes)', () => {
  it('returns the full recipe config for a known title', () => {
    const result = configMap.getRecipeByTitle('deploy-cp-tp-cluster');
    expect(result.error).toBeUndefined();
    expect(result.recipe).toBeTypeOf('object');
    // Same payload the REST GET /cic2/public/v1/recipe?title= endpoint returns:
    // UI form metadata + the full pipeline recipe as a YAML string.
    expect(result.recipe.pipelineName).toBe('Deploy TIBCO Control Plane on Platform Cluster');
    expect(typeof result.recipe.recipe).toBe('string');
  });

  it('narrows the lookup by pipeline type', () => {
    expect(configMap.getRecipeByTitle('deploy-cp-tp-cluster', 'generic-runner').recipe).toBeTypeOf('object');
    const mismatch = configMap.getRecipeByTitle('deploy-cp-tp-cluster', 'helm-install');
    expect(mismatch.reason).toBe('title-not-found');
  });

  it('reports title-not-found for an unknown title', () => {
    const result = configMap.getRecipeByTitle('no-such-recipe-xyz');
    expect(result.recipe).toBeUndefined();
    expect(result.reason).toBe('title-not-found');
    expect(result.error).toContain('no-such-recipe-xyz');
  });
});

describe('listRecipes (bundled dev recipes)', () => {
  it('lists title-addressable recipes with title/pipeline/config', () => {
    const recipes = configMap.listRecipes();
    expect(Array.isArray(recipes)).toBe(true);

    const titles = recipes.map((r) => r.title);
    expect(titles).toContain('deploy-cp-tp-cluster');
    expect(titles).toContain('testing');

    const deploy = recipes.find((r) => r.title === 'deploy-cp-tp-cluster');
    expect(deploy).toMatchObject({
      title: 'deploy-cp-tp-cluster',
      pipeline: 'generic-runner',
      config: 'pp-deploy-cp-tp-cluster.yaml',
    });
  });

  it('every listed recipe is resolvable via getRecipeByTitle', () => {
    for (const r of configMap.listRecipes()) {
      const result = configMap.getRecipeByTitle(r.title, r.pipeline);
      expect(result.error, `recipe "${r.title}" should resolve`).toBeUndefined();
      expect(result.recipe).toBeTypeOf('object');
    }
  });

  it('omits menu items that are not title-addressable', () => {
    const recipes = configMap.listRecipes();
    // "Helm install" (url /pipelines/helm-install, no title=) must not be listed.
    expect(recipes.some((r) => r.config === 'pp-helm-install.yaml')).toBe(false);
  });
});
