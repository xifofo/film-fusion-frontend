import { apiClient } from '@/lib/api-client';

export type UpgradeRule = {
  name: string;
  resolutions?: string[];
  sources?: string[];
  codecs?: string[];
  effects?: string[];
  groups?: string[];
  include?: string;
  score?: number;
};

export type UpgradePolicy = {
  enabled: boolean;
  name: string;
  rules: UpgradeRule[];
  bonuses: UpgradeRule[];
  exclude: string[];
  max_size_mb: number;
  same_tier: boolean;
  min_score_gain: number;
};

export type UpgradeRank = {
  tier: number;
  label: string;
  score: number;
  reasons: string[];
  rejected?: boolean;
};
export type UpgradeDecision = {
  action: 'add' | 'replace' | 'keep' | 'review';
  reason: string;
  media_key: string;
  rank: UpgradeRank;
  existing: Array<{
    file: { file_id: string; name: string; size: number };
    cloud_path: string;
    rank: UpgradeRank;
    bindings: Array<{ path: string }>;
  }>;
  bindings: Array<{ path: string; content: string }>;
  changes: Array<{ before: { path: string; exists: boolean }; write: boolean }>;
};

export type UpgradeJob = {
  id: string;
  status: 'pending' | 'running' | 'failed' | 'completed' | 'rolled_back';
  restoring?: boolean;
  error?: string;
  recovery_path: string;
  refresh_error?: string;
  lease_until?: string;
  created_at: string;
};

export const upgradeActionLabels = {
  add: '新增',
  replace: '替换旧版',
  keep: '保留已有',
  review: '待确认',
};

export function canApplyUpgrade(item: { upgrade?: UpgradeDecision }) {
  return (
    !item.upgrade ||
    item.upgrade.action === 'add' ||
    item.upgrade.action === 'replace'
  );
}

export const getUpgradePresets = () =>
  apiClient.get<API.Response<Record<string, UpgradePolicy>>>(
    '/api/organize/upgrade/presets',
  );
export const testUpgradePolicy = (data: {
  policy: UpgradePolicy;
  incoming: string;
  existing: string;
  incoming_size_mb?: number;
  existing_size_mb?: number;
}) =>
  apiClient.post<
    API.Response<{
      action: UpgradeDecision['action'];
      reason: string;
      incoming: UpgradeRank;
      existing: UpgradeRank;
    }>
  >('/api/organize/upgrade/test', data);
export const getUpgradeJobs = (id: number) =>
  apiClient.get<API.Response<UpgradeJob[]>>('/api/organize/upgrade/jobs', {
    params: { cloud_directory_id: id },
  });
export const retryUpgradeJob = (id: string, restore = false) =>
  apiClient.post<
    API.Response<{ result: API.Organize115CookieResult; error?: string }>
  >(
    `/api/organize/upgrade/jobs/${encodeURIComponent(id)}/retry`,
    { restore },
    { timeout: 0 },
  );

export const refreshUpgradeLibrary = (id: string) =>
  apiClient.post<API.Response<UpgradeJob>>(
    `/api/organize/upgrade/jobs/${encodeURIComponent(id)}/refresh`,
  );
