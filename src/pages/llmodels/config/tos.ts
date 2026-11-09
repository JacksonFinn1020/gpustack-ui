export type TosSourceField = {
  name: string;
  label: string;
  required: boolean;
  placeholder?: string;
};

export type TosSourceItem = {
  source: string;
  label: string;
  ingest?: boolean;
  fields?: TosSourceField[];
  deploy_path?: string;
};

export type TosSourcesResponse = {
  items: TosSourceItem[];
};

export type TosIngestRequest = {
  local_path: string;
  tos_endpoint: string;
  tos_region: string;
  tos_bucket: string;
  tos_model: string;
  tos_version: string;
  tos_release_path?: string | null;
};

export type TosIngestResponse = {
  source: string;
  tos_endpoint: string;
  tos_region: string;
  tos_bucket: string;
  tos_model: string;
  tos_version: string;
  tos_release_path: string;
  uri: string;
  manifest_key: string;
  size: number;
  files: string[];
  model_create: Record<string, unknown>;
};

export const TOS_SOURCE = 'tos';

export const TOS_UI_ONLY_FIELDS = [
  'tos_ingest_local_path',
  'tos_release_verified',
  'auto_archive_enabled',
  'auto_archive_connection_id',
  'auto_archive_tos_model',
  'auto_archive_tos_version',
  'tos_gguf'
] as const;

export const TOS_CREATE_FIELDS = [
  'tos_endpoint',
  'tos_region',
  'tos_bucket',
  'tos_model',
  'tos_version',
  'tos_release_path'
] as const;

export const TOS_REQUIRED_FIELDS = [
  'tos_endpoint',
  'tos_region',
  'tos_bucket',
  'tos_model',
  'tos_version'
] as const;

// Mirrors GET /v2/tos/sources TOS.fields (gpustack PR #2). Labels are
// i18n keys; placeholders stay as the backend examples.
export const tosSourceFields: TosSourceField[] = [
  {
    name: 'tos_endpoint',
    label: 'models.form.tos.endpoint',
    required: true,
    placeholder: 'https://tos-cn-shanghai.volces.com'
  },
  {
    name: 'tos_region',
    label: 'models.form.tos.region',
    required: true,
    placeholder: 'cn-shanghai'
  },
  {
    name: 'tos_bucket',
    label: 'models.form.tos.bucket',
    required: true,
    placeholder: 'your-bucket'
  },
  {
    name: 'tos_model',
    label: 'models.form.tos.model',
    required: true,
    placeholder: 'qwen3'
  },
  {
    name: 'tos_version',
    label: 'models.form.tos.version',
    required: true,
    placeholder: 'v1'
  },
  {
    name: 'tos_release_path',
    label: 'models.form.tos.releasePath',
    required: false,
    placeholder: 'lingji-models/qwen3/v1'
  }
];

export const isTosSource = (source?: string) => source === TOS_SOURCE;

export const hasTosCoordinates = (values: Record<string, any> = {}) => {
  if (!values.tos_model || !values.tos_version) {
    return false;
  }
  if (values.tos_connection_id) {
    return true;
  }
  return Boolean(values.tos_endpoint && values.tos_region && values.tos_bucket);
};

export const hasVerifiedTosRelease = (values: Record<string, any> = {}) =>
  hasTosCoordinates(values) && Boolean(values.tos_release_verified);

export const looksGgufPath = (value?: string | null) =>
  Boolean(value && String(value).toLowerCase().endsWith('.gguf'));

export const isTosGguf = (values: Record<string, any> = {}) => {
  if (values.tos_gguf === true || values.provenance?.gguf === true) {
    return true;
  }
  const selected = values.provenance?.selected_paths || values.paths || [];
  if (
    Array.isArray(selected) &&
    selected.some((path: string) => looksGgufPath(path))
  ) {
    return true;
  }
  return [values.tos_release_path, values.tos_model, values.tos_version].some(
    (item) => looksGgufPath(item)
  );
};

