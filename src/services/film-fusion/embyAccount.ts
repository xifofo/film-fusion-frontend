import { apiClient } from '@/lib/api-client';

export type EmbyAccount = {
  server_id: string;
  emby_user_id: string;
  name: string;
  is_disabled: boolean;
  is_administrator: boolean;
  last_login_date: string;
  last_activity_date: string;
  expires_at: string | null;
  disabled_at: string | null;
  last_checked_at: string | null;
  last_error: string;
};

export function getEmbyAccounts() {
  return apiClient.get<API.Response<EmbyAccount[]>>('/api/emby-accounts', {
    skipErrorHandler: true,
  });
}

export function setEmbyAccountExpiry(
  userId: string,
  data: { server_id: string; expires_at: string | null },
) {
  return apiClient.put<API.Response<unknown>>(
    `/api/emby-accounts/${encodeURIComponent(userId)}/expiry`,
    data,
  );
}
