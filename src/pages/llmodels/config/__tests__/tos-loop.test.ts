import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAutoArchivePayload,
  buildConnectionWritePayload,
  buildModelFileDownloadPayload,
  buildTosSourcePayload,
  clearedTosReleaseFields,
  connectionFormInitialValues,
  hasTosCoordinates,
  hasVerifiedTosRelease,
  isRedactedAccessKey,
  isTosGguf,
  pickRetryableArchiveJob,
  relativeArchivePaths,
  stripTosUiFields,
  TOS_UI_APIS,
  TOS_WORKER_ONLY_PATHS
} from '../tos';

test('connection catalog and archive APIs are owner routes, not worker transport', () => {
  assert.equal(TOS_UI_APIS.catalog, '/tos/releases');
  assert.equal(TOS_UI_APIS.catalogDetail, '/tos/releases/detail');
  assert.equal(TOS_UI_APIS.connections, '/tos/connections');
  assert.equal(TOS_UI_APIS.archives, '/tos/archives');
  assert.ok(
    !Object.values(TOS_UI_APIS).some((path) => path.includes('browse'))
  );
  assert.ok(
    TOS_WORKER_ONLY_PATHS.every(
      (path) => path.includes('transport') || path.includes('complete')
    )
  );
});

test('hasTosCoordinates accepts connection id or legacy five fields', () => {
  assert.equal(
    hasTosCoordinates({
      tos_connection_id: 3,
      tos_model: 'qwen3',
      tos_version: 'v1'
    }),
    true
  );
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
  assert.equal(
    hasVerifiedTosRelease({
      tos_connection_id: 3,
      tos_model: 'qwen3',
      tos_version: 'v1'
    }),
    false
  );
  assert.equal(
    hasVerifiedTosRelease({
      tos_connection_id: 3,
      tos_model: 'qwen3',
      tos_version: 'v1',
      tos_release_verified: true
    }),
    true
  );
});

test('typed tos_* without verification is not a selected artifact', () => {
  assert.equal(
    hasVerifiedTosRelease({
      tos_endpoint: 'https://tos-cn-shanghai.volces.com',
      tos_region: 'cn-shanghai',
      tos_bucket: 'bucket',
      tos_model: 'qwen3',
      tos_version: 'v1'
    }),
    false
  );
});

test('changing connection clears model, version, and verified flag', () => {
  const next = {
    tos_connection_id: 9,
    ...clearedTosReleaseFields()
  };
  assert.equal(next.tos_model, undefined);
  assert.equal(next.tos_version, undefined);
  assert.equal(next.tos_release_verified, undefined);
});

test('connection form initial values never copy secrets or redacted keys', () => {
  const initial = connectionFormInitialValues({
    name: 'prod',
    endpoint: 'https://tos-cn-beijing.volces.com',
    region: 'cn-beijing',
    bucket: 'weights',
    prefix: 'org-a',
    credential_mode: 'inline',
    access_key: 'AKLT***'
  } as any);
  assert.equal(initial.name, 'prod');
  assert.equal(
    Object.prototype.hasOwnProperty.call(initial, 'access_key'),
    false
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(initial, 'secret_key'),
    false
  );
  assert.equal(isRedactedAccessKey('AKLT***'), true);
  const envPayload = buildConnectionWritePayload({
    name: 'prod',
    endpoint: 'https://tos-cn-beijing.volces.com',
    region: 'cn-beijing',
    bucket: 'weights',
    credential_mode: 'env'
  });
  assert.equal(envPayload.credential_ref, 'env');
  assert.equal(envPayload.access_key, undefined);
  assert.equal(envPayload.secret_key, undefined);
  const inline = buildConnectionWritePayload(
    {
      name: 'prod',
      endpoint: 'https://tos-cn-beijing.volces.com',
      region: 'cn-beijing',
      bucket: 'weights',
      credential_mode: 'inline',
      access_key: 'AKLT***',
      secret_key: 'plain-secret'
    },
    { isCreate: false }
  );
  assert.equal(inline.access_key, undefined);
  assert.equal(inline.secret_key, 'plain-secret');
});