export const clearedTosReleaseFields = () => ({
  tos_model: undefined,
  tos_version: undefined,
  tos_release_verified: undefined,
  tos_gguf: undefined
});

export const mergeTosSourceFields = (remote?: TosSourceField[]) => {
  if (!remote?.length) {
    return tosSourceFields;
  }
  const localByName = new Map(
    tosSourceFields.map((field) => [field.name, field])
  );
  const merged = remote.map((field) => {
    const local = localByName.get(field.name);
    return {
      ...field,
      label: local?.label || field.label,
      placeholder: field.placeholder || local?.placeholder
    };
  });
  const remoteNames = new Set(remote.map((field) => field.name));
  return [
    ...merged,
    ...tosSourceFields.filter((field) => !remoteNames.has(field.name))
  ];
};

export const buildTosIngestRequest = (
  values: Record<string, any>
): TosIngestRequest => {
  const request: TosIngestRequest = {
    local_path: values.tos_ingest_local_path || '',
    tos_endpoint: values.tos_endpoint || '',
    tos_region: values.tos_region || '',
    tos_bucket: values.tos_bucket || '',
    tos_model: values.tos_model || '',
    tos_version: values.tos_version || ''
  };
  if (values.tos_release_path) {
    request.tos_release_path = values.tos_release_path;
  }
  return request;
};

export const formatTosSource = (record: {
  tos_model?: string;
  tos_version?: string;
  tos_bucket?: string;
  tos_release_path?: string;
}) => {
  const model = record.tos_model || '';
  const version = record.tos_version || '';
  if (model && version) {
    return `TOS/${model}:${version}`;
  }
  if (record.tos_release_path) {
    return `TOS/${record.tos_release_path}`;
  }
  if (model) {
    return `TOS/${model}`;
  }
  return 'TOS';
};

export const TOS_WORKER_ONLY_PATHS = [
  '/tos/archives/{id}/transport',
  '/tos/archives/{id}/complete'
] as const;

export const TOS_UI_APIS = {
  connections: '/tos/connections',
  archives: '/tos/archives',
  catalog: '/tos/releases',
  catalogDetail: '/tos/releases/detail',
  archiveRetry: '/tos/archives/{id}/retry',
  modelFiles: '/model-files',
  models: '/models'
} as const;

export type TosCredentialMode = 'inline' | 'env';

export type TosArchiveState =
  | 'queued'
  | 'uploading'
  | 'verifying'
  | 'ready'
  | 'error';

export const TosArchiveStateMap = {
  queued: 'queued',
  uploading: 'uploading',
  verifying: 'verifying',
  ready: 'ready',
  error: 'error'
} as const;

export const TosArchiveErrorCode = {
  incomplete_upload: 'incomplete_upload',
  immutable_conflict: 'immutable_conflict',
  concurrent_version: 'concurrent_version',
  checksum_mismatch: 'checksum_mismatch',
  disk_full: 'disk_full',
  worker_unreachable: 'worker_unreachable',
  invalid_credentials: 'invalid_credentials',
  path_escape: 'path_escape',
  prefix_denied: 'prefix_denied',
  not_ready: 'not_ready',
  source_mismatch: 'source_mismatch',
  format_unsupported: 'format_unsupported',
  connection_not_found: 'connection_not_found'
} as const;

export type TosProvenance = {
  origin_source?: string;
  origin_huggingface_repo_id?: string;
  origin_huggingface_filename?: string;
  origin_model_scope_model_id?: string;
  origin_model_scope_file_path?: string;
  origin_local_path?: string;
  origin_worker_id?: number;
  origin_model_file_id?: number;
  upstream_revision?: string;
  selected_paths?: string[] | null;
  manifest_sha256?: string;
  manifest_bytes?: number;
  object_count?: number;
  artifact_uri?: string;
  gguf?: boolean;
  backend_hint?: string;
};

