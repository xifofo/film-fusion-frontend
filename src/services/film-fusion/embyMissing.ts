import { apiClient } from '@/lib/api-client';

/** 获取缺集列表(按剧集分组) + 设置/状态 */
export async function getEmbyMissing(options?: { [key: string]: any }) {
  return apiClient.get<API.Response<API.EmbyMissingListResult>>(
    '/api/emby-missing',
    { ...(options || {}) },
  );
}

/** 手动触发缺集扫描(异步) */
export async function scanEmbyMissing(
  data?: API.EmbyMissingScanParams,
  options?: { [key: string]: any },
) {
  return apiClient.post<API.Response<null>>(
    '/api/emby-missing/scan',
    data || {},
    { ...(options || {}) },
  );
}

/** 忽略增量扫描间隔，只重新检查指定剧集 */
export async function rescanEmbyMissingSeries(
  seriesId: string,
  options?: { [key: string]: any },
) {
  return apiClient.post<API.Response<API.EmbyMissingSeriesScanResult>>(
    `/api/emby-missing/series/${encodeURIComponent(seriesId)}/scan`,
    undefined,
    { ...(options || {}) },
  );
}

/** 由剧集ID取 Emby 本地路径并反推云端源目录 */
export async function resolveEmbyMissingCloudPath(
  data: { series_id: string },
  options?: { [key: string]: any },
) {
  return apiClient.post<API.Response<API.EmbyMissingResolveResult>>(
    '/api/emby-missing/resolve-cloud-path',
    data,
    { ...(options || {}) },
  );
}

/** 按需查询剧集的 TMDB/TVDB/IMDB 外部站点链接 */
export async function getEmbyMissingExternalLinks(
  seriesId: string,
  options?: { [key: string]: any },
) {
  return apiClient.get<API.Response<API.EmbyMissingExternalLinks>>(
    '/api/emby-missing/external-links',
    { params: { series_id: seriesId }, ...(options || {}) },
  );
}

/** 获取定时扫描设置 */
export async function getEmbyMissingSetting(options?: { [key: string]: any }) {
  return apiClient.get<API.Response<API.EmbyMissingSetting>>(
    '/api/emby-missing/setting',
    { ...(options || {}) },
  );
}

/** 更新定时扫描设置 */
export async function updateEmbyMissingSetting(
  data: API.EmbyMissingSettingParams,
  options?: { [key: string]: any },
) {
  return apiClient.put<API.Response<API.EmbyMissingSetting>>(
    '/api/emby-missing/setting',
    data,
    { ...(options || {}) },
  );
}

/** 获取可扫描的电视剧媒体库 */
export async function getEmbyMissingLibraries(options?: {
  [key: string]: any;
}) {
  return apiClient.get<API.Response<API.EmbyTvLibrary[]>>(
    '/api/emby-missing/libraries',
    { ...(options || {}) },
  );
}

/** 获取黑名单列表 */
export async function getEmbyMissingBlacklist(options?: {
  [key: string]: any;
}) {
  return apiClient.get<API.Response<API.EmbyMissingBlacklist[]>>(
    '/api/emby-missing/blacklist',
    { ...(options || {}) },
  );
}

/** 加入黑名单 */
export async function addEmbyMissingBlacklist(
  data: API.EmbyMissingBlacklistParams,
  options?: { [key: string]: any },
) {
  return apiClient.post<API.Response<API.EmbyMissingBlacklist>>(
    '/api/emby-missing/blacklist',
    data,
    { ...(options || {}) },
  );
}

/** 移除黑名单 */
export async function removeEmbyMissingBlacklist(
  id: number,
  options?: { [key: string]: any },
) {
  return apiClient.delete<API.Response<null>>(
    `/api/emby-missing/blacklist/${id}`,
    { ...(options || {}) },
  );
}
