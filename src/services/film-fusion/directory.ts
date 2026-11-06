import { apiClient } from '@/lib/api-client';

/** 获取目录配置列表 */
export async function getCloudDirectoryList(
  params?: API.CloudDirectoryQueryParams,
  options?: { [key: string]: any },
) {
  const { current, pageSize, page, page_size, ...rest } = params || {};

  return apiClient.get<API.Response<API.PageResult<API.CloudDirectory>>>(
    '/api/media-directories',
    {
      params: {
        ...rest,
        capability: 'organize',
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
    `/api/media-directories/${id}`,
    { ...(options || {}) },
  );
}

/** 更新目录配置 */
export async function updateCloudDirectory(
  data: API.UpdateCloudDirectoryParams,
  options?: { [key: string]: any },
) {
  return apiClient.put<API.Response<API.CloudDirectory>>(
    `/api/media-directories/${data.id}`,
    Object.fromEntries(Object.entries(data).filter(([key]) => key !== 'id')),
    { ...(options || {}) },
  );
}
