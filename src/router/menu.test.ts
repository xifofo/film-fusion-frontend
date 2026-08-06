import { describe, expect, it } from 'vitest';

import { findMenuTrail } from './menu';

describe('findMenuTrail', () => {
  it('finds a nested Emby page', () => {
    expect(findMenuTrail('/emby/cover').map((item) => item.name)).toEqual([
      'Emby',
      '封面生成',
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

  it('returns an empty trail for an unknown route', () => {
    expect(findMenuTrail('/unknown')).toEqual([]);
  });
});
