import { request } from '@umijs/max';

/** 获取 Pickcode 缓存列表 */
export async function getPickcodeCacheList(
  params: API.PickcodeCacheQueryParams,
  options?: { [key: string]: any },
) {
  return request<API.Response<API.PageResult<API.PickcodeCache>>>('/api/pickcode-cache', {
    method: 'GET',
    params,
    ...(options || {}),
  });
}

/** 获取单个 Pickcode 缓存记录 */
export async function getPickcodeCacheById(
  id: number,
  options?: { [key: string]: any },
) {
  return request<API.Response<API.PickcodeCache>>(`/api/pickcode-cache/${id}`, {
    method: 'GET',
    ...(options || {}),
  });
}

/** 创建 Pickcode 缓存记录 */
export async function createPickcodeCache(
  data: API.CreatePickcodeCacheParams,
  options?: { [key: string]: any },
) {
  return request<API.Response<API.PickcodeCache>>('/api/pickcode-cache', {
    method: 'POST',
    data,
    ...(options || {}),
  });
}

/** 更新 Pickcode 缓存记录 */
export async function updatePickcodeCache(
  data: API.UpdatePickcodeCacheParams,
  options?: { [key: string]: any },
) {
  return request<API.Response<API.PickcodeCache>>(`/api/pickcode-cache/${data.id}`, {
    method: 'PUT',
    data,
    ...(options || {}),
  });
}

/** 删除单个 Pickcode 缓存记录 */
export async function deletePickcodeCache(
  id: number,
  options?: { [key: string]: any },
) {
  return request<API.Response<boolean>>(`/api/pickcode-cache/${id}`, {
    method: 'DELETE',
    ...(options || {}),
  });
}

/** 批量删除 Pickcode 缓存记录 */
export async function batchDeletePickcodeCache(
  data: API.BatchDeletePickcodeCacheParams,
  options?: { [key: string]: any },
) {
  return request<API.Response<{ deleted_count: number }>>('/api/pickcode-cache/batch/delete', {
    method: 'POST',
    data,
    ...(options || {}),
  });
}

/** 清空所有 Pickcode 缓存 */
export async function clearAllPickcodeCache(
  options?: { [key: string]: any },
) {
  return request<API.Response<{ deleted_count: number }>>('/api/pickcode-cache/clear', {
    method: 'DELETE',
    ...(options || {}),
  });
}

/** 获取 Pickcode 缓存统计信息 */
export async function getPickcodeCacheStats(
  options?: { [key: string]: any },
) {
  return request<API.Response<API.PickcodeCacheStats>>('/api/pickcode-cache/stats', {
    method: 'GET',
    ...(options || {}),
  });
}
