import {
  AutoComplete,
  Select as SealSelect,
  useAppUtils
} from '@gpustack/core-ui';
import { useIntl } from '@umijs/max';
import { Form } from 'antd';
import React, { useRef, useState } from 'react';
import {
  getTosReleaseDetail,
  listAllTosConnections,
  queryTosReleaseCatalog
} from '../../apis/tos';
import {
  clearedTosReleaseFields,
  confirmTosReleaseDetail,
  groupReleaseCatalog,
  isCurrentTosVerifyTarget,
  TosConnectionPublic,
  TosReleaseListItem,
  TosVerifyRequest
} from '../../config/tos';

type ReleasePickerProps = {
  disabled?: boolean;
  onVerified?: (verified: boolean, meta?: { gguf?: boolean }) => void;
};

const ReleasePicker: React.FC<ReleasePickerProps> = ({
  disabled,
  onVerified
}) => {
  const intl = useIntl();
  const { getRuleMessage } = useAppUtils();
  const form = Form.useFormInstance();
  const connectionId = Form.useWatch('tos_connection_id', form);
  const tosModel = Form.useWatch('tos_model', form);
  const [connections, setConnections] = useState<TosConnectionPublic[]>([]);
  const [releases, setReleases] = useState<TosReleaseListItem[]>([]);
  const sessionRef = useRef(0);
  const loadedConnections = useRef(false);

  const loadConnections = () => {
    if (loadedConnections.current) {
      return;
    }
    loadedConnections.current = true;
    listAllTosConnections()
      .then((items) => {
        setConnections(items);
      })
      .catch(() => {
        loadedConnections.current = false;
      });
  };

  const commitVerified = (verified: boolean, gguf?: boolean) => {
    form.setFieldsValue({
      tos_release_verified: verified || undefined,
      tos_gguf: verified ? gguf : undefined,
      provenance: verified
        ? { ...(form.getFieldValue('provenance') || {}), gguf: Boolean(gguf) }
        : form.getFieldValue('provenance')
    });
    onVerified?.(verified, { gguf });
  };

  const applyConnection = (value?: number) => {
    const session = ++sessionRef.current;
    form.setFieldsValue(clearedTosReleaseFields());
    setReleases([]);
    commitVerified(false);
    if (!value) {
      return;
    }
    queryTosReleaseCatalog({ connection_id: value })
      .then((items) => {
        if (sessionRef.current !== session) {
          return;
        }
        setReleases(items || []);
      })
      .catch(() => {
        if (sessionRef.current !== session) {
          return;
        }
        setReleases([]);
      });
  };

  const applyModel = (value?: string) => {
    const session = ++sessionRef.current;
    form.setFieldsValue({
      tos_version: undefined,
      tos_release_verified: undefined,
      tos_gguf: undefined
    });
    commitVerified(false);
    if (value && connectionId) {
      const models = groupReleaseCatalog(releases);
      if (!models.has(value)) {
        queryTosReleaseCatalog({
          connection_id: connectionId,
          tos_model: value
        })
          .then((items) => {
            if (sessionRef.current !== session) {
              return;
            }
            setReleases((prev) => {
              const rest = prev.filter((item) => item.tos_model !== value);
              return [...rest, ...(items || [])];
            });
          })
          .catch(() => undefined);
      }
    }
  };

  const verifyVersion = async (model?: string, version?: string) => {
    const currentConnection = form.getFieldValue('tos_connection_id');
    if (!currentConnection || !model || !version) {
      commitVerified(false);
      return;
    }
    const request: TosVerifyRequest = {
      connection_id: currentConnection,
      tos_model: model,
      tos_version: version
    };
    commitVerified(false);
    const session = sessionRef.current;
    const currentTarget = (): TosVerifyRequest => ({
      connection_id: form.getFieldValue('tos_connection_id'),
      tos_model: form.getFieldValue('tos_model'),
      tos_version: form.getFieldValue('tos_version') || version
    });
    try {
      const result = await confirmTosReleaseDetail(
        getTosReleaseDetail,
        request,
        currentTarget
      );
      if (sessionRef.current !== session || result.stale) {
        return;
      }
      commitVerified(true, result.gguf);
    } catch {
      if (
        sessionRef.current !== session ||
        !isCurrentTosVerifyTarget(currentTarget(), request)
      ) {
        return;
      }
      commitVerified(false);
      form.setFields([
        {
          name: 'tos_version',
          errors: [
            intl.formatMessage({ id: 'models.form.tos.version.verifyFailed' })
          ]
        }
      ]);
    }
  };

  const modelOptions = [...groupReleaseCatalog(releases).keys()].map(
    (name) => ({
      label: name,
      value: name
    })
  );
  const versionOptions = releases
    .filter((item) => item.tos_model === tosModel)
    .map((item) => ({
      label: item.tos_version,
      value: item.tos_version
    }));

  return (
    <>
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
          disabled={disabled}
          label={intl.formatMessage({ id: 'models.form.tos.connection' })}
          options={connections.map((item) => ({
            label: `${item.name} (${item.bucket})`,
            value: item.id
          }))}
          onOpenChange={(open: boolean) => {
            if (open) {
              loadConnections();
            }
          }}
          onChange={(value: number) => applyConnection(value)}
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
        <AutoComplete
          required
          disabled={disabled || !connectionId}
          label={intl.formatMessage({ id: 'models.form.tos.model' })}
          options={modelOptions}
          onChange={(value: string) => applyModel(value)}
        ></AutoComplete>
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
        <AutoComplete
          required
          disabled={disabled || !tosModel}
          label={intl.formatMessage({ id: 'models.form.tos.version' })}
          options={versionOptions}
          onBlur={(e: any) =>
            verifyVersion(
              form.getFieldValue('tos_model'),
              e?.target?.value || form.getFieldValue('tos_version')
            )
          }
          onChange={() => {
            sessionRef.current += 1;
            commitVerified(false);
          }}
          onSelect={(value: string) =>
            verifyVersion(form.getFieldValue('tos_model'), value)
          }
        ></AutoComplete>
      </Form.Item>
      <Form.Item name="tos_release_verified" hidden>
        <input type="hidden" />
      </Form.Item>
    </>
  );
};

export default ReleasePicker;
