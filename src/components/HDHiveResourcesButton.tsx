import { CloudDownloadOutlined, UnlockOutlined } from '@ant-design/icons';
import { Button, Modal, message, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React, { useMemo, useState } from 'react';
import {
  getEmbyMissingExternalLinks,
  queryHDHiveResources,
  unlockHDHiveResources,
} from '@/services/film-fusion';

type HDHiveResourcesButtonProps = {
  seriesId?: string;
  tmdbId?: string;
  mediaType?: 'movie' | 'tv' | string;
  title?: string;
  buttonText?: string;
};

type UnlockState = {
  slug: string;
  loading: boolean;
};

type UnlockResult = {
  slug: string;
  fullUrl: string;
  accessCode: string;
};

const { Text } = Typography;

const PAN_TYPE_COLOR: Record<string, string> = {
  '115': 'blue',
  '189': 'cyan',
  aliyun: 'orange',
  baidu: 'geekblue',
  quark: 'purple',
};

const TV_MEDIA_TYPES = new Set([
  'tv',
  'tvshow',
  'series',
  '电视剧',
  '剧集',
  '动漫',
  '动画',
  '动画番剧',
  '番剧',
]);

function extractTmdbId(tmdbUrl?: string): string {
  const value = (tmdbUrl || '').trim();
  const matched = value.match(/themoviedb\.org\/(?:tv|movie)\/(\d+)/i);
  if (matched?.[1]) return matched[1];
  const digits = value.match(/\d+/);
  return digits?.[0] || '';
}

function normalizeMediaType(mediaType?: string): 'movie' | 'tv' {
  const value = (mediaType || '').trim().toLowerCase();
  return TV_MEDIA_TYPES.has(value) ? 'tv' : 'movie';
}

function renderStringList(values?: string[]) {
  if (!values?.length) return '-';
  return (
    <Space size={[4, 4]} wrap>
      {values.map((value) => (
        <Tag key={value}>{value}</Tag>
      ))}
    </Space>
  );
}

function getPanTypeColor(value?: string | null) {
  const key = (value || '').trim().toLowerCase();
  return PAN_TYPE_COLOR[key] || 'default';
}

function renderPanType(value?: string | null) {
  const text = (value || '').trim();
  if (!text) return <Tag>未知</Tag>;
  return <Tag color={getPanTypeColor(text)}>{text}</Tag>;
}

function getShareUserName(user: any): string {
  if (!user || typeof user !== 'object') return '';
  return (
    user.nickname ||
    user.username ||
    user.name ||
    user.display_name ||
    user.displayName ||
    ''
  );
}

function getShareUserID(user: any): string {
  if (!user || typeof user !== 'object') return '';
  const id = user.id ?? user.user_id ?? user.userId;
  return id == null ? '' : String(id);
}

function renderShareUser(user: any) {
  const name = getShareUserName(user);
  const id = getShareUserID(user);
  if (!name && !id) return '-';
  return (
    <Space direction="vertical" size={0}>
      <Text>{name || `用户 ${id}`}</Text>
      {id && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          ID {id}
        </Text>
      )}
    </Space>
  );
}

