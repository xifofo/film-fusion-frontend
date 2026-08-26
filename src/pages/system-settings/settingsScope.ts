import type { NamePath } from 'antd/es/form/interface';

export type SettingsTabKey =
  | 'server'
  | '115'
  | 'appearance'
  | 'webhook'
  | 'emby'
  | 'notifications'
  | 'mediaRecognition'
  | 'moviepilot'
  | 'tmdb'
  | 'hdhive'
  | 'log'
  | 'jwt';

export type SettingsFieldPath = Extract<NamePath<API.AppConfig>, unknown[]>;

interface SettingsTabScope {
  label: string;
  fields: SettingsFieldPath[];
}

export const SETTINGS_TAB_SCOPES: Record<SettingsTabKey, SettingsTabScope> = {
  server: {
    label: '服务器',
    fields: [
      ['server', 'port'],
      ['server', 'username'],
      ['server', 'password'],
      ['server', 'security'],
      ['server', 'process_new_media'],
    ],
  },
  '115': {
    label: '115',
    fields: [
      ['server', 'download_115_concurrency'],
      ['server', 'cookie_115_default_app'],
      ['server', 'web_115_user_agent'],
    ],
  },
  appearance: {
    label: '登录页外观',
    fields: [['site']],
  },
  webhook: {
    label: 'Webhook',
    fields: [['webhook']],
  },
  emby: {
    label: 'Emby',
    fields: [
      ['emby', 'enabled'],
      ['emby', 'url'],
      ['emby', 'run_proxy_port'],
      ['emby', 'api_key'],
      ['emby', 'admin_user_id'],
      ['emby', 'cache_time'],
      ['emby', 'add_current_media_info'],
      ['emby', 'add_next_media_info'],
      ['emby', 'security'],
      ['emby', 'cover'],
    ],
  },
  notifications: {
    label: '通知',
    fields: [['notifications']],
  },
  mediaRecognition: {
    label: '媒体识别',
    fields: [['media_recognition']],
  },
  moviepilot: {
    label: 'MoviePilot',
    fields: [['moviepilot']],
  },
  tmdb: {
    label: 'TMDB',
    fields: [['tmdb']],
  },
  hdhive: {
    label: 'HDHive',
    fields: [['hdhive']],
  },
  log: {
    label: '日志',
    fields: [['log']],
  },
  jwt: {
    label: '安全 (JWT)',
    fields: [
      ['jwt', 'expire_time'],
      ['jwt', 'issuer'],
    ],
  },
};

export const getConfigFieldValue = (source: unknown, path: SettingsFieldPath) =>
  path.reduce<unknown>((current, key) => {
    if (current === null || typeof current !== 'object') {
      return undefined;
    }
    return (current as Record<string, unknown>)[key];
  }, source);

const setConfigFieldValue = (
  target: API.AppConfig,
  path: SettingsFieldPath,
  value: unknown,
) => {
  let current = target as unknown as Record<string, unknown>;
  for (const key of path.slice(0, -1)) {
    const next = current[key];
    if (next === null || typeof next !== 'object' || Array.isArray(next)) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[path[path.length - 1]] = value;
};

export const buildScopedAppConfig = (
  baseConfig: API.AppConfig,
  tabKey: SettingsTabKey,
  readFormValue: (path: SettingsFieldPath) => unknown,
) => {
  const values = structuredClone(baseConfig);
  for (const fieldPath of SETTINGS_TAB_SCOPES[tabKey].fields) {
    setConfigFieldValue(values, fieldPath, readFormValue(fieldPath));
  }
  return values;
};
