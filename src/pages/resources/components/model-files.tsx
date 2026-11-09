import { modelsExpandKeysAtom } from '@/atoms/models';
import { PageAction } from '@/config';
import { PaginationKey, TABLE_SORT_DIRECTIONS } from '@/config/settings';
import useTableFetch from '@/hooks/use-table-fetch';
import PageBox from '@/pages/_components/page-box';
import { createModel } from '@/pages/llmodels/apis';
import { listAllTosArchives, retryTosArchive } from '@/pages/llmodels/apis/tos';
import DeployModal from '@/pages/llmodels/components/deployment/deploy-modal';
import DownloadModal from '@/pages/llmodels/components/download';
import ArchiveModal from '@/pages/llmodels/components/tos/archive-modal';
import { modelSourceMap } from '@/pages/llmodels/config';
import {
  modalConfig,
  onLineSourceOptions
} from '@/pages/llmodels/config/button-actions';
import {
  TosArchiveInFlight,
  TosArchiveJobPublic,
  buildModelFileDownloadPayload,
  latestArchiveJob,
  pickRetryableArchiveJob
} from '@/pages/llmodels/config/tos';
import { SourceType } from '@/pages/llmodels/config/types';
import { backendOptionsMap } from '@/pages/llmodels/constants/backend-parameters';
import useCheckBackend from '@/pages/llmodels/hooks/use-check-backend';
import { useGenerateWorkerOptions } from '@/pages/llmodels/hooks/use-form-initial-values';
import useRecognizeAudio from '@/pages/llmodels/hooks/use-recognize-audio';
import {
  DeleteModal,
  FilterBar,
  IconFont,
  NoResult,
  useAppUtils,
  useBodyScroll
} from '@gpustack/core-ui';
import { useIntl, useNavigate } from '@umijs/max';
import { useMemoizedFn } from 'ahooks';
import { ConfigProvider, Table, message } from 'antd';
import { useAtom } from 'jotai';
import _ from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import {
  MODEL_FILES_API,
  deleteModelFile,
  downloadModelFile,
  queryModelFilesList,
  retryDownloadModelFile
} from '../apis';
import { WorkerStatusMap } from '../config';
import { ModelFile as ListItem } from '../config/types';
import useFilesColumns from '../hooks/use-files-columns';

const filterPattern = /^(.*?)(?:-\d+-of-\d+)?(\.gguf)?$/;

