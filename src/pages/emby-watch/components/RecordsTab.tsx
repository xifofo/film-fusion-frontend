import { DeleteOutlined } from '@ant-design/icons';
import {
  Button,
  DatePicker,
  message,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useState } from 'react';
import {
  clearEmbyWatchRecords,
  deleteEmbyWatchRecord,
  getEmbyWatchRecords,
} from '@/services/film-fusion';
import { Poster } from './shared';

type RecordsTabProps = {
  embyUserId: string;
  seriesFilter?: { id: string; name?: string };
  onClearSeriesFilter?: () => void;
};

const { RangePicker } = DatePicker;

const titleOf = (r: API.EmbyWatchRecord) => {
  if (r.item_type === 'Episode') {
    const s = r.season_number ?? 0;
    const e = r.episode_number ?? 0;
    const code = `S${String(s).padStart(2, '0')}E${String(e).padStart(2, '0')}`;
    return (
      <Space size={6} wrap>
        <span style={{ fontWeight: 500 }}>{r.series_name || '-'}</span>
        <Tag>{code}</Tag>
        <span style={{ color: '#888' }}>{r.title}</span>
      </Space>
    );
  }
  return <span style={{ fontWeight: 500 }}>{r.title}</span>;
};

const RecordsTab: React.FC<RecordsTabProps> = ({
  embyUserId,
  seriesFilter,
  onClearSeriesFilter,
}) => {
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<API.EmbyWatchRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [itemType, setItemType] = useState<string>();
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [clearing, setClearing] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getEmbyWatchRecords({
        emby_user_id: embyUserId,
        item_type: itemType,
        series_id: seriesFilter?.id,
        start_date: range?.[0]?.format('YYYY-MM-DD'),
        end_date: range?.[1]?.format('YYYY-MM-DD'),
        page,
        page_size: pageSize,
      });
      if (res.code === 0) {
        setList(res.data?.list || []);
        setTotal(res.data?.total || 0);
      } else {
        messageApi.error(res.message || '获取记录失败');
      }
    } catch (error: any) {
      messageApi.error(error?.message || '获取记录失败');
    } finally {
      setLoading(false);
    }
  }, [
    embyUserId,
    itemType,
    seriesFilter?.id,
    range,
    page,
    pageSize,
    messageApi,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  // 切换 series 过滤时回到第一页
  useEffect(() => {
    setPage(1);
  }, [seriesFilter?.id]);

  const handleDelete = async (id: number) => {
    try {
      const res = await deleteEmbyWatchRecord(id, embyUserId);
      if (res.code === 0) {
        messageApi.success('已删除');
        load();
      } else {
        messageApi.error(res.message || '删除失败');
      }
    } catch (error: any) {
      messageApi.error(error?.message || '删除失败');
    }
  };

  const handleClear = async () => {
    setClearing(true);
    try {
      const res = await clearEmbyWatchRecords(embyUserId);
      if (res.code === 0) {
        messageApi.success(`已清空 ${res.data?.deleted ?? 0} 条记录`);
        setPage(1);
        load();
      } else {
        messageApi.error(res.message || '清空失败');
      }
    } catch (error: any) {
      messageApi.error(error?.message || '清空失败');
    } finally {
      setClearing(false);
    }
  };

  const columns: ColumnsType<API.EmbyWatchRecord> = [
    {
      title: '海报',
      dataIndex: 'item_id',
      width: 60,
      render: (v: string) => <Poster itemId={v} width={36} height={54} />,
    },
    {
      title: '观看日期',
      dataIndex: 'watched_at',
      width: 160,
      render: (v: string) => {
        const d = dayjs(v);
        return d.isValid() ? d.format('YYYY-MM-DD HH:mm') : v;
      },
    },
    {
      title: '类型',
      dataIndex: 'item_type',
      width: 80,
      render: (v: string) => (
        <Tag color={v === 'Movie' ? 'blue' : 'green'}>
          {v === 'Movie' ? '电影' : '剧集'}
        </Tag>
      ),
    },
    {
      title: '内容',
      key: 'title',
      render: (_, record) => titleOf(record),
    },
    {
      title: '时长',
      dataIndex: 'runtime_minutes',
      width: 80,
      render: (v: number) => (v ? `${v} 分` : '-'),
    },
    {
      title: '来源',
      dataIndex: 'source',
      width: 90,
      render: (v: string) =>
        v === 'backfill' ? <Tag>回填</Tag> : <Tag color="processing">实时</Tag>,
    },
    {
      title: '操作',
      key: 'option',
      width: 80,
      render: (_, record) => (
        <Popconfirm
          title="删除这条观看记录？"
          onConfirm={() => handleDelete(record.id)}
          okText="删除"
          okButtonProps={{ danger: true }}
          cancelText="取消"
        >
          <Button type="text" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <>
      {contextHolder}
      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          style={{ width: 140 }}
          placeholder="类型"
          allowClear
          value={itemType}
          onChange={(v) => {
            setItemType(v);
            setPage(1);
          }}
          options={[
            { label: '电影', value: 'Movie' },
            { label: '剧集', value: 'Episode' },
          ]}
        />
        <RangePicker
          value={range as any}
          onChange={(v) => {
            setRange(v as [Dayjs, Dayjs] | null);
            setPage(1);
          }}
        />
        {seriesFilter?.id && (
          <Tag
            color="purple"
            closable
            onClose={() => onClearSeriesFilter?.()}
            style={{ padding: '4px 8px' }}
          >
            剧集：{seriesFilter.name || seriesFilter.id}
          </Tag>
        )}
        <Popconfirm
          title="确定清空该用户的全部观看记录？此操作不可恢复"
          onConfirm={handleClear}
          okText="清空"
          okButtonProps={{ danger: true }}
          cancelText="取消"
          disabled={total === 0}
        >
          <Button danger disabled={total === 0} loading={clearing}>
            清空记录
          </Button>
        </Popconfirm>
      </Space>
      <Table<API.EmbyWatchRecord>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={list}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />
    </>
  );
};

export default RecordsTab;
