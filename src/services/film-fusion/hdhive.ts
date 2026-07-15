import { request } from '@umijs/max';

export async function pingHDHive(options?: { [key: string]: any }) {
  return request<API.Response<API.HDHiveAPIResponse<Record<string, any>>>>(
    '/api/hdhive/ping',
    {
      method: 'GET',
      ...(options || {}),
    },
  );
}

export async function getHDHiveQuota(options?: { [key: string]: any }) {
  return request<API.Response<API.HDHiveAPIResponse<API.HDHiveQuota>>>(
    '/api/hdhive/quota',
    {
      method: 'GET',
      ...(options || {}),
    },
  );
}

export async function getHDHiveUsageToday(options?: { [key: string]: any }) {
  return request<API.Response<API.HDHiveAPIResponse<API.HDHiveUsageToday>>>(
    '/api/hdhive/usage/today',
    {
      method: 'GET',
      ...(options || {}),
    },
  );
}

export async function getHDHiveMe(options?: { [key: string]: any }) {
  return request<API.Response<API.HDHiveAPIResponse<API.HDHiveMe>>>(
    '/api/hdhive/me',
    {
      method: 'GET',
      ...(options || {}),
    },
  );
}

export async function getHDHiveAuthorizeURL(
  params?: { state?: string; scope?: string; response_mode?: string },
  options?: { [key: string]: any },
) {
  return request<API.Response<API.HDHiveAuthorizeURLResult>>(
    '/api/hdhive/oauth/authorize-url',
    {
      method: 'GET',
      params,
      ...(options || {}),
    },
  );
}

export async function exchangeHDHiveToken(
  data: { code: string; redirect_uri?: string },
  options?: { [key: string]: any },
) {
  return request<API.Response<API.HDHiveAPIResponse<API.HDHiveOAuthToken>>>(
    '/api/hdhive/oauth/exchange',
    {
      method: 'POST',
      data,
      ...(options || {}),
    },
  );
}

export async function refreshHDHiveToken(options?: { [key: string]: any }) {
  return request<API.Response<API.HDHiveAPIResponse<API.HDHiveOAuthToken>>>(
    '/api/hdhive/oauth/refresh',
    {
      method: 'POST',
      ...(options || {}),
    },
  );
}

export async function queryHDHiveResources(
  mediaType: 'movie' | 'tv' | string,
  tmdbId: string,
  options?: { [key: string]: any },
) {
  const encodedMediaType = encodeURIComponent(mediaType);
  const encodedTmdbId = encodeURIComponent(tmdbId);
  return request<API.Response<API.HDHiveAPIResponse<API.HDHiveResource[]>>>(
    `/api/hdhive/resources/${encodedMediaType}/${encodedTmdbId}`,
    {
      method: 'GET',
      ...(options || {}),
    },
  );
}

export async function unlockHDHiveResources(
  data: { slug?: string; slugs?: string[] },
  options?: { [key: string]: any },
) {
  return request<
    API.Response<
      API.HDHiveAPIResponse<API.HDHiveUnlockResult | API.HDHiveBatchUnlockResult>
    >
  >('/api/hdhive/resources/unlock', {
    method: 'POST',
    data,
    ...(options || {}),
  });
}
