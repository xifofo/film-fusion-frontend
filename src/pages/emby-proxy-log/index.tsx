import {
  clearEmbyProxy302Logs,
  getEmbyProxy302Logs,
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
  Modal,
  Popover,
  Space,
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
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getEmbyProxy302Logs();
      if (res?.code === 0 && res.data) {
        setData(res.data);
      }
    } catch (e) {
      // 静默失败，避免轮询时刷屏
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始拉取 + 自动刷新
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (!autoRefresh) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    const tick = async () => {
      await fetchLogs();
      timerRef.current = setTimeout(tick, POLL_INTERVAL_MS);
    };
    timerRef.current = setTimeout(tick, POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [autoRefresh, fetchLogs]);

  const handleClear = () => {
    Modal.confirm({
      title: '确认清空 302 日志缓冲？',
      content: '该操作仅清空内存缓冲，不影响 Emby 代理运行。',
      okType: 'danger',
      onOk: async () => {
        try {
          await clearEmbyProxy302Logs();
          message.success('已清空');
          fetchLogs();
        } catch (e: any) {
          message.error(`清空失败: ${e?.message || e}`);
        }
      },
    });
  };

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
              onClick={fetchLogs}
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
