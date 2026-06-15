import { request } from '@umijs/max';

/** 获取缺集列表(按剧集分组) + 设置/状态 */
export async function getEmbyMissing(options?: { [key: string]: any }) {
  return request<API.Response<API.EmbyMissingListResult>>('/api/emby-missing', {
    method: 'GET',
    ...(options || {}),
  });
}

/** 手动触发缺集扫描(异步) */
export async function scanEmbyMissing(
  data?: API.EmbyMissingScanParams,
  options?: { [key: string]: any },
) {
  return request<API.Response<null>>('/api/emby-missing/scan', {
    method: 'POST',
    data: data || {},
    ...(options || {}),
  });
}

/** 由剧集ID取 Emby 本地路径并反推云端源目录 */
export async function resolveEmbyMissingCloudPath(
  data: { series_id: string },
  options?: { [key: string]: any },
) {
  return request<API.Response<API.EmbyMissingResolveResult>>(
    '/api/emby-missing/resolve-cloud-path',
    {
      method: 'POST',
      data,
      ...(options || {}),
    },
  );
}

/** 获取定时扫描设置 */
export async function getEmbyMissingSetting(options?: { [key: string]: any }) {
  return request<API.Response<API.EmbyMissingSetting>>('/api/emby-missing/setting', {
    method: 'GET',
    ...(options || {}),
  });
}

/** 更新定时扫描设置 */
export async function updateEmbyMissingSetting(
  data: API.EmbyMissingSettingParams,
  options?: { [key: string]: any },
) {
  return request<API.Response<API.EmbyMissingSetting>>('/api/emby-missing/setting', {
    method: 'PUT',
    data,
    ...(options || {}),
  });
}

/** 获取可扫描的电视剧媒体库 */
export async function getEmbyMissingLibraries(options?: { [key: string]: any }) {
  return request<API.Response<API.EmbyTvLibrary[]>>('/api/emby-missing/libraries', {
    method: 'GET',
    ...(options || {}),
  });
}

/** 获取黑名单列表 */
export async function getEmbyMissingBlacklist(options?: { [key: string]: any }) {
  return request<API.Response<API.EmbyMissingBlacklist[]>>('/api/emby-missing/blacklist', {
    method: 'GET',
    ...(options || {}),
  });
}

/** 加入黑名单 */
export async function addEmbyMissingBlacklist(
  data: API.EmbyMissingBlacklistParams,
  options?: { [key: string]: any },
) {
  return request<API.Response<API.EmbyMissingBlacklist>>('/api/emby-missing/blacklist', {
    method: 'POST',
    data,
    ...(options || {}),
  });
}

/** 移除黑名单 */
export async function removeEmbyMissingBlacklist(
  id: number,
  options?: { [key: string]: any },
) {
  return request<API.Response<null>>(`/api/emby-missing/blacklist/${id}`, {
    method: 'DELETE',
    ...(options || {}),
  });
}
