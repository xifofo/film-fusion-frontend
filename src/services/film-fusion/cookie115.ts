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

/** 查询各 115 存储的 cookie 保活状态 */
export async function getWeb115KeepaliveStatus(options?: { [key: string]: any }) {
  return request<API.Response<{ list: API.Web115CookieStatus[] }>>(
    '/api/115-cookie/keepalive/status',
    {
      method: 'GET',
      ...(options || {}),
    },
  );
}

/** 手动触发指定存储的 115 cookie 换端续期（login_another_app） */
export async function refreshWeb115Cookie(
  data: API.Web115CookieRefreshRequest,
  options?: { [key: string]: any },
) {
  return request<API.Response<{ cloud_storage_id: number; storage_name: string }>>(
    '/api/115-cookie/keepalive/refresh',
    {
      method: 'POST',
      data,
      ...(options || {}),
    },
  );
}