export type AutoArchiveSpec = {
  enabled: boolean;
  connection_id?: number | null;
  tos_model?: string | null;
  tos_version?: string | null;
  paths?: string[] | null;
};

export type TosConnectionPublic = {
  id: number;
  name: string;
  endpoint: string;
  region: string;
  bucket: string;
  prefix: string;
  credential_mode: TosCredentialMode | string;
  credential_ref?: string | null;
  access_key?: string | null;
  description?: string | null;
  owner_principal_id?: number | null;
  created_at: string;
  updated_at: string;
};

export type TosConnectionCreate = {
  name: string;
  endpoint: string;
  region: string;
  bucket: string;
  prefix?: string;
  credential_mode: TosCredentialMode | string;
  credential_ref?: string | null;
  access_key?: string;
  secret_key?: string;
  security_token?: string;
  description?: string | null;
};

export type TosConnectionUpdate = Partial<TosConnectionCreate>;

export type TosReleaseListItem = {
  connection_id: number;
  tos_model: string;
  tos_version: string;
  artifact_uri: string;
  object_count?: number | null;
  total_bytes?: number | null;
  gguf?: boolean | null;
};

export type TosReleaseFilePublic = {
  path: string;
  size: number;
  sha256: string;
};

export type TosReleasePublic = {
  connection_id: number;
  bucket: string;
  prefix: string;
  tos_model: string;
  tos_version: string;
  artifact_uri: string;
  schema_version?: number | null;
  files: TosReleaseFilePublic[];
  total_bytes: number;
  gguf: boolean;
  backend_hint?: string | null;
  provenance?: TosProvenance | null;
};

export type TosArchiveJobPublic = {
  id: number;
  model_file_id: number;
  connection_id: number;
  worker_id: number;
  tos_model: string;
  tos_version: string;
  paths?: string[] | null;
  state: TosArchiveState | string;
  progress: number;
  size?: number | null;
  uploaded_bytes?: number | null;
  state_message?: string | null;
  error_code?: string | null;
  attempt: number;
  provenance?: TosProvenance | Record<string, unknown> | null;
  cluster_id?: number | null;
  owner_principal_id?: number | null;
  created_at?: string;
  updated_at?: string;
};

export type TosArchiveJobCreate = {
  model_file_id: number;
  connection_id: number;
  tos_model: string;
  tos_version: string;
  paths?: string[] | null;
  backend_hint?: string | null;
};

export type Pagination = {
  page: number;
  perPage: number;
  total: number;
  totalPage: number;
};

export type Paginated<T> = {
  items: T[];
  pagination: Pagination;
};

export const groupReleaseCatalog = (items: TosReleaseListItem[] = []) => {
  const models = new Map<string, TosReleaseListItem[]>();
  items.forEach((item) => {
    const list = models.get(item.tos_model) || [];
    list.push(item);
    models.set(item.tos_model, list);
  });
  return models;
};

export const versionsForModel = (
  items: TosReleaseListItem[] = [],
  tosModel?: string
) => {
  if (!tosModel) {
    return [];
  }
  return items.filter((item) => item.tos_model === tosModel);
};

export const isRedactedAccessKey = (value?: string | null) =>
  !value || value.includes('*');

export const connectionFormInitialValues = (
  record?: Partial<TosConnectionPublic> | null
) => ({
  name: record?.name,
  endpoint: record?.endpoint,
  region: record?.region,
  bucket: record?.bucket,
  prefix: record?.prefix ?? '',
  credential_mode: record?.credential_mode || 'inline',
  credential_ref: record?.credential_ref,
  description: record?.description
});

