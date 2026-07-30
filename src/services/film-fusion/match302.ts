import { apiClient } from '@/lib/api-client';

/** 获取 Match302 列表 */
export async function getMatch302List(
  params: API.Match302QueryParams,
  options?: { [key: string]: any },
) {
  return apiClient.get<API.Response<API.PageResult<API.Match302>>>(
    '/api/match-302',
    { params, ...(options || {}) },
  );
}

/** 创建 Match302 */
export async function createMatch302(
  data: API.CreateMatch302Params,
  options?: { [key: string]: any },
) {
  return apiClient.post<API.Response<API.Match302>>('/api/match-302', data, {
    ...(options || {}),
  });
}

/** 更新 Match302 */
export async function updateMatch302(
  data: API.UpdateMatch302Params,
  options?: { [key: string]: any },
) {
  return apiClient.put<API.Response<API.Match302>>(
    `/api/match-302/${data.id}`,
    data,
    { ...(options || {}) },
  );
}

/** 更新 Match302 负载均衡开关 */
export async function updateMatch302BalanceEnabled(
  id: number,
  balanceEnabled: boolean,
  options?: { [key: string]: any },
) {
  return apiClient.patch<API.Response<API.Match302>>(
    `/api/match-302/${id}/balance-enabled`,
    { balance_enabled: balanceEnabled },
    { ...(options || {}) },
  );
}

/** 删除 Match302 */
export async function deleteMatch302(
  id: number,
  options?: { [key: string]: any },
) {
  return apiClient.delete<API.Response<boolean>>(`/api/match-302/${id}`, {
    ...(options || {}),
  });
}

/** 获取 Match302 详情 */
export async function getMatch302Detail(
  id: number,
  options?: { [key: string]: any },
) {
  return apiClient.get<API.Response<API.Match302>>(`/api/match-302/${id}`, {
    ...(options || {}),
  });
}

/** 批量删除 Match302 */
export async function batchDeleteMatch302(
  ids: number[],
  options?: { [key: string]: any },
) {
  return apiClient.delete<API.Response<boolean>>(
    '/api/match-302/batch-delete',
    { data: { ids }, ...(options || {}) },
  );
}

/** 根据云存储ID获取 Match302 列表 */
export async function getMatch302ListByCloudStorage(
  cloudStorageId: number,
  options?: { [key: string]: any },
) {
  return apiClient.get<API.Response<API.Match302[]>>(
    `/api/match-302/cloud-storage/${cloudStorageId}`,
    { ...(options || {}) },
  );
}

/** 测试 Match302 重定向 */
export async function testMatch302Redirect(
  id: number,
  testPath: string,
  options?: { [key: string]: any },
) {
  return apiClient.post<
    API.Response<{ matched: boolean; result_path?: string; message?: string }>
  >(
    `/api/match-302/${id}/test`,
    { test_path: testPath },
    { ...(options || {}) },
  );
}

/** 获取 Match302 负载均衡分配记录 */
export async function getMatch302Assignments(
  id: number,
  params?: { page?: number; page_size?: number; status?: string },
  options?: { [key: string]: any },
) {
  return apiClient.get<
    API.Response<API.PageResult<API.Match302BalanceAssignment>>
  >(`/api/match-302/${id}/assignments`, { params, ...(options || {}) });
}

/** 重试 assignment 秒传 */
export async function retryMatch302Assignment(
  id: number,
  assignmentId: number,
  options?: { [key: string]: any },
) {
  return apiClient.post<API.Response<API.Match302BalanceAssignment>>(
    `/api/match-302/${id}/assignments/${assignmentId}/retry`,
    undefined,
    { ...(options || {}) },
  );
}

/** 立即清理 assignment 对应的子账号缓存文件 */
export async function cleanupMatch302Assignment(
  id: number,
  assignmentId: number,
  options?: { [key: string]: any },
) {
  return apiClient.post<API.Response<API.Match302BalanceAssignment>>(
    `/api/match-302/${id}/assignments/${assignmentId}/cleanup`,
    undefined,
    { ...(options || {}) },
  );
}

/** 延长 assignment 保留时间 */
export async function extendMatch302AssignmentRetention(
  id: number,
  assignmentId: number,
  hours?: number,
  options?: { [key: string]: any },
) {
  return apiClient.post<API.Response<API.Match302BalanceAssignment>>(
    `/api/match-302/${id}/assignments/${assignmentId}/extend-retention`,
    { hours },
    { ...(options || {}) },
  );
}
