import { describe, expect, it } from 'vitest';
import { DEFAULT_RSS_AUTOMATION_DEFINITION } from '@/services/film-fusion';
import {
  createNodeDefinition,
  definitionToFlow,
  flowToDefinition,
  joinHasConditionalOutcome,
  nodeBranches,
  sourcePortLabel,
} from './flow';

describe('RSS automation flow conversion', () => {
  it('round-trips the persisted definition and React Flow handles', () => {
    const source = structuredClone(DEFAULT_RSS_AUTOMATION_DEFINITION);
    const flow = definitionToFlow(source);
    const result = flowToDefinition(flow.nodes, flow.edges, source.viewport);

    expect(result.nodes.map((node) => node.id)).toEqual(['trigger', 'end']);
    expect(flow.nodes.every((node) => node.deletable === false)).toBe(true);
    expect(result.edges[0]).toMatchObject({
      source: 'trigger',
      source_port: 'next',
      target: 'end',
    });
  });

  it('creates a typed regex capture suitable for numeric IF comparison', () => {
    const node = createNodeDefinition('regex', { x: 100, y: 200 });

    expect(node.config).toMatchObject({
      input: '$item.title',
      pattern: '(\\d+)集',
      variable: 'episode',
      value_type: 'integer',
    });
    expect(node.position).toEqual({ x: 100, y: 200 });
  });

  it('creates a keyword matcher for RSS titles', () => {
    const node = createNodeDefinition('keyword', { x: 120, y: 220 });

    expect(node.config).toMatchObject({
      input: '$item.title',
      keywords: [],
      match_mode: 'contains_any',
      case_sensitive: false,
    });
    expect(node.name).toBe('关键词匹配');
  });

  it('creates keyword and regex replacement nodes with safe text outputs', () => {
    const keyword = createNodeDefinition('keyword_replace', { x: 120, y: 220 });
    const regex = createNodeDefinition('regex_replace', { x: 320, y: 220 });

    expect(keyword).toMatchObject({
      name: '关键词替换',
      max_attempts: 1,
      config: {
        input: '$item.title',
        replacements: [{ keyword: '', replacement: '' }],
        case_sensitive: false,
        variable: 'normalized_title',
      },
    });
    expect(regex).toMatchObject({
      name: '正则替换',
      max_attempts: 1,
      config: {
        input: '$item.title',
        pattern: '[._-]+',
        replacement: ' ',
        variable: 'normalized_title',
      },
    });
  });

  it('normalizes visible parallel handles from node configuration', () => {
    const node = createNodeDefinition('parallel', { x: 0, y: 0 });
    expect(nodeBranches(node)).toEqual(['branch-1', 'branch-2']);
  });

  it('uses a single continue outcome for completion joins', () => {
    const join = createNodeDefinition('join', { x: 0, y: 0 });
    expect(joinHasConditionalOutcome(join)).toBe(false);
    expect(sourcePortLabel('success', join)).toBe('继续');

    join.config = { policy: 'all_success' };
    expect(joinHasConditionalOutcome(join)).toBe(true);
    expect(sourcePortLabel('success', join)).toBe('满足');
    expect(sourcePortLabel('failure', join)).toBe('未满足');
  });

  it('creates durable 115 wait and MoviePilot recognition nodes', () => {
    const wait = createNodeDefinition('wait115', { x: 100, y: 100 });
    const recognize = createNodeDefinition('moviepilot_recognize', {
      x: 300,
      y: 100,
    });

    expect(wait.config).toMatchObject({
      poll_interval_seconds: 30,
      max_wait_minutes: 10080,
    });
    expect(wait.max_attempts).toBe(3);
    expect(recognize.name).toBe('MP 媒体识别');
    expect(recognize.config).toEqual({ tmdb_id: '' });
  });

  it('creates a retryable 115 OpenAPI rename node', () => {
    const rename = createNodeDefinition('rename115_openapi', {
      x: 500,
      y: 100,
    });

    expect(rename).toMatchObject({
      name: '115 API 重命名',
      max_attempts: 3,
      config: {
        file_id: '',
        new_name: '{{item.title}}',
      },
    });
  });

  it('creates a pre-download MoviePilot title recognition node', () => {
    const recognize = createNodeDefinition('moviepilot_title_recognize', {
      x: 200,
      y: 100,
    });

    expect(recognize.name).toBe('MP 标题识别');
    expect(recognize.config).toEqual({ input: '$item.title', tmdb_id: '' });
    expect(recognize.max_attempts).toBe(3);
  });

  it('creates a FilmFusion local recognition node without MoviePilot', () => {
    const recognize = createNodeDefinition('filmfusion_recognize', {
      x: 240,
      y: 120,
    });

    expect(recognize.name).toBe('FilmFusion 本地识别');
    expect(recognize.config).toEqual({
      recognition_mode: 'title',
      input: '$item.title',
      tmdb_id: '',
      lookup_tmdb: true,
    });
    expect(recognize.max_attempts).toBe(3);
  });

  it('creates a single-attempt organize and STRM node', () => {
    const organize = createNodeDefinition('organize_strm', {
      x: 500,
      y: 100,
    });

    expect(organize.name).toBe('整理生成 STRM');
    expect(organize.config).toMatchObject({
      media_type: 'auto',
      best_version_enabled: false,
      delete_source_folder: false,
      timeout_seconds: 600,
    });
    expect(organize.max_attempts).toBe(1);
  });

  it('creates the qB wait, lookup, verification and Emby nodes with safe defaults', () => {
    const waitQB = createNodeDefinition('wait_qbittorrent', { x: 0, y: 0 });
    const mpTransfer = createNodeDefinition('moviepilot_transfer', {
      x: 0,
      y: 0,
    });
    const deleteQB = createNodeDefinition('delete_qbittorrent', {
      x: 0,
      y: 0,
    });
    const dedupe = createNodeDefinition('media_exists', { x: 0, y: 0 });
    const query = createNodeDefinition('hdhive_query', { x: 0, y: 0 });
    const verify = createNodeDefinition('strm_verify', { x: 0, y: 0 });
    const regenerate = createNodeDefinition('strm_regenerate', { x: 0, y: 0 });
    const emby = createNodeDefinition('emby_refresh_wait', { x: 0, y: 0 });
    const http = createNodeDefinition('http_request', { x: 0, y: 0 });

    expect(waitQB.config).toMatchObject({
      poll_interval_seconds: 30,
      max_wait_minutes: 10080,
    });
    expect(mpTransfer).toMatchObject({
      name: 'MP2 整理入库',
      max_attempts: 1,
      config: {
        source_path: '',
        file_type: 'auto',
        media_type: 'auto',
        tmdb_id: '',
        scrape: false,
        timeout_seconds: 600,
      },
    });
    expect(deleteQB).toMatchObject({
      name: '删除 qB 做种任务',
      max_attempts: 1,
      config: { delete_files: false, timeout_seconds: 30 },
    });
    expect(dedupe.config).toMatchObject({ tmdb_id: '$item.tmdb_id' });
    expect(query.config).toMatchObject({
      tmdb_id: '$item.tmdb_id',
      media_type: '$item.media_type',
      resolution: '',
      pan_type: '',
    });
    expect(verify.name).toBe('STRM 校验');
    expect(regenerate).toMatchObject({
      name: 'STRM 重生成',
      max_attempts: 1,
      config: { timeout_seconds: 60 },
    });
    expect(emby.config).toMatchObject({
      refresh_library: true,
      poll_interval_seconds: 15,
      max_wait_minutes: 30,
    });
    expect(http).toMatchObject({
      name: 'HTTP / Webhook',
      max_attempts: 1,
      config: {
        method: 'POST',
        allow_private_network: false,
        follow_redirects: false,
        timeout_seconds: 30,
      },
    });
  });
});