const ModelFiles = () => {
  const { identifyModelTask } = useRecognizeAudio();
  const { checkCurrentbackend } = useCheckBackend();
  const { getWorkerOptionList, workerOptions, clusterList, workersList } =
    useGenerateWorkerOptions();
  const { saveScrollHeight, restoreScrollHeight } = useBodyScroll();
  const [modelsExpandKeys, setModelsExpandKeys] = useAtom(modelsExpandKeysAtom);
  const navigate = useNavigate();
  const {
    dataSource,
    rowSelection,
    queryParams,
    sortOrder,
    modalRef,
    fetchData,
    handleDelete,
    handleDeleteBatch,
    handlePageChange,
    handleTableChange,
    handleSearch,
    handleNameChange,
    handleQueryChange
  } = useTableFetch<ListItem>({
    key: PaginationKey.ModelFiles,
    fetchAPI: queryModelFilesList,
    deleteAPI: deleteModelFile,
    API: MODEL_FILES_API,
    watch: true,
    contentForDelete: 'resources.modelfiles.modelfile'
  });
  const intl = useIntl();
  const { showSuccess } = useAppUtils();
  const [downloadModalStatus, setDownlaodMoalStatus] = useState<{
    show: boolean;
    width: number | string;
    source: string;
    hasLinuxWorker: boolean;
  }>({
    show: false,
    width: 600,
    hasLinuxWorker: false,
    source: modelSourceMap.huggingface_value
  });
  const [openDeployModal, setOpenDeployModal] = useState<{
    show: boolean;
    width: number | string;
    source: SourceType;
    initialValues: any;
    isGGUF?: boolean;
  }>({
    show: false,
    width: 600,
    source: modelSourceMap.local_path_value as SourceType,
    initialValues: {},
    isGGUF: false
  });

  useEffect(() => {
    getWorkerOptionList();
  }, []);

  const extractFileName = (name: string) => {
    return name.replace(filterPattern, '$1');
  };

  const handleWorkerChange = (value: number) => {
    handleQueryChange({
      page: 1,
      worker_id: value
    });
  };

  const checkIsGGUF = (record: ListItem) => {
    const isGGUF = _.includes(record.resolved_paths?.[0], 'gguf');
    const isOllama = !!record.ollama_library_model_name;
    return isGGUF || isOllama || record.provenance?.gguf === true;
  };

  const getModelInfo = (record: ListItem) => {
    if (record.source === modelSourceMap.huggingface_value) {
      return {
        source: modelSourceMap.huggingface_value,
        huggingface_repo_id: record.huggingface_repo_id,
        huggingface_filename: record.huggingface_filename
      };
    }

    if (record.source === modelSourceMap.modelscope_value) {
      return {
        source: modelSourceMap.modelscope_value,
        model_scope_model_id: record.model_scope_model_id,
        model_scope_file_path: record.model_scope_file_path
      };
    }

    if (record.source === modelSourceMap.tos_value) {
      return {
        source: modelSourceMap.tos_value,
        tos_connection_id: record.tos_connection_id,
        tos_endpoint: record.tos_endpoint,
        tos_region: record.tos_region,
        tos_bucket: record.tos_bucket,
        tos_model: record.tos_model,
        tos_version: record.tos_version,
        tos_release_path: record.tos_release_path,
        tos_release_verified: true
      };
    }

    return {
      source: modelSourceMap.local_path_value,
      local_path: record.resolved_paths?.[0]
    };
  };

  const generateInitialValues = (record: ListItem, gpuOptions: any[]) => {
    const isGGUF = checkIsGGUF(record);
    const audioModelTag = identifyModelTask(
      record.source,
      record.resolved_paths?.[0]
    );

    const name = _.toLower(
      _.split(
        record.huggingface_repo_id ||
          record.ollama_library_model_name ||
          record.model_scope_model_id ||
          record.tos_model ||
          record.local_path,
        /[\\/]/
      ).pop()
    );

    // select the worker current model file is downloaded to.
    const targetWorker = _.find(workersList, { value: record.worker_id })
      ?.labels?.['worker-name'];

    return {
      cluster_id: workersList?.find(
        (worker) => worker.value === record.worker_id
      )?.cluster_id,
      ...getModelInfo(record),
      worker_selector: targetWorker
        ? {
            'worker-name': targetWorker
          }
        : {},
      name: extractFileName(name),
      backend: checkCurrentbackend({
        isGGUF: !audioModelTag && isGGUF,
        isAudio: !!audioModelTag,
        gpuOptions: gpuOptions,
        defaultBackend:
          !audioModelTag && isGGUF
            ? backendOptionsMap.llamaBox
            : backendOptionsMap.vllm
      }),
      isGGUF: !audioModelTag && isGGUF
    };
  };

  const handleSelect = useMemoizedFn(async (val: any, record: ListItem) => {
    try {
      if (val === 'delete') {
        handleDelete(
          {
            ...record,
            name: record.resolved_paths?.[0]
          },
          {
            checkConfig: {
              checkText: 'resources.modelfiles.delete.tips',
              defautlChecked: record.source !== modelSourceMap.local_path_value
            }
          }
        );
      } else if (val === 'retry') {
        await retryDownloadModelFile(record.id);
        showSuccess();
      } else if (val === 'retry-archive') {
        const jobs = await listAllTosArchives({
          model_file_id: record.id
        });
        const job = pickRetryableArchiveJob(jobs);
        if (!job) {
          return;
        }
        await retryTosArchive(job.id);
        showSuccess();
      } else if (val === 'archive') {
        setArchiveModal({ open: true, record });
      } else if (val === 'deploy') {
        saveScrollHeight();

        const initialValues = generateInitialValues(record, []);
        const source = (initialValues.source ||
          modelSourceMap.local_path_value) as SourceType;
        const config = modalConfig[source];
        setOpenDeployModal({
          ...openDeployModal,
          initialValues: initialValues,
          isGGUF: initialValues.isGGUF,
          source,
          width: config?.width || 600,
          show: true
        });
      }
    } catch (error) {
      // console.log('error', error);
    }
  });

  const handleClickDropdown = (item: any) => {
    const config = modalConfig[item.key];
    const hasLinuxWorker = workersList.some(
      (worker) => _.toLower(worker.labels?.os) === 'linux'
    );
    if (config) {
      setDownlaodMoalStatus({ ...config, hasLinuxWorker });
    }
  };

  const renderEmpty = (type?: string) => {
    if (type !== 'Table') return;
    return (
      <NoResult
        minHeight="calc(100vh - 300px)"
        loading={dataSource.loading}
        loadend={dataSource.loadend}
        dataSource={dataSource.dataList}
        image={<IconFont type="icon-files" />}
        filters={_.omit(queryParams, ['sort_by'])}
        noFoundText={intl.formatMessage({ id: 'noresult.modelfiles.nofound' })}
        title={intl.formatMessage({ id: 'noresult.modelfiles.title' })}
        subTitle={intl.formatMessage({ id: 'noresult.modelfiles.subTitle' })}
      ></NoResult>
    );
  };

  const handleDownloadCancel = () => {
    setDownlaodMoalStatus({
      ...downloadModalStatus,
      show: false
    });
  };

  const [archiveModal, setArchiveModal] = useState<{
    open: boolean;
    record?: ListItem | null;
  }>({ open: false, record: null });
  const [archiveJobs, setArchiveJobs] = useState<
    Record<number, TosArchiveJobPublic>
  >({});

  useEffect(() => {
    const tracked = (dataSource.dataList || []).filter(
      (item) =>
        item.archive_state &&
        (TosArchiveInFlight.includes(item.archive_state as any) ||
          item.archive_state === 'error')
    );
    if (!tracked.length) {
      setArchiveJobs({});
      return;
    }
    let cancelled = false;
    Promise.all(
      tracked.map((item) => listAllTosArchives({ model_file_id: item.id }))
    )
      .then((pages) => {
        if (cancelled) {
          return;
        }
        const next: Record<number, TosArchiveJobPublic> = {};
        pages.forEach((jobs, index) => {
          const latest = latestArchiveJob(jobs);
          if (latest) {
            next[tracked[index].id] = latest;
          }
        });
        setArchiveJobs(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [dataSource.dataList]);

  const handleDownload = async (data: any) => {
    try {
      await downloadModelFile(buildModelFileDownloadPayload(data));
      setDownlaodMoalStatus({
        ...downloadModalStatus,
        show: false
      });
      fetchData();
      showSuccess();
    } catch (error) {
      // console.log('error', error);
    }
  };

  const handleDeployModalCancel = () => {
    setOpenDeployModal({
      ...openDeployModal,
      show: false
    });
    restoreScrollHeight();
  };

  const handleDeleteByBatch = () => {
    handleDeleteBatch({
      checkConfig: {
        checkText: 'resources.modelfiles.delete.tips',
        defautlChecked: false
      }
    });
  };

  const handleCreateModel = async (data: any) => {
    try {
      const modelData = await createModel({
        data
      });
      setOpenDeployModal({
        ...openDeployModal,
        show: false
      });
      message.success(intl.formatMessage({ id: 'common.message.success' }));
      setModelsExpandKeys([modelData.id]);
      navigate('/models/deployments');
    } catch (error) {
      // console.log('error', error);
    }
  };

  const columns = useFilesColumns({
    handleSelect,
    sortOrder,
    workersList,
    archiveJobs
  });

  const readyWorkers = useMemo(() => {
    return workerOptions.map((item) => {
      item.children = item.children?.filter(
        (child) => child.state === WorkerStatusMap.ready
      );
      return item;
    });
  }, [workerOptions]);

  return (
    <>
      <PageBox>
        <FilterBar
          actionType="dropdown"
          selectHolder={intl.formatMessage({ id: 'resources.filter.worker' })}
          inputHolder={intl.formatMessage({ id: 'resources.filter.path' })}
          buttonText={intl.formatMessage({
            id: 'resources.modelfiles.download'
          })}
          handleSelectChange={handleWorkerChange}
          handleDeleteByBatch={handleDeleteByBatch}
          handleClickPrimary={handleClickDropdown}
          handleSearch={handleSearch}
          selectOptions={workersList}
          handleInputChange={handleNameChange}
          rowSelection={rowSelection}
          actionItems={onLineSourceOptions}
          showSelect={true}
        ></FilterBar>
        <ConfigProvider renderEmpty={renderEmpty}>
          <Table
            className={'scroll-table'}
            rowKey="id"
            tableLayout="fixed"
            sortDirections={TABLE_SORT_DIRECTIONS}
            showSorterTooltip={false}
            scroll={{
              x: 900
            }}
            onChange={handleTableChange}
            dataSource={dataSource.dataList}
            loading={{
              spinning: dataSource.loading,
              size: 'middle'
            }}
            rowSelection={rowSelection}
            columns={columns}
            pagination={{
              showSizeChanger: true,
              pageSize: queryParams.perPage,
              current: queryParams.page,
              total: dataSource.total,
              hideOnSinglePage: queryParams.perPage === 10,
              onChange: handlePageChange,
              size: 'middle'
            }}
          ></Table>
        </ConfigProvider>
        <DeleteModal ref={modalRef}></DeleteModal>
        <DownloadModal
          onCancel={handleDownloadCancel}
          onOk={handleDownload}
          title={intl.formatMessage({ id: 'resources.modelfiles.download' })}
          open={downloadModalStatus.show}
          source={downloadModalStatus.source}
          width={downloadModalStatus.width}
          hasLinuxWorker={downloadModalStatus.hasLinuxWorker}
          workerOptions={readyWorkers}
          workersList={workersList}
        ></DownloadModal>
        <ArchiveModal
          open={archiveModal.open}
          record={archiveModal.record}
          onCancel={() => setArchiveModal({ open: false, record: null })}
          onOk={fetchData}
        ></ArchiveModal>
        <DeployModal
          deploymentType="modelFiles"
          title={intl.formatMessage({ id: 'models.button.deploy' })}
          onCancel={handleDeployModalCancel}
          onOk={handleCreateModel}
          open={openDeployModal.show}
          action={PageAction.CREATE}
          source={openDeployModal.source}
          width={openDeployModal.width}
          initialValues={openDeployModal.initialValues}
          isGGUF={openDeployModal.isGGUF}
          clusterList={clusterList}
        ></DeployModal>
      </PageBox>
    </>
  );
};

export default ModelFiles;
