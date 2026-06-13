import {
  clearEmbyProxy302Logs,
  getEmbyProxyBalanceStatus,
  getEmbyProxy302Logs,
  retryMatch302Assignment,
} from '@/services/film-fusion';
import {
  DeleteOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import {
  Alert,
  Button,
  Card,
  Col,
  Modal,
  Popover,
  Row,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useRef, useState } from 'react';

const { Text, Paragraph } = Typography;

const POLL_INTERVAL_MS = 3000;

/** 来源标签样式映射 */
const sourceTag = (source: string) => {
  if (source === 'cache') return <Tag color="blue">缓存命中</Tag>;
  if (source === 'proxyPlay') return <Tag color="green">实时计算</Tag>;
  if (source === 'fallback') return <Tag color="red">未走302</Tag>;
  return <Tag>{source}</Tag>;
};

const statusTag = (status?: string) => {
  const colorMap: Record<string, string> = {
    源账号播放: 'green',
    子账号播放: 'blue',
    秒传中: 'processing',
    等待秒传: 'gold',
    失败回退: 'red',
    未启用负载均衡: 'default',
    pending: 'gold',
    transferring: 'processing',
    ready: 'green',
    failed: 'red',
  };
  if (!status) return <Tag>-</Tag>;
  return <Tag color={colorMap[status] || 'default'}>{status}</Tag>;
};

const accountTypeTag = (type?: string) => {
  if (type === 'source') return <Tag color="green">源账号</Tag>;
  if (type === 'member') return <Tag color="blue">子账号</Tag>;
  return <Tag>{type || '-'}</Tag>;
};

const maxActiveText = (value?: number) => value && value > 0 ? `${value}` : '不限';
const gbText = (value?: number) => {
  if (!value || value <= 0) return '0';
  if (value < 0.01) return '< 0.01';
  return value.toFixed(2);
};

/** 单元格中显示超长 URL —— 截断 + 悬浮查看完整 + 复制 */
const LongText: React.FC<{ value: string; maxWidth?: number }> = ({
  value,
  maxWidth = 360,
}) => {
  if (!value) return <Text type="secondary">-</Text>;
  return (
    <Popover
      placement="topLeft"
      title="完整内容"
      content={
        <div style={{ maxWidth: 600, wordBreak: 'break-all' }}>
          <Paragraph
            copyable={{ text: value }}
            style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}
          >
            {value}
          </Paragraph>
        </div>
      }
    >
      <div
        style={{
          maxWidth,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          cursor: 'pointer',
        }}
      >
        {value}
      </div>
    </Popover>
  );
};

