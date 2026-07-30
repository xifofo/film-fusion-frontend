import { apiClient } from '@/lib/api-client';

/** 获取目录配置列表 */
export async function getCloudDirectoryList(
  params?: API.CloudDirectoryQueryParams,
  options?: { [key: string]: any },
) {
  const { current, pageSize, page, page_size, ...rest } = params || {};

  return apiClient.get<API.Response<API.PageResult<API.CloudDirectory>>>(
    '/api/directories',
    {
      params: {
        ...rest,
        page: page ?? current,
        page_size: page_size ?? pageSize,
      },
      ...(options || {}),
    },
  );
}

/** 获取单个目录配置 */
export async function getCloudDirectoryDetail(
  id: number,
  options?: { [key: string]: any },
) {
  return apiClient.get<API.Response<API.CloudDirectory>>(
    `/api/directories/${id}`,
    { ...(options || {}) },
  );
}

/** 创建目录配置 */
export async function createCloudDirectory(
  data: API.CreateCloudDirectoryParams,
  options?: { [key: string]: any },
) {
  return apiClient.post<API.Response<API.CloudDirectory>>(
    '/api/directories',
    data,
    { ...(options || {}) },
  );
}

/** 更新目录配置 */
export async function updateCloudDirectory(
  data: API.UpdateCloudDirectoryParams,
  options?: { [key: string]: any },
) {
  return apiClient.put<API.Response<API.CloudDirectory>>(
    `/api/directories/${data.id}`,
    data,
    { ...(options || {}) },
  );
}

/** 删除目录配置 */
export async function deleteCloudDirectory(
  id: number,
  options?: { [key: string]: any },
) {
  return apiClient.delete<API.Response<null>>(`/api/directories/${id}`, {
    ...(options || {}),
  });
}
