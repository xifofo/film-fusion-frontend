import { apiClient } from '@/lib/api-client';

/**
 * 拉取 Emby 各媒体库电影 / 电视剧数量统计快照。
 * 后端根据媒体库 CollectionType 只请求实际对应的内容类型，合集按 BoxSet 统计。
 */
export async function getEmbyStats() {
  return apiClient.get<API.Response<API.EmbyStats>>('/api/emby-stats', {
    timeout: 60000,
  });
}

/** 媒体库封面代理 URL（供 <img src> 使用，自动携带 JWT token）。 */
export function embyStatsLibraryImageUrl(
  library: Pick<
    API.EmbyLibraryStat,
    'emby_library_id' | 'image_type' | 'image_tag'
  >,
  maxWidth = 720,
): string {
  if (!library.emby_library_id || !library.image_type || !library.image_tag) {
    return '';
  }

  const params = new URLSearchParams({
    item_id: library.emby_library_id,
    type: library.image_type,
    max_width: String(maxWidth),
    tag: library.image_tag,
  });
  const token = localStorage.getItem('token') || '';
  if (token) params.set('token', token);
  return `/api/emby-stats/image?${params.toString()}`;
}
