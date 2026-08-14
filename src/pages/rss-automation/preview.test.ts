import { describe, expect, it } from 'vitest';
import type { RSSAutomationDefinition } from '@/services/film-fusion';
import { simulateRSSAutomation } from './preview';

const definition: RSSAutomationDefinition = {
  schema_version: 1,
  nodes: [
    { id: 'trigger', type: 'trigger', position: { x: 0, y: 0 } },
    {
      id: 'regex',
      type: 'regex',
      position: { x: 200, y: 0 },
      config: {
        input: '$item.title',
        pattern: '(\\d+)集',
        group: '1',
        variable: 'episode',
        value_type: 'integer',
      },
    },
    {
      id: 'if',
      type: 'if',
      position: { x: 400, y: 0 },
      config: {
        condition: { field: '$vars.episode', operator: 'gt', value: 1000 },
      },
    },
    { id: 'pass', type: 'end', position: { x: 600, y: 0 } },
    { id: 'reject', type: 'end', position: { x: 600, y: 160 } },
  ],
  edges: [
    { id: 'e1', source: 'trigger', source_port: 'next', target: 'regex' },
    { id: 'e2', source: 'regex', source_port: 'success', target: 'if' },
    { id: 'e3', source: 'if', source_port: 'true', target: 'pass' },
    { id: 'e4', source: 'if', source_port: 'false', target: 'reject' },
  ],
};

