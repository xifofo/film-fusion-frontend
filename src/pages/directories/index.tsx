import type {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
} from '@ant-design/pro-components';
import {
  PageContainer,
  ProDescriptions,
  ProTable,
} from '@ant-design/pro-components';
import { useRequest } from '@umijs/max';
import { Button, Drawer, message, Popconfirm, Space, Tag, Tooltip } from 'antd';
import React, { useMemo, useRef, useState } from 'react';
import {
  deleteCloudDirectory,
  getCloudDirectoryList,
  getCloudStorageList,
} from '@/services/film-fusion';
import CreateForm from './components/CreateForm';
import UpdateForm from './components/UpdateForm';
import OrganizeModal from './components/OrganizeModal';

const DirectoryList: React.FC = () => {
  const actionRef = useRef<ActionType | null>(null);

  const [showDetail, setShowDetail] = useState(false);
  const [currentRow, setCurrentRow] = useState<API.CloudDirectory>();

  const [messageApi, contextHolder] = message.useMessage();

  const { data: cloudStorageData = [], loading: cloudStorageLoading } = useRequest(
    () => getCloudStorageList({ current: 1, pageSize: 1000 }),
    {
      formatResult: (res) => res.data?.list || [],
    },
  );

  const storageOptions = useMemo(
    () =>
      cloudStorageData.map((item: API.CloudStorage) => ({
        label: `${item.storage_name} (${item.storage_type})`,
        value: item.id,
      })),
    [cloudStorageData],
  );

  const { run: delRun, loading: delLoading } = useRequest(deleteCloudDirectory, {
    manual: true,
    onSuccess: () => {
      actionRef.current?.reloadAndRest?.();
      messageApi.success('删除成功');
    },
    onError: () => {
      messageApi.error('删除失败，请重试');
    },
  });

  const formatExtensions = (value?: string) => {
    if (!value) return '-';
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        if (parsed.length === 0) return '无';
        return (
          <Tooltip title={parsed.join(', ')}>
            <span>{parsed.length} 种</span>
          </Tooltip>
        );
      }
    } catch (error) {
      return '格式错误';
    }
    return value;
  };

  const renderEncodeTag = (value?: boolean) => (
    <Tag color={value ? 'green' : 'default'}>{value ? '是' : '否'}</Tag>
  );

  const columns: ProColumns<API.CloudDirectory>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
      sorter: true,
      hideInSearch: true,
    },
    {
      title: '目录名称',
      dataIndex: 'directory_name',
      width: 160,
      render: (dom, entity) => (
        <a
          onClick={() => {
            setCurrentRow(entity);
            setShowDetail(true);
          }}
        >
          {dom}
        </a>
      ),
    },
    {
      title: '目录 ID',
      dataIndex: 'directory_id',
      width: 160,
      ellipsis: true,
      copyable: true,
    },
    {
      title: '云存储',
      dataIndex: 'cloud_storage_id',
      width: 180,
      valueType: 'select',
      fieldProps: {
        options: storageOptions,
        loading: cloudStorageLoading,
        showSearch: true,
        filterOption: (input: string, option: any) =>
          option?.label?.toLowerCase().includes(input.toLowerCase()),
      },
      render: (_, record) => (
        <Space size={6}>
          <Tag color="blue">
            {record.cloud_storage?.storage_name || `ID: ${record.cloud_storage_id}`}
          </Tag>
          {record.cloud_storage?.storage_type ? (
            <Tag color="geekblue">{record.cloud_storage.storage_type}</Tag>
          ) : null}
        </Space>
      ),
    },
    {
      title: '保存路径',
      dataIndex: 'save_path',
      width: 200,
      ellipsis: true,
      copyable: true,
      hideInSearch: true,
    },
    {
      title: '内容前缀',
      dataIndex: 'content_prefix',
      width: 200,
      ellipsis: true,
      copyable: true,
      hideInSearch: true,
    },
    {
      title: 'URI 编码',
      dataIndex: 'content_encode_uri',
      width: 100,
      render: (_, record) => renderEncodeTag(record.content_encode_uri),
      hideInSearch: true,
    },
    {
      title: '按分类',
      dataIndex: 'classify_by_category',
      width: 100,
      render: (_, record) => renderEncodeTag(record.classify_by_category),
      hideInSearch: true,
    },
    {
      title: '包含后缀',
      dataIndex: 'include_extensions',
      width: 120,
      render: (value) => formatExtensions(value as string),
      hideInSearch: true,
    },
    {
      title: '排除后缀',
      dataIndex: 'exclude_extensions',
      width: 120,
      render: (value) => formatExtensions(value as string),
      hideInSearch: true,
    },
    {
      title: '排除小于 (MB)',
      dataIndex: 'exclude_smaller_than_mb',
      width: 140,
      hideInSearch: true,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 160,
      valueType: 'dateTime',
      sorter: true,
      hideInSearch: true,
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 160,
      valueType: 'dateTime',
      sorter: true,
      hideInSearch: true,
    },
    {
      title: '搜索',
      dataIndex: 'search',
      hideInTable: true,
      fieldProps: {
        placeholder: '名称/ID/保存路径',
      },
    },
    {
      title: '操作',
      dataIndex: 'option',
      valueType: 'option',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space size={8}>
          <UpdateForm
            record={record}
            storageOptions={storageOptions}
            storageLoading={cloudStorageLoading}
            onSuccess={() => {
              actionRef.current?.reload?.();
            }}
          />
          <OrganizeModal
            record={record}
            onSuccess={() => {
              actionRef.current?.reload?.();
            }}
          />
          <Popconfirm
            title="确定要删除这条目录配置吗？"
            onConfirm={() => delRun(record.id)}
            okButtonProps={{ loading: delLoading }}
          >
            <Button type="link" size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const detailColumns: ProDescriptionsItemProps<API.CloudDirectory>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
    },
    {
      title: '目录名称',
      dataIndex: 'directory_name',
    },
    {
      title: '目录 ID',
      dataIndex: 'directory_id',
      copyable: true,
    },
    {
      title: '云存储 ID',
      dataIndex: 'cloud_storage_id',
    },
    {
      title: '云存储名称',
      render: (_, record) => record.cloud_storage?.storage_name || '-',
    },
    {
      title: '云存储类型',
      render: (_, record) => record.cloud_storage?.storage_type || '-',
    },
    {
      title: '内容前缀',
      dataIndex: 'content_prefix',
      copyable: true,
    },
    {
      title: '内容 URI 编码',
      render: (_, record) => renderEncodeTag(record.content_encode_uri),
    },
    {
      title: '按分类目录',
      render: (_, record) => renderEncodeTag(record.classify_by_category),
    },
    {
      title: '保存路径',
      dataIndex: 'save_path',
      copyable: true,
    },
    {
      title: '包含后缀',
      render: (_, record) => formatExtensions(record.include_extensions),
    },
    {
      title: '排除后缀',
      render: (_, record) => formatExtensions(record.exclude_extensions),
    },
    {
      title: '排除小于 (MB)',
      dataIndex: 'exclude_smaller_than_mb',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      valueType: 'dateTime',
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      valueType: 'dateTime',
    },
  ];

  return (
    <PageContainer
      header={{
        title: '目录配置管理',
        breadcrumb: {
          routes: [
            { path: '', breadcrumbName: '首页' },
            { path: '', breadcrumbName: '目录配置管理' },
          ],
        },
      }}
    >
      {contextHolder}
      <ProTable<API.CloudDirectory, API.CloudDirectoryQueryParams>
        headerTitle="目录配置列表"
        actionRef={actionRef}
        rowKey="id"
        search={{ labelWidth: 120, defaultCollapsed: false }}
        scroll={{ x: 'max-content' }}
        toolBarRender={() => [
          <CreateForm
            key="create"
            storageOptions={storageOptions}
            storageLoading={cloudStorageLoading}
            onSuccess={() => {
              actionRef.current?.reload?.();
            }}
          />,
        ]}
        request={async (params, sort) => {
          const sortParams: API.CloudDirectoryQueryParams = {};
          if (sort && Object.keys(sort).length > 0) {
            const sortKey = Object.keys(sort)[0];
            sortParams.order_by = sortKey;
            sortParams.order_dir = sort[sortKey] === 'ascend' ? 'asc' : 'desc';
          }

          const response = await getCloudDirectoryList({
            current: params.current,
            pageSize: params.pageSize,
            cloud_storage_id: params.cloud_storage_id,
            search: params.search,
            ...sortParams,
          });

          return {
            data: response.data?.list || [],
            success: response.code === 0,
            total: response.data?.total || 0,
          };
        }}
        columns={columns}
      />

      <Drawer
        width={600}
        open={showDetail}
        onClose={() => {
          setCurrentRow(undefined);
          setShowDetail(false);
        }}
        closable={false}
      >
        {currentRow?.id && (
          <ProDescriptions<API.CloudDirectory>
            column={2}
            title={`目录配置 #${currentRow?.id}`}
            request={async () => ({
              data: currentRow || {},
            })}
            params={{ id: currentRow?.id }}
            columns={detailColumns}
          />
        )}
      </Drawer>
    </PageContainer>
  );
};

export default DirectoryList;
