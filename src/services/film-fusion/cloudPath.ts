import { apiClient } from '@/lib/api-client';

/** 获取云盘路径列表 */
export async function getCloudPaths(params?: API.CloudPathQueryParams) {
  return apiClient.get<API.Response<API.PageResult<API.CloudPath>>>(
    '/api/paths',
    { params },
  );
}

/** 获取云盘路径详情 */
export async function getCloudPathDetail(id: number) {
  return apiClient.get<API.Response<API.CloudPath>>(`/api/paths/${id}`);
}

/** 创建云盘路径 */
export async function createCloudPath(params: API.CreateCloudPathParams) {
  return apiClient.post<API.Response<API.CloudPath>>('/api/paths', params);
}

/** 更新云盘路径 */
export async function updateCloudPath(params: API.UpdateCloudPathParams) {
  return apiClient.put<API.Response<API.CloudPath>>(
    `/api/paths/${params.id}`,
    params,
  );
}

/** 删除云盘路径 */
export async function deleteCloudPath(id: number) {
  return apiClient.delete<API.Response<any>>(`/api/paths/${id}`);
}

/** 手动同步云盘路径 */
export async function syncCloudPath(id: number) {
  return apiClient.post<API.Response<any>>(`/api/paths/${id}/sync`, undefined);
}

/** 获取同步状态 */
export async function getCloudPathStatus(id: number) {
  return apiClient.get<API.Response<API.CloudPath>>(`/api/paths/${id}/status`);
}

/** 批量操作 */
export async function batchOperateCloudPaths(params: API.BatchCloudPathParams) {
  return apiClient.post<API.Response<API.BatchOperationResult>>(
    '/api/paths/batch',
    params,
  );
}

/** 获取链接类型列表 */
export async function getLinkTypes() {
  return apiClient.get<API.Response<API.LinkTypeOption[]>>(
    '/api/paths/link-types',
  );
}

/** 获取STRM内容类型列表 */
export async function getStrmContentTypes() {
  return apiClient.get<API.Response<API.StrmContentTypeOption[]>>(
    '/api/paths/strm-content-types',
  );
}

/** 验证云盘路径配置 */
export async function validateCloudPath(params: API.ValidateCloudPathParams) {
  return apiClient.post<API.Response<API.ValidateCloudPathResult>>(
    '/api/paths/validate',
    params,
  );
}

/** 获取路径统计信息 */
export async function getCloudPathStatistics() {
  return apiClient.get<API.Response<API.CloudPathStatistics>>(
    '/api/paths/statistics',
  );
}

/** 导出路径配置 */
export async function exportCloudPaths() {
  return apiClient.get<API.Response<API.ExportCloudPathData>>(
    '/api/paths/export',
  );
}

/** 导入路径配置 */
export async function importCloudPaths(params: API.ImportCloudPathParams) {
  return apiClient.post<API.Response<API.ImportCloudPathResult>>(
    '/api/paths/import',
    params,
  );
}

/** 测试云盘路径连接 (保留兼容) */
export async function testCloudPath(params: API.CreateCloudPathParams) {
  return validateCloudPath(params);
}

/** 启用/禁用云盘路径 (保留兼容) */
export async function toggleCloudPath(id: number, isActive: boolean) {
  return apiClient.put<API.Response<any>>(`/api/paths/${id}/toggle`, {
    isActive,
  });
}

/** 获取云盘路径下的文件列表 (保留兼容) */
export async function getCloudPathFiles(id: number, path?: string) {
  return apiClient.get<
    API.Response<{
      files: Array<{
        name: string;
        path: string;
        isDir: boolean;
        size?: number;
        modTime?: string;
      }>;
    }>
  >(`/api/paths/${id}/files`, { params: { path } });
}

/** 替换 STRM 内容 */
export async function replaceStrmContent(
  id: number,
  params: API.ReplaceStrmContentParams,
) {
  return apiClient.post<API.Response<any>>(
    `/api/paths/${id}/strm/replace`,
    params,
  );
}
