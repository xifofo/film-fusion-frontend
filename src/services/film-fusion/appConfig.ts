import { apiClient } from '@/lib/api-client';

/** 读取登录页公开配置（无需登录） */
export async function getPublicAppConfig(options?: { [key: string]: any }) {
  return apiClient.get<API.Response<API.PublicAppConfig>>(
    '/api/public-config',
    { ...(options || {}) },
  );
}

/** 读取 YAML 与数据库运行配置的统一视图（密钥脱敏） */
export async function getAppConfig(options?: { [key: string]: any }) {
  return apiClient.get<API.Response<API.AppConfigResult>>('/api/app-config', {
    ...(options || {}),
  });
}

/** 按配置归属保存到 YAML 或数据库并热重载 */
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

/** 使用已保存的渠道配置发送统一测试通知 */
export async function testNotificationChannel(
  channel: API.NotificationChannelID,
  options?: { [key: string]: any },
) {
  return apiClient.post<API.Response<unknown>>(
    `/api/notifications/channels/${channel}/test`,
    undefined,
    { ...(options || {}) },
  );
}
