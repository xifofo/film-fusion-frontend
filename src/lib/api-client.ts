import axios, {
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { showApiError } from '@/lib/antd-feedback';

export type ApiRequestConfig<D = unknown> = AxiosRequestConfig<D> & {
  skipErrorHandler?: boolean;
};

const LOGIN_PATH = '/user/login';

const redirectToLogin = () => {
  localStorage.removeItem('token');

  if (window.location.pathname === LOGIN_PATH) {
    return;
  }

  const redirect = `${window.location.pathname}${window.location.search}`;
  const search = new URLSearchParams({ redirect });
  window.location.replace(`${LOGIN_PATH}?${search}`);
};

const axiosInstance = axios.create({
  baseURL: '/',
  timeout: 30_000,
});

axiosInstance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (!axios.isAxiosError(error)) {
      showApiError('请求失败，请重试');
      return Promise.reject(error);
    }

    const config = error.config as ApiRequestConfig | undefined;
    if (config?.skipErrorHandler) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401) {
      if (window.location.pathname !== LOGIN_PATH) {
        showApiError('登录已过期，请重新登录');
      }
      redirectToLogin();
      return Promise.reject(error);
    }

    if (error.response) {
      const responseData = error.response.data as
        | { message?: string }
        | undefined;
      showApiError(
        responseData?.message || `请求失败（HTTP ${error.response.status}）`,
      );
    } else if (error.request) {
      showApiError('服务暂时无响应，请稍后重试');
    } else {
      showApiError(error.message || '请求失败，请重试');
    }

    return Promise.reject(error);
  },
);

const responseData = <T>(response: AxiosResponse<T>) => response.data;

export const apiClient = {
  get<T>(url: string, config?: ApiRequestConfig): Promise<T> {
    return axiosInstance.get<T>(url, config).then(responseData);
  },

  post<T, D = unknown>(
    url: string,
    data?: D,
    config?: ApiRequestConfig<D>,
  ): Promise<T> {
    return axiosInstance
      .post<T, AxiosResponse<T>, D>(url, data, config)
      .then(responseData);
  },

  put<T, D = unknown>(
    url: string,
    data?: D,
    config?: ApiRequestConfig<D>,
  ): Promise<T> {
    return axiosInstance
      .put<T, AxiosResponse<T>, D>(url, data, config)
      .then(responseData);
  },

  patch<T, D = unknown>(
    url: string,
    data?: D,
    config?: ApiRequestConfig<D>,
  ): Promise<T> {
    return axiosInstance
      .patch<T, AxiosResponse<T>, D>(url, data, config)
      .then(responseData);
  },

  delete<T, D = unknown>(
    url: string,
    config?: ApiRequestConfig<D>,
  ): Promise<T> {
    return axiosInstance
      .delete<T, AxiosResponse<T>, D>(url, config)
      .then(responseData);
  },
};
