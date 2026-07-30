import { apiClient } from '@/lib/api-client';

/** 获取 Emby 账号绑定列表 */
export async function getEmbyBindings(options?: { [key: string]: any }) {
  return apiClient.get<API.Response<API.EmbyAccountBinding[]>>(
    '/api/emby-bindings',
    { ...(options || {}) },
  );
}

/** 创建 Emby 账号绑定 */
export async function createEmbyBinding(
  data: API.EmbyAccountBindingParams,
  options?: { [key: string]: any },
) {
  return apiClient.post<API.Response<API.EmbyAccountBinding>>(
    '/api/emby-bindings',
    data,
    { ...(options || {}) },
  );
}

/** 更新 Emby 账号绑定 */
export async function updateEmbyBinding(
  id: number,
  data: API.EmbyAccountBindingParams,
  options?: { [key: string]: any },
) {
  return apiClient.put<API.Response<API.EmbyAccountBinding>>(
    `/api/emby-bindings/${id}`,
    data,
    { ...(options || {}) },
  );
}

/** 删除 Emby 账号绑定 */
export async function deleteEmbyBinding(
  id: number,
  options?: { [key: string]: any },
) {
  return apiClient.delete<API.Response<boolean>>(`/api/emby-bindings/${id}`, {
    ...(options || {}),
  });
}

/** 拉取 Emby 用户列表（用于绑定下拉选择） */
export async function getEmbyUsers(options?: { [key: string]: any }) {
  return apiClient.get<API.Response<API.EmbyUser[]>>(
    '/api/emby-bindings/emby-users',
    { ...(options || {}) },
  );
}
