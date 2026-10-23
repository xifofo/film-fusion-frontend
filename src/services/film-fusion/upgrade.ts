import { apiClient } from '@/lib/api-client';

export type UpgradeCondition = {
  op: 'all' | 'any' | 'not' | 'match';
  children?: UpgradeCondition[];
  field?:
    | 'resolution'
    | 'source'
    | 'codec'
    | 'effect'
    | 'group'
    | 'name'
    | 'audio_codec'
    | 'audio_channels'
    | 'audio_language'
    | 'subtitle';
  values?: string[];
  match?: 'equals' | 'contains' | 'regex';
};

export type UpgradeRule = {
  name: string;
  resolutions?: string[];
  sources?: string[];
  codecs?: string[];
  effects?: string[];
  groups?: string[];
  audio_codecs?: string[];
  audio_channels?: string[];
  audio_languages?: string[];
  subtitles?: string[];
  include?: string;
  exclude?: string;
  include_regex?: string;
  exclude_regex?: string;
  condition?: UpgradeCondition;
  score?: number;
};

export type UpgradePolicy = {
  enabled: boolean;
  group_id?: number;
  group_revision?: number;
  name: string;
  rules: UpgradeRule[];
  bonuses: UpgradeRule[];
  exclude: string[];
  exclude_condition?: UpgradeCondition;
  max_size_mb: number;
  same_tier: boolean;
  min_score_gain: number;
};

export type UpgradePolicyReference = { enabled: boolean; group_id: number };
export type UpgradePolicyInput = UpgradePolicy | UpgradePolicyReference;

export type UpgradeRuleGroup = {
  id: number;
  name: string;
  description: string;
  revision: number;
  policy: UpgradePolicy;
  directory_count: number;
  created_at: string;
  updated_at: string;
};

export type UpgradeRuleGroupInput = {
  name: string;
  description: string;
  policy: UpgradePolicy;
};

const ruleGroupsPath = '/api/organize/upgrade/rule-groups';
export const getUpgradeRuleGroups = () =>
  apiClient.get<API.Response<UpgradeRuleGroup[]>>(ruleGroupsPath);
export const createUpgradeRuleGroup = (data: UpgradeRuleGroupInput) =>
  apiClient.post<API.Response<UpgradeRuleGroup>>(ruleGroupsPath, data);
export const updateUpgradeRuleGroup = (
  id: number,
  data: UpgradeRuleGroupInput & { expected_revision: number },
) =>
  apiClient.put<API.Response<UpgradeRuleGroup>>(
    `${ruleGroupsPath}/${id}`,
    data,
  );
export const deleteUpgradeRuleGroup = (id: number, expectedRevision: number) =>
  apiClient.delete<API.Response<null>>(`${ruleGroupsPath}/${id}`, {
    params: { expected_revision: expectedRevision },
  });

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

export const upgradeAudioLanguageLabels: Record<string, string> = {
  zh: '国语（zh）',
  en: '英语（en）',
  ja: '日语（ja）',
  ko: '韩语（ko）',
  yue: '粤语（yue）',
};

export const upgradeSubtitleLabels: Record<string, string> = {
  'zh-Hans': '简体中文（zh-Hans）',
  'zh-Hant': '繁体中文（zh-Hant）',
  zh: '中文（zh）',
  en: '英语（en）',
  ja: '日语（ja）',
  ko: '韩语（ko）',
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
  policy: UpgradePolicyInput;
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
