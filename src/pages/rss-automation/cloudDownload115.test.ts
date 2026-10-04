import { describe, expect, it, vi } from 'vitest';
import type {
  RSSAutomationDefinition,
  RSSAutomationNodeDefinition,
} from '@/services/film-fusion';
import { OPENAPI_115_CLOUD_NODES } from './cloudDownload115';
import { createNodeDefinition } from './flow';
import { simulateRSSAutomation } from './preview';
import {
  createWorkflowTransferPackage,
  getWorkflowImportRequirements,
  parseWorkflowTransferText,
} from './workflowTransfer';

const chain = (
  nodes: RSSAutomationNodeDefinition[],
): RSSAutomationDefinition => {
  const all = [
    {
      id: 'trigger',
      type: 'trigger' as const,
      position: { x: 0, y: 0 },
      config: {},
    },
    ...nodes,
    {
      id: 'end',
      type: 'end' as const,
      position: { x: 1200, y: 0 },
      config: {},
    },
  ];
  return {
    schema_version: 1,
    nodes: all,
    edges: all.slice(1).map((node, index) => ({
      id: `edge-${index}`,
      source: all[index].id,
      source_port: index === 0 ? 'next' : 'success',
      target: node.id,
    })),
  };
};

describe('115 OpenAPI cloud download workflow', () => {
  it('carries parsed BT fields through submission and task lookup to rename without requests', () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('No network allowed'));
    try {
      const definition = chain([
        {
          id: 'parse',
          type: 'torrent115_openapi',
          position: { x: 100, y: 0 },
          config: {
            cloud_storage_id: 7,
            torrent_sha1: 'seed-sha1',
            pick_code: 'pick123',
          },
        },
        {
          id: 'add',
          type: 'offline115_bt_openapi',
          position: { x: 200, y: 0 },
          config: {
            cloud_storage_id: 7,
            torrent_sha1: '$nodes.parse.output.torrent_sha1',
            pick_code: '$nodes.parse.output.pick_code',
            info_hash: '$nodes.parse.output.info_hash',
            wanted: '$nodes.parse.output.wanted',
            save_path: '$nodes.parse.output.torrent_name',
          },
        },
        {
          id: 'list',
          type: 'list115_tasks_openapi',
          position: { x: 300, y: 0 },
          config: {
            cloud_storage_id: 7,
            page: 1,
            info_hash: '$nodes.add.output.info_hash',
          },
        },
        {
          id: 'rename',
          type: 'rename115_openapi',
          position: { x: 400, y: 0 },
          config: {
            cloud_storage_id: 7,
            file_id: '$nodes.list.output.file_id',
            new_name: '{{item.title}}.mkv',
          },
        },
      ]);
      const preview = simulateRSSAutomation(definition, {
        title: 'Example.S01E01',
      });
      expect(preview.nodes.add.output).toMatchObject({
        submitted: true,
        info_hash: 'preview-bt-hash',
        data: [],
        preview: true,
      });
      expect(preview.nodes.list.output).toMatchObject({
        matched: true,
        completed: true,
        file_id: 'preview-file-id',
        response: { data: { tasks: [{ info_hash: 'preview-bt-hash' }] } },
      });
      expect(preview.nodes.rename.output).toMatchObject({
        file_id: 'preview-file-id',
        new_name: 'Example.S01E01.mkv',
      });
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      fetch.mockRestore();
    }
  });

  it('preserves full per-link output for batch URLs and rejects more than 115', () => {
    const add = {
      ...createNodeDefinition('offline115_openapi', { x: 100, y: 0 }),
      id: 'add',
    };
    const preview = simulateRSSAutomation(chain([add]), {
      download_url: 'magnet:?xt=urn:btih:ABC\nhttps://example.com/file.torrent',
    });
    expect(preview.nodes.add.output).toMatchObject({
      success_count: 2,
      hashes: ['preview-hash-1', 'preview-hash-2'],
      results: [
        { state: true, code: 0 },
        { state: true, code: 0 },
      ],
    });
    expect(preview.nodes.add.output).not.toHaveProperty('info_hash');
    expect(
      simulateRSSAutomation(chain([add]), {
        download_url: 'https://example.com/a\n'.repeat(116),
      }).nodes.add.selectedPorts,
    ).toEqual(['failure']);
  });

  it('exports every new node with account bindings removed and variable references intact', () => {
    const definition = chain(
      OPENAPI_115_CLOUD_NODES.map((type) => ({
        ...createNodeDefinition(type, { x: 100, y: 0 }),
        config: {
          cloud_storage_id: 7,
          directory_id: '9527',
          info_hash: '$nodes.parse.output.info_hash',
          wanted: '0',
          flag: 0,
          page: 1,
        },
      })),
    );
    const exported = createWorkflowTransferPackage(definition, '115 云下载');
    const imported = parseWorkflowTransferText(JSON.stringify(exported));
    expect(exported.removed_bindings.offline115_openapi_accounts).toBe(6);
    expect(
      getWorkflowImportRequirements(imported.definition)
        .offline115OpenAPIAccounts,
    ).toBe(6);
    for (const node of imported.definition.nodes.filter(
      (node) => node.type !== 'trigger' && node.type !== 'end',
    )) {
      expect(node.config).not.toHaveProperty('cloud_storage_id');
      expect(node.config?.info_hash).toBe('$nodes.parse.output.info_hash');
    }
    expect(
      imported.definition.nodes.find(
        (node) => node.type === 'offline115_bt_openapi',
      )?.config,
    ).not.toHaveProperty('directory_id');
  });
});
