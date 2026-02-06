import { request } from '@umijs/max';

/** 获取 115 Cookie 目录列表（仅目录） */
export async function get115CookieDirs(
  data: API.Cookie115DirRequest,
  options?: { [key: string]: any },
) {
  return request<API.Response<API.Cookie115DirResponse>>('/api/115-cookie/dirs', {
    method: 'POST',
    data,
    ...(options || {}),
  });
}
