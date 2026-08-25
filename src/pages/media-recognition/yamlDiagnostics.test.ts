import { describe, expect, it } from 'vitest';

import { getYAMLDiagnostics } from './yamlDiagnostics';

describe('getYAMLDiagnostics', () => {
  it('accepts a valid category configuration', () => {
    const diagnostics = getYAMLDiagnostics(`movie:
  动画电影:
    genre_ids: '16'
  其它电影:

tv:
  电视剧:
`);

    expect(diagnostics).toEqual([]);
  });

  it('reports inconsistent indentation with a source position', () => {
    const diagnostics = getYAMLDiagnostics(`movie:
  动画电影:
   genre_ids: '16'
    original_language: 'zh'
`);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      severity: 'error',
      source: 'YAML',
    });
    expect(diagnostics[0]?.message).toContain('缩进层级不一致');
    expect(diagnostics[0]?.message).toMatch(/第 \d+ 行，第 \d+ 列/);
  });

  it('reports duplicate keys', () => {
    const diagnostics = getYAMLDiagnostics(`movie:
  动画电影:
    genre_ids: '16'
    genre_ids: '18'
`);

    expect(diagnostics[0]?.message).toContain('重复键名');
  });

  it('rejects multiple YAML documents', () => {
    const diagnostics = getYAMLDiagnostics(`movie:
  其它电影:
---
tv:
  电视剧:
`);

    expect(diagnostics[0]?.message).toContain('只允许一个 YAML 文档');
  });

  it('does not treat an empty editor as a syntax error', () => {
    expect(getYAMLDiagnostics('   \n')).toEqual([]);
  });
});
