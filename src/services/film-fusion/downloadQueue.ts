import { apiClient } from '@/lib/api-client';

/** 获取 115Open 下载队列 */
export async function getDownloadQueueList(
  params: API.DownloadQueueQueryParams = {},
  options?: { [key: string]: any },
) {
  const { current, pageSize, ...rest } = params;

  return apiClient.get<API.Response<API.DownloadQueueListResult>>(
    '/api/download-queue',
    {
      params: {
        ...rest,
        page: current,
        size: pageSize,
      },
      ...(options || {}),
    },
  );
}

/** 重试失败的下载任务 */
export async function retryDownloadQueueTask(
  id: number,
  options?: { [key: string]: any },
) {
  return apiClient.post<
    API.Response<{ id: number; status: API.DownloadQueueStatus }>
  >(`/api/download-queue/${id}/retry`, undefined, { ...(options || {}) });
}

/** 移除等待中或失败的下载任务 */
export async function removeDownloadQueueTask(
  id: number,
  options?: { [key: string]: any },
) {
  return apiClient.delete<API.Response<{ id: number }>>(
    `/api/download-queue/${id}`,
    { ...(options || {}) },
  );
}

/** 清理全部失败的下载任务 */
export async function clearFailedDownloadQueueTasks(options?: {
  [key: string]: any;
}) {
  return apiClient.delete<API.Response<{ deleted_count: number }>>(
    '/api/download-queue/failed',
    { ...(options || {}) },
  );
}
