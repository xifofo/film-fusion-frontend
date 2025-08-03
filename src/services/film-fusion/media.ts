import { request } from '@umijs/max';

/** 获取媒体列表 */
export async function getMediaList(params?: API.MediaQueryParams) {
  return request<API.Response<API.PageResult<API.Media>>>('/api/media/list', {
    method: 'GET',
    params,
  });
}

/** 获取媒体详情 */
export async function getMediaDetail(id: number) {
  return request<API.Response<API.Media>>(`/api/media/${id}`, {
    method: 'GET',
  });
}

/** 搜索媒体 */
export async function searchMedia(params: {
  keyword: string;
  type?: string;
  page?: number;
  pageSize?: number;
}) {
  return request<API.Response<API.PageResult<API.Media>>>('/api/media/search', {
    method: 'GET',
    params,
  });
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
  return request<API.Response<API.Media>>(`/api/media/${id}`, {
    method: 'PUT',
    data: params,
  });
}

/** 删除媒体 */
export async function deleteMedia(id: number) {
  return request<API.Response<any>>(`/api/media/${id}`, {
    method: 'DELETE',
  });
}

/** 获取媒体统计信息 */
export async function getMediaStats() {
  return request<API.Response<{
    totalCount: number;
    movieCount: number;
    tvCount: number;
    animeCount: number;
    totalSize: number;
    totalDuration: number;
  }>>('/api/media/stats', {
    method: 'GET',
  });
}

/** 刷新媒体元数据 */
export async function refreshMediaMetadata(id: number) {
  return request<API.Response<any>>(`/api/media/${id}/refresh`, {
    method: 'POST',
  });
}

/** 生成媒体缩略图 */
export async function generateThumbnail(id: number) {
  return request<API.Response<any>>(`/api/media/${id}/thumbnail`, {
    method: 'POST',
  });
}

/** 获取媒体流链接 */
export async function getMediaStreamUrl(id: number) {
  return request<API.Response<{ url: string }>>(`/api/media/${id}/stream`, {
    method: 'GET',
  });
}
