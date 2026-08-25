import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { App } from 'antd';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  RSSAutomationEntryHistoryItem,
  RSSAutomationSource,
} from '@/services/film-fusion';
import { listRSSAutomationEntries } from '@/services/film-fusion';
import EntryHistoryPanel from './EntryHistoryPanel';

vi.mock('@/services/film-fusion', () => ({
  listRSSAutomationEntries: vi.fn(),
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

const previewItem: RSSAutomationEntryHistoryItem = {
  entry: {
    id: 19,
    source_id: 7,
    title: 'Slay.The.Gods.2026.S01E11',
    download_url: 'https://example.com/slay-the-gods.torrent',
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
};

describe('EntryHistoryPanel', () => {
  const listEntriesMock = vi.mocked(listRSSAutomationEntries);

  beforeEach(() => {
    listEntriesMock.mockResolvedValue({
      code: 0,
      message: '获取 RSS 条目记录成功',
      data: { items: [], total: 0 },
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('locks entry history to the source being edited', async () => {
    render(
      <App>
        <EntryHistoryPanel fixedSourceId={7} sources={[source]} />
      </App>,
    );

    expect(screen.getByText('动漫 RSS · RSS 条目记录')).toBeTruthy();
    expect(screen.queryByLabelText('RSS 来源')).toBeNull();
    await waitFor(() => {
      expect(listEntriesMock).toHaveBeenCalledWith({
        filter: 'all',
        sourceId: 7,
        limit: 30,
        offset: 0,
      });
    });
  });

  it('lets the workflow preview choose an existing RSS entry', async () => {
    const onPreviewEntry = vi.fn();
    listEntriesMock.mockResolvedValue({
      code: 0,
      message: '获取 RSS 条目记录成功',
      data: { items: [previewItem], total: 1 },
    });

    render(
      <App>
        <EntryHistoryPanel
          fixedSourceId={7}
          onPreviewEntry={onPreviewEntry}
          sources={[source]}
        />
      </App>,
    );

    fireEvent.click(
      await screen.findByRole('button', {
        name: '选择并预览 Slay.The.Gods.2026.S01E11',
      }),
    );

    expect(onPreviewEntry).toHaveBeenCalledWith(previewItem);
  });
});
