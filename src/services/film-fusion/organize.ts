import { request } from '@umijs/max';

/** 整理并处理 115 Cookie 目录 */
export async function organize115Cookie(
  data: API.Organize115CookieParams,
  options?: { [key: string]: any },
) {
  return request<API.Response<API.Organize115CookieResult>>('/api/organize/115-cookie', {
    method: 'POST',
    data,
    ...(options || {}),
  });
}