export const buildConnectionWritePayload = (
  values: Record<string, any>,
  options?: { isCreate?: boolean }
): TosConnectionCreate => {
  const mode = values.credential_mode || 'inline';
  const payload: TosConnectionCreate = {
    name: values.name,
    endpoint: values.endpoint,
    region: values.region,
    bucket: values.bucket,
    prefix: values.prefix ?? '',
    credential_mode: mode,
    description: values.description || null
  };
  if (mode === 'env') {
    payload.credential_ref = 'env';
    return payload;
  }
  if (values.access_key && !isRedactedAccessKey(values.access_key)) {
    payload.access_key = values.access_key;
  }
  if (values.secret_key) {
    payload.secret_key = values.secret_key;
  }
  if (values.security_token) {
    payload.security_token = values.security_token;
  }
  if (options?.isCreate && (!payload.access_key || !payload.secret_key)) {
    throw new Error('inline TOS connections require access_key and secret_key');
  }
  return payload;
};

export const buildAutoArchivePayload = (
  values: Record<string, any>
): AutoArchiveSpec | undefined => {
  if (!values.auto_archive_enabled) {
    return undefined;
  }
  return {
    enabled: true,
    connection_id: values.auto_archive_connection_id,
    tos_model: values.auto_archive_tos_model,
    tos_version: values.auto_archive_tos_version,
    paths: null
  };
};

export const buildTosSourcePayload = (values: Record<string, any>) => {
  const payload: Record<string, unknown> = {
    source: TOS_SOURCE,
    tos_model: values.tos_model,
    tos_version: values.tos_version
  };
  if (values.tos_connection_id) {
    payload.tos_connection_id = values.tos_connection_id;
  } else {
    payload.tos_endpoint = values.tos_endpoint;
    payload.tos_region = values.tos_region;
    payload.tos_bucket = values.tos_bucket;
    if (values.tos_release_path) {
      payload.tos_release_path = values.tos_release_path;
    }
  }
  const gguf = isTosGguf(values);
  if (gguf) {
    payload.provenance = {
      ...(values.provenance || {}),
      gguf: true
    };
  }
  return payload;
};

export const readTosErrorCode = (error: any): string | undefined =>
  error?.response?.data?.details?.error_code ||
  error?.data?.details?.error_code;

export const TosArchiveInFlight = [
  TosArchiveStateMap.queued,
  TosArchiveStateMap.uploading,
  TosArchiveStateMap.verifying
] as const;

export const canCreateTosArchive = (record: {
  state?: string;
  is_lora?: boolean;
  archive_state?: string | null;
}) =>
  record.state === 'ready' &&
  !record.is_lora &&
  !TosArchiveInFlight.includes(record.archive_state as any) &&
  record.archive_state !== TosArchiveStateMap.error;

export const canRetryTosArchive = (record: { archive_state?: string | null }) =>
  record.archive_state === TosArchiveStateMap.error;

export const pickRetryableArchiveJob = (
  jobs: TosArchiveJobPublic[] = []
): TosArchiveJobPublic | undefined => {
  const retryable = jobs.filter(
    (job) => job.state === TosArchiveStateMap.error
  );
  return retryable.sort((a, b) => (b.id || 0) - (a.id || 0))[0];
};

export const TOS_PAGE_SIZE = 100;

export const collectPaginatedItems = async <T>(
  fetchPage: (page: number, perPage: number) => Promise<Paginated<T>>,
  perPage = TOS_PAGE_SIZE
): Promise<T[]> => {
  const items: T[] = [];
  let page = 1;
  while (page <= 1000) {
    const res = await fetchPage(page, perPage);
    const batch = res?.items || [];
    items.push(...batch);
    const totalPage = res?.pagination?.totalPage;
    const total = res?.pagination?.total;
    if (typeof totalPage === 'number' && page >= totalPage) {
      break;
    }
    if (typeof total === 'number' && items.length >= total) {
      break;
    }
    if (batch.length < perPage) {
      break;
    }
    page += 1;
  }
  return items;
};

export const normalizePosixPath = (value: string) =>
  value.replace(/\\/g, '/').replace(/\/+$/, '');

