import { describe, expect, it } from 'vitest';

import {
  inspectRecognitionWords,
  splitRecognitionWords,
  tmdbImageURL,
} from './rules';

describe('media recognition word helpers', () => {
  it('keeps comments and removes blank editor lines', () => {
    expect(splitRecognitionWords('# 说明\n\n旧名 => 新名\r\n')).toEqual([
      '# 说明',
      '旧名 => 新名',
    ]);
  });

  it('classifies all supported MoviePilot-compatible formats', () => {
    const rules = inspectRecognitionWords(
      [
        'REPACK',
        '旧名 => 新名',
        '第 <> 集 >> EP+1',
        '旧名 => 新名 && 第 <> 集 >> EP+1',
        '# 注释',
      ].join('\n'),
    );
    expect(rules.map((rule) => rule.type)).toEqual([
      'block',
      'replace',
      'episode_offset',
      'replace_and_offset',
      'comment',
    ]);
  });

  it('marks operators without spaces before the backend validation runs', () => {
    expect(inspectRecognitionWords('旧名=>新名')[0]).toMatchObject({
      valid: false,
      error: '运算符两侧需要空格',
    });
  });

  it('accepts an empty replacement after editor whitespace trimming', () => {
    expect(inspectRecognitionWords('REPACK =>')[0]).toMatchObject({
      type: 'replace',
      valid: true,
    });
  });

  it('builds a TMDB image URL for relative artwork paths', () => {
    expect(tmdbImageURL('/poster.jpg')).toBe(
      'https://image.tmdb.org/t/p/w500/poster.jpg',
    );
  });
});