const EmbyProxyLogPage: React.FC = () => {
  const [data, setData] = useState<API.EmbyProxy302LogList | null>(null);
  const [balanceStatus, setBalanceStatus] = useState<API.EmbyProxyBalanceStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [logsRes, statusRes] = await Promise.all([
        getEmbyProxy302Logs(),
        getEmbyProxyBalanceStatus(),
      ]);
      if (logsRes?.code === 0 && logsRes.data) {
        setData(logsRes.data);
      }
      if (statusRes?.code === 0 && statusRes.data) {
        setBalanceStatus(statusRes.data);
      }
    } catch (_e) {
      // 静默失败，避免轮询时刷屏
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始拉取 + 自动刷新
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!autoRefresh) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    const tick = async () => {
      await fetchData();
      timerRef.current = setTimeout(tick, POLL_INTERVAL_MS);
    };
    timerRef.current = setTimeout(tick, POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [autoRefresh, fetchData]);

  const handleClear = () => {
    Modal.confirm({
      title: '确认清空 302 日志缓冲？',
      content: '该操作仅清空内存缓冲，不影响 Emby 代理运行。',
      okType: 'danger',
      onOk: async () => {
        try {
          await clearEmbyProxy302Logs();
          message.success('已清空');
          fetchData();
        } catch (e: any) {
          message.error(`清空失败: ${e?.message || e}`);
        }
      },
    });
  };

  const handleRetry = async (record: API.BalanceTransferQueueItem) => {
    try {
      await retryMatch302Assignment(record.match302_id, record.id);
      message.success('已提交重试');
      fetchData();
    } catch (e: any) {
      message.error(`重试失败: ${e?.message || e}`);
    }
  };

  const activeColumns: ColumnsType<API.BalanceActivePlayback> = [
    {
      title: '状态',
      dataIndex: 'status',
      width: 180,
      render: (status: string, record) => (
        <Space size={4}>
          <Tag color={record.state === 'active' ? 'green' : 'default'}>
            {record.state}
          </Tag>
          {statusTag(status)}
        </Space>
      ),
    },
    {
      title: '媒体路径',
      dataIndex: 'media_path',
      render: (value: string) => <LongText value={value} maxWidth={360} />,
    },
    {
      title: '分配 / 实际账号',
      width: 260,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text>{record.assigned_storage_name || '-'}</Text>
          <Text type="secondary">{record.actual_storage_name || '-'}</Text>
        </Space>
      ),
    },
    {
      title: '账号类型',
      dataIndex: 'account_type',
      width: 100,
      render: (type: string) => accountTypeTag(type),
    },
    {
      title: '客户端',
      dataIndex: 'remote_ip',
      width: 130,
      render: (ip: string) => <Text style={{ fontFamily: 'monospace' }}>{ip || '-'}</Text>,
    },
    {
      title: '最近请求',
      dataIndex: 'last_request_at',
      width: 170,
      render: (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '回退原因',
      dataIndex: 'fallback_reason',
      render: (reason: string) => <LongText value={reason} maxWidth={220} />,
    },
  ];

  const loadColumns: ColumnsType<API.BalanceAccountLoad> = [
    {
      title: '账号',
      dataIndex: 'storage_name',
      render: (name: string, record) => (
        <Space>
          {accountTypeTag(record.account_type)}
          <Text>{name || `ID: ${record.storage_id}`}</Text>
        </Space>
      ),
    },
    {
      title: 'Match302',
      dataIndex: 'match302_id',
      width: 100,
    },
    {
      title: 'active',
      dataIndex: 'active_playbacks',
      width: 110,
      render: (active: number, record) => {
        const reached = !!record.max_active && active >= record.max_active;
        return (
          <Tag color={reached ? 'red' : 'default'}>
            {active} / {maxActiveText(record.max_active)}
          </Tag>
        );
      },
    },
    {
      title: '缓存',
      width: 130,
      render: (_, record) => (
        <Tag>
          {gbText(record.cache_used_gb)} / {maxActiveText(record.cache_max_gb)} GB
        </Tag>
      ),
    },
    {
      title: '分配数',
      width: 260,
      render: (_, record) => (
        <Space size={4} wrap>
          <Tag>总 {record.total_assignments}</Tag>
          <Tag color="green">ready {record.ready_count}</Tag>
          <Tag color="gold">pending {record.pending_count}</Tag>
          <Tag color="processing">transferring {record.transferring_count}</Tag>
          <Tag color="red">failed {record.failed_count}</Tag>
        </Space>
      ),
    },
    {
      title: '冷却 / 错误',
      render: (_, record) => {
        if (record.cooldown_until && dayjs(record.cooldown_until).isAfter(dayjs())) {
          return <Text type="warning">冷却至 {dayjs(record.cooldown_until).format('HH:mm:ss')}</Text>;
        }
        return <LongText value={record.last_error || ''} maxWidth={260} />;
      },
    },
  ];

  const queueColumns: ColumnsType<API.BalanceTransferQueueItem> = [
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (status: string) => statusTag(status),
    },
    {
      title: '媒体路径',
      dataIndex: 'media_path',
      render: (value: string) => <LongText value={value} maxWidth={360} />,
    },
    {
      title: '源 / 目标账号',
      width: 240,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text>{record.source_storage_name || `ID: ${record.source_storage_id}`}</Text>
          <Text type="secondary">{record.target_storage_name || `ID: ${record.target_storage_id}`}</Text>
        </Space>
      ),
    },
    {
      title: '尝试',
      dataIndex: 'attempts',
      width: 80,
    },
    {
      title: '错误',
      dataIndex: 'last_error',
      render: (value: string) => <LongText value={value} maxWidth={260} />,
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 170,
      render: (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      width: 90,
      render: (_, record) => (
        <Button type="link" size="small" onClick={() => handleRetry(record)}>
          重试
        </Button>
      ),
    },
  ];

  const columns: ColumnsType<API.EmbyProxy302LogEntry> = [
    {
      title: '时间',
      dataIndex: 'timestamp',
      width: 170,
      render: (t: string) => (
        <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>
          {dayjs(t).format('YYYY-MM-DD HH:mm:ss.SSS')}
        </Text>
      ),
    },
    {
      title: '来源',
      dataIndex: 'source',
      width: 110,
      render: (s: string) => sourceTag(s),
      filters: [
        { text: '缓存命中', value: 'cache' },
        { text: '实时计算', value: 'proxyPlay' },
        { text: '未走302', value: 'fallback' },
      ],
      onFilter: (val, record) => record.source === val,
    },
    {
      title: '方法',
      dataIndex: 'method',
      width: 70,
      render: (m: string) => <Tag color="geekblue">{m}</Tag>,
    },
    {
      title: '客户端',
      dataIndex: 'remote_ip',
      width: 130,
      render: (ip: string) => (
        <Text style={{ fontFamily: 'monospace' }}>{ip || '-'}</Text>
      ),
    },
    {
      title: 'User-Agent',
      dataIndex: 'user_agent',
      width: 220,
      render: (ua: string) => <LongText value={ua} maxWidth={200} />,
    },
    {
      title: '请求 URI',
      dataIndex: 'uri',
      render: (uri: string) => <LongText value={uri} maxWidth={420} />,
    },
    {
      title: '负载状态',
      dataIndex: 'balance_status',
      width: 130,
      render: (status: string) => statusTag(status),
    },
    {
      title: '实际账号',
      dataIndex: 'actual_storage_name',
      width: 160,
      render: (name: string, record) => (
        <Space direction="vertical" size={0}>
          <Text>{name || '-'}</Text>
          {accountTypeTag(record.account_type)}
        </Space>
      ),
    },
    {
      title: '重定向目标 / 原因',
      dataIndex: 'target',
      render: (t: string, record) => {
        if (record.source === 'fallback') {
          return <Text type="warning">{t || '-'}</Text>;
        }
        return <LongText value={t} maxWidth={420} />;
      },
    },
  ];

  return (
    <PageContainer
      header={{
        title: 'Emby 代理 302 日志',
        subTitle: '内存环形缓冲，进程重启会丢失',
      }}
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={
          <Space size="middle" wrap>
            <span>
              当前条数：
              <b>{data?.count ?? 0}</b> / 容量 <b>{data?.capacity ?? 500}</b>
            </span>
            <span>
              <ThunderboltOutlined /> 用于排查 Emby 播放是否走到 302 直链：
              <Tag color="green" style={{ marginLeft: 4 }}>实时计算</Tag>
              <Tag color="blue">缓存命中</Tag>
              表示走了 302；
              <Tag color="red">未走302</Tag>
              表示该是视频播放请求但落到了默认反代。
            </span>
          </Space>
        }
      />
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card bordered={false}>
            <Statistic
              title="当前 active"
              value={balanceStatus?.active_playbacks?.filter((item) => item.state === 'active').length || 0}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card bordered={false}>
            <Statistic title="秒传中" value={balanceStatus?.transfer_summary?.transferring || 0} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card bordered={false}>
            <Statistic title="缓存资源" value={balanceStatus?.cleanup_summary?.cache_count || 0} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card bordered={false}>
            <Statistic title="回退事件" value={balanceStatus?.recent_fallbacks?.length || 0} />
          </Card>
        </Col>
      </Row>

      <Card bordered={false} title="当前播放" style={{ marginBottom: 16 }}>
        <Table
          rowKey="key"
          size="small"
          loading={loading && !balanceStatus}
          columns={activeColumns}
          dataSource={balanceStatus?.active_playbacks || []}
          pagination={false}
          scroll={{ x: 1200 }}
        />
      </Card>

      <Card bordered={false} title="账号负载" style={{ marginBottom: 16 }}>
        <Table
          rowKey={(record) => `${record.match302_id}-${record.storage_id}`}
          size="small"
          loading={loading && !balanceStatus}
          columns={loadColumns}
          dataSource={balanceStatus?.account_loads || []}
          pagination={false}
          scroll={{ x: 1000 }}
        />
      </Card>

      <Card bordered={false} title="秒传队列" style={{ marginBottom: 16 }}>
        <Table
          rowKey="id"
          size="small"
          loading={loading && !balanceStatus}
          columns={queueColumns}
          dataSource={balanceStatus?.transfer_summary?.queue || []}
          pagination={{ pageSize: 5 }}
          scroll={{ x: 1200 }}
        />
      </Card>

      <Card
        bordered={false}
        title={
          <Space>
            <span>302 重定向记录</span>
          </Space>
        }
        extra={
          <Space>
            <span style={{ color: '#888' }}>自动刷新</span>
            <Switch
              checked={autoRefresh}
              onChange={setAutoRefresh}
              checkedChildren="开"
              unCheckedChildren="关"
            />
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchData}
              loading={loading}
            >
              刷新
            </Button>
            <Button danger icon={<DeleteOutlined />} onClick={handleClear}>
              清空
            </Button>
          </Space>
        }
      >
        <Table
          rowKey="id"
          size="small"
          loading={loading && !data}
          columns={columns}
          dataSource={data?.entries || []}
          pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: [20, 50, 100, 200],
            showTotal: (total) => `共 ${total} 条`,
          }}
          scroll={{ x: 1400 }}
        />
      </Card>
    </PageContainer>
  );
};

export default EmbyProxyLogPage;
