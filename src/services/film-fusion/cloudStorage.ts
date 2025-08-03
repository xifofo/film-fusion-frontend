import { request } from '@umijs/max';

/** 获取云存储列表 */
export async function getCloudStorageList(
  params: API.CloudStorageQueryParams,
  options?: { [key: string]: any },
) {
  return request<API.Response<API.PageResult<API.CloudStorage>>>('/api/cloud-storage', {
    method: 'GET',
    params,
    ...(options || {}),
  });
}

/** 创建云存储 */
export async function createCloudStorage(
  data: API.CreateCloudStorageParams,
  options?: { [key: string]: any },
) {
  return request<API.Response<API.CloudStorage>>('/api/cloud-storage', {
    method: 'POST',
    data,
    ...(options || {}),
  });
}

/** 更新云存储 */
export async function updateCloudStorage(
  data: API.UpdateCloudStorageParams,
  options?: { [key: string]: any },
) {
  return request<API.Response<API.CloudStorage>>(`/api/cloud-storage/${data.id}`, {
    method: 'PUT',
    data,
    ...(options || {}),
  });
}

/** 删除云存储 */
export async function deleteCloudStorage(
  ids: number[],
  options?: { [key: string]: any },
) {
  return request<API.Response<boolean>>('/api/cloud-storage', {
    method: 'DELETE',
    data: { ids },
    ...(options || {}),
  });
}

/** 获取云存储详情 */
export async function getCloudStorageDetail(
  id: number,
  options?: { [key: string]: any },
) {
  return request<API.Response<API.CloudStorage>>(`/api/cloud-storage/${id}`, {
    method: 'GET',
    ...(options || {}),
  });
}

/** 设置默认云存储 */
export async function setDefaultCloudStorage(
  id: number,
  options?: { [key: string]: any },
) {
  return request<API.Response<boolean>>(`/api/cloud-storage/${id}/set-default`, {
    method: 'PUT',
    ...(options || {}),
  });
}

/** 刷新云存储令牌 */
export async function refreshCloudStorageToken(
  id: number,
  options?: { [key: string]: any },
) {
  return request<API.Response<API.CloudStorage>>(`/api/cloud-storage/${id}/refresh-token`, {
    method: 'POST',
    ...(options || {}),
  });
}

/** 测试云存储连接 */
export async function testCloudStorageConnection(
  id: number,
  options?: { [key: string]: any },
) {
  return request<API.Response<{ connected: boolean; message?: string }>>(`/api/cloud-storage/${id}/test`, {
    method: 'POST',
    ...(options || {}),
  });
}
