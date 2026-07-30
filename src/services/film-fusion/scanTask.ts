import { apiClient } from '@/lib/api-client';

/** 获取扫描任务列表 */
export async function getScanTasks(params?: API.ScanTaskQueryParams) {
  return apiClient.get<API.Response<API.PageResult<API.ScanTask>>>(
    '/api/scan-task/list',
    { params },
  );
}

/** 获取扫描任务详情 */
export async function getScanTaskDetail(id: number) {
  return apiClient.get<API.Response<API.ScanTask>>(`/api/scan-task/${id}`);
}

/** 创建扫描任务 */
export async function createScanTask(params: API.CreateScanTaskParams) {
  return apiClient.post<API.Response<API.ScanTask>>('/api/scan-task', params);
}

/** 启动扫描任务 */
export async function startScanTask(id: number) {
  return apiClient.post<API.Response<any>>(
    `/api/scan-task/${id}/start`,
    undefined,
  );
}

/** 停止扫描任务 */
export async function stopScanTask(id: number) {
  return apiClient.post<API.Response<any>>(
    `/api/scan-task/${id}/stop`,
    undefined,
  );
}

/** 删除扫描任务 */
export async function deleteScanTask(id: number) {
  return apiClient.delete<API.Response<any>>(`/api/scan-task/${id}`);
}

/** 获取扫描任务日志 */
export async function getScanTaskLogs(
  id: number,
  params?: { page?: number; pageSize?: number },
) {
  return apiClient.get<
    API.Response<
      API.PageResult<{
        id: number;
        level: 'info' | 'warn' | 'error';
        message: string;
        createTime: string;
      }>
    >
  >(`/api/scan-task/${id}/logs`, { params });
}

/** 重试扫描任务 */
export async function retryScanTask(id: number) {
  return apiClient.post<API.Response<any>>(
    `/api/scan-task/${id}/retry`,
    undefined,
  );
}

/** 获取当前运行的扫描任务 */
export async function getActiveScanTasks() {
  return apiClient.get<API.Response<API.ScanTask[]>>('/api/scan-task/active');
}
