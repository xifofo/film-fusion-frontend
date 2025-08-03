import type {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
} from '@ant-design/pro-components';
import {
  FooterToolbar,
  PageContainer,
  ProDescriptions,
  ProTable,
} from '@ant-design/pro-components';
import { useRequest } from '@umijs/max';
import { Button, Drawer, message, Tag, Popconfirm, Space, Tooltip } from 'antd';
import React, { useCallback, useRef, useState } from 'react';
import {
  getCloudStorageList,
  deleteCloudStorage,
  setDefaultCloudStorage,
  refreshCloudStorageToken,
  testCloudStorageConnection
} from '@/services/film-fusion';
import CreateForm from './components/CreateForm';
import UpdateForm from './components/UpdateForm';

const CloudStorageList: React.FC = () => {
  const actionRef = useRef<ActionType | null>(null);

  const [showDetail, setShowDetail] = useState<boolean>(false);
  const [currentRow, setCurrentRow] = useState<API.CloudStorage>();
  const [selectedRowsState, setSelectedRows] = useState<API.CloudStorage[]>([]);

  const [messageApi, contextHolder] = message.useMessage();

  const { run: delRun, loading: delLoading } = useRequest(deleteCloudStorage, {
    manual: true,
    onSuccess: () => {
      setSelectedRows([]);
      actionRef.current?.reloadAndRest?.();
      messageApi.success('删除成功');
    },
    onError: () => {
      messageApi.error('删除失败，请重试');
    },
  });

  const { run: setDefaultRun, loading: setDefaultLoading } = useRequest(setDefaultCloudStorage, {
    manual: true,
    onSuccess: () => {
      actionRef.current?.reload?.();
      messageApi.success('设置默认存储成功');
    },
    onError: () => {
      messageApi.error('设置默认存储失败');
    },
  });

  const { run: refreshTokenRun, loading: refreshLoading } = useRequest(refreshCloudStorageToken, {
    manual: true,
    onSuccess: () => {
      actionRef.current?.reload?.();
      messageApi.success('刷新令牌成功');
    },
    onError: () => {
      messageApi.error('刷新令牌失败');
    },
  });

  const { run: testConnectionRun, loading: testLoading } = useRequest(testCloudStorageConnection, {
    manual: true,
    onSuccess: (result) => {
      if (result.connected) {
        messageApi.success('连接测试成功');
      } else {
        messageApi.error(`连接测试失败: ${result.message}`);
      }
    },
    onError: () => {
      messageApi.error('连接测试失败');
    },
  });

  const getStorageTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      '115': '115网盘',
      'baidu': '百度网盘',
      'aliyun': '阿里云盘',
      'tencent': '腾讯云',
      'tianyi': '天翼云盘',
      'quark': '夸克网盘',
    };
    return typeMap[type] || type;
  };

  const getStatusTag = (status: string) => {
    const statusMap = {
      active: { color: 'green', text: '启用' },
      disabled: { color: 'gray', text: '禁用' },
      error: { color: 'red', text: '错误' },
    };
    const config = statusMap[status as keyof typeof statusMap] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const columns: ProColumns<API.CloudStorage>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
      hideInSearch: true,
    },
    {
      title: '用户ID',
      dataIndex: 'user_id',
      width: 100,
      hideInSearch: true,
    },
    {
      title: '存储名称',
      dataIndex: 'storage_name',
      width: 150,
      render: (dom, entity) => {
        return (
          <a
            onClick={() => {
              setCurrentRow(entity);
              setShowDetail(true);
            }}
          >
            {dom}
            {entity.is_default && <Tag color="blue" style={{ marginLeft: 8 }}>默认</Tag>}
          </a>
        );
      },
    },
    {
      title: '存储类型',
      dataIndex: 'storage_type',
      width: 120,
      render: (_, record) => getStorageTypeLabel(record.storage_type),
      valueEnum: {
        '115': { text: '115网盘' },
        'baidu': { text: '百度网盘' },
        'aliyun': { text: '阿里云盘' },
        'tencent': { text: '腾讯云' },
        'tianyi': { text: '天翼云盘' },
        'quark': { text: '夸克网盘' },
      },
    },
    {
      title: '应用ID',
      dataIndex: 'app_id',
      width: 150,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '应用密钥',
      dataIndex: 'app_secret',
      width: 150,
      ellipsis: true,
      hideInSearch: true,
      render: (_, record) => record.app_secret ? '***已配置***' : '未配置',
    },
    {
      title: '访问令牌',
      dataIndex: 'access_token',
      width: 150,
      ellipsis: true,
      hideInSearch: true,
      render: (_, record) => record.access_token ? `${record.access_token.substring(0, 10)}...` : '未配置',
    },
    {
      title: '刷新令牌',
      dataIndex: 'refresh_token',
      width: 150,
      ellipsis: true,
      hideInSearch: true,
      render: (_, record) => record.refresh_token ? `${record.refresh_token.substring(0, 10)}...` : '未配置',
    },
    {
      title: '令牌过期时间',
      dataIndex: 'token_expires_at',
      width: 160,
      valueType: 'dateTime',
      hideInSearch: true,
      render: (_, record) => {
        if (!record.token_expires_at) {
          return <Tag color="gray">未配置</Tag>;
        }
        const expireTime = new Date(record.token_expires_at).getTime();
        const now = Date.now();
        if (expireTime <= now) {
          return <Tag color="red">已过期</Tag>;
        }
        const diffHours = Math.floor((expireTime - now) / (1000 * 60 * 60));
        if (diffHours < 24) {
          return <Tag color="orange">即将过期({diffHours}小时)</Tag>;
        }
        return record.token_expires_at;
      },
    },
    {
      title: '刷新令牌过期时间',
      dataIndex: 'refresh_expires_at',
      width: 160,
      valueType: 'dateTime',
      hideInSearch: true,
    },
    {
      title: '最后刷新时间',
      dataIndex: 'last_refresh_at',
      width: 160,
      valueType: 'dateTime',
      hideInSearch: true,
    },
    {
      title: '自动刷新',
      dataIndex: 'auto_refresh',
      width: 100,
      render: (_, record) => (
        <Tag color={record.auto_refresh ? 'green' : 'gray'}>
          {record.auto_refresh ? '启用' : '禁用'}
        </Tag>
      ),
      valueEnum: {
        true: { text: '启用' },
        false: { text: '禁用' },
      },
    },
    {
      title: '刷新提前时间(分钟)',
      dataIndex: 'refresh_before_min',
      width: 140,
      hideInSearch: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (_, record) => getStatusTag(record.status),
      valueEnum: {
        active: { text: '启用', status: 'Success' },
        disabled: { text: '禁用', status: 'Default' },
        error: { text: '错误', status: 'Error' },
      },
    },
    {
      title: '错误信息',
      dataIndex: 'error_message',
      width: 200,
      ellipsis: true,
      hideInSearch: true,
      render: (_, record) => record.error_message || '-',
    },
    {
      title: '最后错误时间',
      dataIndex: 'last_error_at',
      width: 160,
      valueType: 'dateTime',
      hideInSearch: true,
    },
    {
      title: '额外配置',
      dataIndex: 'config',
      width: 150,
      ellipsis: true,
      hideInSearch: true,
      render: (_, record) => {
        if (!record.config) return '-';
        try {
          const config = JSON.parse(record.config);
          return `${Object.keys(config).length} 项配置`;
        } catch {
          return '配置格式错误';
        }
      },
    },
    {
      title: '默认存储',
      dataIndex: 'is_default',
      width: 100,
      render: (_, record) => (
        <Tag color={record.is_default ? 'blue' : 'gray'}>
          {record.is_default ? '是' : '否'}
        </Tag>
      ),
      valueEnum: {
        true: { text: '是' },
        false: { text: '否' },
      },
    },
    {
      title: '排序',
      dataIndex: 'sort_order',
      width: 80,
      hideInSearch: true,
      sorter: true,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 160,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 160,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: '删除时间',
      dataIndex: 'deleted_at',
      width: 160,
      valueType: 'dateTime',
      hideInSearch: true,
    },
    {
      title: '操作',
      dataIndex: 'option',
      width: 250,
      valueType: 'option',
      fixed: 'right',
      render: (_, record) => [
        <UpdateForm
          trigger={<a>编辑</a>}
          key="edit"
          onOk={actionRef.current?.reload}
          values={record}
        />,
        <Popconfirm
          key="setDefault"
          title="确定设为默认存储吗？"
          onConfirm={() => setDefaultRun(record.id)}
          disabled={record.is_default || setDefaultLoading}
        >
          <a style={{ color: record.is_default ? '#ccc' : undefined }}>
            设为默认
          </a>
        </Popconfirm>,
        <Tooltip title="刷新访问令牌" key="refresh">
          <a
            onClick={() => refreshTokenRun(record.id)}
            style={{ color: refreshLoading ? '#ccc' : undefined }}
          >
            刷新令牌
          </a>
        </Tooltip>,
        <Tooltip title="测试连接" key="test">
          <a
            onClick={() => testConnectionRun(record.id)}
            style={{ color: testLoading ? '#ccc' : undefined }}
          >
            测试连接
          </a>
        </Tooltip>,
      ],
    },
  ];

  /**
   * 删除节点
   */
  const handleRemove = useCallback(
    async (selectedRows: API.CloudStorage[]) => {
      if (!selectedRows?.length) {
        messageApi.warning('请选择删除项');
        return;
      }

      await delRun(selectedRows.map((row) => row.id));
    },
    [delRun, messageApi],
  );

  return (
    <PageContainer>
      {contextHolder}
      <ProTable<API.CloudStorage, API.CloudStorageQueryParams>
        headerTitle="云存储管理"
        actionRef={actionRef}
        rowKey="id"
        search={{
          labelWidth: 120,
        }}
        scroll={{ x: 'max-content' }}
        toolBarRender={() => [
          <CreateForm key="create" reload={actionRef.current?.reload} />,
        ]}
        request={async (params) => {
          const response = await getCloudStorageList(params);
          return {
            data: response.data.list,
            success: response.code === 200,
            total: response.data.total,
          };
        }}
        columns={columns}
        rowSelection={{
          onChange: (_, selectedRows) => {
            setSelectedRows(selectedRows);
          },
        }}
      />
      {selectedRowsState?.length > 0 && (
        <FooterToolbar
          extra={
            <div>
              已选择{' '}
              <a style={{ fontWeight: 600 }}>{selectedRowsState.length}</a>{' '}
              项
            </div>
          }
        >
          <Button
            loading={delLoading}
            onClick={() => {
              handleRemove(selectedRowsState);
            }}
          >
            批量删除
          </Button>
        </FooterToolbar>
      )}

      <Drawer
        width={600}
        open={showDetail}
        onClose={() => {
          setCurrentRow(undefined);
          setShowDetail(false);
        }}
        closable={false}
      >
        {currentRow?.storage_name && (
          <ProDescriptions<API.CloudStorage>
            column={2}
            title={currentRow?.storage_name}
            request={async () => ({
              data: currentRow || {},
            })}
            params={{
              id: currentRow?.id,
            }}
            columns={columns as ProDescriptionsItemProps<API.CloudStorage>[]}
          />
        )}
      </Drawer>
    </PageContainer>
  );
};

export default CloudStorageList;
