import { apiClient } from '@/lib/api-client';

/** 读取登录页公开配置（无需登录） */
export async function getPublicAppConfig(options?: { [key: string]: any }) {
  return apiClient.get<API.Response<API.PublicAppConfig>>(
    '/api/public-config',
    { ...(options || {}) },
  );
}

/** 读取 config.yaml 当前配置（密钥脱敏） */
export async function getAppConfig(options?: { [key: string]: any }) {
  return apiClient.get<API.Response<API.AppConfigResult>>('/api/app-config', {
    ...(options || {}),
  });
}

/** 保存配置到 config.yaml 并热重载 */
export async function saveAppConfig(
  config: API.AppConfig,
  options?: { [key: string]: any },
) {
  return apiClient.put<API.Response<{ restart_fields: string[] }>>(
    '/api/app-config',
    { config },
    { ...(options || {}) },
  );
}

/** 上传登录页背景到后端持久化 data 目录 */
export async function uploadLoginBackground(
  file: File,
  options?: { [key: string]: any },
) {
  const formData = new FormData();
  formData.append('file', file);

  return apiClient.post<
    API.Response<API.LoginBackgroundUploadResult>,
    FormData
  >('/api/site-assets/login-background', formData, { ...(options || {}) });
}

/** 使用已保存的 Telegram 配置发送测试消息 */
export async function testTelegramNotification(options?: {
  [key: string]: any;
}) {
  return apiClient.post<API.Response<unknown>>(
    '/api/telegram/test',
    undefined,
    { ...(options || {}) },
  );
}
