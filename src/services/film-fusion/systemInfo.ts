import { apiClient } from '@/lib/api-client';
import type { RSSGeneratorWorkerStatus } from './rssGenerator';

export type SystemInfo = {
  rss_generator_worker: {
    url: string;
    token?: string;
    token_error?: string;
    status: RSSGeneratorWorkerStatus;
  };
};

export async function getSystemInfo() {
  return apiClient.get<API.Response<SystemInfo>>('/api/system-info');
}
