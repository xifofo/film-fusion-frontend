import { apiClient } from '@/lib/api-client';

/** 获取媒体列表 */
export async function getMediaList(params?: API.MediaQueryParams) {
  return apiClient.get<API.Response<API.PageResult<API.Media>>>(
    '/api/media/list',
    { params },
  );
}

/** 获取媒体详情 */
export async function getMediaDetail(id: number) {
  return apiClient.get<API.Response<API.Media>>(`/api/media/${id}`);
}

/** 搜索媒体 */
export async function searchMedia(params: {
  keyword: string;
  type?: string;
  page?: number;
  pageSize?: number;
}) {
  return apiClient.get<API.Response<API.PageResult<API.Media>>>(
    '/api/media/search',
    { params },
  );
}

/** 更新媒体信息 */
export async function updateMedia(
  id: number,
  params: {
    title?: string;
    originalTitle?: string;
    year?: number;
    genre?: string[];
    rating?: number;
    overview?: string;
    poster?: string;
    backdrop?: string;
  },
) {
  return apiClient.put<API.Response<API.Media>>(`/api/media/${id}`, params);
}

/** 删除媒体 */
export async function deleteMedia(id: number) {
  return apiClient.delete<API.Response<any>>(`/api/media/${id}`);
}

/** 获取媒体统计信息 */
export async function getMediaStats() {
  return apiClient.get<
    API.Response<{
      totalCount: number;
      movieCount: number;
      tvCount: number;
      animeCount: number;
      totalSize: number;
      totalDuration: number;
    }>
  >('/api/media/stats');
}

/** 刷新媒体元数据 */
export async function refreshMediaMetadata(id: number) {
  return apiClient.post<API.Response<any>>(
    `/api/media/${id}/refresh`,
    undefined,
  );
}

/** 生成媒体缩略图 */
export async function generateThumbnail(id: number) {
  return apiClient.post<API.Response<any>>(
    `/api/media/${id}/thumbnail`,
    undefined,
  );
}

/** 获取媒体流链接 */
export async function getMediaStreamUrl(id: number) {
  return apiClient.get<API.Response<{ url: string }>>(
    `/api/media/${id}/stream`,
  );
}
