import { Alert } from 'antd';
import type { RSSCacheMetadata } from '@/services/film-fusion/automation';

const RSSCacheNotice = ({ cache }: { cache: RSSCacheMetadata }) => {
  if (!cache.cache_fetched_at) return null;
  const updatedAt = new Date(cache.cache_fetched_at).toLocaleString('zh-CN', {
    hour12: false,
  });
  return (
    <Alert
      showIcon
      type={cache.cache_stale ? 'warning' : 'info'}
      title={
        cache.cache_stale
          ? '正在使用上次成功的 RSS 缓存'
          : cache.cache_hit
            ? '已读取共享 RSS 缓存，未重复请求原站'
            : 'RSS 缓存已更新'
      }
      description={`最近成功抓取：${updatedAt}${cache.cache_warning ? `；${cache.cache_warning}` : ''}`}
    />
  );
};

export default RSSCacheNotice;
