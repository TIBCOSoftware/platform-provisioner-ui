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

import { describe, it, expect, beforeEach } from 'vitest';

// Import the module — changeMetadata and isTemplateAccessible are now exported
const k8s = await import('./k8s.js');

// A valid Kubernetes label value: empty, or <=63 chars of alphanumerics / '-' /
// '_' / '.' that begin and end with an alphanumeric. A value that fails this is
// exactly what makes the k8s API reject a PipelineRun with a 422 (PCP-19684).
// (dash kept last in the char class so it is an unambiguous literal, not a range)
const LABEL_VALUE_RE = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9_.-]{0,61}[a-zA-Z0-9])?)?$/;

describe('changeMetadata', () => {
  let data;

  beforeEach(() => {
    data = {
      metadata: {
        name: 'test-pipeline',
        labels: {}
      },
      spec: {
        params: []
      }
    };
  });

  it('should set account and action labels', () => {
    k8s.changeMetadata(data, 'my-account', 'deploy', null, null);
    expect(data.metadata.labels['account']).toBe('my-account');
    expect(data.metadata.labels['action']).toBe('deploy');
  });

  it('should extract note from input param', () => {
    const inputJson = JSON.stringify({ meta: { guiEnv: { note: 'test-note' } } });
    data.spec.params = [{ name: 'input', value: inputJson }];
    k8s.changeMetadata(data, 'acc', 'deploy', null, null);
    expect(data.metadata.labels['note']).toBe('test-note');
  });

  it('should set empty note when input has no note field', () => {
    const inputJson = JSON.stringify({ meta: {} });
    data.spec.params = [{ name: 'input', value: inputJson }];
    k8s.changeMetadata(data, 'acc', 'deploy', null, null);
    expect(data.metadata.labels['note']).toBe('');
  });

  // PCP-19684: a note with spaces / label-invalid characters must not be written
  // verbatim — it has to come out as a value the k8s API will accept (no 422).
  it('should sanitize a note containing spaces into a valid k8s label value', () => {
    const inputJson = JSON.stringify({ meta: { guiEnv: { note: 'my deploy note' } } });
    data.spec.params = [{ name: 'input', value: inputJson }];
    k8s.changeMetadata(data, 'acc', 'deploy', null, null);
    expect(data.metadata.labels['note']).toMatch(LABEL_VALUE_RE);
    expect(data.metadata.labels['note']).not.toMatch(/\s/);
  });

  it('should leave an already label-safe note unchanged', () => {
    const inputJson = JSON.stringify({ meta: { guiEnv: { note: 'release-1.19.0' } } });
    data.spec.params = [{ name: 'input', value: inputJson }];
    k8s.changeMetadata(data, 'acc', 'deploy', null, null);
    expect(data.metadata.labels['note']).toBe('release-1.19.0');
  });

  it('should produce a valid k8s label value for arbitrary invalid note characters', () => {
    const inputJson = JSON.stringify({ meta: { guiEnv: { note: 'env: prod / region=us-west-2 !!' } } });
    data.spec.params = [{ name: 'input', value: inputJson }];
    k8s.changeMetadata(data, 'acc', 'deploy', null, null);
    expect(data.metadata.labels['note']).toMatch(LABEL_VALUE_RE);
  });

  it('should truncate a long note to a valid (<=63 char) label value', () => {
    const longNote = 'a'.repeat(80) + ' tail';
    const inputJson = JSON.stringify({ meta: { guiEnv: { note: longNote } } });
    data.spec.params = [{ name: 'input', value: inputJson }];
    k8s.changeMetadata(data, 'acc', 'deploy', null, null);
    expect(data.metadata.labels['note'].length).toBeLessThanOrEqual(63);
    expect(data.metadata.labels['note']).toMatch(LABEL_VALUE_RE);
  });

  it('should reduce an all-invalid note to an empty (still valid) label value', () => {
    const inputJson = JSON.stringify({ meta: { guiEnv: { note: '!!!' } } });
    data.spec.params = [{ name: 'input', value: inputJson }];
    k8s.changeMetadata(data, 'acc', 'deploy', null, null);
    expect(data.metadata.labels['note']).toBe('');
    expect(data.metadata.labels['note']).toMatch(LABEL_VALUE_RE);
  });

  it('should set name label and metadata.name when name provided', () => {
    k8s.changeMetadata(data, 'acc', 'deploy', 'custom-name', null);
    expect(data.metadata.labels['name']).toBe('custom-name');
    expect(data.metadata.name).toBe('custom-name');
  });

  it('should generate unique metadata.name when no name provided', () => {
    k8s.changeMetadata(data, 'acc', 'deploy', null, null);
    expect(data.metadata.name).toMatch(/^test-pipeline-acc-\d+$/);
  });

  it('should set created-by label from tenant', () => {
    k8s.changeMetadata(data, 'acc', 'deploy', null, { tenant: 'my-tenant' });
    expect(data.metadata.labels['created-by']).toBe('my-tenant');
  });

  it('should set created-by label from email (strip domain)', () => {
    k8s.changeMetadata(data, 'acc', 'deploy', null, { email: 'user@example.com' });
    expect(data.metadata.labels['created-by']).toBe('user');
  });

  it('should sanitize special characters in created-by', () => {
    k8s.changeMetadata(data, 'acc', 'deploy', null, { tenant: 'user!@#$name' });
    expect(data.metadata.labels['created-by']).toBe('user----name');
  });

  it('should truncate created-by to 63 characters', () => {
    const longName = 'a'.repeat(100);
    k8s.changeMetadata(data, 'acc', 'deploy', null, { tenant: longName });
    expect(data.metadata.labels['created-by'].length).toBeLessThanOrEqual(63);
  });

  it('should strip leading special characters from created-by', () => {
    k8s.changeMetadata(data, 'acc', 'deploy', null, { tenant: '---user' });
    expect(data.metadata.labels['created-by']).toBe('user');
  });
});

