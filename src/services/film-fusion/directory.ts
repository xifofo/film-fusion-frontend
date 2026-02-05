import { request } from '@umijs/max';

/** 获取目录配置列表 */
export async function getCloudDirectoryList(
  params?: API.CloudDirectoryQueryParams,
  options?: { [key: string]: any },
) {
  const {
    current,
    pageSize,
    page,
    page_size,
    ...rest
  } = params || {};

  return request<API.Response<API.PageResult<API.CloudDirectory>>>('/api/directories', {
    method: 'GET',
    params: {
      ...rest,
      page: page ?? current,
      page_size: page_size ?? pageSize,
    },
    ...(options || {}),
  });
}

/** 获取单个目录配置 */
export async function getCloudDirectoryDetail(
  id: number,
  options?: { [key: string]: any },
) {
  return request<API.Response<API.CloudDirectory>>(`/api/directories/${id}`, {
    method: 'GET',
    ...(options || {}),
  });
}

/** 创建目录配置 */
export async function createCloudDirectory(
  data: API.CreateCloudDirectoryParams,
  options?: { [key: string]: any },
) {
  return request<API.Response<API.CloudDirectory>>('/api/directories', {
    method: 'POST',
    data,
    ...(options || {}),
  });
}

/** 更新目录配置 */
export async function updateCloudDirectory(
  data: API.UpdateCloudDirectoryParams,
  options?: { [key: string]: any },
) {
  return request<API.Response<API.CloudDirectory>>(`/api/directories/${data.id}`, {
    method: 'PUT',
    data,
    ...(options || {}),
  });
}

/** 删除目录配置 */
export async function deleteCloudDirectory(
  id: number,
  options?: { [key: string]: any },
) {
  return request<API.Response<null>>(`/api/directories/${id}`, {
    method: 'DELETE',
    ...(options || {}),
  });
}
