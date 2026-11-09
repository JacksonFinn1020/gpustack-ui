import type { FormInstance } from 'antd';
import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { after, mock, test } from 'node:test';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';

const InputField = ({ value, onChange, label }: any) =>
  createElement(
    'label',
    null,
    createElement('span', null, label),
    createElement('input', {
      'aria-label': label,
      value: value ?? '',
      onChange
    })
  );

mock.module('@gpustack/core-ui', {
  namedExports: {
    Input: { Input: InputField },
    AutoComplete: InputField,
    Select: InputField,
    CheckboxField: InputField,
    useAppUtils: () => ({ getRuleMessage: (_: string, id: string) => id })
  }
});
mock.module('@umijs/max', {
  namedExports: {
    useIntl: () => ({ formatMessage: ({ id }: any) => id })
  }
});
mock.module(new URL('../../apis/index.ts', import.meta.url).href, {
  namedExports: {
    queryTosSources: async () => ({ items: [] }),
    ingestTosRelease: async () => ({})
  }
});
mock.module(new URL('../../apis/tos.ts', import.meta.url).href, {
  namedExports: {
    queryTosConnections: async () => ({ items: [], pagination: {} }),
    listAllTosConnections: async () => [],
    queryTosReleaseCatalog: async () => [],
    getTosReleaseDetail: async () => ({})
  }
});
mock.module(new URL('../../config/index.ts', import.meta.url).href, {
  namedExports: {
    DeployFormKeyMap: { CATALOG: 'catalog' },
    modelSourceMap: { tos_value: 'tos' }
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
dom.window.matchMedia = (media) => ({
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
const { FormContext } = await import('../../config/form-context.ts');
const { default: TosSource } = await import('../tos-source.tsx');

test('TOS source fields render, hide for other sources, and ingest path is optional', async () => {
  const container = dom.window.document.getElementById('root')!;
  const root = createRoot(container);
  let form!: FormInstance;
  const Harness = () => {
    [form] = Form.useForm();
    return createElement(
      Form,
      { form, initialValues: { source: 'tos' } },
      createElement(
        FormContext.Provider,
        {
          value: {
            formKey: 'deployment',
            onBackendChange: () => undefined,
            flatBackendOptions: []
          } as any
        },
        createElement(TosSource),
        createElement(
          Form.Item,
          { name: 'source', hidden: true },
          createElement('input')
        )
      )
    );
  };

  await act(async () => root.render(createElement(Harness)));

  const labels = () =>
    [...container.querySelectorAll('label span')].map(
      (node) => node.textContent
    );

  assert.ok(labels().includes('models.form.tos.endpoint'));
  assert.ok(labels().includes('models.form.tos.releasePath'));
  assert.ok(labels().includes('models.form.tos.ingestPath'));
  assert.ok(
    [...container.querySelectorAll('button')].some(
      (button) => button.textContent === 'models.form.tos.ingest'
    )
  );

  await act(async () => {
    form.setFieldsValue({
      tos_endpoint: 'https://tos-cn-shanghai.volces.com',
      tos_region: 'cn-shanghai',
      tos_bucket: 'bucket',
      tos_model: 'qwen3',
      tos_version: 'v1'
    });
  });
  const values = await form.validateFields([
    'tos_endpoint',
    'tos_region',
    'tos_bucket',
    'tos_model',
    'tos_version',
    'tos_release_path',
    'tos_ingest_local_path'
  ]);
  assert.equal(values.tos_model, 'qwen3');
  assert.equal(values.tos_ingest_local_path, undefined);

  const runtimeErrors: unknown[] = [];
  const onError = (event: ErrorEvent) => {
    runtimeErrors.push(event.error || event.message);
  };
  dom.window.addEventListener('error', onError);

  await act(async () => {
    form.setFieldValue('source', 'huggingface');
  });
  assert.equal(labels().includes('models.form.tos.endpoint'), false);
  assert.equal(labels().includes('models.form.tos.connection'), false);

  await act(async () => {
    form.setFieldValue('source', 'model_scope');
  });
  assert.equal(labels().includes('models.form.tos.endpoint'), false);

  await act(async () => {
    form.setFieldValue('source', 'local_path');
  });
  assert.equal(labels().includes('models.form.tos.endpoint'), false);

  await act(async () => {
    form.setFieldValue('source', 'tos');
  });
  assert.ok(labels().includes('models.form.tos.endpoint'));
  assert.ok(labels().includes('models.form.tos.connection'));
  assert.equal(runtimeErrors.length, 0);

  dom.window.removeEventListener('error', onError);
  await act(async () => root.unmount());
});
