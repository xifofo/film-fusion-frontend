import { apiClient } from '@/lib/api-client';

export type RSSRelayInput = {
  name: string;
  feed_url: string;
  enabled: boolean;
  min_interval_seconds: number;
};

export type RSSRelay = RSSRelayInput & {
  id: number;
  relay_path: string;
  has_cache: boolean;
  last_attempt_at?: string;
  last_success_at?: string;
  next_fetch_at?: string;
  last_error?: string;
};

export const getRSSRelays = () =>
  apiClient.get<API.Response<RSSRelay[]>>('/api/rss-relays');
export const createRSSRelay = (input: RSSRelayInput) =>
  apiClient.post<API.Response<RSSRelay>>('/api/rss-relays', input);
export const updateRSSRelay = (id: number, input: RSSRelayInput) =>
  apiClient.put<API.Response<RSSRelay>>(`/api/rss-relays/${id}`, input);
export const setRSSRelayEnabled = (id: number, enabled: boolean) =>
  apiClient.patch<API.Response<RSSRelay>>(`/api/rss-relays/${id}/enabled`, {
    enabled,
  });
export const refreshRSSRelay = (id: number) =>
  apiClient.post<API.Response<RSSRelay>>(`/api/rss-relays/${id}/refresh`);
export const rotateRSSRelayToken = (id: number) =>
  apiClient.post<API.Response<RSSRelay>>(`/api/rss-relays/${id}/token`);
export const deleteRSSRelay = (id: number) =>
  apiClient.delete<API.Response<unknown>>(`/api/rss-relays/${id}`);
