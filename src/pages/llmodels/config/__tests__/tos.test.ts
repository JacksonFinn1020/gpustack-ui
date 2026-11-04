import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatTosSource,
  hasTosCoordinates,
  mergeTosSourceFields,
  stripTosUiFields,
  tosSourceFields
} from '../tos';

test('formatTosSource prefers model:version', () => {
  assert.equal(
    formatTosSource({
      tos_model: 'qwen3',
      tos_version: 'v1',
      tos_release_path: 'lingji-models/qwen3/v1'
    }),
    'TOS/qwen3:v1'
  );
});

test('hasTosCoordinates requires the five deploy fields', () => {
  assert.equal(hasTosCoordinates({}), false);
  assert.equal(
    hasTosCoordinates({
      tos_endpoint: 'https://tos-cn-shanghai.volces.com',
      tos_region: 'cn-shanghai',
      tos_bucket: 'bucket',
      tos_model: 'qwen3',
      tos_version: 'v1'
    }),
    true
  );
});

test('stripTosUiFields drops ingest path and empty release path', () => {
  const payload = stripTosUiFields({
    source: 'tos',
    tos_endpoint: 'https://tos-cn-shanghai.volces.com',
    tos_region: 'cn-shanghai',
    tos_bucket: 'bucket',
    tos_model: 'qwen3',
    tos_version: 'v1',
    tos_release_path: '',
    tos_ingest_local_path: '/data/snapshots/qwen3',
    gpu_selector: { gpu_ids: ['worker-1:cuda:0'] }
  });
  assert.equal(payload.source, 'tos');
  assert.equal(payload.tos_model, 'qwen3');
  assert.equal(payload.tos_ingest_local_path, undefined);
  assert.equal(payload.tos_release_path, undefined);
  assert.deepEqual(payload.gpu_selector, { gpu_ids: ['worker-1:cuda:0'] });
});

test('mergeTosSourceFields keeps i18n labels for known names', () => {
  const merged = mergeTosSourceFields([
    {
      name: 'tos_endpoint',
      label: 'TOS Endpoint',
      required: true,
      placeholder: 'https://example.com'
    }
  ]);
  assert.equal(merged[0].label, 'models.form.tos.endpoint');
  assert.equal(merged[0].placeholder, 'https://example.com');
  assert.equal(tosSourceFields.length, 6);
});
