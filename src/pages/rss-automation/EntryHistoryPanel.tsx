import { EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Image,
  message,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  RSSAutomationEntryHistoryItem,
  RSSAutomationRunStatus,
  RSSAutomationSource,
} from '@/services/film-fusion';
import { listRSSAutomationEntries } from '@/services/film-fusion';

const { Link, Text } = Typography;

const runStatus: Record<
  RSSAutomationRunStatus,
  { label: string; color: string }
> = {
  pending: { label: '排队中', color: 'default' },
  running: { label: '执行中', color: 'processing' },
  succeeded: { label: '成功', color: 'success' },
  partial: { label: '部分成功', color: 'warning' },
  failed: { label: '失败', color: 'error' },
  cancelled: { label: '已取消', color: 'default' },
};

const formatTime = (value?: string) =>
  value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-';

const formatSize = (bytes?: unknown) => {
  const parsed = Number(bytes);
  if (!Number.isFinite(parsed) || parsed <= 0) return '';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let value = parsed;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(2)} ${units[unit]}`;
};

const entryFields = (raw: string) => {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
};

const notificationTag = (item: RSSAutomationEntryHistoryItem) => {
  switch (item.notification_status) {
    case 'sent':
      return <Tag color="success">已推送</Tag>;
    case 'partial':
      return (
        <Tooltip title={item.notification_error || '部分渠道投递失败'}>
          <Tag color="warning">部分成功</Tag>
        </Tooltip>
      );
    case 'failed':
      return (
        <Tooltip title={item.notification_error || '通知失败'}>
          <Tag color="error">推送失败</Tag>
        </Tooltip>
      );
    case 'skipped':
      return (
        <Tooltip title={item.notification_error || '没有匹配的投递渠道'}>
          <Tag>已跳过</Tag>
        </Tooltip>
      );
    default:
      return <Text type="secondary">-</Text>;
  }
};

type EntryHistoryPanelProps = {
  sources: RSSAutomationSource[];
  fixedSourceId?: number;
  onPreviewEntry?: (item: RSSAutomationEntryHistoryItem) => void;
};

const EntryHistoryPanel = ({
  sources,
  fixedSourceId,
  onPreviewEntry,
}: EntryHistoryPanelProps) => {
  const [items, setItems] = useState<RSSAutomationEntryHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<'all' | 'matched'>('all');
  const [selectedSourceId, setSelectedSourceId] = useState<number>();
  const [loading, setLoading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const pageSize = 30;
  const sourceId = fixedSourceId ?? selectedSourceId;

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const response = await listRSSAutomationEntries({
          filter,
          sourceId,
          limit: pageSize,
          offset: (page - 1) * pageSize,
        });
        if (response.code !== 0 || !response.data) {
          throw new Error(response.message || '获取 RSS 条目记录失败');
        }
        setItems(response.data.items);
        setTotal(response.data.total);
      } catch (error: any) {
        if (!silent) {
          messageApi.error(
            error?.data || error?.message || '获取 RSS 条目记录失败',
          );
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [filter, messageApi, page, sourceId],
  );

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const columns = useMemo<ColumnsType<RSSAutomationEntryHistoryItem>>(() => {
    const result: ColumnsType<RSSAutomationEntryHistoryItem> = [
      {
        title: 'RSS 条目',
        render: (_, item) => {
          const fields = entryFields(item.entry.fields_json);
          const meta = [
            String(fields.category || '').trim(),
            formatSize(fields.size_bytes),
          ].filter(Boolean);
          const media = [
            item.media_title,
            item.media_year ? `(${item.media_year})` : '',
            item.season_episode,
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <Space align="start" size={12}>
              {item.poster_url && (
                <Image
                  alt={item.media_title || item.entry.title || '媒体海报'}
                  fallback="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="
                  height={72}
                  preview={false}
                  src={item.poster_url}
                  style={{ borderRadius: 6, objectFit: 'cover' }}
                  width={48}
                />
              )}
              <Space orientation="vertical" size={2}>
                {item.entry.detail_url ? (
                  <Link
                    href={item.entry.detail_url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {item.entry.title || '未命名条目'}
                  </Link>
                ) : (
                  <Text>{item.entry.title || '未命名条目'}</Text>
                )}
                {meta.length > 0 && (
                  <Text type="secondary">{meta.join(' · ')}</Text>
                )}
                {media && (
                  <Tooltip title={item.recognition_error || media}>
                    <Text type={item.recognition_error ? 'warning' : 'success'}>
                      识别：{media}
                      {item.tmdb_id ? ` · TMDB ${item.tmdb_id}` : ''}
                    </Text>
                  </Tooltip>
                )}
              </Space>
            </Space>
          );
        },
      },
      {
        title: '来源',
        dataIndex: 'source_name',
        width: 150,
        render: (value, item) => (
          <Space orientation="vertical" size={0}>
            <Text>{value || `源 #${item.entry.source_id}`}</Text>
            {item.legacy && <Tag>旧版迁移</Tag>}
          </Space>
        ),
      },
      {
        title: '匹配',
        width: 120,
        render: (_, item) => {
          if (item.entry.baseline) return <Tag color="processing">基线</Tag>;
          if (!item.matched) return <Tag>未命中</Tag>;
          return (
            <Tooltip title={item.rule_name || '流程动作已执行'}>
              <Tag color="success">已命中</Tag>
            </Tooltip>
          );
        },
      },
      {
        title: '流程状态',
        width: 120,
        render: (_, item) => {
          if (!item.latest_run) return <Text type="secondary">-</Text>;
          const meta = runStatus[item.latest_run.status];
          return <Tag color={meta.color}>{meta.label}</Tag>;
        },
      },
      {
        title: '通知',
        width: 110,
        render: (_, item) => notificationTag(item),
      },
      {
        title: '发现时间',
        dataIndex: ['entry', 'discovered_at'],
        width: 172,
        render: formatTime,
      },
    ];
    if (onPreviewEntry) {
      result.push({
        title: '操作',
        fixed: 'right',
        width: 132,
        render: (_, item) => (
          <Button
            aria-label={`选择并预览 ${item.entry.title || `条目 ${item.entry.id}`}`}
            icon={<EyeOutlined />}
            onClick={() => onPreviewEntry(item)}
            type="primary"
          >
            选择并预览
          </Button>
        ),
      });
    }
    return result;
  }, [onPreviewEntry]);

  return (
    <>
      {contextHolder}
      <Card
        extra={
          <Space wrap>
            <Select
              aria-label="条目类型"
              onChange={(value) => {
                setPage(1);
                setFilter(value);
              }}
              options={[
                { label: '全部条目', value: 'all' },
                { label: '命中条目', value: 'matched' },
              ]}
              value={filter}
            />
            {fixedSourceId === undefined && (
              <Select
                allowClear
                aria-label="RSS 来源"
                onChange={(value) => {
                  setPage(1);
                  setSelectedSourceId(value);
                }}
                options={sources.map((source) => ({
                  label: source.name,
                  value: source.id,
                }))}
                placeholder="全部 RSS 源"
                style={{ minWidth: 180 }}
                value={selectedSourceId}
              />
            )}
            <Button icon={<ReloadOutlined />} onClick={() => void load()}>
              刷新
            </Button>
          </Space>
        }
        title={
          onPreviewEntry
            ? '选择 RSS 条目进行流程预览'
            : fixedSourceId === undefined
              ? 'RSS 条目记录'
              : `${
                  sources.find((source) => source.id === fixedSourceId)?.name ||
                  '当前自动化'
                } · RSS 条目记录`
        }
      >
        <Table
          columns={columns}
          dataSource={items}
          loading={loading}
          locale={{
            emptyText: filter === 'matched' ? '暂无命中条目' : '暂无 RSS 条目',
          }}
          pagination={{
            current: page,
            onChange: setPage,
            pageSize,
            showSizeChanger: false,
            total,
          }}
          rowKey={(item) => item.entry.id}
          scroll={{ x: onPreviewEntry ? 1180 : 1050 }}
        />
      </Card>
    </>
  );
};

export default EntryHistoryPanel;
