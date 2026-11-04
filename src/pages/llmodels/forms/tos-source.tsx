import { Input as CInput, useAppUtils } from '@gpustack/core-ui';
import { useIntl } from '@umijs/max';
import { Button, Form, message } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import { ingestTosRelease, queryTosSources } from '../apis';
import { DeployFormKeyMap, modelSourceMap } from '../config';
import { useFormContext } from '../config/form-context';
import {
  mergeTosSourceFields,
  TOS_REQUIRED_FIELDS,
  TosSourceField,
  tosSourceFields
} from '../config/tos';
import { FormData } from '../config/types';

const TosSourceForm: React.FC = () => {
  const intl = useIntl();
  const form = Form.useFormInstance<FormData>();
  const { getRuleMessage } = useAppUtils();
  const { formKey, onValuesChange } = useFormContext();
  const source = Form.useWatch('source', form);
  const [fields, setFields] = useState<TosSourceField[]>(tosSourceFields);
  const [ingesting, setIngesting] = useState(false);
  const sessionRef = useRef(0);

  const visible =
    source === modelSourceMap.tos_value && formKey !== DeployFormKeyMap.CATALOG;

  useEffect(() => {
    if (!visible) {
      sessionRef.current += 1;
      return;
    }
    const session = ++sessionRef.current;
    queryTosSources()
      .then((res) => {
        if (sessionRef.current !== session) {
          return;
        }
        const item = res.items?.find(
          (entry) => entry.source === modelSourceMap.tos_value
        );
        setFields(mergeTosSourceFields(item?.fields));
      })
      .catch(() => {
        // Keep the hardcoded TOS_SOURCE_FIELDS mirror when the endpoint
        // is missing (older servers / this UI ahead of the backend PR).
      });
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
      const result = await ingestTosRelease({
        local_path: values.tos_ingest_local_path || '',
        tos_endpoint: values.tos_endpoint || '',
        tos_region: values.tos_region || '',
        tos_bucket: values.tos_bucket || '',
        tos_model: values.tos_model || '',
        tos_version: values.tos_version || '',
        tos_release_path: values.tos_release_path || null
      });
      form.setFieldsValue({
        tos_endpoint: result.tos_endpoint,
        tos_region: result.tos_region,
        tos_bucket: result.tos_bucket,
        tos_model: result.tos_model,
        tos_version: result.tos_version,
        tos_release_path: result.tos_release_path
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

  return (
    <>
      {fields.map((field) => (
        <Form.Item<FormData>
          name={field.name as keyof FormData}
          key={field.name}
          rules={
            field.required
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
            required={field.required}
            label={intl.formatMessage({ id: field.label })}
            placeholder={field.placeholder}
            onBlur={handleOnBlur}
          ></CInput.Input>
        </Form.Item>
      ))}
      <Form.Item<FormData>
        name="tos_ingest_local_path"
        key="tos_ingest_local_path"
      >
        <CInput.Input
          allowClear
          label={intl.formatMessage({ id: 'models.form.tos.ingestPath' })}
          placeholder="/data/snapshots/qwen3"
          description={intl.formatMessage({
            id: 'models.form.tos.ingestPath.tips'
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
  );
};

export default TosSourceForm;
