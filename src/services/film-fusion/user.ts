import { apiClient } from '@/lib/api-client';

/** 用户登录 */
export async function login(params: API.LoginParams) {
  try {
    const response = await apiClient.post<API.Response<API.LoginResult>>(
      '/api/auth/login',
      params,
      { skipErrorHandler: true },
    );

    if (response.code !== 0) {
      return { error: response.message || '登录失败' };
    }

    return { response };
  } catch (error: any) {
    return { error };
  }
}

/** 获取当前用户信息 */
export async function getCurrentUser() {
  return apiClient.get<API.Response<API.User>>('/api/me', {
    skipErrorHandler: true,
  });
}

/** 获取用户列表 */
export async function getUsers(params?: API.PageParams) {
  return apiClient.get<API.Response<API.PageResult<API.User>>>(
    '/api/user/list',
    { params },
  );
}

/** 创建用户 */
export async function createUser(params: {
  username: string;
  password: string;
  email?: string;
}) {
  return apiClient.post<API.Response<API.User>>('/api/user', params);
}

/** 更新用户信息 */
export async function updateUser(
  id: number,
  params: {
    username?: string;
    email?: string;
    avatar?: string;
  },
) {
  return apiClient.put<API.Response<API.User>>(`/api/user/${id}`, params);
}

/** 删除用户 */
export async function deleteUser(id: number) {
  return apiClient.delete<API.Response<any>>(`/api/user/${id}`);
}

/** 修改密码 */
export async function changePassword(params: {
  oldPassword: string;
  newPassword: string;
}) {
  return apiClient.put<API.Response<any>>('/api/user/password', params);
}

/** 用户登出 */
export async function logout() {
  return apiClient.post<API.Response<any>>('/api/auth/logout', undefined);
}
