import { request } from '@umijs/max';

/** 获取云盘路径列表 */
export async function getCloudPaths(params?: API.CloudPathQueryParams) {
  return request<API.Response<API.PageResult<API.CloudPath>>>('/api/cloud-path/list', {
    method: 'GET',
    params,
  });
}

/** 获取云盘路径详情 */
export async function getCloudPathDetail(id: number) {
  return request<API.Response<API.CloudPath>>(`/api/cloud-path/${id}`, {
    method: 'GET',
  });
}

/** 创建云盘路径 */
export async function createCloudPath(params: API.CreateCloudPathParams) {
  return request<API.Response<API.CloudPath>>('/api/cloud-path', {
    method: 'POST',
    data: params,
  });
}

/** 更新云盘路径 */
export async function updateCloudPath(
  id: number,
  params: {
    name?: string;
    path?: string;
    config?: Record<string, any>;
    isActive?: boolean;
  },
) {
  return request<API.Response<API.CloudPath>>(`/api/cloud-path/${id}`, {
    method: 'PUT',
    data: params,
  });
}

/** 删除云盘路径 */
export async function deleteCloudPath(id: number) {
  return request<API.Response<any>>(`/api/cloud-path/${id}`, {
    method: 'DELETE',
  });
}

/** 测试云盘路径连接 */
export async function testCloudPath(params: API.CreateCloudPathParams) {
  return request<API.Response<{ success: boolean; message: string }>>('/api/cloud-path/test', {
    method: 'POST',
    data: params,
  });
}

/** 启用/禁用云盘路径 */
export async function toggleCloudPath(id: number, isActive: boolean) {
  return request<API.Response<any>>(`/api/cloud-path/${id}/toggle`, {
    method: 'PUT',
    data: { isActive },
  });
}

/** 获取云盘路径下的文件列表 */
export async function getCloudPathFiles(id: number, path?: string) {
  return request<API.Response<{
    files: Array<{
      name: string;
      path: string;
      isDir: boolean;
      size?: number;
      modTime?: string;
    }>;
  }>>(`/api/cloud-path/${id}/files`, {
    method: 'GET',
    params: { path },
  });
}
