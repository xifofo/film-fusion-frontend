import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { useRequest } from '@umijs/max';
import {
  Button,
  Card,
  Col,
  Drawer,
  Descriptions,
  Modal,
  Row,
  Statistic,
  Tag,
  Tooltip,
  message,
} from 'antd';
import {
  ClearOutlined,
  EyeOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons';
import React, { useRef, useState } from 'react';
import dayjs from 'dayjs';
import {
  clearOrganizeLogs,
  getOrganizeLogList,
  getOrganizeLogStats,
} from '@/services/film-fusion';

const ACTION_OPTIONS: Record<string, { text: string; color?: string }> = {
  strm_create: { text: 'STRM 创建', color: 'blue' },
  strm_delete: { text: 'STRM 删除', color: 'magenta' },
  strm_rename: { text: 'STRM 重命名', color: 'purple' },
  file_download: { text: '文件下载', color: 'cyan' },
  walk_dir: { text: '目录扫描', color: 'default' },
  webhook_received: { text: 'Webhook 接收', color: 'gold' },
};

const STATUS_OPTIONS: Record<string, { text: string; color: string; icon: React.ReactNode }> = {
  success: { text: '成功', color: 'success', icon: <CheckCircleOutlined /> },
  skipped: { text: '跳过', color: 'default', icon: <MinusCircleOutlined /> },
  failed: { text: '失败', color: 'error', icon: <CloseCircleOutlined /> },
};

const formatSize = (bytes?: number) => {
  if (!bytes || bytes <= 0) return '-';
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
};

const formatDuration = (ms?: number) => {
  if (!ms || ms <= 0) return '-';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
};

const OrganizeLogList: React.FC = () => {
  const actionRef = useRef<ActionType | null>(null);
  const [detail, setDetail] = useState<API.OrganizeLog | undefined>();
  const [messageApi, contextHolder] = message.useMessage();

  const { data: stats, refresh: refreshStats } = useRequest(getOrganizeLogStats, {
    formatResult: (res: any) => res?.data || {},
  });

  // 从 breakdown 中算出汇总指标
  const counts = (() => {
    const acc = { success: 0, skipped: 0, failed: 0 };
    (stats?.breakdown || []).forEach((row: any) => {
      if (row.status in acc) acc[row.status as keyof typeof acc] += row.count;
    });
    return acc;
  })();

  const { run: clearRun, loading: clearLoading } = useRequest(clearOrganizeLogs, {
    manual: true,
    onSuccess: (res: any) => {
      messageApi.success(`清理成功，共删除 ${res?.deleted_count || 0} 条`);
      actionRef.current?.reloadAndRest?.();
      refreshStats();
    },
    onError: (err) => messageApi.error(`清理失败：${err.message}`),
  });

  const handleClearSuccess = () => {
    Modal.confirm({
      title: '清理所有成功记录？',
      content: '将删除全部 status=success 的整理日志（保留 skipped 与 failed）。',
      okText: '清理',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => clearRun({ status: 'success' }),
    });
  };

  const handleClearOld = () => {
    Modal.confirm({
      title: '清理 30 天前的记录？',
      content: '删除 30 天前的所有整理日志（含 failed）。',
      okText: '清理',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => clearRun({ before_days: 30 }),
    });
  };

  const columns: ProColumns<API.OrganizeLog>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
      hideInSearch: true,
    },
    {
      title: '动作',
      dataIndex: 'action',
      width: 120,
      valueType: 'select',
      valueEnum: Object.fromEntries(
        Object.entries(ACTION_OPTIONS).map(([k, v]) => [k, { text: v.text }]),
      ),
      render: (_, record) => {
        const opt = ACTION_OPTIONS[record.action];
        return <Tag color={opt?.color || 'default'}>{opt?.text || record.action}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: Object.fromEntries(
        Object.entries(STATUS_OPTIONS).map(([k, v]) => [k, { text: v.text, status: v.color }]),
      ),
      render: (_, record) => {
        const opt = STATUS_OPTIONS[record.status];
        return (
          <Tag icon={opt?.icon} color={opt?.color || 'default'}>
            {opt?.text || record.status}
          </Tag>
        );
      },
    },
    {
      title: '触发',
      dataIndex: 'trigger',
      width: 130,
      hideInSearch: true,
      render: (text) => text || '-',
    },
    {
      title: '源路径',
      dataIndex: 'source',
      ellipsis: true,
      copyable: true,
      hideInSearch: true,
      render: (text) => (
        <Tooltip title={text}>
          <div style={{ maxWidth: 320 }}>{text || '-'}</div>
        </Tooltip>
      ),
    },
    {
      title: '目标路径',
      dataIndex: 'target',
      ellipsis: true,
      copyable: true,
      hideInSearch: true,
      render: (text) => (
        <Tooltip title={text}>
          <div style={{ maxWidth: 320 }}>{text || '-'}</div>
        </Tooltip>
      ),
    },
    {
      title: '路径/PickCode 搜索',
      dataIndex: 'search',
      hideInTable: true,
    },
    {
      title: '说明',
      dataIndex: 'message',
      ellipsis: true,
      hideInSearch: true,
      render: (text, record) => {
        if (record.status === 'failed' && record.error) {
          return (
            <Tooltip title={record.error}>
              <span style={{ color: '#cf1322' }}>{record.error}</span>
            </Tooltip>
          );
        }
        return (
          <Tooltip title={text as string}>
            <div style={{ maxWidth: 260 }}>{(text as string) || '-'}</div>
          </Tooltip>
        );
      },
    },
    {
      title: '大小',
      dataIndex: 'size_bytes',
      width: 90,
      hideInSearch: true,
      render: (_, r) => formatSize(r.size_bytes),
    },
    {
      title: '耗时',
      dataIndex: 'duration_ms',
      width: 80,
      hideInSearch: true,
      render: (_, r) => formatDuration(r.duration_ms),
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      width: 170,
      valueType: 'dateTimeRange',
      hideInTable: false,
      sorter: false,
      render: (_, record) => dayjs(record.created_at).format('YYYY-MM-DD HH:mm:ss'),
      search: {
        transform: (value: any) => {
          if (!value || value.length !== 2) return {};
          return {
            start: dayjs(value[0]).toISOString(),
            end: dayjs(value[1]).toISOString(),
          };
        },
      },
    },
    {
      title: '操作',
      valueType: 'option',
      width: 80,
      fixed: 'right',
      render: (_, record) => [
        <Tooltip key="detail" title="详情">
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setDetail(record)}
          />
        </Tooltip>,
      ],
    },
  ];

  return (
    <PageContainer>
      {contextHolder}

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="总记录数" value={stats?.total || 0} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="成功" value={counts.success} valueStyle={{ color: '#3f8600' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="跳过" value={counts.skipped} valueStyle={{ color: '#8c8c8c' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="失败" value={counts.failed} valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
      </Row>

      <ProTable<API.OrganizeLog, API.OrganizeLogQueryParams>
        headerTitle="整理日志"
        actionRef={actionRef}
        rowKey="id"
        search={{ labelWidth: 100 }}
        toolBarRender={() => [
          <Button
            key="refresh"
            icon={<ReloadOutlined />}
            onClick={() => {
              actionRef.current?.reload?.();
              refreshStats();
            }}
          >
            刷新
          </Button>,
          <Button key="clearOld" loading={clearLoading} onClick={handleClearOld}>
            清理 30 天前
          </Button>,
          <Button
            key="clearSuccess"
            danger
            icon={<ClearOutlined />}
            loading={clearLoading}
            onClick={handleClearSuccess}
          >
            清理成功记录
          </Button>,
        ]}
        request={async (params) => {
          const { current, pageSize, ...rest } = params as any;
          const res = await getOrganizeLogList({
            ...rest,
            page: current,
            size: pageSize,
          });
          return {
            data: res?.data?.list || [],
            success: res?.code === 0,
            total: res?.data?.total || 0,
          };
        }}
        columns={columns}
        pagination={{ defaultPageSize: 20, showSizeChanger: true, showQuickJumper: true }}
        scroll={{ x: 1400 }}
      />

      <Drawer
        title={`整理日志 #${detail?.id ?? ''}`}
        width={640}
        open={!!detail}
        onClose={() => setDetail(undefined)}
      >
        {detail && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="ID">{detail.id}</Descriptions.Item>
            <Descriptions.Item label="动作">
              {ACTION_OPTIONS[detail.action]?.text || detail.action}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={STATUS_OPTIONS[detail.status]?.color}>
                {STATUS_OPTIONS[detail.status]?.text || detail.status}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="触发">{detail.trigger || '-'}</Descriptions.Item>
            <Descriptions.Item label="源路径">
              <span style={{ wordBreak: 'break-all' }}>{detail.source || '-'}</span>
            </Descriptions.Item>
            <Descriptions.Item label="目标路径">
              <span style={{ wordBreak: 'break-all' }}>{detail.target || '-'}</span>
            </Descriptions.Item>
            <Descriptions.Item label="CloudPath ID">{detail.cloud_path_id || '-'}</Descriptions.Item>
            <Descriptions.Item label="CloudStorage">
              {detail.cloud_storage
                ? `${detail.cloud_storage.storage_name} (${detail.cloud_storage.storage_type})`
                : detail.cloud_storage_id || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="PickCode">{detail.pick_code || '-'}</Descriptions.Item>
            <Descriptions.Item label="说明">
              <span style={{ wordBreak: 'break-all' }}>{detail.message || '-'}</span>
            </Descriptions.Item>
            <Descriptions.Item label="错误">
              <span style={{ wordBreak: 'break-all', color: detail.error ? '#cf1322' : undefined }}>
                {detail.error || '-'}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="耗时">{formatDuration(detail.duration_ms)}</Descriptions.Item>
            <Descriptions.Item label="大小">{formatSize(detail.size_bytes)}</Descriptions.Item>
            <Descriptions.Item label="时间">
              {dayjs(detail.created_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </PageContainer>
  );
};

export default OrganizeLogList;
