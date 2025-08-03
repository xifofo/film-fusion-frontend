import { request } from '@umijs/max';

/** 用户登录 */
export async function login(params: API.LoginParams) {
  try {
    const response = await request<API.Response<API.LoginResult>>('/api/auth/login', {
      method: 'POST',
      data: params,
    });

    if (response.code !== 0) {
      return { error: response.message || '登录失败'};
    }

    return { response };
  } catch (error: any) {
    return { error }
  }
}

/** 获取当前用户信息 */
export async function getCurrentUser() {
  return request<API.Response<API.User>>('/api/me', {
    method: 'GET',
  });
}

/** 获取用户列表 */
export async function getUsers(params?: API.PageParams) {
  return request<API.Response<API.PageResult<API.User>>>('/api/user/list', {
    method: 'GET',
    params,
  });
}

/** 创建用户 */
export async function createUser(params: {
  username: string;
  password: string;
  email?: string;
}) {
  return request<API.Response<API.User>>('/api/user', {
    method: 'POST',
    data: params,
  });
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
  return request<API.Response<API.User>>(`/api/user/${id}`, {
    method: 'PUT',
    data: params,
  });
}

/** 删除用户 */
export async function deleteUser(id: number) {
  return request<API.Response<any>>(`/api/user/${id}`, {
    method: 'DELETE',
  });
}

/** 修改密码 */
export async function changePassword(params: {
  oldPassword: string;
  newPassword: string;
}) {
  return request<API.Response<any>>('/api/user/password', {
    method: 'PUT',
    data: params,
  });
}

/** 用户登出 */
export async function logout() {
  return request<API.Response<any>>('/api/auth/logout', {
    method: 'POST',
  });
}
