import {
  ClearOutlined,
  ClockCircleOutlined,
  CloudDownloadOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined,
  RedoOutlined,
  ReloadOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Grid,
  message,
  Popconfirm,
  Row,
  Segmented,
  Space,
  Statistic,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import {
  clearFailedDownloadQueueTasks,
  getDownloadQueueList,
  removeDownloadQueueTask,
  retryDownloadQueueTask,
} from '@/services/film-fusion';

const POLL_INTERVAL_MS = 5000;

const EMPTY_STATS: API.DownloadQueueStats = {
  total: 0,
  pending: 0,
  downloading: 0,
  failed: 0,
};

const STATUS_META: Record<
  API.DownloadQueueStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  downloading: {
    label: '下载中',
    color: 'processing',
    icon: <LoadingOutlined spin />,
  },
  pending: {
    label: '等待中',
    color: 'gold',
    icon: <ClockCircleOutlined />,
  },
  failed: {
    label: '失败',
    color: 'error',
    icon: <ExclamationCircleOutlined />,
  },
};

const splitPath = (path: string) => {
  const normalized = path.replace(/\\/g, '/');
  const separatorIndex = normalized.lastIndexOf('/');
  if (separatorIndex < 0) {
    return { name: path, directory: '' };
  }
  return {
    name: normalized.slice(separatorIndex + 1) || normalized,
    directory: normalized.slice(0, separatorIndex),
  };
};

type QueueOperation = { id: number; type: 'retry' | 'remove' };

type DownloadQueueColumnActions = {
  operatingTask?: QueueOperation;
  onRemove: (task: API.DownloadQueueTask) => void;
  onRetry: (task: API.DownloadQueueTask) => void;
};

const createColumns = ({
  operatingTask,
  onRemove,
  onRetry,
}: DownloadQueueColumnActions): ProColumns<API.DownloadQueueTask>[] => [
  {
    title: '状态',
    dataIndex: 'status',
    width: 100,
    valueType: 'select',
    valueEnum: {
      downloading: { text: '下载中' },
      pending: { text: '等待中' },
      failed: { text: '失败' },
    },
    render: (_, record) => {
      const meta = STATUS_META[record.status];
      return (
        <Tag color={meta.color} icon={meta.icon}>
          {meta.label}
        </Tag>
      );
    },
  },
  {
    title: '保存位置',
    dataIndex: 'save_path',
    hideInSearch: true,
    ellipsis: true,
    render: (_, record) => {
      const path = splitPath(record.save_path);
      return (
        <Tooltip title={record.save_path} placement="topLeft">
          <div style={{ minWidth: 280 }}>
            <Typography.Text strong>{path.name || '-'}</Typography.Text>
            <br />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {path.directory || '-'}
            </Typography.Text>
          </div>
        </Tooltip>
      );
    },
  },
  {
    title: '路径 / PickCode',
    dataIndex: 'search',
    hideInTable: true,
    fieldProps: {
      placeholder: '搜索保存路径或 PickCode',
    },
  },
  {
    title: '云存储',
    dataIndex: ['cloud_storage', 'storage_name'],
    width: 160,
    hideInSearch: true,
    render: (_, record) => (
      <Space direction="vertical" size={0}>
        <Typography.Text>
          {record.cloud_storage?.storage_name ||
            `存储 #${record.cloud_storage_id}`}
        </Typography.Text>
        {record.cloud_storage?.storage_type && (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {record.cloud_storage.storage_type}
          </Typography.Text>
        )}
      </Space>
    ),
  },
  {
    title: 'PickCode',
    dataIndex: 'pick_code',
    width: 170,
    hideInSearch: true,
    copyable: true,
    ellipsis: true,
  },
  {
    title: '重试',
    dataIndex: 'retry_count',
    width: 86,
    hideInSearch: true,
    align: 'center',
    render: (_, record) => (
      <Typography.Text
        type={
          record.retry_count >= record.max_retry_count ? 'danger' : undefined
        }
      >
        {record.retry_count} / {record.max_retry_count}
      </Typography.Text>
    ),
  },
  {
    title: '最后错误',
    dataIndex: 'last_error',
    width: 240,
    hideInSearch: true,
    ellipsis: true,
    render: (_, record) =>
      record.last_error ? (
        <Tooltip title={record.last_error} placement="topLeft">
          <Typography.Text type="danger">{record.last_error}</Typography.Text>
        </Tooltip>
      ) : (
        '-'
      ),
  },
  {
    title: '入队时间',
    dataIndex: 'created_at',
    width: 170,
    hideInSearch: true,
    render: (_, record) =>
      dayjs(record.created_at).format('YYYY-MM-DD HH:mm:ss'),
  },
  {
    title: '操作',
    valueType: 'option',
    width: 150,
    fixed: 'right',
    render: (_, record) => {
      if (record.status === 'downloading') {
        return <Typography.Text type="secondary">运行中</Typography.Text>;
      }

      const actions: React.ReactNode[] = [];
      if (record.status === 'failed') {
        actions.push(
          <Popconfirm
            key="retry"
            title="重新下载这个任务？"
            description="重试次数将清零，任务会重新进入等待队列。"
            okText="重新下载"
            cancelText="取消"
            onConfirm={() => onRetry(record)}
          >
            <Button
              type="link"
              size="small"
              icon={<RedoOutlined />}
              loading={
                operatingTask?.id === record.id &&
                operatingTask.type === 'retry'
              }
            >
              重试
            </Button>
          </Popconfirm>,
        );
      }
      actions.push(
        <Popconfirm
          key="remove"
          title="移出下载队列？"
          description="只移除队列记录，不会删除本地已经写入的文件。"
          okText="移除"
          okType="danger"
          cancelText="取消"
          onConfirm={() => onRemove(record)}
        >
          <Button
            danger
            type="link"
            size="small"
            icon={<DeleteOutlined />}
            loading={
              operatingTask?.id === record.id && operatingTask.type === 'remove'
            }
          >
            移除
          </Button>
        </Popconfirm>,
      );
      return actions;
    },
  },
];

