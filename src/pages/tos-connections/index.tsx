import { PageAction } from '@/config';
import { PaginationKey } from '@/config/settings';
import type { PageActionType } from '@/config/types';
import { useActingOrganizationId } from '@/hooks/use-acting-organization-id';
import useTableFetch from '@/hooks/use-table-fetch';
import PageBox from '@/pages/_components/page-box';
import {
  deleteTosConnection,
  queryTosConnections
} from '@/pages/llmodels/apis/tos';
import { TosConnectionPublic as ListItem } from '@/pages/llmodels/config/tos';
import { DeleteModal, FilterBar, IconFont, NoResult } from '@gpustack/core-ui';
import { useAccess, useIntl } from '@umijs/max';
import useMemoizedFn from 'ahooks/lib/useMemoizedFn';
import { ConfigProvider, Table } from 'antd';
import { useEffect, useRef, useState } from 'react';
import AddTosConnectionModal from './components/add-tos-connection-modal';
import useTosConnectionColumns from './hooks/use-tos-connection-columns';

const TosConnections = () => {
  const intl = useIntl();
  const access = useAccess();
  const actingOrganizationId = useActingOrganizationId();
  const {
    TABLE_SORT_DIRECTIONS,
    dataSource,
    rowSelection,
    queryParams,
    modalRef,
    fetchData,
    handleDelete,
    handlePageChange,
    handleTableChange,
    handleSearch,
    handleNameChange
  } = useTableFetch<ListItem>({
    key: PaginationKey.TosConnections,
    fetchAPI: queryTosConnections,
    deleteAPI: deleteTosConnection,
    contentForDelete: 'models.form.tos.connections.title'
  });
  const [openModal, setOpenModal] = useState<{
    open: boolean;
    action: PageActionType;
    title: string;
    currentData?: ListItem | null;
  }>({
    open: false,
    action: PageAction.CREATE,
    title: '',
    currentData: null
  });

  const handleAdd = () => {
    setOpenModal({
      open: true,
      action: PageAction.CREATE,
      title: intl.formatMessage({ id: 'models.form.tos.connections.create' }),
      currentData: null
    });
  };

  const handleSelect = useMemoizedFn((val: string, record: ListItem) => {
    if (val === 'delete') {
      handleDelete(record);
      return;
    }
    if (val === 'edit') {
      setOpenModal({
        open: true,
        action: PageAction.EDIT,
        title: intl.formatMessage({ id: 'models.form.tos.connections.edit' }),
        currentData: record
      });
    }
  });

  const columns = useTosConnectionColumns({ handleSelect });
  const previousOrgId = useRef<number | null | undefined>(undefined);

  useEffect(() => {
    if (previousOrgId.current === undefined) {
      previousOrgId.current = actingOrganizationId;
      return;
    }
    if (previousOrgId.current === actingOrganizationId) {
      return;
    }
    previousOrgId.current = actingOrganizationId;
    setOpenModal({
      open: false,
      action: PageAction.CREATE,
      title: '',
      currentData: null
    });
    fetchData();
  }, [actingOrganizationId]);

  if (!access?.canSeeOrgAdmin) {
    return null;
  }

  const renderEmpty = (type?: string) => {
    if (type !== 'Table') return;
    return (
      <NoResult
        minHeight="calc(100vh - 300px)"
        loading={dataSource.loading}
        loadend={dataSource.loadend}
        dataSource={dataSource.dataList}
        image={<IconFont type="icon-files" />}
        noFoundText={intl.formatMessage({
          id: 'noresult.tosConnections.nofound'
        })}
        title={intl.formatMessage({ id: 'noresult.tosConnections.title' })}
        subTitle={intl.formatMessage({
          id: 'noresult.tosConnections.subTitle'
        })}
      ></NoResult>
    );
  };

  return (
    <PageBox>
      <FilterBar
        buttonText={intl.formatMessage({
          id: 'models.form.tos.connections.create'
        })}
        handleClickPrimary={handleAdd}
        handleSearch={handleSearch}
        handleInputChange={handleNameChange}
        rowSelection={rowSelection}
      ></FilterBar>
      <ConfigProvider renderEmpty={renderEmpty}>
        <Table
          className="scroll-table"
          rowKey="id"
          tableLayout="fixed"
          sortDirections={TABLE_SORT_DIRECTIONS}
          showSorterTooltip={false}
          scroll={{ x: 'max-content' }}
          onChange={handleTableChange}
          dataSource={dataSource.dataList}
          loading={{ spinning: dataSource.loading, size: 'middle' }}
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
      <AddTosConnectionModal
        title={openModal.title}
        action={openModal.action}
        open={openModal.open}
        currentData={openModal.currentData}
        onOk={fetchData}
        onCancel={() =>
          setOpenModal({
            open: false,
            action: PageAction.CREATE,
            title: '',
            currentData: null
          })
        }
      ></AddTosConnectionModal>
    </PageBox>
  );
};

export default TosConnections;
