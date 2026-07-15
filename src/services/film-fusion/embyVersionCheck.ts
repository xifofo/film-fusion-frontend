import { request } from '@umijs/max';

/** 扫描云路径映射对应的本地目录，找出电影/剧集单集多版本。 */
export async function scanEmbyVersionCheck(
  data: API.EmbyVersionCheckParams,
  options?: { [key: string]: any },
) {
  return request<API.Response<API.EmbyVersionCheckResult>>(
    '/api/emby-version-check/scan',
    {
      method: 'POST',
      data,
      ...(options || {}),
    },
  );
}
