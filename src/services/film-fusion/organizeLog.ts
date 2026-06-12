import { request } from '@umijs/max';

/** 整理日志列表 */
export async function getOrganizeLogList(
  params: API.OrganizeLogQueryParams,
  options?: { [key: string]: any },
) {
  return request<API.Response<API.PageResult<API.OrganizeLog>>>('/api/organize-logs', {
    method: 'GET',
    params,
    ...(options || {}),
  });
}

/** 整理日志统计 */
export async function getOrganizeLogStats(options?: { [key: string]: any }) {
  return request<API.Response<API.OrganizeLogStats>>('/api/organize-logs/stats', {
    method: 'GET',
    ...(options || {}),
  });
}

/** 按条件清理整理日志 */
export async function clearOrganizeLogs(
  data: API.ClearOrganizeLogParams,
  options?: { [key: string]: any },
) {
  return request<API.Response<{ deleted_count: number }>>('/api/organize-logs/clear', {
    method: 'POST',
    data,
    ...(options || {}),
  });
}
