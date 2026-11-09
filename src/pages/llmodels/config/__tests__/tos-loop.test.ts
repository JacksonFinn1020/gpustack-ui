import assert from 'node:assert/strict';
import test from 'node:test';
import {
  archiveFileOptionsFromEntries,
  archiveFileOptionsFromResolved,
  buildAutoArchivePayload,
  buildConnectionWritePayload,
  buildModelFileDownloadPayload,
  buildTosSourcePayload,
  canCreateTosArchive,
  canRetryTosArchive,
  catalogHitIsNotVerified,
  catalogListIsNotDeployable,
  clearedTosReleaseFields,
  clampModelFileFilesPerPage,
  collectModelFileEntries,
  collectPaginatedItems,
  confirmTosReleaseDetail,
  connectionFormInitialValues,
  connectionScope,
  EMPTY_PREFIX_REQUIRES_BUCKET_ROOT,
  formatOriginSource,
  ggufFromReleaseDetail,
  hasTosCoordinates,
  hasVerifiedTosRelease,
  isCurrentTosVerifyTarget,
  isRedactedAccessKey,
  isSafeRelativeArchivePath,
  isTosGguf,
  matchArchiveJob,
  pickRetryableArchiveJob,
  readTosErrorDetails,
  relativeArchivePaths,
  stripTosUiFields,
  TOS_UI_APIS,
  TOS_WORKER_ONLY_PATHS,
  TosVerifyRequest
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
    TOS_WORKER_ONLY_PATHS.filter((path) => path.startsWith('/tos')).every(
      (path) => path.includes('transport') || path.includes('complete')
    )
  );
  assert.ok(
    TOS_WORKER_ONLY_PATHS.includes('/tos/pull/{model_file_id}/transport')
  );
  assert.ok(TOS_WORKER_ONLY_PATHS.includes('/files/archive-listing'));
  assert.ok(
    !Object.values(TOS_UI_APIS).some((path) =>
      path.includes('archive-listing')
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
    prefix: 'org-a',
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
      prefix: 'org-a',
      credential_mode: 'inline',
      access_key: 'AKLT***',
      secret_key: 'plain-secret'
    },
    { isCreate: false }
  );
  assert.equal(inline.access_key, undefined);
  assert.equal(inline.secret_key, 'plain-secret');
  assert.equal(inline.allow_bucket_root, undefined);
  assert.equal(initial.allow_bucket_root, false);
});

test('empty prefix requires explicit allow_bucket_root and does not expand a prefix', () => {
  assert.throws(
    () =>
      buildConnectionWritePayload({
        name: 'prod',
        endpoint: 'https://tos-cn-beijing.volces.com',
        region: 'cn-beijing',
        bucket: 'weights',
        prefix: '',
        credential_mode: 'env'
      }),
    { message: EMPTY_PREFIX_REQUIRES_BUCKET_ROOT }
  );
  const bucketRoot = buildConnectionWritePayload({
    name: 'prod',
    endpoint: 'https://tos-cn-beijing.volces.com',
    region: 'cn-beijing',
    bucket: 'weights',
    prefix: '  ',
    allow_bucket_root: true,
    credential_mode: 'env'
  });
  assert.equal(bucketRoot.prefix, '');
  assert.equal(bucketRoot.allow_bucket_root, true);
  assert.equal(connectionScope({ prefix: '', scope: 'bucket' }), 'bucket');
  assert.equal(
    connectionFormInitialValues({
      prefix: '',
      scope: 'bucket'
    } as any).allow_bucket_root,
    true
  );
  assert.equal(connectionFormInitialValues(null).allow_bucket_root, false);
});

test('catalog_verified false is listable but not a deployable hit', () => {
  const unverified = {
    connection_id: 1,
    tos_model: 'qwen3',
    tos_version: 'v1',
    artifact_uri: 'tos://weights/qwen3/v1',
    gguf: null,
    object_count: null,
    total_bytes: null,
    catalog_verified: false
  };
  const verifiedMeta = {
    ...unverified,
    gguf: true,
    object_count: 2,
    total_bytes: 10,
    catalog_verified: true
  };
  assert.equal(catalogListIsNotDeployable(unverified), true);
  assert.equal(catalogListIsNotDeployable(verifiedMeta), true);
  assert.equal(unverified.catalog_verified, false);
  assert.equal(verifiedMeta.catalog_verified, true);
  assert.equal(catalogHitIsNotVerified(verifiedMeta), false);
  assert.equal(
    hasVerifiedTosRelease({
      tos_connection_id: 1,
      tos_model: 'qwen3',
      tos_version: 'v1',
      tos_release_verified: true
    }),
    true
  );
});