const HDHiveResourcesButton: React.FC<HDHiveResourcesButtonProps> = ({
  seriesId,
  tmdbId,
  mediaType,
  title,
  buttonText = 'HDHive',
}) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resources, setResources] = useState<API.HDHiveResource[]>([]);
  const [currentTmdbId, setCurrentTmdbId] = useState('');
  const [currentMediaType, setCurrentMediaType] = useState<'movie' | 'tv'>(
    normalizeMediaType(mediaType),
  );
  const [unlocking, setUnlocking] = useState<UnlockState>();
  const [unlockResults, setUnlockResults] = useState<
    Record<string, UnlockResult>
  >({});
  const [messageApi, contextHolder] = message.useMessage();

  const resolveTarget = async () => {
    const directTmdbId = (tmdbId || '').trim();
    if (directTmdbId) {
      return {
        tmdbId: directTmdbId,
        mediaType: normalizeMediaType(mediaType),
      };
    }
    if (!seriesId) {
      return { tmdbId: '', mediaType: normalizeMediaType(mediaType) };
    }
    const linksRes = await getEmbyMissingExternalLinks(seriesId);
    if (linksRes.code !== 0) {
      messageApi.error(linksRes.message || '获取 TMDB ID 失败');
      return { tmdbId: '', mediaType: 'tv' as const };
    }
    return {
      tmdbId: extractTmdbId(linksRes.data?.tmdb),
      mediaType: 'tv' as const,
    };
  };

  const loadResources = async () => {
    setOpen(true);
    setLoading(true);
    setResources([]);
    setCurrentTmdbId('');
    try {
      const target = await resolveTarget();
      if (!target.tmdbId) {
        messageApi.warning('未找到 TMDB ID，无法查询 HDHive');
        return;
      }
      setCurrentTmdbId(target.tmdbId);
      setCurrentMediaType(target.mediaType);

      const res = await queryHDHiveResources(target.mediaType, target.tmdbId);
      if (res.code === 0 && res.data?.success) {
        setResources(res.data.data || []);
      } else {
        messageApi.error(
          res.message || res.data?.message || '查询 HDHive 资源失败',
        );
      }
    } catch (error: any) {
      messageApi.error(error?.message || '查询 HDHive 资源失败');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = async (record: API.HDHiveResource) => {
    setUnlocking({ slug: record.slug, loading: true });
    try {
      const res = await unlockHDHiveResources({ slug: record.slug });
      if (res.code !== 0 || !res.data?.success) {
        messageApi.error(
          res.message || res.data?.message || '解锁 HDHive 资源失败',
        );
        return;
      }
      const data = res.data.data as API.HDHiveUnlockResult;
      setUnlockResults((prev) => ({
        ...prev,
        [record.slug]: {
          slug: record.slug,
          fullUrl: data.full_url || data.url,
          accessCode: data.access_code,
        },
      }));
      setResources((prev) =>
        prev.map((item) =>
          item.slug === record.slug ? { ...item, is_unlocked: true } : item,
        ),
      );
      messageApi.success('解锁成功');
    } catch (error: any) {
      messageApi.error(error?.message || '解锁 HDHive 资源失败');
    } finally {
      setUnlocking(undefined);
    }
  };

  const columns = useMemo<ColumnsType<API.HDHiveResource>>(
    () => [
      {
        title: '标题',
        dataIndex: 'title',
        ellipsis: true,
        render: (value: string | null | undefined, record) => (
          <Space direction="vertical" size={2}>
            <Text strong>{value || record.slug}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.share_size || '-'}
            </Text>
          </Space>
        ),
      },
      {
        title: '网盘来源',
        dataIndex: 'pan_type',
        width: 110,
        render: (value: string | null | undefined) => renderPanType(value),
      },
      {
        title: '规格',
        width: 180,
        render: (_, record) =>
          renderStringList([
            ...(record.video_resolution || []),
            ...(record.source || []),
          ]),
      },
      {
        title: '字幕',
        width: 160,
        render: (_, record) =>
          renderStringList([
            ...(record.subtitle_language || []),
            ...(record.subtitle_type || []),
          ]),
      },
      {
        title: '分享人',
        dataIndex: 'user',
        width: 140,
        render: (value: any) => renderShareUser(value),
      },
      {
        title: '积分',
        dataIndex: 'unlock_points',
        width: 90,
        render: (value: number | null | undefined) =>
          value == null ? '-' : <Tag color="gold">{value}</Tag>,
      },
      {
        title: '状态',
        dataIndex: 'is_unlocked',
        width: 90,
        render: (value: boolean) => (
          <Tag color={value ? 'green' : 'default'}>
            {value ? '已解锁' : '未解锁'}
          </Tag>
        ),
      },
      {
        title: '操作',
        key: 'action',
        width: 180,
        render: (_, record) => {
          const result = unlockResults[record.slug];
          return (
            <Space size={0} wrap>
              <Button
                type="link"
                size="small"
                icon={<UnlockOutlined />}
                loading={unlocking?.slug === record.slug && unlocking.loading}
                onClick={() => handleUnlock(record)}
              >
                解锁
              </Button>
              {result?.fullUrl && (
                <Text
                  copyable={{ text: result.fullUrl }}
                  style={{ fontSize: 12 }}
                >
                  链接
                </Text>
              )}
            </Space>
          );
        },
      },
    ],
    [unlockResults, unlocking],
  );

  return (
    <>
      {contextHolder}
      <Button
        type="link"
        size="small"
        icon={<CloudDownloadOutlined />}
        onClick={loadResources}
      >
        {buttonText}
      </Button>
      <Modal
        title={`${title || 'HDHive 资源'}${currentTmdbId ? ` · TMDB ${currentTmdbId}` : ''}`}
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width={1120}
      >
        <Table<API.HDHiveResource>
          rowKey="slug"
          size="small"
          loading={loading}
          columns={columns}
          dataSource={resources}
          pagination={{ pageSize: 8, showSizeChanger: false }}
          locale={{
            emptyText: loading
              ? '查询中'
              : `暂无 HDHive ${currentMediaType === 'tv' ? '剧集' : '电影'}资源`,
          }}
        />
      </Modal>
    </>
  );
};

export default HDHiveResourcesButton;
