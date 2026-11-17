import { PageAction } from '@/config';
import type { PageActionType } from '@/config/types';
import {
  createTosConnection,
  updateTosConnection
} from '@/pages/llmodels/apis/tos';
import {
  buildConnectionWritePayload,
  connectionFormInitialValues,
  EMPTY_PREFIX_REQUIRES_BUCKET_ROOT,
  TosConnectionPublic
} from '@/pages/llmodels/config/tos';
import {
  CheckboxField,
  Input as CInput,
  FormDrawer,
  Select as SealSelect,
  useAppUtils,
  useSubmitLock
} from '@gpustack/core-ui';
import { useIntl } from '@umijs/max';
import { Form } from 'antd';
import React from 'react';

type AddModalProps = {
  title: string;
  action: PageActionType;
  open: boolean;
  currentData?: TosConnectionPublic | null;
  onOk: () => void;
  onCancel: () => void;
};

const credentialModeOptions = [
  {
    label: 'models.form.tos.credentialMode.inline',
    value: 'inline',
    locale: true
  },
  {
    label: 'models.form.tos.credentialMode.env',
    value: 'env',
    locale: true
  }
];

const AddTosConnectionModal: React.FC<AddModalProps> = ({
  title,
  action,
  open,
  currentData,
  onOk,
  onCancel
}) => {
  const [form] = Form.useForm();
  const intl = useIntl();
  const { getRuleMessage, showSuccess } = useAppUtils();
  const { loading, guard, run, release } = useSubmitLock();
  const isCreate = action === PageAction.CREATE;
  const credentialMode = Form.useWatch('credential_mode', form) || 'inline';
  const prefix = Form.useWatch('prefix', form);
  const allowBucketRoot = Form.useWatch('allow_bucket_root', form);
  const prefixEmpty = !String(prefix ?? '').trim();

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  const handleFinish = async (values: Record<string, any>) => {
    try {
      await run(async () => {
        const payload = buildConnectionWritePayload(values, { isCreate });
        if (isCreate) {
          await createTosConnection(payload);
        } else if (currentData?.id) {
          await updateTosConnection(currentData.id, payload);
        }
      });
      showSuccess();
      handleCancel();
      onOk();
    } catch (error: any) {
      if (error?.message === EMPTY_PREFIX_REQUIRES_BUCKET_ROOT) {
        form.setFields([
          {
            name: 'prefix',
            errors: [
              intl.formatMessage({
                id: 'models.form.tos.prefix.bucketRootRequired'
              })
            ]
          }
        ]);
      }
      release();
    }
  };

  return (
    <FormDrawer
      title={title}
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
          credential_mode: 'inline',
          ...connectionFormInitialValues(currentData)
        }}
      >
        <Form.Item
          name="name"
          rules={[
            {
              required: true,
              message: getRuleMessage('input', 'common.table.name')
            }
          ]}
        >
          <CInput.Input
            required
            label={intl.formatMessage({ id: 'common.table.name' })}
          ></CInput.Input>
        </Form.Item>
        <Form.Item
          name="endpoint"
          rules={[
            {
              required: true,
              message: getRuleMessage('input', 'models.form.tos.endpoint')
            }
          ]}
        >
          <CInput.Input
            required
            label={intl.formatMessage({ id: 'models.form.tos.endpoint' })}
            placeholder="https://tos-cn-shanghai.volces.com"
          ></CInput.Input>
        </Form.Item>
        <Form.Item
          name="region"
          rules={[
            {
              required: true,
              message: getRuleMessage('input', 'models.form.tos.region')
            }
          ]}
        >
          <CInput.Input
            required
            label={intl.formatMessage({ id: 'models.form.tos.region' })}
          ></CInput.Input>
        </Form.Item>
        <Form.Item
          name="bucket"
          rules={[
            {
              required: true,
              message: getRuleMessage('input', 'models.form.tos.bucket')
            }
          ]}
        >
          <CInput.Input
            required
            label={intl.formatMessage({ id: 'models.form.tos.bucket' })}
          ></CInput.Input>
        </Form.Item>
        <Form.Item
          name="prefix"
          extra={
            prefixEmpty
              ? intl.formatMessage({ id: 'models.form.tos.prefix.empty' })
              : intl.formatMessage({ id: 'models.form.tos.prefix.tips' })
          }
          rules={[
            {
              validator: async () => {
                if (prefixEmpty && !allowBucketRoot) {
                  throw new Error(
                    intl.formatMessage({
                      id: 'models.form.tos.prefix.bucketRootRequired'
                    })
                  );
                }
              }
            }
          ]}
        >
          <CInput.Input
            label={intl.formatMessage({ id: 'models.form.tos.prefix' })}
          ></CInput.Input>
        </Form.Item>
        {prefixEmpty ? (
          <Form.Item name="allow_bucket_root" valuePropName="checked">
            <CheckboxField
              label={intl.formatMessage({
                id: 'models.form.tos.allowBucketRoot'
              })}
              description={intl.formatMessage({
                id: 'models.form.tos.allowBucketRoot.tips'
              })}
            ></CheckboxField>
          </Form.Item>
        ) : null}
        <Form.Item
          name="credential_mode"
          extra={
            credentialMode === 'env'
              ? intl.formatMessage({
                  id: 'models.form.tos.env.endpoint.tips'
                })
              : undefined
          }
          rules={[
            {
              required: true,
              message: getRuleMessage(
                'select',
                'models.form.tos.credentialMode'
              )
            }
          ]}
        >
          <SealSelect
            required
            label={intl.formatMessage({
              id: 'models.form.tos.credentialMode'
            })}
            options={credentialModeOptions}
            onChange={(mode: string) => {
              if (mode === 'env') {
                form.setFieldsValue({
                  access_key: undefined,
                  secret_key: undefined,
                  security_token: undefined,
                  credential_ref: 'env'
                });
              }
            }}
          ></SealSelect>
        </Form.Item>
        {credentialMode === 'inline' ? (
          <>
            <Form.Item
              name="access_key"
              rules={[
                {
                  required: isCreate,
                  message: getRuleMessage('input', 'models.form.tos.accessKey')
                }
              ]}
            >
              <CInput.Input
                required={isCreate}
                autoComplete="off"
                label={intl.formatMessage({ id: 'models.form.tos.accessKey' })}
                placeholder={
                  isCreate
                    ? undefined
                    : intl.formatMessage({
                        id: 'models.form.tos.secret.placeholder'
                      })
                }
                description={intl.formatMessage({
                  id: 'models.form.tos.secret.tips'
                })}
              ></CInput.Input>
            </Form.Item>
            <Form.Item
              name="secret_key"
              rules={[
                {
                  required: isCreate,
                  message: getRuleMessage('input', 'models.form.tos.secretKey')
                }
              ]}
            >
              <CInput.Password
                required={isCreate}
                autoComplete="new-password"
                label={intl.formatMessage({ id: 'models.form.tos.secretKey' })}
                placeholder={
                  isCreate
                    ? undefined
                    : intl.formatMessage({
                        id: 'models.form.tos.secret.placeholder'
                      })
                }
              ></CInput.Password>
            </Form.Item>
            <Form.Item name="security_token">
              <CInput.Password
                autoComplete="new-password"
                label={intl.formatMessage({
                  id: 'models.form.tos.securityToken'
                })}
              ></CInput.Password>
            </Form.Item>
          </>
        ) : (
          <Form.Item name="credential_ref" initialValue="env">
            <CInput.Input
              disabled
              label={intl.formatMessage({
                id: 'models.form.tos.credentialRef'
              })}
            ></CInput.Input>
          </Form.Item>
        )}
        <Form.Item name="description">
          <CInput.TextArea
            label={intl.formatMessage({ id: 'common.table.description' })}
          ></CInput.TextArea>
        </Form.Item>
      </Form>
    </FormDrawer>
  );
};

export default AddTosConnectionModal;
