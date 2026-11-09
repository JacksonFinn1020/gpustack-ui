import {
  connectionScope,
  TosConnectionPublic
} from '@/pages/llmodels/config/tos';
import { AutoTooltip, DropdownButtons, icons } from '@gpustack/core-ui';
import { useIntl } from '@umijs/max';
import { ColumnsType } from 'antd/lib/table';
import dayjs from 'dayjs';
import { useMemo } from 'react';

const actions = [
  {
    label: 'common.button.edit',
    key: 'edit',
    icon: icons.EditOutlined
  },
  {
    label: 'common.button.delete',
    key: 'delete',
    props: { danger: true },
    icon: icons.DeleteOutlined
  }
];

const useTosConnectionColumns = (props: {
  handleSelect: (action: string, record: TosConnectionPublic) => void;
}): ColumnsType<TosConnectionPublic> => {
  const { handleSelect } = props;
  const intl = useIntl();

  return useMemo(
    () => [
      {
        title: intl.formatMessage({ id: 'common.table.name' }),
        dataIndex: 'name',
        render: (text: string) => (
          <AutoTooltip ghost>
            <span>{text}</span>
          </AutoTooltip>
        )
      },
      {
        title: intl.formatMessage({ id: 'models.form.tos.endpoint' }),
        dataIndex: 'endpoint',
        render: (text: string) => (
          <AutoTooltip ghost>
            <span>{text}</span>
          </AutoTooltip>
        )
      },
      {
        title: intl.formatMessage({ id: 'models.form.tos.region' }),
        dataIndex: 'region'
      },
      {
        title: intl.formatMessage({ id: 'models.form.tos.bucket' }),
        dataIndex: 'bucket'
      },
      {
        title: intl.formatMessage({ id: 'models.form.tos.prefix' }),
        dataIndex: 'prefix',
        render: (text: string, record: TosConnectionPublic) => (
          <AutoTooltip ghost>
            <span>
              {text || '—'} (
              {intl.formatMessage({
                id:
                  connectionScope(record) === 'bucket'
                    ? 'models.form.tos.scope.bucket'
                    : 'models.form.tos.scope.prefix'
              })}
              )
            </span>
          </AutoTooltip>
        )
      },
      {
        title: intl.formatMessage({ id: 'models.form.tos.credentialMode' }),
        dataIndex: 'credential_mode'
      },
      {
        title: intl.formatMessage({ id: 'common.table.createTime' }),
        dataIndex: 'created_at',
        width: 180,
        render: (text: string) => (
          <AutoTooltip ghost>
            {text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : ''}
          </AutoTooltip>
        )
      },
      {
        title: intl.formatMessage({ id: 'common.table.operation' }),
        dataIndex: 'operation',
        width: 120,
        render: (_: string, record: TosConnectionPublic) => (
          <DropdownButtons
            items={actions}
            onSelect={(val) => handleSelect(val, record)}
          ></DropdownButtons>
        )
      }
    ],
    [intl, handleSelect]
  );
};

export default useTosConnectionColumns;
