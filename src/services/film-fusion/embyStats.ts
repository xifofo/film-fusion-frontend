import { request } from '@umijs/max';

/**
 * 拉取 Emby 各媒体库电影 / 电视剧数量统计快照。
 * 后端实时聚合：每个媒体库 2 次 Emby 轻量计数请求，并发拉取。
 */
export async function getEmbyStats() {
  return request<API.Response<API.EmbyStats>>('/api/emby-stats', {
    method: 'GET',
    timeout: 60000,
  });
}
