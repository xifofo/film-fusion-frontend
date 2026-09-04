import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AutomationEntryHistoryItem,
  AutomationRun,
  AutomationSource,
  AutomationWorkflow,
} from '@/services/film-fusion';
import AutomationHistory from './AutomationHistory';

const serviceMocks = vi.hoisted(() => ({
  cancelAutomationRun: vi.fn(),
  getAutomationRun: vi.fn(),
  listAutomationEntries: vi.fn(),
  listAutomationRuns: vi.fn(),
  repeatAutomationRun: vi.fn(),
  retryAutomationRun: vi.fn(),
  runAutomationEntry: vi.fn(),
}));

vi.mock('@/services/film-fusion', () => serviceMocks);

const source: AutomationSource = {
  id: 1,
  name: '新番下载',
  description: '',
  enabled: true,
  trigger_type: 'rss',
  feed_url: 'https://example.com/feed.xml',
  interval_minutes: 5,
  initialized: true,
  created_at: '2026-09-03T08:00:00Z',
  updated_at: '2026-09-03T08:00:00Z',
};

const workflow: AutomationWorkflow = {
  id: 2,
  source_id: source.id,
  name: '新番下载',
  description: '',
  enabled: true,
  version: 4,
  definition_json: '{}',
  created_at: '2026-09-03T08:00:00Z',
  updated_at: '2026-09-03T08:00:00Z',
};

const historicalRun: AutomationRun = {
  id: 19,
  workflow_id: workflow.id,
  workflow_name: workflow.name,
  workflow_version: 3,
  entry_id: 8,
  execution_no: 1,
  trigger_mode: 'event',
  definition_json: '{}',
  context_json: '{}',
  status: 'succeeded',
  started_at: '2026-09-03T08:10:00Z',
  completed_at: '2026-09-03T08:11:00Z',
  created_at: '2026-09-03T08:10:00Z',
  updated_at: '2026-09-03T08:11:00Z',
};

const baselineEntry: AutomationEntryHistoryItem = {
  source_name: source.name,
  matched: false,
  entry: {
    id: 8,
    source_id: source.id,
    event_key: 'rss:baseline-entry',
    item_id: 'baseline-entry',
    title: '存量第一集',
    path: 'https://example.com/episode/1',
    is_directory: false,
    size: 0,
    updated_at_115: 0,
    baseline: true,
    fields_json:
      '{"title":"存量第一集","download_url":"magnet:?xt=urn:btih:baseline"}',
    discovered_at: '2026-09-03T08:00:00Z',
    created_at: '2026-09-03T08:00:00Z',
  },
};

describe('automation run history', () => {
  beforeEach(() => {
    serviceMocks.listAutomationEntries.mockResolvedValue({
      code: 0,
      data: { items: [], total: 0 },
    });
    serviceMocks.listAutomationRuns.mockResolvedValue({
      code: 0,
      data: { items: [historicalRun], total: 1 },
    });
    serviceMocks.repeatAutomationRun.mockResolvedValue({
      code: 0,
      data: {
        ...historicalRun,
        id: 20,
        execution_no: 2,
        trigger_mode: 'manual',
        repeated_from_run_id: historicalRun.id,
        status: 'pending',
      },
    });
    serviceMocks.runAutomationEntry.mockResolvedValue({
      code: 0,
      data: {
        ...historicalRun,
        id: 21,
        workflow_version: workflow.version,
        entry_id: baselineEntry.entry.id,
        trigger_mode: 'manual',
        status: 'pending',
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('creates a new run from a selected terminal history record', async () => {
    render(
      <AutomationHistory
        refreshToken={0}
        sources={[source]}
        workflows={[workflow]}
      />,
    );

    fireEvent.click(await screen.findByRole('tab', { name: '运行记录 1' }));
    fireEvent.click(await screen.findByRole('button', { name: /重新运行/ }));

    expect(await screen.findByText('重新运行这条记录？')).toBeTruthy();
    expect(
      screen.getByText(/使用运行 #19 保存的流程 v3 和事件数据/),
    ).toBeTruthy();
    expect(screen.getByText(/下载、通知等动作可能再次发生/)).toBeTruthy();

    const confirmButtons = screen.getAllByRole('button', {
      name: /重新运行/,
    });
    const confirmButton = confirmButtons.at(-1);
    expect(confirmButton).toBeDefined();
    if (!confirmButton) return;
    fireEvent.click(confirmButton);

    await waitFor(() =>
      expect(serviceMocks.repeatAutomationRun).toHaveBeenCalledWith(19),
    );
    await waitFor(() =>
      expect(serviceMocks.listAutomationRuns).toHaveBeenCalledTimes(2),
    );
  });

  it('manually runs one saved baseline entry with the current workflow', async () => {
    serviceMocks.listAutomationEntries.mockResolvedValue({
      code: 0,
      data: { items: [baselineEntry], total: 1 },
    });

    render(
      <AutomationHistory
        refreshToken={0}
        sources={[source]}
        workflows={[workflow]}
      />,
    );

    expect(await screen.findByText('存量基线')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /手动执行/ }));

    expect(await screen.findByText('执行这条存量基线？')).toBeTruthy();
    expect(
      screen.getByText(
        (_, element) =>
          element?.classList.contains('ant-popconfirm-description') === true &&
          element.textContent?.includes('当前流程“新番下载”v4') === true &&
          element.textContent?.includes('该条目的原始数据') === true,
      ),
    ).toBeTruthy();
    expect(screen.getByText(/下载、通知等动作可能发生/)).toBeTruthy();

    const confirmButtons = screen.getAllByRole('button', {
      name: /手动执行/,
    });
    const confirmButton = confirmButtons.at(-1);
    expect(confirmButton).toBeDefined();
    if (!confirmButton) return;
    fireEvent.click(confirmButton);

    await waitFor(() =>
      expect(serviceMocks.runAutomationEntry).toHaveBeenCalledWith(8),
    );
    await waitFor(() =>
      expect(serviceMocks.listAutomationEntries).toHaveBeenCalledTimes(2),
    );
  });

  it('does not offer a full repeat while the run is active', async () => {
    serviceMocks.listAutomationRuns.mockResolvedValue({
      code: 0,
      data: {
        items: [{ ...historicalRun, status: 'running' }],
        total: 1,
      },
    });

    render(
      <AutomationHistory
        refreshToken={0}
        sources={[source]}
        workflows={[workflow]}
      />,
    );

    fireEvent.click(await screen.findByRole('tab', { name: '运行记录 1' }));
    expect(screen.queryByRole('button', { name: /重新运行/ })).toBeNull();
    expect(screen.getByRole('button', { name: /取消/ })).toBeTruthy();
  });
});
