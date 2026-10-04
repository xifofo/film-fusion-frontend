import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RSSAutomationDefinition } from '@/services/film-fusion';
import { createNodeDefinition } from './flow';
import NodeConfigModal from './NodeConfigDrawer';
import { simulateRSSAutomation } from './preview';
import { previewTorrentToMagnet } from './torrentToMagnet';
import {
  createWorkflowTransferPackage,
  parseWorkflowTransferText,
} from './workflowTransfer';

vi.mock('@/components/CloudDirectoryPicker', () => ({
  default: () => null,
  CLOUD_DIRECTORY_ROOT_ID: '0',
}));

const hash = '0123456789abcdef0123456789abcdef01234567';
const makeDefinition = (): RSSAutomationDefinition => ({
  schema_version: 1,
  nodes: [
    { ...createNodeDefinition('trigger', { x: 0, y: 0 }), id: 'trigger' },
    {
      ...createNodeDefinition('torrent_to_magnet', { x: 200, y: 0 }),
      id: 'convert',
    },
    {
      ...createNodeDefinition('offline115_openapi', { x: 400, y: 0 }),
      id: 'download',
      config: { cloud_storage_id: 7, url: '$nodes.convert.output.magnet' },
    },
    { ...createNodeDefinition('end', { x: 600, y: 0 }), id: 'end' },
  ],
  edges: [
    { id: 'a', source: 'trigger', source_port: 'next', target: 'convert' },
    { id: 'b', source: 'convert', source_port: 'success', target: 'download' },
    { id: 'c', source: 'download', source_port: 'success', target: 'end' },
  ],
});

describe('torrent to magnet node', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('simulates conversion into the 115 link node without fetching anything', () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('No network'));
    const preview = simulateRSSAutomation(makeDefinition(), {
      download_url: 'https://rss.example/download/123',
    });
    expect(preview.nodes.convert.output).toMatchObject({
      preview: true,
      info_hash: hash,
      metadata_available: true,
      files: [{ index: 0, path: 'Example.mkv', size: 1024 }],
    });
    expect(preview.nodes.convert.detail).toContain('模拟输出');
    expect(preview.nodes.download.output).toMatchObject({
      preview: true,
      results: [{ url: `magnet:?xt=urn:btih:${hash}&dn=Example.mkv` }],
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('inspects existing encoded and Base32 magnets without inventing metadata', () => {
    const output = previewTorrentToMagnet(
      `magnet:?xt=urn%3Abtih%3A${hash}&dn=Name&tr=https%3A%2F%2Ftracker.example`,
      false,
    );
    expect(output).toMatchObject({
      info_hash: hash,
      metadata_available: false,
      torrent_name: 'Name',
    });
    expect(output).not.toHaveProperty('private');
    expect(output).not.toHaveProperty('file_count');
    expect(String(output.magnet)).not.toContain('tr=');
    expect(
      previewTorrentToMagnet(
        'magnet:?xt=urn:btih:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        true,
      ).info_hash,
    ).toBe('0'.repeat(40));
  });

  it('rejects unsupported input and routes it to failure in the preview', () => {
    for (const input of [
      'file:///tmp/a.torrent',
      'https://user:password@example.com/a',
      'magnet:?xt=urn:btmh:1220abc',
      'magnet:?xt=urn:btih:abc',
    ]) {
      expect(() => previewTorrentToMagnet(input, true)).toThrow();
    }
    const preview = simulateRSSAutomation(makeDefinition(), {
      download_url: 'file:///tmp/a.torrent',
    });
    expect(preview.nodes.convert.selectedPorts).toEqual(['failure']);
    expect(preview.activeNodeIds).not.toContain('download');
  });

  it('keeps conversion configuration and variable links during export/import', () => {
    const definition = makeDefinition();
    definition.nodes[1].config = {
      url: '$item.download_url',
      include_trackers: false,
      headers: { Referer: '{{item.detail_url}}' },
      follow_redirects: true,
      allow_private_network: true,
    };
    const imported = parseWorkflowTransferText(
      JSON.stringify(createWorkflowTransferPackage(definition, '种子下载')),
    );
    expect(imported.definition.nodes[1].config).toEqual(
      definition.nodes[1].config,
    );
    expect(imported.definition.nodes[2].config?.url).toBe(
      '$nodes.convert.output.magnet',
    );
  });

  it('saves the source, tracker setting, headers and network settings', async () => {
    const onChange = vi.fn();
    render(
      <NodeConfigModal
        node={createNodeDefinition('torrent_to_magnet', { x: 200, y: 0 })}
        cloudDirectories={[]}
        cloudStorages={[]}
        targets={[]}
        fieldReferences={[]}
        onChange={onChange}
        onClose={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText('种子地址或磁力链接'), {
      target: { value: '$item.enclosure_url' },
    });
    fireEvent.change(screen.getByLabelText('种子请求头 JSON'), {
      target: { value: '{"Referer":"{{item.detail_url}}"}' },
    });
    fireEvent.click(screen.getByRole('switch', { name: '磁链携带 Tracker' }));
    fireEvent.click(screen.getByRole('switch', { name: '允许访问内网' }));
    fireEvent.click(screen.getByRole('button', { name: '应用配置' }));
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            url: '$item.enclosure_url',
            include_trackers: false,
            headers: { Referer: '{{item.detail_url}}' },
            allow_private_network: true,
            follow_redirects: true,
          }),
        }),
      ),
    );
  });
});
