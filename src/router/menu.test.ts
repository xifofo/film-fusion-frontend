import { describe, expect, it } from 'vitest';

import { findMenuTrail } from './menu';

describe('findMenuTrail', () => {
  it('finds a nested Emby page', () => {
    expect(findMenuTrail('/emby/cover').map((item) => item.name)).toEqual([
      'Emby',
      '封面生成',
    ]);
  });

  it('groups watch history under Emby', () => {
    expect(findMenuTrail('/emby-watch').map((item) => item.name)).toEqual([
      'Emby',
      '观看记录',
    ]);
  });

  it('prefers a more specific log route over the Emby prefix', () => {
    expect(findMenuTrail('/emby/proxy-log').map((item) => item.name)).toEqual([
      '日志中心',
      '代理日志',
    ]);
  });

  it('keeps directory detail routes attached to directory configuration', () => {
    expect(
      findMenuTrail('/directories/organize/42').map((item) => item.name),
    ).toEqual(['目录配置']);
  });

  it('exposes the independent RSS automation module', () => {
    expect(findMenuTrail('/rss-automation').map((item) => item.name)).toEqual([
      'RSS',
      'RSS 自动化',
    ]);
  });

  it('exposes the independent RSS generator module', () => {
    expect(findMenuTrail('/rss-generator').map((item) => item.name)).toEqual([
      'RSS',
      'RSS 生成器',
    ]);
  });

  it('exposes downloader account settings', () => {
    expect(findMenuTrail('/downloaders').map((item) => item.name)).toEqual([
      '下载器设置',
    ]);
  });

  it('exposes the system information page', () => {
    expect(findMenuTrail('/system-info').map((item) => item.name)).toEqual([
      '系统信息',
    ]);
  });

  it('does not expose the retired RSS monitoring entry', () => {
    expect(findMenuTrail('/rss-monitor')).toEqual([]);
  });

  it('returns an empty trail for an unknown route', () => {
    expect(findMenuTrail('/unknown')).toEqual([]);
  });
});