test('version_retry_required uses details.retry_job_id', () => {
  const details = readTosErrorDetails({
    response: {
      data: {
        details: {
          error_code: 'version_retry_required',
          retry_job_id: 44
        }
      }
    }
  });
  assert.equal(details.error_code, 'version_retry_required');
  assert.equal(details.retry_job_id, 44);
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
  assert.equal(payload.provenance, undefined);
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

test('catalog list hits are not treated as verified; GGUF comes from detail', () => {
  assert.equal(
    catalogHitIsNotVerified({
      connection_id: 1,
      tos_model: 'qwen3',
      tos_version: 'v1',
      artifact_uri: 'tos://bucket/qwen3/v1',
      gguf: undefined
    }),
    false
  );
  assert.equal(
    hasVerifiedTosRelease({
      tos_connection_id: 1,
      tos_model: 'qwen3',
      tos_version: 'v1'
    }),
    false
  );
  assert.equal(
    ggufFromReleaseDetail({
      connection_id: 1,
      bucket: 'weights',
      prefix: '',
      tos_model: 'qwen3',
      tos_version: 'v1',
      artifact_uri: 'tos://weights/qwen3/v1',
      files: [{ path: 'weights/Llama-3-8B-Q4_K_M.gguf', size: 1, sha256: 'a' }],
      total_bytes: 1,
      gguf: false
    }),
    true
  );
  assert.equal(
    ggufFromReleaseDetail({
      connection_id: 1,
      bucket: 'weights',
      prefix: '',
      tos_model: 'qwen3',
      tos_version: 'v1',
      artifact_uri: 'tos://weights/qwen3/v1',
      files: [{ path: 'config.json', size: 1, sha256: 'a' }],
      total_bytes: 1,
      gguf: false,
      provenance: { gguf: true }
    }),
    true
  );
  assert.equal(
    ggufFromReleaseDetail({
      connection_id: 1,
      bucket: 'weights',
      prefix: '',
      tos_model: 'qwen3',
      tos_version: 'v1',
      artifact_uri: 'tos://weights/qwen3/v1',
      files: [{ path: 'model.safetensors', size: 1, sha256: 'a' }],
      total_bytes: 1,
      gguf: false
    }),
    false
  );
});

test('verify always uses detail; catalog gguf is ignored; HTTP and stale responses fail closed', async () => {
  const listed = {
    connection_id: 1,
    tos_model: 'qwen3',
    tos_version: 'v1',
    artifact_uri: 'tos://weights/qwen3/v1'
  };
  assert.equal(catalogHitIsNotVerified(listed), false);
  const calls: TosVerifyRequest[] = [];
  const ok = await confirmTosReleaseDetail(
    async (request) => {
      calls.push(request);
      return {
        ...request,
        bucket: 'weights',
        prefix: '',
        artifact_uri: listed.artifact_uri,
        files: [{ path: 'weights/model.gguf', size: 1, sha256: 'a' }],
        total_bytes: 1,
        gguf: false
      };
    },
    listed,
    () => listed
  );
  assert.equal(calls.length, 1);
  assert.equal(ok.verified, true);
  assert.equal(ok.gguf, true);
  let resolveLate!: (value: any) => void;
  const pending = confirmTosReleaseDetail(
    () =>
      new Promise((resolve) => {
        resolveLate = resolve;
      }),
    listed,
    () => ({ ...listed, tos_version: 'v2' })
  );
  resolveLate({
    ...listed,
    bucket: 'weights',
    prefix: '',
    files: [],
    total_bytes: 0,
    gguf: true
  });
  const stale = await pending;
  assert.equal(stale.stale, true);
  assert.equal(stale.verified, false);
  await assert.rejects(
    confirmTosReleaseDetail(
      async () => {
        throw new Error('http 500');
      },
      listed,
      () => listed
    )
  );
});

test('stale verify responses for another connection/model/version are ignored', () => {
  const expected = {
    connection_id: 2,
    tos_model: 'qwen3',
    tos_version: 'v1'
  };
  assert.equal(isCurrentTosVerifyTarget(expected, expected), true);
  assert.equal(
    isCurrentTosVerifyTarget(
      { connection_id: 9, tos_model: 'qwen3', tos_version: 'v1' },
      expected
    ),
    false
  );
  assert.equal(
    isCurrentTosVerifyTarget(
      { connection_id: 2, tos_model: 'qwen3', tos_version: 'v2' },
      expected
    ),
    false
  );
});

test('archive file options use nested relative paths and reject basename/absolute fakes', () => {
  const options = archiveFileOptionsFromResolved([
    '/cache/ready/weights/model.gguf',
    '/cache/ready/config.json'
  ]);
  assert.deepEqual(
    options.map((item) => item.value),
    ['weights/model.gguf', 'config.json']
  );
  assert.deepEqual(
    relativeArchivePaths(
      ['/cache/ready/weights/model.gguf', '/cache/ready/config.json'],
      ['weights/model.gguf']
    ),
    ['weights/model.gguf']
  );
  assert.equal(
    relativeArchivePaths(
      ['/cache/ready/weights/model.gguf', '/cache/ready/config.json'],
      ['model.gguf']
    ),
    null
  );
  assert.equal(
    relativeArchivePaths(['/cache/ready/weights/model.gguf'], ['/etc/passwd']),
    null
  );
  assert.equal(isSafeRelativeArchivePath('../secret'), false);
  assert.equal(isSafeRelativeArchivePath('/abs/model.gguf'), false);
  assert.equal(archiveFileOptionsFromResolved(['/cache/ready/qwen']).length, 0);
});

test('READY directory listing uses relative paths and does not treat pagination.total as catalog size', async () => {
  assert.equal(TOS_UI_APIS.modelFileFiles, '/model-files/{id}/files');
  assert.notEqual(TOS_UI_APIS.modelFileFiles, '/files/archive-listing');
  assert.equal(clampModelFileFilesPerPage(1000), 200);
  const listed = archiveFileOptionsFromEntries([
    { path: 'weights/Llama-3-8B-Q4_K_M.gguf', size: 4 },
    { path: '/etc/passwd', size: 1 },
    { path: '../x', size: 1 }
  ]);
  assert.deepEqual(
    listed.map((item) => item.value),
    ['weights/Llama-3-8B-Q4_K_M.gguf']
  );
  const calls: Array<{ after?: string; perPage: number }> = [];
  const collected = await collectModelFileEntries(async (params) => {
    calls.push(params);
    if (!params.after) {
      return {
        items: [{ path: 'config.json', size: 2 }],
        pagination: { total: 1, totalPage: 2, page: 1, perPage: 100 },
        truncated: true,
        next_after: 'config.json',
        root_kind: 'directory'
      };
    }
    return {
      items: [{ path: 'weights/Llama-3-8B-Q4_K_M.gguf', size: 4 }],
      pagination: { total: 1, totalPage: 2, page: 1, perPage: 100 },
      truncated: false,
      next_after: null,
      root_kind: 'directory'
    };
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].after, 'config.json');
  assert.deepEqual(
    collected.items.map((item) => item.path),
    ['config.json', 'weights/Llama-3-8B-Q4_K_M.gguf']
  );
  assert.equal(collected.truncated, false);
  assert.deepEqual(
    relativeArchivePaths(
      ['/cache/qwen'],
      ['weights/Llama-3-8B-Q4_K_M.gguf'],
      collected.items.map((item) => item.path)
    ),
    ['weights/Llama-3-8B-Q4_K_M.gguf']
  );
});

test('file listing scan cap marks truncated instead of pretending the catalog is complete', async () => {
  const collected = await collectModelFileEntries(
    async ({ after }) => ({
      items: [{ path: `${after || 'a'}.gguf`, size: 1 }],
      pagination: { total: 1, totalPage: 99, page: 1, perPage: 1 },
      truncated: true,
      next_after: `${(after || 'a').length}`,
      root_kind: 'directory'
    }),
    { perPage: 1, scanCap: 3 }
  );
  assert.equal(collected.items.length, 3);
  assert.equal(collected.truncated, true);
});

test('ERROR unique version can only retry, not create another archive', () => {
  assert.equal(
    canCreateTosArchive({
      state: 'ready',
      archive_state: 'error',
      is_lora: false
    }),
    false
  );
  assert.equal(canRetryTosArchive({ archive_state: 'error' }), true);
  assert.equal(
    canCreateTosArchive({
      state: 'ready',
      archive_state: null,
      is_lora: false
    }),
    true
  );
  const existing = matchArchiveJob(
    [
      {
        id: 4,
        connection_id: 1,
        tos_model: 'qwen3',
        tos_version: 'v1',
        state: 'error'
      } as any
    ],
    { connection_id: 1, tos_model: 'qwen3', tos_version: 'v1' }
  );
  assert.equal(existing?.id, 4);
});

test('connection pagination collects every page instead of truncating at 100', async () => {
  const pages = [
    {
      items: Array.from({ length: 100 }, (_, index) => ({ id: index + 1 })),
      pagination: { page: 1, perPage: 100, total: 101, totalPage: 2 }
    },
    {
      items: [{ id: 101 }],
      pagination: { page: 2, perPage: 100, total: 101, totalPage: 2 }
    }
  ];
  const items = await collectPaginatedItems(
    async (page) => pages[page - 1] as any
  );
  assert.equal(items.length, 101);
  assert.equal(items[100].id, 101);
});

test('TOS download origin is blank until provenance origin is filled', () => {
  assert.equal(
    formatOriginSource({
      source: 'tos',
      tos_model: 'qwen3',
      tos_version: 'v1'
    } as any),
    ''
  );
  assert.equal(
    formatOriginSource({
      source: 'tos',
      provenance: { origin_source: 'tos' }
    }),
    ''
  );
  assert.equal(
    formatOriginSource({
      source: 'tos',
      provenance: {
        origin_huggingface_repo_id: 'Qwen/Qwen3-8B',
        origin_source: 'huggingface'
      }
    }),
    'Hugging Face/Qwen/Qwen3-8B'
  );
  assert.equal(
    formatOriginSource({
      source: 'huggingface',
      huggingface_repo_id: 'Qwen/Qwen3-8B'
    }),
    'Hugging Face/Qwen/Qwen3-8B'
  );
});