const DownloadQueuePage: React.FC = () => {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const actionRef = useRef<ActionType | null>(null);
  const [stats, setStats] = useState<API.DownloadQueueStats>(EMPTY_STATS);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string>();
  const [createdAtOrder, setCreatedAtOrder] = useState<'asc' | 'desc'>('asc');
  const [operatingTask, setOperatingTask] = useState<QueueOperation>();
  const [clearingFailed, setClearingFailed] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const reloadQueue = () => actionRef.current?.reload?.();

  const handleRetry = async (task: API.DownloadQueueTask) => {
    setOperatingTask({ id: task.id, type: 'retry' });
    try {
      const response = await retryDownloadQueueTask(task.id);
      if (response.code !== 0) {
        messageApi.error(response.message || '重新下载失败');
        return;
      }
      messageApi.success('任务已重新加入等待队列');
      reloadQueue();
    } catch {
      // 请求层统一展示错误信息。
    } finally {
      setOperatingTask(undefined);
    }
  };

  const handleRemove = async (task: API.DownloadQueueTask) => {
    setOperatingTask({ id: task.id, type: 'remove' });
    try {
      const response = await removeDownloadQueueTask(task.id);
      if (response.code !== 0) {
        messageApi.error(response.message || '移除任务失败');
        return;
      }
      messageApi.success('任务已移出下载队列');
      reloadQueue();
    } catch {
      // 请求层统一展示错误信息。
    } finally {
      setOperatingTask(undefined);
    }
  };

  const handleClearFailed = async () => {
    setClearingFailed(true);
    try {
      const response = await clearFailedDownloadQueueTasks();
      if (response.code !== 0) {
        messageApi.error(response.message || '清理失败任务失败');
        return;
      }
      messageApi.success(`已清理 ${response.data.deleted_count} 个失败任务`);
      reloadQueue();
    } catch {
      // 请求层统一展示错误信息。
    } finally {
      setClearingFailed(false);
    }
  };

  const columns = createColumns({
    operatingTask,
    onRemove: handleRemove,
    onRetry: handleRetry,
  });

  useEffect(() => {
    const reloadWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        actionRef.current?.reload?.();
      }
    };

    const timer = window.setInterval(reloadWhenVisible, POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', reloadWhenVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', reloadWhenVisible);
    };
  }, []);

  return (
    <PageContainer header={{ title: '下载队列' }}>
      {contextHolder}
      <Alert
        showIcon
        type="info"
        style={{ marginBottom: 16 }}
        message="可重试失败任务，也可移除等待中或失败的任务；下载中的任务会在完成后自动出队，不能直接移除。"
        action={<Link to="/organize-logs">查看整理日志</Link>}
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} lg={6}>
          <Card size="small">
            <Statistic
              title="队列总数"
              value={stats.total}
              prefix={<UnorderedListOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card size="small">
            <Statistic
              title="下载中"
              value={stats.downloading}
              valueStyle={{ color: '#1677ff' }}
              prefix={<CloudDownloadOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card size="small">
            <Statistic
              title="等待中"
              value={stats.pending}
              valueStyle={{ color: '#d48806' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card size="small">
            <Statistic
              title="失败"
              value={stats.failed}
              valueStyle={{ color: '#cf1322' }}
              prefix={<ExclamationCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <ProTable<API.DownloadQueueTask, API.DownloadQueueQueryParams>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        params={{ created_at_order: createdAtOrder }}
        options={false}
        search={{ labelWidth: 110 }}
        toolBarRender={() => [
          <Space key="sort" size={8}>
            {!isMobile && (
              <Typography.Text type="secondary">入队时间</Typography.Text>
            )}
            <Segmented
              aria-label="入队时间排序"
              options={[
                { label: isMobile ? '最早' : '最早优先', value: 'asc' },
                { label: isMobile ? '最新' : '最新优先', value: 'desc' },
              ]}
              value={createdAtOrder}
              onChange={(value) => setCreatedAtOrder(value as 'asc' | 'desc')}
            />
          </Space>,
          ...(!isMobile
            ? [
                <Typography.Text key="updated" type="secondary">
                  每 5 秒自动刷新
                  {lastUpdatedAt ? ` · 更新于 ${lastUpdatedAt}` : ''}
                </Typography.Text>,
              ]
            : []),
          <Button
            key="refresh"
            aria-label="刷新下载队列"
            icon={<ReloadOutlined />}
            onClick={() => actionRef.current?.reload?.()}
          >
            {!isMobile && '刷新'}
          </Button>,
          <Popconfirm
            key="clearFailed"
            title="清理全部失败任务？"
            description="只移除失败任务的队列记录，不会删除本地文件。"
            okText="清理"
            okType="danger"
            cancelText="取消"
            disabled={stats.failed === 0}
            onConfirm={handleClearFailed}
          >
            <Button
              danger
              aria-label="清理失败任务"
              icon={<ClearOutlined />}
              disabled={stats.failed === 0}
              loading={clearingFailed}
            >
              {!isMobile && '清理失败任务'}
            </Button>
          </Popconfirm>,
        ]}
        request={async (params) => {
          const response = await getDownloadQueueList({
            ...params,
            created_at_order: params.created_at_order || 'asc',
          });
          if (response.code === 0 && response.data) {
            setStats(response.data.stats || EMPTY_STATS);
            setLastUpdatedAt(dayjs().format('HH:mm:ss'));
          }
          return {
            data: response.data?.list || [],
            total: response.data?.total || 0,
            success: response.code === 0,
          };
        }}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
          showQuickJumper: true,
        }}
        scroll={{ x: 1430 }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="当前没有等待、下载中或失败的任务"
            />
          ),
        }}
      />
    </PageContainer>
  );
};

export default DownloadQueuePage;
