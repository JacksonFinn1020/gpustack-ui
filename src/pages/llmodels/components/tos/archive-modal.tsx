import { ModelFile as ListItem } from '@/pages/resources/config/types';
import {
  Input as CInput,
  FormDrawer,
  Select as SealSelect,
  useAppUtils,
  useSubmitLock
} from '@gpustack/core-ui';
import { useIntl } from '@umijs/max';
import { Form } from 'antd';
import React, { useRef, useState } from 'react';
import { createTosArchive, queryTosConnections } from '../../apis/tos';
import { relativeArchivePaths, TosConnectionPublic } from '../../config/tos';

type ArchiveModalProps = {
  open: boolean;
  record?: ListItem | null;
  onCancel: () => void;
  onOk: () => void;
};

const ArchiveModal: React.FC<ArchiveModalProps> = ({
  open,
  record,
  onCancel,
  onOk
}) => {
  const intl = useIntl();
  const { getRuleMessage, showSuccess } = useAppUtils();
  const [form] = Form.useForm();
  const { loading, guard, run, release } = useSubmitLock();
  const [connections, setConnections] = useState<TosConnectionPublic[]>([]);
  const loaded = useRef(false);

  const loadConnections = () => {
    if (loaded.current) {
      return;
    }
    loaded.current = true;
    queryTosConnections({ perPage: 100 })
      .then((page) => setConnections(page.items || []))
      .catch(() => {
        loaded.current = false;
      });
  };

  const handleCancel = () => {
    form.resetFields();
    loaded.current = false;
    onCancel();
  };

  const handleFinish = async (values: Record<string, any>) => {
    if (!record?.id) {
      return;
    }
    try {
      await run(async () => {
        const selected = values.paths?.length ? values.paths : null;
        await createTosArchive({
          model_file_id: record.id,
          connection_id: values.tos_connection_id,
          tos_model: values.tos_model,
          tos_version: values.tos_version,
          paths: relativeArchivePaths(record.resolved_paths || [], selected)
        });
      });
      showSuccess();
      handleCancel();
      onOk();
    } catch {
      release();
    }
  };

  const fileOptions = (record?.resolved_paths || []).map((path) => {
    const name = path.split(/[\\/]/).pop() || path;
    return { label: name, value: name };
  });

  return (
    <FormDrawer
      title={intl.formatMessage({ id: 'models.form.tos.archive.title' })}
      open={open}
      onCancel={handleCancel}
      onSubmit={() => guard(() => form.submit())}
      loading={loading}
    >
      <Form
        form={form}
        onFinish={handleFinish}
        preserve={false}
        initialValues={{
          tos_model: record?.tos_model || record?.huggingface_repo_id,
          tos_version: record?.tos_version
        }}
      >
        <Form.Item
          name="tos_connection_id"
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
              label: `${item.name} (${item.bucket}/${item.prefix || ''})`,
              value: item.id
            }))}
            onOpenChange={(openSelect: boolean) => {
              if (openSelect) {
                loadConnections();
              }
            }}
          ></SealSelect>
        </Form.Item>
        <Form.Item
          name="tos_model"
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
          name="tos_version"
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
            description={intl.formatMessage({
              id: 'models.form.tos.version.immutable'
            })}
          ></CInput.Input>
        </Form.Item>
        <Form.Item
          name="paths"
          extra={
            <>
              {intl.formatMessage({
                id: 'models.form.tos.archive.paths.tips'
              })}{' '}
              {intl.formatMessage({
                id: 'models.form.tos.delete.remoteKeep'
              })}
            </>
          }
        >
          <SealSelect
            mode="multiple"
            allowClear
            label={intl.formatMessage({ id: 'models.form.tos.archive.paths' })}
            options={fileOptions}
          ></SealSelect>
        </Form.Item>
      </Form>
    </FormDrawer>
  );
};

export default ArchiveModal;
