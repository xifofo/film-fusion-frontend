import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RSSAutomationWorkflow } from '@/services/film-fusion';
import ManualRunModal from './ManualRunModal';

const { listCandidates, createManualRuns } = vi.hoisted(() => ({
  listCandidates: vi.fn(),
  createManualRuns: vi.fn(),
}));

vi.mock('@/services/film-fusion', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    createRSSAutomationManualRuns: (...args: unknown[]) =>
      createManualRuns(...args),
    listRSSAutomationManualCandidates: (...args: unknown[]) =>
      listCandidates(...args),
  };
});

const workflow: RSSAutomationWorkflow = {
  id: 11,
  source_id: 7,
  name: '下载新番',
  enabled: true,
  version: 1,
  definition_json: '{}',
  created_at: '2026-08-12T00:00:00Z',
  updated_at: '2026-08-12T00:00:00Z',
};

describe('ManualRunModal', () => {
  beforeEach(() => {
    listCandidates.mockResolvedValue({
      code: 0,
      data: {
        workflow_id: 11,
        workflow_version: 1,
        scanned_entries: 500,
        has_more: false,
        items: [
          {
            entry_id: 1209,
            title: '第1209集 简繁日多语MKV',
            download_url: 'magnet:?xt=urn:btih:ABC1209',
            published_at: '2026-08-01T16:34:45Z',
            discovered_at: '2026-08-12T14:11:53Z',
            action_names: ['115 OpenAPI 离线'],
            action_types: ['offline115_openapi'],
          },
        ],
      },
    });
    createManualRuns.mockResolvedValue({
      code: 0,
      data: { requested: 1, created: 1, run_ids: [88], skipped: [] },
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('does not queue anything until the user selects and confirms an item', async () => {
    const onClose = vi.fn();
    const onQueued = vi.fn();
    render(
      <ManualRunModal
        onClose={onClose}
        onQueued={onQueued}
        open
        workflow={workflow}
      />,
    );

    expect(await screen.findByText('第1209集 简繁日多语MKV')).toBeTruthy();
    expect(createManualRuns).not.toHaveBeenCalled();
    expect(
      screen
        .getByRole('button', { name: '请先选择条目' })
        .hasAttribute('disabled'),
    ).toBe(true);

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[checkboxes.length - 1]);
    fireEvent.click(screen.getByRole('button', { name: '确认运行 1 条' }));

    await waitFor(() => {
      expect(createManualRuns).toHaveBeenCalledWith(11, [1209]);
    });
    expect(onQueued).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
