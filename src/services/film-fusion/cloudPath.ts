import { request } from '@umijs/max';

/** 获取云盘路径列表 */
export async function getCloudPaths(params?: API.CloudPathQueryParams) {
  return request<API.Response<API.PageResult<API.CloudPath>>>('/api/paths', {
    method: 'GET',
    params,
  });
}

/** 获取云盘路径详情 */
export async function getCloudPathDetail(id: number) {
  return request<API.Response<API.CloudPath>>(`/api/paths/${id}`, {
    method: 'GET',
  });
}

/** 创建云盘路径 */
export async function createCloudPath(params: API.CreateCloudPathParams) {
  return request<API.Response<API.CloudPath>>('/api/paths', {
    method: 'POST',
    data: params,
  });
}

/** 更新云盘路径 */
export async function updateCloudPath(params: API.UpdateCloudPathParams) {
  return request<API.Response<API.CloudPath>>(`/api/paths/${params.id}`, {
    method: 'PUT',
    data: params,
  });
}

/** 删除云盘路径 */
export async function deleteCloudPath(id: number) {
  return request<API.Response<any>>(`/api/paths/${id}`, {
    method: 'DELETE',
  });
}

/** 手动同步云盘路径 */
export async function syncCloudPath(id: number) {
  return request<API.Response<any>>(`/api/paths/${id}/sync`, {
    method: 'POST',
  });
}

/** 获取同步状态 */
export async function getCloudPathStatus(id: number) {
  return request<API.Response<API.CloudPath>>(`/api/paths/${id}/status`, {
    method: 'GET',
  });
}

/** 批量操作 */
export async function batchOperateCloudPaths(params: API.BatchCloudPathParams) {
  return request<API.Response<API.BatchOperationResult>>('/api/paths/batch', {
    method: 'POST',
    data: params,
  });
}

/** 获取链接类型列表 */
export async function getLinkTypes() {
  return request<API.Response<API.LinkTypeOption[]>>('/api/paths/link-types', {
    method: 'GET',
  });
}

/** 获取STRM内容类型列表 */
export async function getStrmContentTypes() {
  return request<API.Response<API.StrmContentTypeOption[]>>('/api/paths/strm-content-types', {
    method: 'GET',
  });
}

/** 验证云盘路径配置 */
export async function validateCloudPath(params: API.ValidateCloudPathParams) {
  return request<API.Response<API.ValidateCloudPathResult>>('/api/paths/validate', {
    method: 'POST',
    data: params,
  });
}

/** 获取路径统计信息 */
export async function getCloudPathStatistics() {
  return request<API.Response<API.CloudPathStatistics>>('/api/paths/statistics', {
    method: 'GET',
  });
}

/** 导出路径配置 */
export async function exportCloudPaths() {
  return request<API.Response<API.ExportCloudPathData>>('/api/paths/export', {
    method: 'GET',
  });
}

/** 导入路径配置 */
export async function importCloudPaths(params: API.ImportCloudPathParams) {
  return request<API.Response<API.ImportCloudPathResult>>('/api/paths/import', {
    method: 'POST',
    data: params,
  });
}

/** 测试云盘路径连接 (保留兼容) */
export async function testCloudPath(params: API.CreateCloudPathParams) {
  return validateCloudPath(params);
}

/** 启用/禁用云盘路径 (保留兼容) */
export async function toggleCloudPath(id: number, isActive: boolean) {
  return request<API.Response<any>>(`/api/paths/${id}/toggle`, {
    method: 'PUT',
    data: { isActive },
  });
}

/** 获取云盘路径下的文件列表 (保留兼容) */
export async function getCloudPathFiles(id: number, path?: string) {
  return request<API.Response<{
    files: Array<{
      name: string;
      path: string;
      isDir: boolean;
      size?: number;
      modTime?: string;
    }>;
  }>>(`/api/paths/${id}/files`, {
    method: 'GET',
    params: { path },
  });
}
