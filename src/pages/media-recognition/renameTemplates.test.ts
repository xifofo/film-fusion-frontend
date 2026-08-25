import { describe, expect, it } from 'vitest';

import type { MediaRecognitionRenameVariable } from '@/services/film-fusion';
import {
  buildRenameSampleJSON,
  getRenameVariables,
  parseRenameSampleJSON,
} from './renameTemplates';

const common: MediaRecognitionRenameVariable[] = [
  {
    name: 'title',
    label: '标题',
    description: '媒体标题',
    example: '流浪地球',
  },
  {
    name: 'year',
    label: '年份',
    description: '上映年份',
    example: 2019,
  },
];

const tv: MediaRecognitionRenameVariable[] = [
  {
    name: 'season_episode',
    label: '季集',
    description: '格式化季集',
    example: 'S01E02',
  },
];

describe('media recognition rename template helpers', () => {
  it('adds TV-only variables only for TV templates', () => {
    expect(
      getRenameVariables(common, tv, 'movie').map(({ name }) => name),
    ).toEqual(['title', 'year']);
    expect(
      getRenameVariables(common, tv, 'tv').map(({ name }) => name),
    ).toEqual(['title', 'year', 'season_episode']);
  });

  it('builds a JSON sample from backend-provided examples', () => {
    expect(JSON.parse(buildRenameSampleJSON(common, tv, 'tv'))).toEqual({
      title: '流浪地球',
      year: 2019,
      season_episode: 'S01E02',
    });
  });

  it('accepts an empty sample and rejects non-object JSON', () => {
    expect(parseRenameSampleJSON('  ')).toBeUndefined();
    expect(() => parseRenameSampleJSON('["not-an-object"]')).toThrow(
      '示例数据必须是 JSON 对象',
    );
  });
});
