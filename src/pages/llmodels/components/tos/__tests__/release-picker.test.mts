import type { FormInstance } from 'antd';
import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { after, mock, test } from 'node:test';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';

const InputField = ({ value, onChange, onBlur, onSelect, label }: any) =>
  createElement(
    'label',
    null,
    createElement('span', null, label),
    createElement('input', {
      'aria-label': label,
      value: value ?? '',
      onChange: (event: any) => onChange?.(event.target.value),
      onBlur: (event: any) =>
        onBlur?.({
          target: { value: value ?? event?.target?.value }
        })
    }),
    createElement('button', {
      type: 'button',
      'data-select': label,
      onClick: () => onSelect?.(value)
    })
  );

mock.module('@gpustack/core-ui', {
  namedExports: {
    AutoComplete: InputField,
    Select: InputField,
    useAppUtils: () => ({ getRuleMessage: (_: string, id: string) => id })
  }
});
mock.module('@umijs/max', {
  namedExports: {
    useIntl: () => ({ formatMessage: ({ id }: any) => id })
  }
});

let catalogCalls = 0;
let detailCalls: Array<Record<string, unknown>> = [];
let detailImpl: (params: any) => Promise<any> = async () => ({
  connection_id: 1,
  tos_model: 'qwen3',
  tos_version: 'v1',
  files: [{ path: 'model.safetensors', size: 1, sha256: 'a' }],
  gguf: false
});

mock.module(new URL('../../../apis/tos.ts', import.meta.url).href, {
  namedExports: {
    listAllTosConnections: async () => [
      { id: 1, name: 'prod', bucket: 'weights', prefix: '' }
    ],
    queryTosReleaseCatalog: async () => {
      catalogCalls += 1;
      return [
        {
          connection_id: 1,
          tos_model: 'qwen3',
          tos_version: 'v1',
          artifact_uri: 'tos://weights/qwen3/v1'
        }
      ];
    },
    getTosReleaseDetail: async (params: any) => {
      detailCalls.push({ ...params });
      return detailImpl(params);
    }
  }
});

const dom = new JSDOM('<div id="root"></div>');
Object.defineProperties(globalThis, {
  window: { configurable: true, value: dom.window },
  document: { configurable: true, value: dom.window.document },
  navigator: { configurable: true, value: dom.window.navigator },
  HTMLElement: { configurable: true, value: dom.window.HTMLElement },
  Element: { configurable: true, value: dom.window.Element },
  SVGElement: { configurable: true, value: dom.window.SVGElement },
  Node: { configurable: true, value: dom.window.Node },
  MutationObserver: { configurable: true, value: dom.window.MutationObserver },
  ShadowRoot: { configurable: true, value: dom.window.ShadowRoot },
  getComputedStyle: { configurable: true, value: dom.window.getComputedStyle },
  IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true }
});
dom.window.matchMedia = (media: string) => ({
  matches: false,
  media,
  onchange: null,
  addListener() {},
  removeListener() {},
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent: () => false
});
after(() => dom.window.close());

const { Form } = await import('antd');
const { default: ReleasePicker } = await import('../release-picker.tsx');

const mount = async () => {
  const container = dom.window.document.getElementById('root')!;
  const root = createRoot(container);
  let form!: FormInstance;
  const Harness = () => {
    [form] = Form.useForm();
    return createElement(
      Form,
      { form, initialValues: {} },
      createElement(ReleasePicker)
    );
  };
  await act(async () => root.render(createElement(Harness)));
  const selectVersion = () => {
    const button = [...dom.window.document.querySelectorAll('button')].find(
      (item) => item.getAttribute('data-select') === 'models.form.tos.version'
    ) as HTMLButtonElement | undefined;
    button?.click();
  };
  return { form, root, selectVersion };
};

test('catalog hit still calls detail; missing list gguf is not treated as verified GGUF', async () => {
  catalogCalls = 0;
  detailCalls = [];
  const { form, root, selectVersion } = await mount();
  await act(async () => {
    form.setFieldsValue({
      tos_connection_id: 1,
      tos_model: 'qwen3',
      tos_version: 'v1'
    });
  });
  await act(async () => {
    selectVersion();
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  assert.equal(form.getFieldValue('tos_release_verified'), true);
  assert.equal(form.getFieldValue('tos_gguf'), false);
  assert.equal(detailCalls.length, 1);
  assert.deepEqual(detailCalls[0], {
    connection_id: 1,
    tos_model: 'qwen3',
    tos_version: 'v1'
  });
  await act(async () => root.unmount());
});

test('detail GGUF files mark gguf; version change and HTTP failure stay unverified', async () => {
  detailCalls = [];
  detailImpl = async (params) => {
    if (params.tos_version === 'gguf') {
      return {
        connection_id: params.connection_id,
        tos_model: params.tos_model,
        tos_version: params.tos_version,
        files: [{ path: 'weights/model.gguf', size: 1, sha256: 'a' }],
        gguf: false
      };
    }
    throw new Error('not found');
  };
  const { form, root, selectVersion } = await mount();
  await act(async () => {
    form.setFieldsValue({
      tos_connection_id: 1,
      tos_model: 'qwen3',
      tos_version: 'gguf'
    });
  });
  await act(async () => {
    selectVersion();
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  assert.equal(form.getFieldValue('tos_release_verified'), true);
  assert.equal(form.getFieldValue('tos_gguf'), true);

  let resolveLate: (value: any) => void = () => undefined;
  detailImpl = () =>
    new Promise((resolve) => {
      resolveLate = resolve;
    });
  await act(async () => {
    form.setFieldValue('tos_version', 'v-stale');
  });
  await act(async () => {
    selectVersion();
  });
  await act(async () => {
    form.setFieldValue('tos_version', 'v-new');
  });
  resolveLate({
    connection_id: 1,
    tos_model: 'qwen3',
    tos_version: 'v-stale',
    files: [],
    gguf: true
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  assert.notEqual(form.getFieldValue('tos_version'), 'v-stale');
  assert.equal(form.getFieldValue('tos_release_verified'), undefined);

  detailImpl = async () => {
    throw new Error('http 500');
  };
  await act(async () => {
    form.setFieldValue('tos_version', 'v-fail');
  });
  await act(async () => {
    selectVersion();
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  assert.equal(form.getFieldValue('tos_release_verified'), undefined);
  await act(async () => root.unmount());
});
