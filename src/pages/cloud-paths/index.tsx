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
import { Drawer, message, Tag, Popconfirm, Tooltip, Button, Space } from 'antd';
import React, { useRef, useState } from 'react';
import {
  getCloudPaths,
  deleteCloudPath,
  syncCloudPath,
  batchOperateCloudPaths,
} from '@/services/film-fusion';
import CreateForm from './components/CreateForm';
import UpdateForm from './components/UpdateForm';
import StatisticsCards from './components/StatisticsCards';

const CloudPathList: React.FC = () => {
  const actionRef = useRef<ActionType | null>(null);

  const [showDetail, setShowDetail] = useState<boolean>(false);
  const [currentRow, setCurrentRow] = useState<API.CloudPath>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const [messageApi, contextHolder] = message.useMessage();

  // 删除操作
  const { run: delRun, loading: delLoading } = useRequest(deleteCloudPath, {
    manual: true,
    onSuccess: () => {
      actionRef.current?.reloadAndRest?.();
      messageApi.success('删除成功');
    },
    onError: () => {
      messageApi.error('删除失败，请重试');
    },
  });

  // 同步操作
  const { run: syncRun, loading: syncLoading } = useRequest(syncCloudPath, {
    manual: true,
    onSuccess: () => {
      messageApi.success('同步请求已提交');
    },
    onError: () => {
      messageApi.error('同步失败，请重试');
    },
  });

  // 批量操作
  const { run: batchRun, loading: batchLoading } = useRequest(batchOperateCloudPaths, {
    manual: true,
    onSuccess: () => {
      messageApi.success('批量操作完成');
      actionRef.current?.reloadAndRest?.();
      setSelectedRowKeys([]);
    },
    onError: () => {
      messageApi.error('批量操作失败，请重试');
    },
  });

  // 批量删除
  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning('请先选择要删除的项');
      return;
    }
    batchRun({
      ids: selectedRowKeys as number[],
      operation: 'delete',
    });
  };

  // 批量同步
  const handleBatchSync = () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning('请先选择要同步的项');
      return;
    }
    batchRun({
      ids: selectedRowKeys as number[],
      operation: 'sync',
    });
  };

  const getLinkTypeTag = (type: string) => {
    const typeMap = {
      strm: { color: 'blue', text: 'STRM文件' },
      symlink: { color: 'green', text: '软链接' },
    };
    const config = typeMap[type as keyof typeof typeMap] || { color: 'default', text: type };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const formatFilterRules = (rules?: string) => {
    if (!rules) return '-';
    try {
      const parsed = JSON.parse(rules);
      if (Array.isArray(parsed)) {
        return (
          <Tooltip title={parsed.join(', ')}>
            <span>{parsed.length} 种文件类型</span>
          </Tooltip>
        );
      }
    } catch {
      return '格式错误';
    }
    return rules;
  };

  const columns: ProColumns<API.CloudPath>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
      hideInSearch: true,
    },
    {
      title: '云存储',
      dataIndex: ['cloud_storage', 'storage_name'],
      width: 150,
      render: (dom, entity) => {
        const storage = entity.cloud_storage;
        return (
          <a
            onClick={() => {
              setCurrentRow(entity);
              setShowDetail(true);
            }}
          >
            {storage ? (
              <div>
                <div>{storage.storage_name}</div>
                <Tag color="geekblue">{storage.storage_type}</Tag>
              </div>
            ) : (
              '未关联'
            )}
          </a>
        );
      },
      hideInSearch: true,
    },
    {
      title: '云盘源路径',
      dataIndex: 'source_path',
      width: 200,
      ellipsis: true,
      copyable: true,
    },
    {
      title: '本地路径',
      dataIndex: 'local_path',
      width: 200,
      ellipsis: true,
      copyable: true,
      render: (text) => text || '-',
    },
    {
      title: 'STRM内容前缀',
      dataIndex: 'content_prefix',
      width: 200,
      ellipsis: true,
      copyable: true,
      render: (text, record) => {
        if (record.link_type === 'strm') {
          return text || '-';
        }
        return '-';
      },
      hideInSearch: true,
    },
    {
      title: '链接类型',
      dataIndex: 'link_type',
      width: 120,
      render: (_, record) => getLinkTypeTag(record.link_type),
      valueEnum: {
        strm: { text: 'STRM文件' },
        symlink: { text: '软链接' },
      },
    },
    {
      title: 'STRM内容类型',
      dataIndex: 'strm_content_type',
      width: 120,
      render: (text, record) => {
        if (record.link_type === 'strm') {
          const typeMap = {
            path: { color: 'orange', text: 'Path' },
            openlist: { color: 'purple', text: 'Openlist' },
          };
          const config = typeMap[text as keyof typeof typeMap] || { color: 'default', text: text || '-' };
          return <Tag color={config.color}>{config.text}</Tag>;
        }
        return '-';
      },
      valueEnum: {
        path: { text: 'Path' },
        openlist: { text: 'Openlist' },
      },
    },
    {
      title: '文件过滤规则',
      dataIndex: 'filter_rules',
      width: 150,
      ellipsis: true,
      hideInSearch: true,
      render: (_, record) => formatFilterRules(record.filter_rules),
    },
    {
      title: '用户ID',
      dataIndex: 'user_id',
      width: 100,
      hideInSearch: true,
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
      title: '操作',
      dataIndex: 'option',
      width: 280,
      valueType: 'option',
      fixed: 'right',
      render: (_, record) => [
        <UpdateForm
          trigger={<a>编辑</a>}
          key="edit"
          onOk={actionRef.current?.reload}
          values={record}
        />,
        <Button
          key="sync"
          type="link"
          size="small"
          loading={syncLoading}
          onClick={() => syncRun(record.id)}
        >
          同步
        </Button>,
        <Popconfirm
          key="delete"
          title="确定删除这个云路径映射吗？"
          description="删除后将无法恢复，请谨慎操作。"
          onConfirm={() => delRun(record.id)}
          okText="确定"
          cancelText="取消"
          okButtonProps={{ danger: true }}
        >
          <a style={{ color: '#ff4d4f' }}>删除</a>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <PageContainer>
      {contextHolder}
      <StatisticsCards />
      <ProTable<API.CloudPath, API.CloudPathQueryParams>
        headerTitle="云路径映射管理"
        actionRef={actionRef}
        rowKey="id"
        search={{
          labelWidth: 120,
        }}
        scroll={{ x: 'max-content' }}
        toolBarRender={() => [
          <CreateForm key="create" reload={actionRef.current?.reload} />,
          selectedRowKeys.length > 0 && (
            <Space key="batch-actions">
              <Button
                type="default"
                loading={batchLoading}
                onClick={handleBatchSync}
              >
                批量同步 ({selectedRowKeys.length})
              </Button>
              <Popconfirm
                title="确定删除选中的路径映射吗？"
                description="删除后将无法恢复，请谨慎操作。"
                onConfirm={handleBatchDelete}
                okText="确定"
                cancelText="取消"
                okButtonProps={{ danger: true }}
              >
                <Button
                  danger
                  loading={batchLoading}
                >
                  批量删除 ({selectedRowKeys.length})
                </Button>
              </Popconfirm>
            </Space>
          ),
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        request={async (params, sort) => {
          // 处理排序参数
          const sortParams: any = {};
          if (sort && Object.keys(sort).length > 0) {
            const sortKey = Object.keys(sort)[0];
            const sortOrder = sort[sortKey] === 'ascend' ? 'asc' : 'desc';
            sortParams.order_by = sortKey;
            sortParams.order_dir = sortOrder;
          }

          const response = await getCloudPaths({
            ...params,
            ...sortParams,
            page: params.current,
            page_size: params.pageSize,
          });

          return {
            data: response.data.list || [],
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
          <ProDescriptions<API.CloudPath>
            column={2}
            title={`路径映射 #${currentRow?.id}`}
            request={async () => ({
              data: currentRow || {},
            })}
            params={{
              id: currentRow?.id,
            }}
            columns={columns as ProDescriptionsItemProps<API.CloudPath>[]}
          />
        )}
      </Drawer>
    </PageContainer>
  );
};

export default CloudPathList;