describe('isTemplateAccessible', () => {
  const groupsKey = process.env.PIPELINE_TEMPLATE_LABEL_KEY_CONFIG_GROUPS;

  it('should return false when account is null', () => {
    expect(k8s.isTemplateAccessible({}, null)).toBe(false);
  });

  it('should return false when account is empty array', () => {
    expect(k8s.isTemplateAccessible({}, [])).toBe(false);
  });

  it('should return true for admin user', () => {
    const template = { metadata: { annotations: {} } };
    expect(k8s.isTemplateAccessible(template, [{ id: 'admin' }])).toBe(true);
  });

  it('should return true when no config-groups annotation exists', () => {
    const template = { metadata: { annotations: {} } };
    expect(k8s.isTemplateAccessible(template, [{ id: 'tenant1' }])).toBe(true);
  });

  it('should return true when config-groups.all is true', () => {
    const template = {
      metadata: { annotations: { [groupsKey]: JSON.stringify({ all: true }) } }
    };
    expect(k8s.isTemplateAccessible(template, [{ id: 'tenant1' }])).toBe(true);
  });

  it('should return true when tenant is in config-groups.tenants', () => {
    const template = {
      metadata: { annotations: { [groupsKey]: JSON.stringify({ tenants: ['tenant1', 'tenant2'] }) } }
    };
    expect(k8s.isTemplateAccessible(template, [{ id: 'tenant1' }])).toBe(true);
  });

  it('should return false when tenant is not in config-groups.tenants', () => {
    const template = {
      metadata: { annotations: { [groupsKey]: JSON.stringify({ tenants: ['tenant1'] }) } }
    };
    expect(k8s.isTemplateAccessible(template, [{ id: 'tenant2' }])).toBe(false);
  });

  it('should return false when config-groups is invalid JSON', () => {
    const template = {
      metadata: { annotations: { [groupsKey]: 'not-valid-json' } }
    };
    expect(k8s.isTemplateAccessible(template, [{ id: 'tenant1' }])).toBe(false);
  });

  it('should return false when config-groups.all is false and no tenants', () => {
    const template = {
      metadata: { annotations: { [groupsKey]: JSON.stringify({ all: false }) } }
    };
    expect(k8s.isTemplateAccessible(template, [{ id: 'tenant1' }])).toBe(false);
  });
});

