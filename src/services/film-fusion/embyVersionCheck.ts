import { apiClient } from '@/lib/api-client';

/** 启动后台扫描，立即返回任务快照。 */
export async function scanEmbyVersionCheck(
  data: API.EmbyVersionCheckParams,
  options?: { [key: string]: any },
) {
  return apiClient.post<API.Response<API.EmbyVersionCheckJob>>(
    '/api/emby-version-check/scan',
    data,
    { ...(options || {}) },
  );
}

/** 查询当前用户正在运行或最近完成的本地多版本检查。 */
export async function getEmbyVersionCheckStatus() {
  return apiClient.get<API.Response<API.EmbyVersionCheckStatus>>(
    '/api/emby-version-check/status',
  );
}

/** 获取当前用户的本地多版本定时检查设置。 */
export async function getEmbyVersionCheckSetting() {
  return apiClient.get<API.Response<API.EmbyVersionCheckSetting>>(
    '/api/emby-version-check/setting',
  );
}

/** 更新当前用户的本地多版本定时检查设置。 */
export async function updateEmbyVersionCheckSetting(
  data: API.EmbyVersionCheckSettingParams,
) {
  return apiClient.put<API.Response<API.EmbyVersionCheckSetting>>(
    '/api/emby-version-check/setting',
    data,
  );
}
