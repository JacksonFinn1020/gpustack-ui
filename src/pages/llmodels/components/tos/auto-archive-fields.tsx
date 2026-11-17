import {
  CheckboxField,
  Input as CInput,
  Select as SealSelect,
  useAppUtils
} from '@gpustack/core-ui';
import { useIntl } from '@umijs/max';
import { Form } from 'antd';
import React, { useRef, useState } from 'react';
import { listAllTosConnections } from '../../apis/tos';
import { TosConnectionPublic } from '../../config/tos';

const AutoArchiveFields: React.FC = () => {
  const intl = useIntl();
  const { getRuleMessage } = useAppUtils();
  const form = Form.useFormInstance();
  const enabled = Form.useWatch('auto_archive_enabled', form);
  const [connections, setConnections] = useState<TosConnectionPublic[]>([]);
  const loaded = useRef(false);

  const loadConnections = () => {
    if (loaded.current) {
      return;
    }
    loaded.current = true;
    listAllTosConnections()
      .then((items) => setConnections(items))
      .catch(() => {
        loaded.current = false;
      });
  };

  return (
    <>
      <Form.Item
        name="auto_archive_enabled"
        valuePropName="checked"
        initialValue={false}
      >
        <CheckboxField
          label={intl.formatMessage({ id: 'models.form.tos.autoarchive' })}
          description={intl.formatMessage({
            id: 'models.form.tos.autoarchive.tips'
          })}
        ></CheckboxField>
      </Form.Item>
      {enabled ? (
        <>
          <Form.Item
            name="auto_archive_connection_id"
            rules={[
              {
                required: true,
                message: getRuleMessage('select', 'models.form.tos.connection')
              }
            ]}
          >
            <SealSelect
              required
              label={intl.formatMessage({
                id: 'models.form.tos.archive.connection'
              })}
              options={connections.map((item) => ({
                label: `${item.name} (${item.bucket})`,
                value: item.id
              }))}
              onOpenChange={(open: boolean) => {
                if (open) {
                  loadConnections();
                }
              }}
            ></SealSelect>
          </Form.Item>
          <Form.Item
            name="auto_archive_tos_model"
            rules={[
              {
                required: true,
                message: getRuleMessage('input', 'models.form.tos.model')
              }
            ]}
          >
            <CInput.Input
              required
              label={intl.formatMessage({ id: 'models.form.tos.model' })}
            ></CInput.Input>
          </Form.Item>
          <Form.Item
            name="auto_archive_tos_version"
            rules={[
              {
                required: true,
                message: getRuleMessage('input', 'models.form.tos.version')
              }
            ]}
          >
            <CInput.Input
              required
              label={intl.formatMessage({ id: 'models.form.tos.version' })}
            ></CInput.Input>
          </Form.Item>
        </>
      ) : null}
    </>
  );
};

export default AutoArchiveFields;
