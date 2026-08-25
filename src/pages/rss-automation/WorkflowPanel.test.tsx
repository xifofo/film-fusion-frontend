import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App } from 'antd';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  RSSAutomationEntryHistoryItem,
  RSSAutomationSource,
  RSSAutomationWorkflow,
} from '@/services/film-fusion';
import WorkflowPanel from './WorkflowPanel';

vi.mock('./EntryHistoryPanel', () => ({
  default: (props: {
    fixedSourceId?: number;
    onPreviewEntry?: (item: RSSAutomationEntryHistoryItem) => void;
  }) => (
    <button
      onClick={() =>
        props.onPreviewEntry?.({
          entry: {
            id: 19,
            source_id: 7,
            title: 'Slay.The.Gods.2026.S01E11',
            fields_json: JSON.stringify({
              title: 'Slay.The.Gods.2026.S01E11',
              category: '综艺',
            }),
            baseline: false,
            discovered_at: '2026-08-25T00:05:00Z',
          },
          source_name: '动漫 RSS',
          matched: false,
          legacy: false,
        })
      }
      type="button"
    >
      选择源 {props.fixedSourceId} 的测试条目
    </button>
  ),
}));

const source: RSSAutomationSource = {
  id: 7,
  name: '动漫 RSS',
  enabled: true,
  feed_url: 'https://example.com/feed.xml',
  interval_minutes: 5,
  mapping_json: '{}',
  initialized: true,
  created_at: '2026-08-25T00:00:00Z',
  updated_at: '2026-08-25T00:00:00Z',
};

const workflow: RSSAutomationWorkflow = {
  id: 11,
  source_id: 7,
  name: '下载新番',
  enabled: true,
  version: 2,
  definition_json: JSON.stringify({
    schema_version: 1,
    nodes: [
      {
        id: 'trigger',
        type: 'trigger',
        name: '收到 RSS 条目',
        position: { x: 80, y: 180 },
        config: {},
      },
      {
        id: 'end',
        type: 'end',
        name: '结束',
        position: { x: 420, y: 180 },
        config: {},
      },
    ],
    edges: [
      {
        id: 'edge-trigger-end',
        source: 'trigger',
        source_port: 'next',
        target: 'end',
      },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  }),
  created_at: '2026-08-25T00:00:00Z',
  updated_at: '2026-08-25T00:00:00Z',
};

describe('WorkflowPanel RSS entry preview', () => {
  afterEach(cleanup);

  it('reselects a persisted RSS entry before opening the preview', async () => {
    render(
      <App>
        <WorkflowPanel
          cloudDirectories={[]}
          cloudStorages={[]}
          loading={false}
          onChanged={vi.fn()}
          showWorkflowList={false}
          sources={[source]}
          targets={[]}
          workflows={[workflow]}
        />
      </App>,
    );

    const previewButton = await screen.findByRole('button', {
      name: 'RSS 条目预览',
    });
    expect(previewButton.textContent).toContain('选择 RSS 条目');

    fireEvent.click(previewButton);
    fireEvent.click(
      await screen.findByRole('button', {
        name: '选择源 7 的测试条目',
      }),
    );

    expect(await screen.findByText('RSS 字段')).toBeTruthy();
    expect(screen.getByText('Slay.The.Gods.2026.S01E11')).toBeTruthy();
    expect(previewButton.textContent).toContain('重新选择 RSS 条目');
  });
});
