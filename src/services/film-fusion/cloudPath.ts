import { apiClient } from '@/lib/api-client';

/** 旧界面选择器读取统一媒体目录，仅显示启用映射的配置。 */
export async function getCloudPaths(params?: API.CloudPathQueryParams) {
  const response = await apiClient.get<
    API.Response<API.PageResult<API.CloudPath & { save_path: string }>>
  >('/api/media-directories', { params: { ...params, capability: 'mapping' } });
  return {
    ...response,
    data: {
      ...response.data,
      list: response.data.list.map((row) => ({
        ...row,
        local_path: row.save_path,
      })),
    },
  };
}
