import { request } from '@umijs/max';

/** 后端通过 ?token= 鉴权的图片/下载场景拼 token */
function withToken(params: Record<string, string | number | undefined>): string {
  const token = localStorage.getItem('token') || '';
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && `${v}` !== '') usp.append(k, `${v}`);
  });
  if (token) usp.append('token', token);
  return usp.toString();
}

/** Emby 条目图片代理 URL（供 <img src> 使用，自动带 JWT token） */
export function embyWatchImageUrl(itemId?: string, maxWidth = 200): string {
  if (!itemId) return '';
  return `/api/emby-watch/image?${withToken({
    item_id: itemId,
    type: 'Primary',
    max_width: maxWidth,
  })}`;
}

/** 年度报告分享图 URL（PNG，自动带 JWT token） */
export function embyWatchShareImageUrl(embyUserId: string, year: number): string {
  return `/api/emby-watch/annual-report/share-image?${withToken({
    emby_user_id: embyUserId,
    year,
  })}`;
}

/** 列出 Emby 用户 + 被统计/回填状态 */
export async function getEmbyWatchUsers(options?: { [key: string]: any }) {
  return request<API.Response<API.EmbyWatchUserView[]>>(
    '/api/emby-watch/users',
    {
      method: 'GET',
      ...(options || {}),
    },
  );
}

/** 保存被统计用户集合 */
export async function saveEmbyWatchUsers(
  embyUserIds: string[],
  options?: { [key: string]: any },
) {
  return request<API.Response<null>>('/api/emby-watch/users', {
    method: 'PUT',
    data: { emby_user_ids: embyUserIds },
    ...(options || {}),
  });
}

/** 触发某用户历史回填(异步) */
export async function backfillEmbyWatch(
  embyUserId: string,
  options?: { [key: string]: any },
) {
  return request<API.Response<null>>('/api/emby-watch/backfill', {
    method: 'POST',
    data: { emby_user_id: embyUserId },
    ...(options || {}),
  });
}

/** 查询某用户回填进度 */
export async function getEmbyWatchBackfillStatus(
  embyUserId: string,
  options?: { [key: string]: any },
) {
  return request<API.Response<API.EmbyWatchBackfillStatus>>(
    '/api/emby-watch/backfill/status',
    {
      method: 'GET',
      params: { emby_user_id: embyUserId },
      ...(options || {}),
    },
  );
}

/** 获取采集规则设置 */
export async function getEmbyWatchSetting(options?: { [key: string]: any }) {
  return request<API.Response<API.EmbyWatchSetting>>('/api/emby-watch/setting', {
    method: 'GET',
    ...(options || {}),
  });
}

/** 保存采集规则设置 */
export async function saveEmbyWatchSetting(
  data: API.EmbyWatchSetting,
  options?: { [key: string]: any },
) {
  return request<API.Response<API.EmbyWatchSetting>>('/api/emby-watch/setting', {
    method: 'PUT',
    data,
    ...(options || {}),
  });
}

/** 删除单条观看记录 */
export async function deleteEmbyWatchRecord(
  id: number,
  embyUserId: string,
  options?: { [key: string]: any },
) {
  return request<API.Response<{ deleted: number }>>(
    `/api/emby-watch/records/${id}`,
    {
      method: 'DELETE',
      params: { emby_user_id: embyUserId },
      ...(options || {}),
    },
  );
}

/** 清空某用户的全部观看记录 */
export async function clearEmbyWatchRecords(
  embyUserId: string,
  options?: { [key: string]: any },
) {
  return request<API.Response<{ deleted: number }>>('/api/emby-watch/records', {
    method: 'DELETE',
    params: { emby_user_id: embyUserId },
    ...(options || {}),
  });
}

/** 分页观看记录 */
export async function getEmbyWatchRecords(
  params: API.EmbyWatchRecordParams,
  options?: { [key: string]: any },
) {
  return request<API.Response<API.EmbyWatchRecordList>>(
    '/api/emby-watch/records',
    {
      method: 'GET',
      params,
      ...(options || {}),
    },
  );
}

/** 画廊（海报墙）：电影按片 / 剧集按剧 去重聚合 */
export async function getEmbyWatchGallery(
  params: API.EmbyWatchGalleryParams,
  options?: { [key: string]: any },
) {
  return request<API.Response<API.EmbyWatchGalleryResult>>(
    '/api/emby-watch/gallery',
    {
      method: 'GET',
      params,
      ...(options || {}),
    },
  );
}

/** 某年月逐日聚合 */
export async function getEmbyWatchCalendar(
  params: { emby_user_id: string; year: number; month: number },
  options?: { [key: string]: any },
) {
  return request<API.Response<API.EmbyWatchCalendarDay[]>>(
    '/api/emby-watch/calendar',
    {
      method: 'GET',
      params,
      ...(options || {}),
    },
  );
}

/** 总览统计 */
export async function getEmbyWatchSummary(
  params: { emby_user_id: string; year?: number },
  options?: { [key: string]: any },
) {
  return request<API.Response<API.EmbyWatchSummary>>(
    '/api/emby-watch/summary',
    {
      method: 'GET',
      params,
      ...(options || {}),
    },
  );
}

/** 年度报告 */
export async function getEmbyWatchAnnualReport(
  params: { emby_user_id: string; year: number },
  options?: { [key: string]: any },
) {
  return request<API.Response<API.EmbyWatchAnnualReport>>(
    '/api/emby-watch/annual-report',
    {
      method: 'GET',
      params,
      ...(options || {}),
    },
  );
}
