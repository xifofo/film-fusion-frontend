import { request } from '@umijs/max';

/** 获取 Emby 账号绑定列表 */
export async function getEmbyBindings(options?: { [key: string]: any }) {
  return request<API.Response<API.EmbyAccountBinding[]>>('/api/emby-bindings', {
    method: 'GET',
    ...(options || {}),
  });
}

/** 创建 Emby 账号绑定 */
export async function createEmbyBinding(
  data: API.EmbyAccountBindingParams,
  options?: { [key: string]: any },
) {
  return request<API.Response<API.EmbyAccountBinding>>('/api/emby-bindings', {
    method: 'POST',
    data,
    ...(options || {}),
  });
}

/** 更新 Emby 账号绑定 */
export async function updateEmbyBinding(
  id: number,
  data: API.EmbyAccountBindingParams,
  options?: { [key: string]: any },
) {
  return request<API.Response<API.EmbyAccountBinding>>(`/api/emby-bindings/${id}`, {
    method: 'PUT',
    data,
    ...(options || {}),
  });
}

/** 删除 Emby 账号绑定 */
export async function deleteEmbyBinding(
  id: number,
  options?: { [key: string]: any },
) {
  return request<API.Response<boolean>>(`/api/emby-bindings/${id}`, {
    method: 'DELETE',
    ...(options || {}),
  });
}

/** 拉取 Emby 用户列表（用于绑定下拉选择） */
export async function getEmbyUsers(options?: { [key: string]: any }) {
  return request<API.Response<API.EmbyUser[]>>('/api/emby-bindings/emby-users', {
    method: 'GET',
    ...(options || {}),
  });
}
