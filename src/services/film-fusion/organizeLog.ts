import { apiClient } from '@/lib/api-client';

/** 整理日志列表 */
export async function getOrganizeLogList(
  params: API.OrganizeLogQueryParams,
  options?: { [key: string]: any },
) {
  return apiClient.get<API.Response<API.PageResult<API.OrganizeLog>>>(
    '/api/organize-logs',
    { params, ...(options || {}) },
  );
}

/** 整理日志统计 */
export async function getOrganizeLogStats(options?: { [key: string]: any }) {
  return apiClient.get<API.Response<API.OrganizeLogStats>>(
    '/api/organize-logs/stats',
    { ...(options || {}) },
  );
}

/** 按条件清理整理日志 */
export async function clearOrganizeLogs(
  data: API.ClearOrganizeLogParams,
  options?: { [key: string]: any },
) {
  return apiClient.post<API.Response<{ deleted_count: number }>>(
    '/api/organize-logs/clear',
    data,
    { ...(options || {}) },
  );
}
