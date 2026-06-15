import { DownOutlined, LinkOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { Button, Dropdown, message } from 'antd';
import React, { useState } from 'react';
import { getEmbyMissingExternalLinks } from '@/services/film-fusion';

type ExternalLinksButtonProps = {
  seriesId: string;
};

type ProviderKey = 'tmdb' | 'tvdb' | 'imdb';

const PROVIDER_LABELS: Record<ProviderKey, string> = {
  tmdb: 'TMDB',
  tvdb: 'TVDB',
  imdb: 'IMDB',
};

/**
 * 缺集剧集的外部站点链接：按需点击展开时再向后端查询 Emby ProviderIds，
 * 拼出 TMDB/TVDB/IMDB 链接，点击在新标签页打开。
 */
const ExternalLinksButton: React.FC<ExternalLinksButtonProps> = ({
  seriesId,
}) => {
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [links, setLinks] = useState<API.EmbyMissingExternalLinks>();
  const [messageApi, contextHolder] = message.useMessage();

  const fetchLinks = async () => {
    setLoading(true);
    try {
      const res = await getEmbyMissingExternalLinks(seriesId);
      if (res.code === 0) {
        setLinks(res.data);
        setFetched(true);
      } else {
        messageApi.error(res.message || '获取外部链接失败');
      }
    } catch (error: any) {
      messageApi.error(error?.message || '获取外部链接失败');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (open && !fetched && !loading) {
      fetchLinks();
    }
  };

  const buildItems = (): MenuProps['items'] => {
    if (loading) {
      return [{ key: 'loading', label: '查询中…', disabled: true }];
    }
    if (!fetched) {
      return [{ key: 'tip', label: '展开以查询', disabled: true }];
    }
    const list = (['tmdb', 'tvdb', 'imdb'] as ProviderKey[])
      .filter((k) => !!links?.[k])
      .map((k) => ({ key: k, label: PROVIDER_LABELS[k] }));
    if (list.length === 0) {
      return [{ key: 'empty', label: '未找到外部站点 ID', disabled: true }];
    }
    return list;
  };

  const handleClick: MenuProps['onClick'] = ({ key }) => {
    const url = links?.[key as ProviderKey];
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <>
      {contextHolder}
      <Dropdown
        trigger={['click']}
        onOpenChange={handleOpenChange}
        menu={{ items: buildItems(), onClick: handleClick }}
      >
        <Button type="link" size="small" icon={<LinkOutlined />}>
          外部链接 <DownOutlined />
        </Button>
      </Dropdown>
    </>
  );
};

export default ExternalLinksButton;
