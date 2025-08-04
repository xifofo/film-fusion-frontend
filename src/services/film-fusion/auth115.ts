import { request } from '@umijs/max';

// 统一响应结构
export interface ApiResponse<T = any> {
  code: number;        // 状态码，0表示成功，其他值表示错误
  message: string;     // 响应消息
  data: T | null;      // 响应数据，成功时包含具体数据，失败时为null
}

export interface Auth115QRCodeRequest {
  client_id: string;
  name: string;
}

export interface Auth115QRCodeData {
  qr_code_data: string;
  session_id: string;
}

export interface Auth115StatusRequest {
  session_id: string;
}

export interface Auth115StatusData {
  status: number;
}

export interface Auth115CompleteRequest {
  session_id: string;
  storage_id?: number;  // 可选的存储ID，用于更新现有记录
}

export interface Auth115CompleteData {
  storage_id: number;
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

// 获取JWT Token
const getAuthToken = () => {
  return localStorage.getItem('token') || '';
};

// 获取授权二维码
export async function getAuth115QRCode(params: Auth115QRCodeRequest): Promise<Auth115QRCodeData> {
  const response = await request<ApiResponse<Auth115QRCodeData>>('/api/auth/115/qrcode', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`,
    },
    data: params,
    skipErrorHandler: true,
  });

  if (response.code !== 0) {
    throw new Error(response.message || '请求失败');
  }

  if (!response.data) {
    throw new Error('响应数据为空');
  }

  return response.data;
}

// 检查授权状态
export async function checkAuth115Status(params: Auth115StatusRequest): Promise<Auth115StatusData> {
  const response = await request<ApiResponse<Auth115StatusData>>('/api/auth/115/status', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`,
    },
    data: params,
    skipErrorHandler: true,
  });

  if (response.code !== 0) {
    throw new Error(response.message || '请求失败');
  }

  if (!response.data) {
    throw new Error('响应数据为空');
  }

  return response.data;
}

// 完成授权
export async function completeAuth115(params: Auth115CompleteRequest): Promise<Auth115CompleteData> {
  const response = await request<ApiResponse<Auth115CompleteData>>('/api/auth/115/complete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`,
    },
    data: params,
    skipErrorHandler: true,
  });

  if (response.code !== 0) {
    throw new Error(response.message || '请求失败');
  }

  if (!response.data) {
    throw new Error('响应数据为空');
  }

  return response.data;
}
