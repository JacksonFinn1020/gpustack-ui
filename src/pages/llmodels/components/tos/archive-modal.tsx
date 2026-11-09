import { useActingOrganizationId } from '@/hooks/use-acting-organization-id';
import { queryModelFileEntries } from '@/pages/resources/apis';
import { ModelFile as ListItem } from '@/pages/resources/config/types';
import {
  Input as CInput,
  FormDrawer,
  Select as SealSelect,
  useAppUtils,
  useSubmitLock
} from '@gpustack/core-ui';
import { useIntl } from '@umijs/max';
import { Alert, Form } from 'antd';
import React, { useEffect, useState } from 'react';
import {
  createTosArchive,
  listAllTosArchives,
  listAllTosConnections,
  retryTosArchive
} from '../../apis/tos';
import {
  archiveFileOptionsFromEntries,
  archiveFileOptionsFromResolved,
  collectModelFileEntries,
  ModelFileListingErrorCode,
  pickRetryableArchiveJob,
  readTosErrorDetails,
  relativeArchivePaths,
  TosArchiveErrorCode,
  TosArchiveJobPublic,
  TosConnectionPublic
} from '../../config/tos';

type ArchiveModalProps = {
  open: boolean;
  record?: ListItem | null;
  onCancel: () => void;
  onOk: () => void;
};

type FileListingState = {
  modelFileId?: number;
  organizationId?: number | null;
  loading: boolean;
  items: { path: string; size?: number | null }[];
  truncated: boolean;
  errorCode?: string;
  rootKind?: string;
};

const emptyListing = (): FileListingState => ({
  loading: false,
  items: [],
  truncated: false
});

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
  const [jobs, setJobs] = useState<TosArchiveJobPublic[]>([]);
  const [listing, setListing] = useState<FileListingState>(emptyListing);
  const actingOrganizationId = useActingOrganizationId();

  useEffect(() => {
    if (!open || !record?.id) {
      setListing(emptyListing());
      setJobs([]);
      setConnections([]);
      return;
    }
    let cancelled = false;
    const modelFileId = record.id;
    const organizationId = actingOrganizationId;
    setListing({
      modelFileId,
      organizationId,
      loading: true,
      items: [],
      truncated: false
    });
    setJobs([]);
    setConnections([]);
    form.resetFields(['paths']);
    listAllTosConnections()
      .then((items) => {
        if (!cancelled) {
          setConnections(items);
        }
      })
      .catch(() => undefined);
    listAllTosArchives({ model_file_id: modelFileId })
      .then((items) => {
        if (!cancelled) {
          setJobs(items);
        }
      })
      .catch(() => undefined);
    collectModelFileEntries((params) =>
      queryModelFileEntries(modelFileId, params, {
        skipErrorHandler: true
      })
    )
      .then((result) => {
        if (cancelled) {
          return;
        }
        setListing({
          modelFileId,
          organizationId,
          loading: false,
          items: result.items,
          truncated: result.truncated,
          rootKind: result.root_kind
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setListing({
          modelFileId,
          organizationId,
          loading: false,
          items: [],
          truncated: false,
          errorCode:
            readTosErrorDetails(error).error_code ||
            ModelFileListingErrorCode.worker_unreachable
        });
      });
    return () => {
      cancelled = true;
    };
  }, [open, record?.id, actingOrganizationId]);

  const handleCancel = () => {
    form.resetFields();
    setJobs([]);
    setConnections([]);
    setListing(emptyListing());
    onCancel();
  };

  const listingMatchesRecord =
    listing.modelFileId === record?.id &&
    listing.organizationId === actingOrganizationId &&
    !listing.loading;
  const listedOptions = listingMatchesRecord
    ? archiveFileOptionsFromEntries(listing.items)
    : [];
  const resolvedOptions = archiveFileOptionsFromResolved(
    record?.resolved_paths || []
  );
  const fileOptions = listedOptions.length ? listedOptions : resolvedOptions;
  const listedPaths = fileOptions.map((item) => item.value);
  const retryable = pickRetryableArchiveJob(jobs);
  const listingErrorId = listing.errorCode
    ? `models.form.tos.archive.files.${listing.errorCode}`
    : undefined;

  const handleFinish = async (values: Record<string, any>) => {
    if (!record?.id) {
      return;
    }
    try {
      await run(async () => {
        try {
          await createTosArchive(
            {
              model_file_id: record.id,
              connection_id: values.tos_connection_id,
              tos_model: values.tos_model,
              tos_version: values.tos_version,
              paths: relativeArchivePaths(
                record.resolved_paths || [],
                values.paths?.length ? values.paths : null,
                listedPaths
              )
            },
            { skipErrorHandler: true }
          );
        } catch (error) {
          const details = readTosErrorDetails(error);
          if (
            details.error_code === TosArchiveErrorCode.version_retry_required &&
            details.retry_job_id
          ) {
            await retryTosArchive(details.retry_job_id);
            return;
          }
          throw error;
        }
      });
      showSuccess();
      handleCancel();
      onOk();
    } catch (error) {
      const code = readTosErrorDetails(error).error_code;
      if (code === TosArchiveErrorCode.version_retry_required) {
        form.setFields([
          {
            name: 'tos_version',
            errors: [
              intl.formatMessage({
                id: 'models.form.tos.archive.versionRetryRequired'
              })
            ]
          }
        ]);
      } else if (code === TosArchiveErrorCode.concurrent_version) {
        form.setFields([
          {
            name: 'tos_version',
            errors: [
              intl.formatMessage({
                id: 'models.form.tos.archive.concurrentVersion'
              })
            ]
          }
        ]);
      } else if (code === TosArchiveErrorCode.immutable_conflict) {
        form.setFields([
          {
            name: 'tos_version',
            errors: [
              intl.formatMessage({
                id: 'models.form.tos.archive.immutableConflict'
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
          tos_connection_id: retryable?.connection_id,
          tos_model:
            retryable?.tos_model ||
            record?.tos_model ||
            record?.huggingface_repo_id,
          tos_version: retryable?.tos_version || record?.tos_version
        }}
      >
        {retryable ? (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message={intl.formatMessage({
              id: 'models.form.tos.archive.versionRetryRequired'
            })}
          />
        ) : null}
        {listing.truncated && listingMatchesRecord ? (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message={intl.formatMessage({
              id: 'models.form.tos.archive.files.truncated'
            })}
          />
        ) : null}
        {listingErrorId && listingMatchesRecord ? (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
            message={intl.formatMessage({ id: listingErrorId })}
          />
        ) : null}
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
                id: listing.loading
                  ? 'models.form.tos.archive.files.loading'
                  : fileOptions.length > 0
                    ? 'models.form.tos.archive.paths.tips'
                    : 'models.form.tos.archive.paths.directoryOnly'
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
            disabled={!fileOptions.length || listing.loading}
            label={intl.formatMessage({ id: 'models.form.tos.archive.paths' })}
            options={fileOptions}
          ></SealSelect>
        </Form.Item>
      </Form>
    </FormDrawer>
  );
};

export default ArchiveModal;