test('auto-archive is off unless explicitly enabled', () => {
  assert.equal(buildAutoArchivePayload({}), undefined);
  assert.equal(
    buildAutoArchivePayload({ auto_archive_enabled: false }),
    undefined
  );
  const spec = buildAutoArchivePayload({
    auto_archive_enabled: true,
    auto_archive_connection_id: 1,
    auto_archive_tos_model: 'qwen3',
    auto_archive_tos_version: 'hub-1'
  });
  assert.deepEqual(spec, {
    enabled: true,
    connection_id: 1,
    tos_model: 'qwen3',
    tos_version: 'hub-1',
    paths: null
  });
});

test('download payload uses connection coordinates and strips UI-only fields', () => {
  const payload = buildModelFileDownloadPayload({
    source: 'tos',
    tos_connection_id: 2,
    tos_model: 'qwen3',
    tos_version: 'v1',
    tos_release_verified: true,
    tos_gguf: true,
    worker_id: [1, 7],
    local_dir: '/data/cache',
    trust_remote_code: true,
    auto_archive_enabled: false
  });
  assert.equal(payload.source, 'tos');
  assert.equal(payload.tos_connection_id, 2);
  assert.equal(payload.worker_id, 7);
  assert.equal(payload.tos_release_verified, undefined);
  assert.equal(payload.trust_remote_code, undefined);
  assert.equal(payload.auto_archive, undefined);
  assert.equal(payload.tos_gguf, undefined);
});

test('HF download can attach auto_archive without flipping download state fields', () => {
  const payload = buildModelFileDownloadPayload({
    source: 'huggingface',
    huggingface_repo_id: 'Qwen/Qwen3-8B',
    worker_id: 4,
    auto_archive_enabled: true,
    auto_archive_connection_id: 1,
    auto_archive_tos_model: 'qwen3-8b',
    auto_archive_tos_version: 'hub-2026-11-09'
  });
  assert.equal(payload.source, 'huggingface');
  assert.deepEqual(payload.auto_archive, {
    enabled: true,
    connection_id: 1,
    tos_model: 'qwen3-8b',
    tos_version: 'hub-2026-11-09',
    paths: null
  });
});

test('legacy local_path download payload is unchanged', () => {
  const payload = buildModelFileDownloadPayload({
    source: 'local_path',
    local_path: '/models/qwen',
    worker_id: 3
  });
  assert.equal(payload.source, 'local_path');
  assert.equal(payload.local_path, '/models/qwen');
  assert.equal(payload.auto_archive, undefined);
});

test('TOS GGUF is detected from provenance, selected paths, and coordinates', () => {
  assert.equal(isTosGguf({ provenance: { gguf: true } }), true);
  assert.equal(isTosGguf({ paths: ['Llama-3-8B-Q4_K_M.gguf'] }), true);
  assert.equal(isTosGguf({ tos_model: 'qwen3.gguf', tos_version: 'v1' }), true);
  assert.equal(isTosGguf({ tos_model: 'qwen3', tos_version: 'v1' }), false);
});

test('stripTosUiFields never enables trust_remote_code', () => {
  const payload = stripTosUiFields({
    source: 'tos',
    trust_remote_code: true,
    tos_connection_id: 1,
    tos_model: 'qwen3',
    tos_version: 'v1'
  });
  assert.equal(payload.trust_remote_code, undefined);
});

test('deploy source payload prefers connection id over leftover legacy fields', () => {
  const payload = buildTosSourcePayload({
    tos_connection_id: 8,
    tos_model: 'qwen3',
    tos_version: 'v1',
    tos_endpoint: 'https://tos-cn-shanghai.volces.com',
    tos_region: 'cn-shanghai',
    tos_bucket: 'bucket'
  });
  assert.deepEqual(payload, {
    source: 'tos',
    tos_model: 'qwen3',
    tos_version: 'v1',
    tos_connection_id: 8
  });
});

test('archive retry picks latest error job and relative paths stay relative', () => {
  const job = pickRetryableArchiveJob([
    { id: 1, state: 'ready' } as any,
    { id: 3, state: 'error' } as any,
    { id: 2, state: 'uploading' } as any
  ]);
  assert.equal(job?.id, 3);
  assert.deepEqual(
    relativeArchivePaths(
      ['/cache/Llama-3-8B-Q4_K_M.gguf', '/cache/mmproj.gguf'],
      ['Llama-3-8B-Q4_K_M.gguf']
    ),
    ['Llama-3-8B-Q4_K_M.gguf']
  );
  assert.equal(relativeArchivePaths(['/cache/model'], []), null);
});
