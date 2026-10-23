import { apiClient } from '@/lib/api-client';

export type PlutoFishConfig = {
  enabled: boolean;
  baseURL: string;
  ownerUID: string;
  mode: 'sse' | 'poll';
  keyConfigured: boolean;
  pollSeconds: number;
  mappings: { targetAccountID: string; cloudPathID: number }[];
};

export type PlutoFishConfigInput = Omit<PlutoFishConfig, 'keyConfigured'> & {
  apiKey?: string;
};

export type PlutoFishStatus = {
  state: string;
  lastEventAt?: string;
  lastError: string;
  cursor: string;
  pendingCount: number;
  reviewCount: number;
};

export type PlutoFishEvent = {
  id: number;
  eventID: string;
  transferID: string;
  type: string;
  schemaVersion?: number;
  status: string;
  workTitle: string;
  fileName: string;
  state: 'pending' | 'review' | 'completed' | 'recorded' | 'duplicate';
  reason: string;
  occurredAt: string;
  outputPath?: string;
};

export const getPlutoFishConfig = (signal?: AbortSignal) =>
  apiClient.get<API.Response<PlutoFishConfig>>('/api/plutofish/config', {
    signal,
    skipErrorHandler: true,
  });

export const updatePlutoFishConfig = (input: PlutoFishConfigInput) =>
  apiClient.put<API.Response<PlutoFishConfig>>('/api/plutofish/config', input, {
    skipErrorHandler: true,
  });

// Read existing local CloudPath configuration; this endpoint never scans a provider.
export const getPlutoFishCloudPaths = (page: number, signal?: AbortSignal) =>
  apiClient.get<API.Response<API.PageResult<API.CloudPath>>>('/api/paths', {
    params: { page, page_size: 100 },
    signal,
    skipErrorHandler: true,
  });

export const getPlutoFishStatus = (signal?: AbortSignal) =>
  apiClient.get<API.Response<PlutoFishStatus>>('/api/plutofish/status', {
    signal,
    skipErrorHandler: true,
  });

export const getPlutoFishEvents = (
  page: number,
  pageSize: number,
  signal?: AbortSignal,
) =>
  apiClient.get<API.Response<{ items: PlutoFishEvent[]; total: number }>>(
    '/api/plutofish/events',
    { params: { page, pageSize }, signal, skipErrorHandler: true },
  );

export const startPlutoFish = () =>
  apiClient.post<API.Response<unknown>>('/api/plutofish/start', undefined, {
    skipErrorHandler: true,
  });

export const stopPlutoFish = () =>
  apiClient.post<API.Response<unknown>>('/api/plutofish/stop', undefined, {
    skipErrorHandler: true,
  });

export const retryPlutoFishEvent = (id: number) =>
  apiClient.post<API.Response<unknown>>(
    `/api/plutofish/events/${id}/retry`,
    undefined,
    {
      skipErrorHandler: true,
    },
  );
