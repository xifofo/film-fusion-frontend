import { request } from '@umijs/max';

/** 获取扫描任务列表 */
export async function getScanTasks(params?: API.ScanTaskQueryParams) {
  return request<API.Response<API.PageResult<API.ScanTask>>>('/api/scan-task/list', {
    method: 'GET',
    params,
  });
}

/** 获取扫描任务详情 */
export async function getScanTaskDetail(id: number) {
  return request<API.Response<API.ScanTask>>(`/api/scan-task/${id}`, {
    method: 'GET',
  });
}

/** 创建扫描任务 */
export async function createScanTask(params: API.CreateScanTaskParams) {
  return request<API.Response<API.ScanTask>>('/api/scan-task', {
    method: 'POST',
    data: params,
  });
}

/** 启动扫描任务 */
export async function startScanTask(id: number) {
  return request<API.Response<any>>(`/api/scan-task/${id}/start`, {
    method: 'POST',
  });
}

/** 停止扫描任务 */
export async function stopScanTask(id: number) {
  return request<API.Response<any>>(`/api/scan-task/${id}/stop`, {
    method: 'POST',
  });
}

/** 删除扫描任务 */
export async function deleteScanTask(id: number) {
  return request<API.Response<any>>(`/api/scan-task/${id}`, {
    method: 'DELETE',
  });
}

/** 获取扫描任务日志 */
export async function getScanTaskLogs(id: number, params?: { page?: number; pageSize?: number }) {
  return request<API.Response<API.PageResult<{
    id: number;
    level: 'info' | 'warn' | 'error';
    message: string;
    createTime: string;
  }>>>(`/api/scan-task/${id}/logs`, {
    method: 'GET',
    params,
  });
}

/** 重试扫描任务 */
export async function retryScanTask(id: number) {
  return request<API.Response<any>>(`/api/scan-task/${id}/retry`, {
    method: 'POST',
  });
}

/** 获取当前运行的扫描任务 */
export async function getActiveScanTasks() {
  return request<API.Response<API.ScanTask[]>>('/api/scan-task/active', {
    method: 'GET',
  });
}
