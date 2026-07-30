import { apiClient } from '@/lib/api-client';

export async function getRSSMonitorDashboard() {
  return apiClient.get<API.Response<API.RSSMonitorDashboard>>(
    '/api/rss-monitor',
  );
}

export async function saveRSSMonitorSettings(
  settings: API.RSSMonitorSettingsInput,
) {
  return apiClient.put<API.Response<API.RSSMonitorSettings>>(
    '/api/rss-monitor/settings',
    { settings },
  );
}

export async function createRSSSource(source: API.RSSMonitorSettingsInput) {
  return apiClient.post<API.Response<API.RSSMonitorSettings>>(
    '/api/rss-monitor/sources',
    source,
  );
}

export async function updateRSSSource(
  id: number,
  source: API.RSSMonitorSettingsInput,
) {
  return apiClient.put<API.Response<API.RSSMonitorSettings>>(
    `/api/rss-monitor/sources/${id}`,
    source,
  );
}

export async function deleteRSSSource(id: number) {
  return apiClient.delete<API.Response<Record<string, never>>>(
    `/api/rss-monitor/sources/${id}`,
  );
}

export async function refreshRSSMonitor() {
  return apiClient.post<API.Response<API.RSSRefreshResult>>(
    '/api/rss-monitor/refresh',
    undefined,
  );
}

export async function createRSSRule(rule: API.RSSNotificationRuleInput) {
  return apiClient.post<API.Response<API.RSSNotificationRule>>(
    '/api/rss-monitor/rules',
    rule,
  );
}

export async function updateRSSRule(
  id: number,
  rule: API.RSSNotificationRuleInput,
) {
  return apiClient.put<API.Response<API.RSSNotificationRule>>(
    `/api/rss-monitor/rules/${id}`,
    rule,
  );
}

export async function deleteRSSRule(id: number) {
  return apiClient.delete<API.Response<Record<string, never>>>(
    `/api/rss-monitor/rules/${id}`,
  );
}

export async function testRSSRule(data: {
  rule: API.RSSNotificationRuleInput;
  title: string;
  category: string;
}) {
  return apiClient.post<API.Response<API.RSSRuleTestResult>>(
    '/api/rss-monitor/rules/test',
    data,
  );
}
