import { describe, expect, it } from 'vitest';
import type { RSSAutomationDefinition } from '@/services/film-fusion';
import {
  createWorkflowTransferPackage,
  parseWorkflowTransferText,
  RSS_WORKFLOW_TRANSFER_FORMAT,
  workflowTransferFileName,
} from './workflowTransfer';

const definition: RSSAutomationDefinition = {
  schema_version: 1,
  nodes: [
    { id: 'trigger', type: 'trigger', position: { x: 0, y: 0 } },
    {
      id: 'qb',
      type: 'qbittorrent',
      position: { x: 260, y: 0 },
      config: { target_id: 12, url: '$item.download_url', category: 'rss' },
    },
    {
      id: 'offline',
      type: 'offline115',
      position: { x: 260, y: 160 },
      config: {
        cloud_storage_id: 8,
        directory_id: '90210',
        url: '$item.download_url',
      },
      ui: { directory_path: '/媒体/动画' },
    },
    { id: 'end', type: 'end', position: { x: 560, y: 80 } },
  ],
  edges: [
    {
      id: 'edge-1',
      source: 'trigger',
      source_port: 'next',
      target: 'qb',
    },
    {
      id: 'edge-2',
      source: 'qb',
      source_port: 'success',
      target: 'end',
    },
  ],
  viewport: { x: 10, y: 20, zoom: 0.9 },
};

describe('RSS workflow transfer', () => {
  it('exports a portable package without local target or directory bindings', () => {
    const exported = createWorkflowTransferPackage(definition, '动漫下载流程');
    const qb = exported.definition.nodes.find((node) => node.id === 'qb');
    const offline = exported.definition.nodes.find(
      (node) => node.id === 'offline',
    );

    expect(exported.format).toBe(RSS_WORKFLOW_TRANSFER_FORMAT);
    expect(qb?.config).toEqual({
      url: '$item.download_url',
      category: 'rss',
    });
    expect(offline?.config).toEqual({ url: '$item.download_url' });
    expect(offline?.ui?.directory_path).toBeUndefined();
    expect(exported.removed_bindings).toEqual({
      qbittorrent_targets: 1,
      offline115_accounts: 1,
      offline115_openapi_accounts: 0,
      offline115_directories: 1,
      organize_directories: 0,
    });
  });

  it('round-trips a package and reports action bindings to reconfigure', () => {
    const parsed = parseWorkflowTransferText(
      JSON.stringify(createWorkflowTransferPackage(definition, '共享流程')),
    );

    expect(parsed.name).toBe('共享流程');
    expect(parsed.source).toBe('workflow-package');
    expect(parsed.definition.nodes).toHaveLength(4);
    expect(parsed.requirements).toEqual({
      qbittorrentTargets: 1,
      offline115Accounts: 1,
      offline115OpenAPIAccounts: 0,
      directorySelections: 1,
      organizeDirectories: 0,
    });
  });

  it('strips OpenAPI account and directory bindings from shared workflows', () => {
    const withOpenAPI = structuredClone(definition);
    withOpenAPI.nodes.push({
      id: 'offline-openapi',
      type: 'offline115_openapi',
      position: { x: 260, y: 320 },
      config: {
        cloud_storage_id: 18,
        directory_id: '12345',
        url: '$item.download_url',
      },
      ui: { directory_path: '/OpenAPI/动画' },
    });

    const exported = createWorkflowTransferPackage(withOpenAPI, 'OpenAPI 流程');
    const openAPI = exported.definition.nodes.find(
      (node) => node.id === 'offline-openapi',
    );

    expect(openAPI?.config).toEqual({ url: '$item.download_url' });
    expect(openAPI?.ui?.directory_path).toBeUndefined();
    expect(exported.removed_bindings.offline115_openapi_accounts).toBe(1);
    expect(exported.removed_bindings.offline115_directories).toBe(2);
    expect(
      parseWorkflowTransferText(JSON.stringify(exported)).requirements,
    ).toMatchObject({
      offline115OpenAPIAccounts: 1,
      directorySelections: 2,
    });
  });

  it('accepts a bare definition and rejects unsafe graph references', () => {
    expect(parseWorkflowTransferText(JSON.stringify(definition)).source).toBe(
      'bare-definition',
    );
    expect(() =>
      parseWorkflowTransferText(
        JSON.stringify({
          ...definition,
          edges: [{ ...definition.edges[0], target: 'missing' }],
        }),
      ),
    ).toThrow('指向不存在的节点');
  });

  it('removes local media directory bindings from shared workflows', () => {
    const withOrganize = structuredClone(definition);
    withOrganize.nodes.push(
      {
        id: 'organize',
        type: 'organize_strm',
        position: { x: 500, y: 240 },
        config: { cloud_directory_id: 9, media_type: 'tv' },
      },
      {
        id: 'dedupe',
        type: 'media_exists',
        position: { x: 500, y: 360 },
        config: { cloud_directory_id: 9, tmdb_id: '$item.tmdb_id' },
      },
      {
        id: 'verify',
        type: 'strm_verify',
        position: { x: 500, y: 480 },
        config: { cloud_directory_id: 9 },
      },
      {
        id: 'regenerate',
        type: 'strm_regenerate',
        position: { x: 500, y: 600 },
        config: { cloud_directory_id: 9 },
      },
    );

    const exported = createWorkflowTransferPackage(withOrganize, '整理流程');
    const organize = exported.definition.nodes.find(
      (node) => node.id === 'organize',
    );
    const dedupe = exported.definition.nodes.find(
      (node) => node.id === 'dedupe',
    );
    const verify = exported.definition.nodes.find(
      (node) => node.id === 'verify',
    );
    const regenerate = exported.definition.nodes.find(
      (node) => node.id === 'regenerate',
    );

    expect(organize?.config).toEqual({ media_type: 'tv' });
    expect(dedupe?.config).toEqual({ tmdb_id: '$item.tmdb_id' });
    expect(verify?.config).toEqual({});
    expect(regenerate?.config).toEqual({});
    expect(exported.removed_bindings.organize_directories).toBe(4);
    expect(
      parseWorkflowTransferText(JSON.stringify(exported)).requirements
        .organizeDirectories,
    ).toBe(4);
  });

  it('creates a filesystem-safe sharing filename', () => {
    expect(workflowTransferFileName('动漫 / RSS: 1000+')).toBe(
      '动漫-RSS-1000+.rssflow.json',
    );
  });
});
