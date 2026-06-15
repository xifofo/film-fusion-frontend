import {
  Empty,
  message,
  Pagination,
  Segmented,
  Select,
  Space,
  Spin,
} from 'antd';
import React, { useCallback, useEffect, useState } from 'react';
import { getEmbyWatchGallery } from '@/services/film-fusion';
import { Poster } from './shared';

type GalleryTabProps = {
  embyUserId: string;
};

const PAGE_SIZE = 24;

const GalleryTab: React.FC<GalleryTabProps> = ({ embyUserId }) => {
  const [itemType, setItemType] = useState<'Movie' | 'Episode'>('Movie');
  const [year, setYear] = useState<number>(0);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<API.EmbyWatchGalleryResult>();
  const [loading, setLoading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getEmbyWatchGallery({
        emby_user_id: embyUserId,
        item_type: itemType,
        year: year || undefined,
        page,
        page_size: PAGE_SIZE,
      });
      if (res.code === 0) {
        setData(res.data);
      } else {
        messageApi.error(res.message || '获取影库失败');
      }
    } catch (error: any) {
      messageApi.error(error?.message || '获取影库失败');
    } finally {
      setLoading(false);
    }
  }, [embyUserId, itemType, year, page, messageApi]);

  useEffect(() => {
    load();
  }, [load]);

  const openEmby = (url?: string) => {
    if (!url) {
      messageApi.info('未配置可访问的 Emby 地址');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const yearOptions = [
    { label: '全部年份', value: 0 },
    ...(data?.years || []).map((y) => ({ label: `${y} 年`, value: y })),
  ];

  const list = data?.list || [];
  const isEpisode = itemType === 'Episode';

  return (
    <Spin spinning={loading}>
      {contextHolder}
      <style>{`
        .ff-poster-card .ff-poster-thumb {
          position: relative;
          overflow: hidden;
          border-radius: 10px;
          box-shadow: 0 1px 4px rgba(0,0,0,.12);
        }
        .ff-poster-card .ff-poster-img {
          transition: transform .22s ease;
        }
        .ff-poster-card:hover .ff-poster-img {
          transform: scale(1.08);
        }
        .ff-poster-card:hover .ff-poster-title { color: #1677ff; }
      `}</style>

      <Space style={{ marginBottom: 16 }} wrap>
        <Segmented
          value={itemType}
          onChange={(v) => {
            setItemType(v as 'Movie' | 'Episode');
            setPage(1);
          }}
          options={[
            { label: '电影', value: 'Movie' },
            { label: '剧集', value: 'Episode' },
          ]}
        />
        <Select
          style={{ width: 140 }}
          value={year}
          onChange={(v) => {
            setYear(v);
            setPage(1);
          }}
          options={yearOptions}
        />
        {data ? (
          <span style={{ color: '#888' }}>
            共 {data.total} {isEpisode ? '部剧集' : '部电影'}
          </span>
        ) : null}
      </Space>

      {list.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={isEpisode ? '暂无剧集观看记录' : '暂无电影观看记录'}
          style={{ padding: '48px 0' }}
        />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: 18,
          }}
        >
          {list.map((card) => (
            <div
              key={card.id}
              className="ff-poster-card"
              style={{ cursor: card.emby_url ? 'pointer' : 'default' }}
              onClick={() => openEmby(card.emby_url)}
              title={card.emby_url ? '在 Emby 中打开' : undefined}
            >
              <div className="ff-poster-thumb">
                <div className="ff-poster-img">
                  <Poster
                    itemId={card.poster_id}
                    fill
                    maxWidth={400}
                    radius={10}
                  />
                </div>
                <span
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    padding: '1px 8px',
                    borderRadius: 10,
                    fontSize: 12,
                    color: '#fff',
                    background: isEpisode
                      ? 'rgba(82,196,26,.92)'
                      : 'rgba(22,119,255,.92)',
                  }}
                >
                  {isEpisode ? `${card.count} 集` : `×${card.count}`}
                </span>
              </div>
              <div
                className="ff-poster-title"
                title={card.title}
                style={{
                  marginTop: 8,
                  fontWeight: 500,
                  fontSize: 14,
                  lineHeight: 1.35,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {card.title || card.id}
              </div>
              <div style={{ color: '#999', fontSize: 12, marginTop: 2 }}>
                {card.year ? `${card.year}` : '—'}
                {card.last_watched ? ` · ${card.last_watched}` : ''}
              </div>
            </div>
          ))}
        </div>
      )}

      {data && data.total > PAGE_SIZE ? (
        <div style={{ marginTop: 24, textAlign: 'right' }}>
          <Pagination
            current={page}
            pageSize={PAGE_SIZE}
            total={data.total}
            showSizeChanger={false}
            onChange={setPage}
          />
        </div>
      ) : null}
    </Spin>
  );
};

export default GalleryTab;