describe('RSS automation sample preview', () => {
  it('extracts typed variables and highlights the matching branch', () => {
    const preview = simulateRSSAutomation(definition, {
      title: '示例动画 1001集',
    });

    expect(preview.variables.episode).toBe(1001);
    expect(preview.nodes.if.label).toContain('条件成立');
    expect(preview.nodes.pass.active).toBe(true);
    expect(preview.nodes.reject.active).toBe(false);
    expect(preview.activeEdgeIds).toEqual(['e1', 'e2', 'e3']);
  });

  it('shows a failed regex path without executing downstream nodes', () => {
    const preview = simulateRSSAutomation(definition, { title: '没有集数' });
    expect(preview.nodes.regex.label).toContain('没有匹配');
    expect(preview.nodes.if.active).toBe(false);
    expect(preview.nodes.pass.active).toBe(false);
  });

  it('lets conditional branches share one end node', () => {
    const sharedEndDefinition: RSSAutomationDefinition = {
      ...definition,
      nodes: [
        ...definition.nodes.filter(
          (node) => node.id !== 'pass' && node.id !== 'reject',
        ),
        { id: 'end', type: 'end', position: { x: 600, y: 80 } },
      ],
      edges: definition.edges.map((edge) =>
        edge.source === 'if' ? { ...edge, target: 'end' } : edge,
      ),
    };

    const matching = simulateRSSAutomation(sharedEndDefinition, {
      title: '示例动画 1001集',
    });
    const rejected = simulateRSSAutomation(sharedEndDefinition, {
      title: '示例动画 999集',
    });

    expect(matching.nodes.end.active).toBe(true);
    expect(matching.activeEdgeIds).toContain('e3');
    expect(rejected.nodes.end.active).toBe(true);
    expect(rejected.activeEdgeIds).toContain('e4');
  });

  it('routes forbidden keywords through matched and unmatched ports', () => {
    const keywordDefinition: RSSAutomationDefinition = {
      schema_version: 1,
      nodes: [
        { id: 'trigger', type: 'trigger', position: { x: 0, y: 0 } },
        {
          id: 'keyword',
          type: 'keyword',
          position: { x: 200, y: 0 },
          config: {
            input: '$item.title',
            keywords: ['CAM', 'TS'],
            match_mode: 'contains_none',
            case_sensitive: false,
          },
        },
        { id: 'end', type: 'end', position: { x: 400, y: 0 } },
      ],
      edges: [
        { id: 'k1', source: 'trigger', source_port: 'next', target: 'keyword' },
        { id: 'k2', source: 'keyword', source_port: 'matched', target: 'end' },
        {
          id: 'k3',
          source: 'keyword',
          source_port: 'unmatched',
          target: 'end',
        },
      ],
    };

    const clean = simulateRSSAutomation(keywordDefinition, {
      title: 'Show 1080p WEB-DL',
    });
    const forbidden = simulateRSSAutomation(keywordDefinition, {
      title: 'Show 1080p cam',
    });

    expect(clean.nodes.keyword.label).toContain('未发现禁用关键词');
    expect(clean.activeEdgeIds).toContain('k2');
    expect(forbidden.nodes.keyword.label).toContain('发现禁用关键词 CAM');
    expect(forbidden.activeEdgeIds).toContain('k3');
    expect(clean.nodes.end.active).toBe(true);
    expect(forbidden.nodes.end.active).toBe(true);
  });

  it('previews the 115 completion and MP recognition chain with node outputs', () => {
    const mediaDefinition: RSSAutomationDefinition = {
      schema_version: 1,
      nodes: [
        { id: 'trigger', type: 'trigger', position: { x: 0, y: 0 } },
        {
          id: 'offline',
          type: 'offline115_openapi',
          position: { x: 200, y: 0 },
          config: { url: '$item.download_url', cloud_storage_id: 1 },
        },
        {
          id: 'wait',
          type: 'wait115',
          position: { x: 400, y: 0 },
          config: { poll_interval_seconds: 30, max_wait_minutes: 10080 },
        },
        {
          id: 'mp',
          type: 'moviepilot_recognize',
          position: { x: 600, y: 0 },
          config: { tmdb_id: '{{item.tmdb_id}}' },
        },
        {
          id: 'organize',
          type: 'organize_strm',
          position: { x: 800, y: 0 },
          config: { cloud_directory_id: 9, media_type: 'tv' },
        },
        {
          id: 'notify',
          type: 'notification',
          position: { x: 1000, y: 0 },
          config: {
            message:
              '识别结果 {{nodes.mp.output.tmdb_id}}，STRM {{nodes.organize.output.strm_count}}',
          },
        },
        { id: 'end', type: 'end', position: { x: 1200, y: 0 } },
      ],
      edges: [
        { id: 'm1', source: 'trigger', source_port: 'next', target: 'offline' },
        { id: 'm2', source: 'offline', source_port: 'success', target: 'wait' },
        { id: 'm3', source: 'wait', source_port: 'success', target: 'mp' },
        { id: 'm4', source: 'mp', source_port: 'success', target: 'organize' },
        {
          id: 'm5',
          source: 'organize',
          source_port: 'success',
          target: 'notify',
        },
        { id: 'm6', source: 'notify', source_port: 'success', target: 'end' },
      ],
    };

    const preview = simulateRSSAutomation(mediaDefinition, {
      download_url: 'magnet:?xt=urn:btih:ABC',
      tmdb_id: '12345',
    });

    expect(preview.nodes.wait.label).toContain('等待 115');
    expect(preview.nodes.mp.label).toContain('TMDB 12345');
    expect(preview.nodes.organize.label).toContain('目录配置 #9');
    expect(preview.nodes.notify.detail).toBe('识别结果 12345，STRM 1');
    expect(preview.nodes.end.active).toBe(true);
  });

  it('previews title recognition metadata in notification text and image', () => {
    const titleDefinition: RSSAutomationDefinition = {
      schema_version: 1,
      nodes: [
        { id: 'trigger', type: 'trigger', position: { x: 0, y: 0 } },
        {
          id: 'mp_title',
          type: 'moviepilot_title_recognize',
          position: { x: 200, y: 0 },
          config: { input: '$item.title', tmdb_id: '{{item.tmdb_id}}' },
        },
        {
          id: 'notify',
          type: 'notification',
          position: { x: 400, y: 0 },
          config: {
            message: '{{nodes.mp_title.output.title}}',
            image_url: '{{nodes.mp_title.output.poster_url}}',
          },
        },
        { id: 'end', type: 'end', position: { x: 600, y: 0 } },
      ],
      edges: [
        {
          id: 't1',
          source: 'trigger',
          source_port: 'next',
          target: 'mp_title',
        },
        {
          id: 't2',
          source: 'mp_title',
          source_port: 'success',
          target: 'notify',
        },
        { id: 't3', source: 'notify', source_port: 'success', target: 'end' },
      ],
    };

    const preview = simulateRSSAutomation(titleDefinition, {
      title: '示例剧.S01E01',
      tmdb_id: '1396',
    });

    expect(preview.nodes.mp_title.label).toContain('TMDB 1396');
    expect(preview.nodes.notify.detail).toContain('图片：运行时识别');
    expect(preview.nodes.end.active).toBe(true);
  });

  it('previews the new media pipeline without calling external services', () => {
    const mediaPipeline: RSSAutomationDefinition = {
      schema_version: 1,
      nodes: [
        { id: 'trigger', type: 'trigger', position: { x: 0, y: 0 } },
        {
          id: 'dedupe',
          type: 'media_exists',
          position: { x: 200, y: 0 },
          config: { cloud_directory_id: 9, tmdb_id: '{{item.tmdb_id}}' },
        },
        {
          id: 'query',
          type: 'hdhive_query',
          position: { x: 400, y: 0 },
          config: { tmdb_id: '{{item.tmdb_id}}', media_type: 'tv' },
        },
        {
          id: 'unlock',
          type: 'hdhive_unlock',
          position: { x: 600, y: 0 },
          config: { slug: '{{nodes.query.output.selected_slug}}' },
        },
        {
          id: 'qb',
          type: 'qbittorrent',
          position: { x: 800, y: 0 },
          config: { target_id: 1, url: '{{nodes.unlock.output.download_url}}' },
        },
        {
          id: 'wait_qb',
          type: 'wait_qbittorrent',
          position: { x: 1000, y: 0 },
        },
        { id: 'end', type: 'end', position: { x: 1200, y: 0 } },
      ],
      edges: [
        { id: 'p1', source: 'trigger', source_port: 'next', target: 'dedupe' },
        { id: 'p2', source: 'dedupe', source_port: 'missing', target: 'query' },
        { id: 'p3', source: 'query', source_port: 'found', target: 'unlock' },
        { id: 'p4', source: 'unlock', source_port: 'success', target: 'qb' },
        { id: 'p5', source: 'qb', source_port: 'success', target: 'wait_qb' },
        { id: 'p6', source: 'wait_qb', source_port: 'success', target: 'end' },
      ],
    };

    const preview = simulateRSSAutomation(mediaPipeline, { tmdb_id: '1396' });

    expect(preview.nodes.dedupe.label).toContain('TMDB 1396');
    expect(preview.nodes.dedupe.detail).toContain('不会查询真实 Emby');
    expect(preview.nodes.query.detail).toContain('不会查询真实 HDHive');
    expect(preview.nodes.unlock.detail).toContain('不会解锁真实 HDHive');
    expect(preview.nodes.wait_qb.detail).toContain('不会连接真实 qBittorrent');
    expect(preview.nodes.end.active).toBe(true);
  });

  it('previews STRM verification and Emby refresh as local-only simulations', () => {
    const verificationPipeline: RSSAutomationDefinition = {
      schema_version: 1,
      nodes: [
        { id: 'trigger', type: 'trigger', position: { x: 0, y: 0 } },
        {
          id: 'organize',
          type: 'organize_strm',
          position: { x: 200, y: 0 },
          config: { cloud_directory_id: 9 },
        },
        {
          id: 'verify',
          type: 'strm_verify',
          position: { x: 400, y: 0 },
          config: { cloud_directory_id: 9 },
        },
        {
          id: 'emby',
          type: 'emby_refresh_wait',
          position: { x: 600, y: 0 },
          config: { tmdb_id: '{{item.tmdb_id}}' },
        },
        { id: 'end', type: 'end', position: { x: 800, y: 0 } },
      ],
      edges: [
        {
          id: 'v1',
          source: 'trigger',
          source_port: 'next',
          target: 'organize',
        },
        {
          id: 'v2',
          source: 'organize',
          source_port: 'success',
          target: 'verify',
        },
        { id: 'v3', source: 'verify', source_port: 'valid', target: 'emby' },
        { id: 'v4', source: 'emby', source_port: 'success', target: 'end' },
      ],
    };

    const preview = simulateRSSAutomation(verificationPipeline, {
      tmdb_id: '1396',
    });

    expect(preview.nodes.verify.detail).toContain('不会读取真实 STRM');
    expect(preview.nodes.emby.detail).toContain('不会请求真实 Emby');
    expect(preview.nodes.end.active).toBe(true);

    const regenerate = simulateRSSAutomation(
      {
        schema_version: 1,
        nodes: [
          { id: 'trigger', type: 'trigger', position: { x: 0, y: 0 } },
          {
            id: 'regenerate',
            type: 'strm_regenerate',
            position: { x: 200, y: 0 },
            config: { cloud_directory_id: 9 },
          },
          { id: 'end', type: 'end', position: { x: 400, y: 0 } },
        ],
        edges: [
          {
            id: 'r1',
            source: 'trigger',
            source_port: 'next',
            target: 'regenerate',
          },
          {
            id: 'r2',
            source: 'regenerate',
            source_port: 'success',
            target: 'end',
          },
        ],
      },
      {},
    );
    expect(regenerate.nodes.regenerate.detail).toContain('不会请求 115');
  });

  it('previews HTTP/Webhook nodes without sending a request', () => {
    const preview = simulateRSSAutomation(
      {
        schema_version: 1,
        nodes: [
          { id: 'trigger', type: 'trigger', position: { x: 0, y: 0 } },
          {
            id: 'webhook',
            type: 'http_request',
            position: { x: 200, y: 0 },
            config: {
              method: 'POST',
              url: 'https://hooks.example/media/{{item.tmdb_id}}',
            },
          },
          { id: 'end', type: 'end', position: { x: 400, y: 0 } },
        ],
        edges: [
          {
            id: 'h1',
            source: 'trigger',
            source_port: 'next',
            target: 'webhook',
          },
          {
            id: 'h2',
            source: 'webhook',
            source_port: 'success',
            target: 'end',
          },
        ],
      },
      { tmdb_id: '1396' },
    );

    expect(preview.nodes.webhook.label).toContain('POST hooks.example');
    expect(preview.nodes.webhook.detail).toContain('不会发起真实 HTTP');
    expect(preview.nodes.end.active).toBe(true);
  });
});