describe('stripPipelineRunFields', () => {
  it('should remove spec from item', () => {
    const item = { spec: { params: [{ name: 'input' }] }, metadata: {}, status: {} };
    k8s.stripPipelineRunFields(item);
    expect(item.spec).toBeUndefined();
  });

  it('should remove metadata.managedFields', () => {
    const item = { metadata: { name: 'test', managedFields: [{ manager: 'kubectl' }] }, status: {} };
    k8s.stripPipelineRunFields(item);
    expect(item.metadata.managedFields).toBeUndefined();
    expect(item.metadata.name).toBe('test');
  });

  it('should remove metadata.annotations', () => {
    const item = { metadata: { name: 'test', annotations: { key: 'value' } }, status: {} };
    k8s.stripPipelineRunFields(item);
    expect(item.metadata.annotations).toBeUndefined();
    expect(item.metadata.name).toBe('test');
  });

  it('should remove status.provenance', () => {
    const item = { metadata: {}, status: { conditions: [{ type: 'Succeeded' }], provenance: { refSource: {} } } };
    k8s.stripPipelineRunFields(item);
    expect(item.status.provenance).toBeUndefined();
    expect(item.status.conditions).toEqual([{ type: 'Succeeded' }]);
  });

  it('should strip all four fields at once', () => {
    const item = {
      spec: { params: [] },
      metadata: { name: 'run-1', managedFields: [], annotations: { a: 'b' }, labels: { x: 'y' } },
      status: { conditions: [], provenance: {}, childReferences: [] }
    };
    k8s.stripPipelineRunFields(item);
    expect(item.spec).toBeUndefined();
    expect(item.metadata).toEqual({ name: 'run-1', labels: { x: 'y' } });
    expect(item.status).toEqual({ conditions: [], childReferences: [] });
  });

  it('should not crash when metadata is missing', () => {
    const item = { status: { provenance: {} } };
    expect(() => k8s.stripPipelineRunFields(item)).not.toThrow();
    expect(item.status.provenance).toBeUndefined();
  });

  it('should not crash when status is missing', () => {
    const item = { metadata: { managedFields: [] } };
    expect(() => k8s.stripPipelineRunFields(item)).not.toThrow();
    expect(item.metadata.managedFields).toBeUndefined();
  });

  it('should remove input param from pipelineSpec.finally[*].params', () => {
    const item = {
      metadata: {},
      status: {
        pipelineSpec: {
          tasks: [],
          finally: [{
            name: 'cleanup',
            params: [
              { name: 'input', value: '{"large":"json"}' },
              { name: 'status', value: 'done' }
            ]
          }]
        }
      }
    };
    k8s.stripPipelineRunFields(item);
    expect(item.status.pipelineSpec.finally[0].params).toEqual([{ name: 'status', value: 'done' }]);
  });

  it('should remove input param from pipelineSpec.tasks[*].params', () => {
    const item = {
      metadata: {},
      status: {
        pipelineSpec: {
          tasks: [{
            name: 'task-1',
            params: [
              { name: 'input', value: '{"meta":{"very":"large json"}}' },
              { name: 'awsAccount', value: 'gcp-123' },
              { name: 'awsRegion', value: 'us-west-2' }
            ]
          }]
        }
      }
    };
    k8s.stripPipelineRunFields(item);
    expect(item.status.pipelineSpec.tasks[0].params).toEqual([
      { name: 'awsAccount', value: 'gcp-123' },
      { name: 'awsRegion', value: 'us-west-2' }
    ]);
  });

  it('should remove input param from all tasks', () => {
    const item = {
      metadata: {},
      status: {
        pipelineSpec: {
          tasks: [
            { name: 't1', params: [{ name: 'input', value: 'big' }, { name: 'foo', value: 'bar' }] },
            { name: 't2', params: [{ name: 'input', value: 'big2' }] }
          ]
        }
      }
    };
    k8s.stripPipelineRunFields(item);
    expect(item.status.pipelineSpec.tasks[0].params).toEqual([{ name: 'foo', value: 'bar' }]);
    expect(item.status.pipelineSpec.tasks[1].params).toEqual([]);
  });

  it('should handle tasks without params', () => {
    const item = {
      metadata: {},
      status: { pipelineSpec: { tasks: [{ name: 't1' }] } }
    };
    expect(() => k8s.stripPipelineRunFields(item)).not.toThrow();
  });
});

describe('normalizeError (PCP-19676)', () => {
  it('should not throw and should surface the message for a plain Error', () => {
    // Regression: the old `e.error.message` threw on a plain Error (no .error),
    // producing "Cannot read properties of undefined (reading 'message')" and
    // masking the true failure.
    const e = new Error('real underlying failure');
    let result;
    expect(() => { result = k8s.normalizeError(e); }).not.toThrow();
    expect(result).toBe('real underlying failure');
  });

  it('should surface the k8s API Status message from axios response.data', () => {
    const e = new Error('Request failed with status code 400');
    e.response = { status: 400, data: { kind: 'Status', message: 'admission webhook denied the request', reason: 'BadRequest', code: 400 } };
    expect(k8s.normalizeError(e)).toBe('admission webhook denied the request');
  });

  it('should fall back to response.data.reason when no message present', () => {
    const e = new Error('Request failed with status code 404');
    e.response = { status: 404, data: { kind: 'Status', reason: 'NotFound', code: 404 } };
    expect(k8s.normalizeError(e)).toBe('NotFound');
  });

  it('should surface a string response body', () => {
    const e = new Error('Request failed with status code 500');
    e.response = { status: 500, data: 'Internal Server Error' };
    expect(k8s.normalizeError(e)).toBe('Internal Server Error');
  });

  it('should serialize an API body object that has no message or reason', () => {
    const e = new Error('Request failed with status code 422');
    e.response = { status: 422, data: { code: 422, details: { causes: ['bad field'] } } };
    expect(k8s.normalizeError(e)).toBe('{"code":422,"details":{"causes":["bad field"]}}');
  });

  it('should not throw on a non-serializable (circular) API body', () => {
    const circular = { code: 500 };
    circular.self = circular;
    const e = new Error('boom');
    e.response = { status: 500, data: circular };
    let result;
    expect(() => { result = k8s.normalizeError(e); }).not.toThrow();
    expect(result).toBe('boom');
  });

  it('should fall back to e.message when there is no response body', () => {
    const e = new Error('socket hang up');
    expect(k8s.normalizeError(e)).toBe('socket hang up');
  });

  it('should still honor the legacy { error: { message } } shape', () => {
    const e = { error: { message: 'legacy nested message' } };
    expect(k8s.normalizeError(e)).toBe('legacy nested message');
  });

  it('should return "Unknown error" for null/undefined/empty errors', () => {
    expect(k8s.normalizeError(null)).toBe('Unknown error');
    expect(k8s.normalizeError(undefined)).toBe('Unknown error');
    expect(k8s.normalizeError({})).toBe('Unknown error');
  });
});
