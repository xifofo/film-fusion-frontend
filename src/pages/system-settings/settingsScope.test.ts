import { describe, expect, it } from 'vitest';
import {
  buildScopedAppConfig,
  getConfigFieldValue,
  type SettingsFieldPath,
} from './settingsScope';

const baseConfig = {
  server: {
    port: '9000',
    username: 'admin',
    password: '',
    download_115_concurrency: 3,
    cookie_115_default_app: 'web',
    web_115_user_agent: 'saved-ua',
    process_new_media: true,
    security: { enabled: true },
  },
  media_recognition: {
    source: 'shadow',
  },
  emby: {
    enabled: true,
    url: 'http://emby.example',
    run_proxy_port: 8097,
    api_key: '',
    admin_user_id: 'admin-id',
    cache_time: 60,
    add_current_media_info: true,
    add_next_media_info: true,
    security: { enabled: true },
    cover: { enabled: true, width: 1000 },
  },
} as API.AppConfig;

const valuesFrom = (values: unknown) => (path: SettingsFieldPath) =>
  getConfigFieldValue(values, path);

describe('system settings tab scopes', () => {
  it('saves server fields without carrying unsaved 115 changes', () => {
    const formValues = structuredClone(baseConfig);
    formValues.server.port = '9100';
    formValues.server.download_115_concurrency = 99;
    formValues.server.web_115_user_agent = 'unsaved-ua';

    const result = buildScopedAppConfig(
      baseConfig,
      'server',
      valuesFrom(formValues),
    );

    expect(result.server.port).toBe('9100');
    expect(result.server.download_115_concurrency).toBe(3);
    expect(result.server.web_115_user_agent).toBe('saved-ua');
  });

  it('saves 115 fields without carrying unsaved server changes', () => {
    const formValues = structuredClone(baseConfig);
    formValues.server.port = '';
    formValues.server.download_115_concurrency = 8;
    formValues.server.web_115_user_agent = 'new-ua';

    const result = buildScopedAppConfig(
      baseConfig,
      '115',
      valuesFrom(formValues),
    );

    expect(result.server.port).toBe('9000');
    expect(result.server.download_115_concurrency).toBe(8);
    expect(result.server.web_115_user_agent).toBe('new-ua');
  });

  it('saves Emby connection and cover fields together', () => {
    const formValues = structuredClone(baseConfig);
    formValues.emby.url = 'http://new-emby.example';
    formValues.emby.cover.width = 2000;

    const result = buildScopedAppConfig(
      baseConfig,
      'emby',
      valuesFrom(formValues),
    );

    expect(result.emby.url).toBe('http://new-emby.example');
    expect(result.emby.cover.width).toBe(2000);
  });

  it('saves media recognition mode without carrying another tab change', () => {
    const formValues = structuredClone(baseConfig);
    formValues.media_recognition.source = 'local';
    formValues.server.port = '9999';

    const result = buildScopedAppConfig(
      baseConfig,
      'mediaRecognition',
      valuesFrom(formValues),
    );

    expect(result.media_recognition.source).toBe('local');
    expect(result.server.port).toBe('9000');
  });
});