export const isSafeRelativeArchivePath = (value?: string | null) => {
  if (!value) {
    return false;
  }
  const posix = value.replace(/\\/g, '/');
  if (
    !posix ||
    posix.startsWith('/') ||
    posix.includes('://') ||
    /^[A-Za-z]:/.test(posix)
  ) {
    return false;
  }
  const path = posix.replace(/\/+$/, '');
  const parts = path.split('/');
  return parts.every((part) => part && part !== '.' && part !== '..');
};

export const looksLikeResolvedFile = (value?: string | null) => {
  if (!value || value.endsWith('/') || value.endsWith('\\')) {
    return false;
  }
  const base = normalizePosixPath(value).split('/').pop() || '';
  return base.includes('.');
};

const commonDirectory = (files: string[]) => {
  const dirParts = files.map((file) => {
    const parts = normalizePosixPath(file).split('/');
    return parts.slice(0, -1);
  });
  if (!dirParts.length) {
    return '';
  }
  let index = 0;
  while (
    dirParts[0][index] !== undefined &&
    dirParts.every((parts) => parts[index] === dirParts[0][index])
  ) {
    index += 1;
  }
  const rootParts = dirParts[0].slice(0, index);
  if (!rootParts.length) {
    return '';
  }
  if (rootParts[0] === '') {
    return `/${rootParts.slice(1).join('/')}`;
  }
  return rootParts.join('/');
};

export const relativePathUnderRoot = (absolute: string, root: string) => {
  const file = normalizePosixPath(absolute);
  const base = normalizePosixPath(root);
  if (base && file.startsWith(`${base}/`)) {
    return file.slice(base.length + 1);
  }
  return file.split('/').pop() || file;
};

export const archiveFileOptionsFromResolved = (
  resolvedPaths: string[] = []
) => {
  const files = resolvedPaths.filter((path) => looksLikeResolvedFile(path));
  if (!files.length) {
    return [];
  }
  const root = commonDirectory(files);
  const seen = new Set<string>();
  return files.flatMap((abs) => {
    const rel = relativePathUnderRoot(abs, root);
    if (!isSafeRelativeArchivePath(rel) || seen.has(rel)) {
      return [];
    }
    seen.add(rel);
    return [{ label: rel, value: rel }];
  });
};

export const relativeArchivePaths = (
  resolvedPaths: string[] = [],
  selected?: string[] | null
): string[] | null => {
  if (!selected?.length) {
    return null;
  }
  const allowed = new Set(
    archiveFileOptionsFromResolved(resolvedPaths).map((item) => item.value)
  );
  const safe = selected.filter(
    (item) => isSafeRelativeArchivePath(item) && allowed.has(item)
  );
  return safe.length ? safe : null;
};

export type TosVerifyRequest = {
  connection_id: number;
  tos_model: string;
  tos_version: string;
};

export const isCurrentTosVerifyTarget = (
  current: TosVerifyRequest | null | undefined,
  expected: TosVerifyRequest
) =>
  Boolean(current) &&
  current!.connection_id === expected.connection_id &&
  current!.tos_model === expected.tos_model &&
  current!.tos_version === expected.tos_version;

export const ggufFromReleaseDetail = (detail?: TosReleasePublic | null) => {
  if (!detail) {
    return false;
  }
  if (detail.gguf === true || detail.provenance?.gguf === true) {
    return true;
  }
  const files = detail.files || [];
  if (files.some((file) => looksGgufPath(file.path))) {
    return true;
  }
  return looksGgufPath(detail.tos_model) || looksGgufPath(detail.tos_version);
};

export const catalogHitIsNotVerified = (_listed?: TosReleaseListItem | null) =>
  false;

export const confirmTosReleaseDetail = async (
  fetchDetail: (request: TosVerifyRequest) => Promise<TosReleasePublic>,
  request: TosVerifyRequest,
  current: () => TosVerifyRequest | null | undefined
): Promise<{
  stale: boolean;
  verified: boolean;
  gguf: boolean;
  detail?: TosReleasePublic;
}> => {
  const detail = await fetchDetail(request);
  if (!isCurrentTosVerifyTarget(current(), request)) {
    return { stale: true, verified: false, gguf: false };
  }
  return {
    stale: false,
    verified: true,
    gguf: ggufFromReleaseDetail(detail),
    detail
  };
};

