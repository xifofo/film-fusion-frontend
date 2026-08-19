import { apiClient } from '@/lib/api-client';

export async function getEmbyImageOptimizationSettings() {
  return apiClient.get<API.Response<API.EmbyImageOptimizationSettings>>(
    '/api/emby-image-optimization/settings',
    { skipErrorHandler: true },
  );
}

export async function saveEmbyImageOptimizationSettings(
  settings: API.EmbyImageOptimizationSettings,
) {
  return apiClient.put<API.Response<API.EmbyImageOptimizationSettings>>(
    '/api/emby-image-optimization/settings',
    { settings },
    { skipErrorHandler: true },
  );
}

export async function getEmbyImageOptimizationSamples() {
  return apiClient.get<API.Response<{ samples: API.EmbyImageSample[] }>>(
    '/api/emby-image-optimization/samples',
    { skipErrorHandler: true },
  );
}

export async function testEmbyImageOptimization(
  data: API.EmbyImageTestRequest,
) {
  return apiClient.post<API.Response<API.EmbyImageTestResult>>(
    '/api/emby-image-optimization/test',
    data,
    { skipErrorHandler: true },
  );
}
