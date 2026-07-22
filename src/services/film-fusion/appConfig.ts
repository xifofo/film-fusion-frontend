import { request } from '@umijs/max';

/** 读取 config.yaml 当前配置（密钥脱敏） */
export async function getAppConfig(options?: { [key: string]: any }) {
  return request<API.Response<API.AppConfigResult>>('/api/app-config', {
    method: 'GET',
    ...(options || {}),
  });
}

/** 保存配置到 config.yaml 并热重载 */
export async function saveAppConfig(
  config: API.AppConfig,
  options?: { [key: string]: any },
) {
  return request<API.Response<{ restart_fields: string[] }>>(
    '/api/app-config',
    {
      method: 'PUT',
      data: { config },
      ...(options || {}),
    },
  );
}

/** 使用已保存的 Telegram 配置发送测试消息 */
export async function testTelegramNotification(options?: {
  [key: string]: any;
}) {
  return request<API.Response<unknown>>('/api/telegram/test', {
    method: 'POST',
    ...(options || {}),
  });
}
