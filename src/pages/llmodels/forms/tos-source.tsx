import { Input as CInput, useAppUtils } from '@gpustack/core-ui';
import { useIntl } from '@umijs/max';
import { Button, Form, message } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import { ingestTosRelease, queryTosSources } from '../apis';
import ReleasePicker from '../components/tos/release-picker';
import { DeployFormKeyMap, modelSourceMap } from '../config';
import { useFormContext } from '../config/form-context';
import {
  buildTosIngestRequest,
  mergeTosSourceFields,
  TOS_REQUIRED_FIELDS,
  TosSourceField,
  tosSourceFields
} from '../config/tos';
import { FormData } from '../config/types';
import {
  backendOptionsMap,
  BuiltInBackendOptions
} from '../constants/backend-parameters';

const TosSourceForm: React.FC = () => {
  const intl = useIntl();
  const form = Form.useFormInstance<FormData>();
  const { getRuleMessage } = useAppUtils();
  const { formKey, onValuesChange, onBackendChange, flatBackendOptions } =
    useFormContext();
  const source = Form.useWatch('source', form);
  const connectionId = Form.useWatch('tos_connection_id', form);
  const [fields, setFields] = useState<TosSourceField[]>(tosSourceFields);
  const [allowIngest, setAllowIngest] = useState(true);
  const [ingesting, setIngesting] = useState(false);
  const sourcesSession = useRef(0);

  const visible =
    source === modelSourceMap.tos_value && formKey !== DeployFormKeyMap.CATALOG;

  useEffect(() => {
    if (!visible) {
      sourcesSession.current += 1;
      return;
    }
    const session = ++sourcesSession.current;
    queryTosSources()
      .then((res) => {
        if (sourcesSession.current !== session) {
          return;
        }
        const item = res?.items?.find(
          (entry) => entry.source === modelSourceMap.tos_value
        );
        setFields(mergeTosSourceFields(item?.fields));
        if (item && item.ingest === false) {
          setAllowIngest(false);
        } else {
          setAllowIngest(true);
        }
      })
      .catch(() => undefined);
  }, [visible]);

  if (!visible) {
    return null;
  }

  const handleOnBlur = () => {
    onValuesChange?.({}, form.getFieldsValue());
  };

  const handleIngest = async () => {
    try {
      await form.validateFields([...TOS_REQUIRED_FIELDS]);
    } catch {
      return;
    }
    const values = form.getFieldsValue();
    if (!values.tos_ingest_local_path) {
      form.setFields([
        {
          name: 'tos_ingest_local_path',
          errors: [getRuleMessage('input', 'models.form.tos.ingestPath')]
        }
      ]);
      return;
    }
    setIngesting(true);
    try {
      const result = await ingestTosRelease(buildTosIngestRequest(values));
      form.setFieldsValue({
        tos_endpoint: result.tos_endpoint,
        tos_region: result.tos_region,
        tos_bucket: result.tos_bucket,
        tos_model: result.tos_model,
        tos_version: result.tos_version,
        tos_release_path: result.tos_release_path,
        tos_release_verified: true
      });
      message.success(
        intl.formatMessage({ id: 'models.form.tos.ingest.success' })
      );
      onValuesChange?.({}, form.getFieldsValue());
    } catch {
      // The request interceptor already surfaces the API error.
    } finally {
      setIngesting(false);
    }
  };

  const coordinateRequired = !connectionId;

  return (
    <>
      <ReleasePicker
        onVerified={(verified, meta) => {
          if (verified && meta?.gguf) {
            const backend = form.getFieldValue('backend');
            if (BuiltInBackendOptions.includes(backend)) {
              form.setFieldValue('backend', backendOptionsMap.llamaBox);
              const option = flatBackendOptions?.find(
                (item) => item.value === backendOptionsMap.llamaBox
              );
              onBackendChange?.(backendOptionsMap.llamaBox, option);
            }
          }
          onValuesChange?.({}, form.getFieldsValue());
        }}
      ></ReleasePicker>
      {fields.map((field) => (
        <Form.Item<FormData>
          name={field.name as keyof FormData}
          key={field.name}
          rules={
            field.required && coordinateRequired
              ? [
                  {
                    required: true,
                    message: getRuleMessage('input', field.label)
                  }
                ]
              : undefined
          }
        >
          <CInput.Input
            allowClear
            required={Boolean(field.required && coordinateRequired)}
            label={intl.formatMessage({ id: field.label })}
            placeholder={field.placeholder}
            onBlur={handleOnBlur}
          ></CInput.Input>
        </Form.Item>
      ))}
      {allowIngest && (
        <>
          <Form.Item<FormData>
            name="tos_ingest_local_path"
            key="tos_ingest_local_path"
          >
            <CInput.Input
              allowClear
              label={intl.formatMessage({ id: 'models.form.tos.ingestPath' })}
              placeholder="/data/snapshots/qwen3"
              description={intl.formatMessage({
                id: 'models.form.tos.ingest.serverOnly'
              })}
            ></CInput.Input>
          </Form.Item>
          <Form.Item>
            <Button
              type="default"
              htmlType="button"
              loading={ingesting}
              onClick={handleIngest}
            >
              {intl.formatMessage({ id: 'models.form.tos.ingest' })}
            </Button>
          </Form.Item>
        </>
      )}
      <Form.Item
        name="tos_release_verified"
        rules={[
          {
            validator: async (_: unknown, value: boolean) => {
              if (!value) {
                throw new Error(
                  intl.formatMessage({
                    id: 'models.form.tos.release.required'
                  })
                );
              }
            }
          }
        ]}
        hidden
      >
        <input type="hidden" />
      </Form.Item>
    </>
  );
};

export default TosSourceForm;
