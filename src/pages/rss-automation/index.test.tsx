import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { App } from 'antd';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RSSAutomationDashboard } from '@/services/film-fusion';
import RSSAutomationPage from './index';

const serviceMocks = vi.hoisted(() => ({
  deleteRSSAutomation: vi.fn(),
  getCloudDirectoryList: vi.fn(),
  getCloudStorageList: vi.fn(),
  getRSSAutomationDashboard: vi.fn(),
  sampleRSSAutomationSource: vi.fn(),
  setRSSAutomationEnabled: vi.fn(),
}));

vi.mock('@/services/film-fusion', () => ({
  DEFAULT_RSS_AUTOMATION_MAPPING: {
    item_selector: 'channel/item',
    fields: [{ name: 'title', selector: 'title', type: 'string' }],
  },
  ...serviceMocks,
}));

vi.mock('./AutomationWizard', () => ({ default: () => null }));
vi.mock('./ManualRunModal', () => ({ default: () => null }));
vi.mock('./SourcePanel', () => ({
  default: () => <div>rss-settings-panel</div>,
}));
vi.mock('./WorkflowPanel', () => ({
  default: () => <div>workflow-panel</div>,
}));
vi.mock('./EntryHistoryPanel', () => ({
  default: (props: { fixedSourceId?: number }) => (
    <div>entries-source:{props.fixedSourceId ?? 'all'}</div>
  ),
}));
vi.mock('./RunPanel', () => ({
  default: (props: { workflowId?: number }) => (
    <div>runs-workflow:{props.workflowId ?? 'all'}</div>
  ),
}));

const dashboard: RSSAutomationDashboard = {
  sources: [
    {
      id: 7,
      name: '动漫 RSS',
      enabled: true,
      feed_url: 'https://example.com/feed.xml',
      interval_minutes: 5,
      mapping_json: JSON.stringify({
        item_selector: 'channel/item',
        fields: [{ name: 'title', selector: 'title', type: 'string' }],
      }),
      initialized: true,
      created_at: '2026-08-25T00:00:00Z',
      updated_at: '2026-08-25T00:00:00Z',
    },
  ],
  workflows: [
    {
      id: 11,
      source_id: 7,
      name: '下载新番',
      description: '下载最新条目',
      enabled: true,
      version: 2,
      definition_json: JSON.stringify({
        schema_version: 1,
        nodes: [],
        edges: [],
      }),
      created_at: '2026-08-25T00:00:00Z',
      updated_at: '2026-08-25T00:00:00Z',
    },
  ],
  targets: [],
  recent_runs: [],
  total_entries: 0,
  pending_nodes: 0,
  running_nodes: 0,
  failed_runs: 0,
  source_running: false,
  node_protocols: [],
};

describe('RSSAutomationPage editor', () => {
  beforeEach(() => {
    serviceMocks.deleteRSSAutomation.mockResolvedValue({ code: 0, data: {} });
    serviceMocks.getRSSAutomationDashboard.mockResolvedValue({
      code: 0,
      data: dashboard,
    });
    serviceMocks.getCloudStorageList.mockResolvedValue({
      code: 0,
      data: { list: [] },
    });
    serviceMocks.getCloudDirectoryList.mockResolvedValue({
      code: 0,
      data: { list: [] },
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('opens the editor without refetching the live RSS source', async () => {
    render(
      <App>
        <RSSAutomationPage />
      </App>,
    );

    fireEvent.click(
      await screen.findByRole('button', { name: '编辑自动化 下载新番' }),
    );

    expect(screen.getByRole('tab', { name: '流程设计' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'RSS 设置' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'RSS 条目' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: '运行情况' })).toBeTruthy();

    expect(await screen.findByText('workflow-panel')).toBeTruthy();
    expect(serviceMocks.sampleRSSAutomationSource).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('tab', { name: 'RSS 条目' }));
    expect(await screen.findByText('entries-source:7')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: '运行情况' }));
    expect(await screen.findByText('runs-workflow:11')).toBeTruthy();
  });

  it('deletes an automation from its more-actions menu after confirmation', async () => {
    render(
      <App>
        <RSSAutomationPage />
      </App>,
    );

    fireEvent.click(
      await screen.findByRole('button', { name: '更多操作 下载新番' }),
    );
    fireEvent.click(
      await screen.findByRole('menuitem', { name: /删除自动化/ }),
    );
    expect(serviceMocks.deleteRSSAutomation).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '确认删除' }));
    await waitFor(() => {
      expect(serviceMocks.deleteRSSAutomation).toHaveBeenCalledWith(7);
    });
  });
});
