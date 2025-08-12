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
import {
  Button,
  Drawer,
  message,
  Popconfirm,
  Space,
  Tooltip,
  Modal,
  Statistic,
  Card,
  Row,
  Col,
  Tag
} from 'antd';
import {
  DeleteOutlined,
  EyeOutlined,
  ClearOutlined,
  InfoCircleOutlined,
  FileTextOutlined,
  DatabaseOutlined,
  CalendarOutlined
} from '@ant-design/icons';
import React, { useRef, useState } from 'react';
import dayjs from 'dayjs';
import {
  getPickcodeCacheList,
  deletePickcodeCache,
  batchDeletePickcodeCache,
  clearAllPickcodeCache,
  getPickcodeCacheStats
} from '@/services/film-fusion';
import CreateForm from './components/CreateForm';
import UpdateForm from './components/UpdateForm';

const PickcodeCacheList: React.FC = () => {
  const actionRef = useRef<ActionType | null>(null);

  const [showDetail, setShowDetail] = useState<boolean>(false);
  const [currentRow, setCurrentRow] = useState<API.PickcodeCache>();
  const [selectedRows, setSelectedRows] = useState<API.PickcodeCache[]>([]);
  const [showCreateForm, setShowCreateForm] = useState<boolean>(false);
  const [showUpdateForm, setShowUpdateForm] = useState<boolean>(false);
  const [updateRow, setUpdateRow] = useState<API.PickcodeCache>();

  const [messageApi, contextHolder] = message.useMessage();

  // 获取统计信息
  const { data: statsData, refresh: refreshStats } = useRequest(getPickcodeCacheStats, {
    formatResult: (res: any) => res?.data || {}
  });

  // 删除单个缓存记录
  const { run: deleteRun, loading: deleteLoading } = useRequest(deletePickcodeCache, {
    manual: true,
    onSuccess: () => {
      actionRef.current?.reloadAndRest?.();
      refreshStats();
      messageApi.success('删除成功');
    },
    onError: (error) => {
      messageApi.error(`删除失败：${error.message}`);
    },
  });

  // 批量删除缓存记录
  const { run: batchDeleteRun, loading: batchDeleteLoading } = useRequest(batchDeletePickcodeCache, {
    manual: true,
    onSuccess: (result) => {
      actionRef.current?.reloadAndRest?.();
      setSelectedRows([]);
      refreshStats();
      messageApi.success(`批量删除成功，共删除 ${result?.deleted_count || 0} 条记录`);
    },
    onError: (error) => {
      messageApi.error(`批量删除失败：${error.message}`);
    },
  });

  // 清空所有缓存
  const { run: clearAllRun, loading: clearAllLoading } = useRequest(clearAllPickcodeCache, {
    manual: true,
    onSuccess: (result) => {
      actionRef.current?.reloadAndRest?.();
      setSelectedRows([]);
      refreshStats();
      messageApi.success(`清空成功，共删除 ${result?.deleted_count || 0} 条记录`);
    },
    onError: (error) => {
      messageApi.error(`清空失败：${error.message}`);
    },
  });

  // 处理批量删除
  const handleBatchDelete = () => {
    if (selectedRows.length === 0) {
      messageApi.warning('请选择要删除的记录');
      return;
    }

    Modal.confirm({
      title: '确认批量删除',
      content: `确定要删除选中的 ${selectedRows.length} 条缓存记录吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: () => {
        batchDeleteRun({ ids: selectedRows.map(row => row.id) });
      },
    });
  };

  // 处理清空所有缓存
  const handleClearAll = () => {
    Modal.confirm({
      title: '确认清空所有缓存',
      content: '此操作将删除所有 Pickcode 缓存记录，且不可恢复。确定继续吗？',
      okText: '确认',
      cancelText: '取消',
      okType: 'danger',
      onOk: () => {
        clearAllRun();
      },
    });
  };

  // 格式化文件大小
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '-';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };

  const columns: ProColumns<API.PickcodeCache>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
      sorter: true,
      hideInSearch: true,
    },
    {
      title: '文件路径',
      dataIndex: 'file_path',
      ellipsis: true,
      copyable: true,
      render: (text) => (
        <Tooltip title={text}>
          <div style={{ maxWidth: 300 }}>{text}</div>
        </Tooltip>
      ),
    },
    {
      title: 'Pickcode',
      dataIndex: 'pickcode',
      copyable: true,
      render: (text) => (
        <Tag color="blue">{text}</Tag>
      ),
      hideInSearch: true,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 180,
      valueType: 'dateTime',
      sorter: true,
      hideInSearch: true,
      render: (_, record) => dayjs(record.created_at).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 180,
      valueType: 'dateTime',
      sorter: true,
      hideInSearch: true,
      render: (_, record) => dayjs(record.updated_at).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      dataIndex: 'option',
      valueType: 'option',
      width: 120,
      fixed: 'right',
      render: (_, record) => [
        <Tooltip key="detail" title="查看详情">
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setCurrentRow(record);
              setShowDetail(true);
            }}
          />
        </Tooltip>,
        <Tooltip key="edit" title="编辑">
          <Button
            type="text"
            size="small"
            icon={<FileTextOutlined />}
            onClick={() => {
              setUpdateRow(record);
              setShowUpdateForm(true);
            }}
          />
        </Tooltip>,
        <Popconfirm
          key="delete"
          title="确定删除这条缓存记录吗？"
          onConfirm={() => deleteRun(record.id)}
          okText="确认"
          cancelText="取消"
        >
          <Tooltip title="删除">
            <Button
              type="text"
              size="small"
              danger
              loading={deleteLoading}
              icon={<DeleteOutlined />}
            />
          </Tooltip>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <PageContainer>
      {contextHolder}

      {/* 统计信息卡片 */}
      {statsData && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Card>
              <Statistic
                title="总缓存数量"
                value={statsData.total_count || 0}
                prefix={<DatabaseOutlined />}
              />
            </Card>
          </Col>
        </Row>
      )}

      <ProTable<API.PickcodeCache, API.PickcodeCacheQueryParams>
        headerTitle="Pickcode 缓存管理"
        actionRef={actionRef}
        rowKey="id"
        search={{
          labelWidth: 120,
        }}
        toolBarRender={() => [
          <Button
            type="primary"
            key="create"
            onClick={() => setShowCreateForm(true)}
          >
            新建缓存
          </Button>,
          <Button
            key="batchDelete"
            danger
            disabled={selectedRows.length === 0}
            loading={batchDeleteLoading}
            onClick={handleBatchDelete}
          >
            批量删除 ({selectedRows.length})
          </Button>,
          <Popconfirm
            key="clearAll"
            title="确认清空所有缓存吗？"
            description="此操作不可恢复，请谨慎操作！"
            onConfirm={handleClearAll}
            okText="确认"
            cancelText="取消"
            okType="danger"
          >
            <Button
              danger
              loading={clearAllLoading}
              icon={<ClearOutlined />}
            >
              清空所有缓存
            </Button>
          </Popconfirm>,
        ]}
        request={async (params) => {
          const { current, pageSize, ...searchParams } = params;
          const response = await getPickcodeCacheList({
            ...searchParams,
            page: current,
            size: pageSize,
          });

          return {
            data: response.data.list || [],
            success: response?.code === 0,
            total: response?.data?.total || 0,
          };
        }}
        columns={columns}
        rowSelection={{
          type: 'checkbox',
          onChange: (_, selectedRowsData) => {
            setSelectedRows(selectedRowsData);
          },
        }}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
          showQuickJumper: true,
        }}
        scroll={{ x: 1200 }}
      />

      {/* 详情抽屉 */}
      <Drawer
        width={600}
        open={showDetail}
        onClose={() => setShowDetail(false)}
        closable={false}
      >
        {currentRow?.id && (
          <ProDescriptions<API.PickcodeCache>
            column={1}
            title="缓存详情"
            request={async () => ({
              data: currentRow || {},
            })}
            params={{
              id: currentRow?.id,
            }}
            columns={columns as ProDescriptionsItemProps<API.PickcodeCache>[]}
          />
        )}
      </Drawer>

      {/* 创建表单 */}
      <CreateForm
        open={showCreateForm}
        onClose={() => setShowCreateForm(false)}
        onSuccess={() => {
          actionRef.current?.reload?.();
          refreshStats();
        }}
      />

      {/* 更新表单 */}
      <UpdateForm
        open={showUpdateForm}
        onClose={() => {
          setShowUpdateForm(false);
          setUpdateRow(undefined);
        }}
        onSuccess={() => {
          actionRef.current?.reload?.();
          refreshStats();
        }}
        values={updateRow}
      />
    </PageContainer>
  );
};

export default PickcodeCacheList;
