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

export const TOS_UI_ONLY_FIELDS = ['tos_ingest_local_path'] as const;

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

export const hasTosCoordinates = (values: Record<string, any> = {}) =>
  TOS_REQUIRED_FIELDS.every((name) => Boolean(values[name]));

export const mergeTosSourceFields = (remote?: TosSourceField[]) => {
  if (!remote?.length) {
    return tosSourceFields;
  }
  const localByName = new Map(
    tosSourceFields.map((field) => [field.name, field])
  );
  return remote.map((field) => {
    const local = localByName.get(field.name);
    return {
      ...field,
      label: local?.label || field.label,
      placeholder: field.placeholder || local?.placeholder
    };
  });
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

export const stripTosUiFields = <T extends Record<string, any>>(data: T): T => {
  const next = { ...data };
  TOS_UI_ONLY_FIELDS.forEach((name) => {
    delete next[name];
  });
  if (!next.tos_release_path) {
    delete next.tos_release_path;
  }
  return next;
};
