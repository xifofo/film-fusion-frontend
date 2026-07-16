import { request } from '@umijs/max';

/** 启动后台扫描，立即返回任务快照。 */
export async function scanEmbyVersionCheck(
  data: API.EmbyVersionCheckParams,
  options?: { [key: string]: any },
) {
  return request<API.Response<API.EmbyVersionCheckJob>>(
    '/api/emby-version-check/scan',
    {
      method: 'POST',
      data,
      ...(options || {}),
    },
  );
}

/** 查询当前用户正在运行或最近完成的本地多版本检查。 */
export async function getEmbyVersionCheckStatus() {
  return request<API.Response<API.EmbyVersionCheckStatus>>(
    '/api/emby-version-check/status',
    { method: 'GET' },
  );
}
