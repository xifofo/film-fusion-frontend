import { describe, expect, it } from 'vitest';
import type { RSSAutomationDefinition } from '@/services/film-fusion';
import { createNodeDefinition, NODE_LABELS } from './flow';
import { simulateRSSAutomation } from './preview';

describe('qBittorrent workflow nodes', () => {
  it('creates an add-task node with safe WebAPI defaults', () => {
    const node = createNodeDefinition('qbittorrent', { x: 100, y: 80 });

    expect(node.name).toBe('添加 qBittorrent 任务');
    expect(node.config).toMatchObject({
      url: '$item.download_url',
      paused: false,
      sequential: false,
      skip_checking: false,
      first_last_piece_priority: false,
      root_folder: 'default',
      auto_tmm: 'default',
      timeout_seconds: 30,
    });
  });

  it('uses explicit names for all three qBittorrent API actions', () => {
    expect(NODE_LABELS.qbittorrent).toBe('添加 qBittorrent 任务');
    expect(NODE_LABELS.wait_qbittorrent).toBe('等待 qBittorrent 完成');
    expect(NODE_LABELS.delete_qbittorrent).toBe('删除 qBittorrent 任务');
  });

  it('previews the structured add API output without calling qBittorrent', () => {
    const addNode = createNodeDefinition('qbittorrent', { x: 240, y: 0 });
    const definition: RSSAutomationDefinition = {
      schema_version: 1,
      nodes: [
        {
          id: 'trigger',
          type: 'trigger',
          position: { x: 0, y: 0 },
          config: {},
        },
        { ...addNode, id: 'qb-add' },
      ],
      edges: [
        {
          id: 'trigger-to-qb',
          source: 'trigger',
          source_port: 'next',
          target: 'qb-add',
          target_port: 'input',
        },
      ],
    };

    const preview = simulateRSSAutomation(definition, {
      download_url: 'magnet:?xt=urn:btih:0123456789abcdef',
    });

    expect(preview.nodes['qb-add']).toMatchObject({
      active: true,
      tone: 'success',
      label: '将调用 qBittorrent 添加任务 API',
      selectedPorts: ['success'],
      output: {
        submitted: true,
        accepted: true,
        pending: false,
        success_count: 1,
        pending_count: 0,
        failure_count: 0,
        response_format: 'preview',
      },
    });
  });
});
