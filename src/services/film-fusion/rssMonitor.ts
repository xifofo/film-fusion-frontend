import { request } from '@umijs/max';

export async function getRSSMonitorDashboard() {
  return request<API.Response<API.RSSMonitorDashboard>>('/api/rss-monitor', {
    method: 'GET',
  });
}

export async function saveRSSMonitorSettings(
  settings: API.RSSMonitorSettingsInput,
) {
  return request<API.Response<API.RSSMonitorSettings>>(
    '/api/rss-monitor/settings',
    { method: 'PUT', data: { settings } },
  );
}

export async function createRSSSource(source: API.RSSMonitorSettingsInput) {
  return request<API.Response<API.RSSMonitorSettings>>(
    '/api/rss-monitor/sources',
    { method: 'POST', data: source },
  );
}

export async function updateRSSSource(
  id: number,
  source: API.RSSMonitorSettingsInput,
) {
  return request<API.Response<API.RSSMonitorSettings>>(
    `/api/rss-monitor/sources/${id}`,
    { method: 'PUT', data: source },
  );
}

export async function deleteRSSSource(id: number) {
  return request<API.Response<Record<string, never>>>(
    `/api/rss-monitor/sources/${id}`,
    { method: 'DELETE' },
  );
}

export async function refreshRSSMonitor() {
  return request<API.Response<API.RSSRefreshResult>>(
    '/api/rss-monitor/refresh',
    { method: 'POST' },
  );
}

export async function createRSSRule(rule: API.RSSNotificationRuleInput) {
  return request<API.Response<API.RSSNotificationRule>>(
    '/api/rss-monitor/rules',
    { method: 'POST', data: rule },
  );
}

export async function updateRSSRule(
  id: number,
  rule: API.RSSNotificationRuleInput,
) {
  return request<API.Response<API.RSSNotificationRule>>(
    `/api/rss-monitor/rules/${id}`,
    { method: 'PUT', data: rule },
  );
}

export async function deleteRSSRule(id: number) {
  return request<API.Response<Record<string, never>>>(
    `/api/rss-monitor/rules/${id}`,
    { method: 'DELETE' },
  );
}

export async function testRSSRule(data: {
  rule: API.RSSNotificationRuleInput;
  title: string;
  category: string;
}) {
  return request<API.Response<API.RSSRuleTestResult>>(
    '/api/rss-monitor/rules/test',
    { method: 'POST', data },
  );
}
