import { request } from '@umijs/max';

export async function getEmbyImageOptimizationSettings() {
  return request<API.Response<API.EmbyImageOptimizationSettings>>(
    '/api/emby-image-optimization/settings',
    { method: 'GET' },
  );
}

export async function saveEmbyImageOptimizationSettings(
  settings: API.EmbyImageOptimizationSettings,
) {
  return request<API.Response<API.EmbyImageOptimizationSettings>>(
    '/api/emby-image-optimization/settings',
    { method: 'PUT', data: { settings } },
  );
}

export async function getEmbyImageOptimizationSamples() {
  return request<API.Response<{ samples: API.EmbyImageSample[] }>>(
    '/api/emby-image-optimization/samples',
    { method: 'GET' },
  );
}

export async function testEmbyImageOptimization(
  data: API.EmbyImageTestRequest,
) {
  return request<API.Response<API.EmbyImageTestResult>>(
    '/api/emby-image-optimization/test',
    { method: 'POST', data },
  );
}
