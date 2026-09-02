import { describe, expect, it } from 'vitest';
import { buildOrganizeShadowFieldRows } from './Organize';

function matchedComparison(): API.Organize115ShadowComparison {
  return {
    status: 'matched',
    matched: true,
    recognition: {
      status: 'matched',
      matched: true,
      moviepilot: {
        engine: 'moviepilot',
        media_type: 'movie',
        title: '乌云背后的幸福线',
        tmdb_id: '82693',
        category: '电影/欧美电影',
      },
      local: {
        engine: 'local',
        media_type: 'movie',
        title: '乌云背后的幸福线',
        tmdb_id: '82693',
        category: '电影/欧美电影',
      },
      differences: [],
    },
    transfer: {
      status: 'matched',
      matched: true,
      moviepilot:
        'Silver Linings Playbook.2012.BluRay.1080p.x264.DDP 5.1 2Audios-CMCT.mkv',
      local:
        'Silver Linings Playbook.2012.BluRay.1080p.x264.DDP 5.1 2Audios-CMCT.mkv',
    },
    moviepilot_target_path:
      '/影视中心/欧美电影/乌云背后的幸福线 (2012) {tmdb-82693}/Silver Linings Playbook.2012.mkv',
    local_target_path:
      '/影视中心/欧美电影/乌云背后的幸福线 (2012) {tmdb-82693}/Silver Linings Playbook.2012.mkv',
    differences: [],
  };
}

describe('organize shadow comparison rows', () => {
  it('shows recognition, naming and target path as matched', () => {
    const rows = buildOrganizeShadowFieldRows(matchedComparison());
    expect(rows.find((row) => row.key === 'recognition:tmdb_id')).toMatchObject(
      {
        moviepilot: '82693',
        local: '82693',
        status: 'matched',
      },
    );
    expect(
      rows.find((row) => row.key === 'transfer:transfer_name')?.status,
    ).toBe('matched');
    expect(rows.find((row) => row.key === 'target:target_path')?.status).toBe(
      'matched',
    );
  });

  it('marks backend-reported category, naming and path differences', () => {
    const comparison = matchedComparison();
    comparison.status = 'different';
    comparison.matched = false;
    if (comparison.recognition?.local) {
      comparison.recognition.local.category = '电影/华语电影';
    }
    if (comparison.transfer) {
      comparison.transfer.local = 'Local.Name.mkv';
    }
    comparison.local_target_path = '/影视中心/华语电影/Local.Name.mkv';
    comparison.differences = [
      {
        stage: 'recognition',
        field: 'category',
        label: '媒体分类',
        moviepilot: '电影/欧美电影',
        local: '电影/华语电影',
      },
      {
        stage: 'transfer',
        field: 'transfer_name',
        label: '重命名',
        moviepilot: comparison.transfer?.moviepilot || '',
        local: comparison.transfer?.local || '',
      },
      {
        stage: 'target',
        field: 'target_path',
        label: '目标路径',
        moviepilot: comparison.moviepilot_target_path || '',
        local: comparison.local_target_path || '',
      },
    ];

    const rows = buildOrganizeShadowFieldRows(comparison);
    expect(
      rows.filter((row) => row.status === 'different').map((row) => row.key),
    ).toEqual([
      'recognition:category',
      'transfer:transfer_name',
      'target:target_path',
    ]);
  });

  it('lists every rename variable including empty values and webSource', () => {
    const comparison = matchedComparison();
    comparison.rename_variables = [
      {
        name: 'title',
        label: '标题',
        moviepilot: '乌云背后的幸福线',
        local: '乌云背后的幸福线',
        matched: true,
      },
      {
        name: 'webSource',
        label: '流媒体平台',
        moviepilot: 'Netflix',
        local: '',
        matched: false,
      },
      {
        name: 'customization',
        label: '自定义占位符',
        moviepilot: '',
        local: '',
        matched: true,
      },
    ];
    comparison.differences.push({
      stage: 'variable',
      field: 'webSource',
      label: '流媒体平台',
      moviepilot: 'Netflix',
      local: '',
    });

    const rows = buildOrganizeShadowFieldRows(comparison);
    expect(rows.filter((row) => row.stage === '变量')).toHaveLength(3);
    expect(rows.find((row) => row.key === 'variable:webSource')).toMatchObject({
      label: '流媒体平台 (webSource)',
      moviepilot: 'Netflix',
      local: '-',
      status: 'different',
    });
    expect(
      rows.find((row) => row.key === 'variable:customization'),
    ).toMatchObject({ moviepilot: '-', local: '-', status: 'matched' });
  });
});