const ORIGIN_SOURCE_LABEL: Record<string, string> = {
  huggingface: 'Hugging Face',
  model_scope: 'ModelScope',
  local_path: 'Local Path'
};

export const formatOriginSource = (record: {
  source?: string;
  provenance?: TosProvenance | null;
  huggingface_repo_id?: string;
  model_scope_model_id?: string;
  local_path?: string;
}) => {
  const origin = record.provenance;
  if (origin?.origin_huggingface_repo_id) {
    return [
      'Hugging Face',
      origin.origin_huggingface_repo_id,
      origin.origin_huggingface_filename,
      origin.upstream_revision
    ]
      .filter(Boolean)
      .join('/');
  }
  if (origin?.origin_model_scope_model_id) {
    return [
      'ModelScope',
      origin.origin_model_scope_model_id,
      origin.origin_model_scope_file_path,
      origin.upstream_revision
    ]
      .filter(Boolean)
      .join('/');
  }
  if (origin?.origin_local_path) {
    return origin.origin_local_path;
  }
  if (
    origin?.origin_source &&
    origin.origin_source !== TOS_SOURCE &&
    origin.origin_source !== 'tos'
  ) {
    return ORIGIN_SOURCE_LABEL[origin.origin_source] || origin.origin_source;
  }
  if (record.source === TOS_SOURCE) {
    return '';
  }
  if (record.huggingface_repo_id) {
    return `Hugging Face/${record.huggingface_repo_id}`;
  }
  if (record.model_scope_model_id) {
    return `ModelScope/${record.model_scope_model_id}`;
  }
  if (record.local_path) {
    return record.local_path;
  }
  return '';
};

export const matchArchiveJob = (
  jobs: TosArchiveJobPublic[] = [],
  values: {
    connection_id?: number;
    tos_model?: string;
    tos_version?: string;
  }
) =>
  jobs.find(
    (job) =>
      job.connection_id === values.connection_id &&
      job.tos_model === values.tos_model &&
      job.tos_version === values.tos_version
  );

export const latestArchiveJob = (jobs: TosArchiveJobPublic[] = []) =>
  [...jobs].sort((a, b) => (b.id || 0) - (a.id || 0))[0];

export const formatArtifactLocation = (record: {
  provenance?: TosProvenance | null;
  tos_model?: string;
  tos_version?: string;
  tos_bucket?: string;
  tos_release_path?: string;
}) => record.provenance?.artifact_uri || formatTosSource(record);

export const stripTosUiFields = <T extends Record<string, any>>(data: T): T => {
  const next = { ...data };
  TOS_UI_ONLY_FIELDS.forEach((name) => {
    delete next[name];
  });
  if (!next.tos_release_path) {
    delete next.tos_release_path;
  }
  const autoArchive =
    data.auto_archive?.enabled === true
      ? data.auto_archive
      : buildAutoArchivePayload(data);
  if (autoArchive) {
    next.auto_archive = autoArchive;
  } else {
    delete next.auto_archive;
  }
  delete next.trust_remote_code;
  return next;
};

export const buildModelFileDownloadPayload = (values: Record<string, any>) => {
  const workerId = Array.isArray(values.worker_id)
    ? values.worker_id[1]
    : values.worker_id;
  const cleaned = stripTosUiFields({ ...values, worker_id: workerId });
  if (cleaned.source === TOS_SOURCE) {
    return {
      ...cleaned,
      ...buildTosSourcePayload({
        ...cleaned,
        tos_gguf: values.tos_gguf,
        provenance: values.provenance
      }),
      worker_id: workerId,
      local_dir: values.local_dir || undefined
    };
  }
  return cleaned;
};
