import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AutomationDashboard } from '@/services/film-fusion';
import AutomationPage from './index';

const serviceMocks = vi.hoisted(() => ({
  createAutomation: vi.fn(),
  deleteAutomation: vi.fn(),
  getAutomationDashboard: vi.fn(),
  getCloudDirectoryList: vi.fn(),
  getCloudStorageList: vi.fn(),
  scanAutomation: vi.fn(),
  setAutomationEnabled: vi.fn(),
  updateAutomation: vi.fn(),
}));

vi.mock('@/services/film-fusion', () => serviceMocks);

vi.mock('./AutomationEditorModal', () => ({
  default: ({ open }: { open: boolean }) =>
    open ? <div>automation-editor-open</div> : null,
}));

vi.mock('./AutomationHistory', () => ({
  default: () => <div>automation-history</div>,
}));

vi.mock('@/pages/rss-automation/AutomationWizard', () => ({
  default: () => <div>rss-wizard-open</div>,
}));

vi.mock('@/pages/rss-automation/SourcePanel', () => ({
  default: () => <div>rss-source-panel</div>,
}));

vi.mock('@/pages/rss-automation/WorkflowPanel', () => ({
  default: () => <div>rss-workflow-panel</div>,
}));

const dashboard: AutomationDashboard = {
  sources: [
    {
      id: 1,
      name: '115 入库监控',
      description: '监控新下载的媒体',
      enabled: true,
      trigger_type: '115_directory',
      cloud_storage_id: 8,
      directory_id: 'root',
      directory_path: '/入库',
      recursive: true,
      interval_seconds: 300,
      quiet_seconds: 120,
      initialized: false,
      created_at: '2026-08-25T00:00:00Z',
      updated_at: '2026-08-25T00:00:00Z',
    },
    {
      id: 3,
      name: '新番下载',
      description: 'RSS 新条目进入下载流程',
      enabled: true,
      trigger_type: 'rss',
      feed_url: 'https://example.com/rss.xml',
      interval_minutes: 5,
      mapping_json: '{"item_selector":"channel/item","fields":[]}',
      initialized: true,
      created_at: '2026-08-26T00:00:00Z',
      updated_at: '2026-08-26T00:00:00Z',
    },
  ],
  workflows: [
    {
      id: 2,
      source_id: 1,
      name: '115 入库监控',
      enabled: true,
      version: 1,
      definition_json:
        '{"nodes":[{"type":"filmfusion_recognize"},{"type":"notification"}]}',
      created_at: '2026-08-25T00:00:00Z',
      updated_at: '2026-08-25T00:00:00Z',
    },
    {
      id: 4,
      source_id: 3,
      name: '新番下载',
      enabled: true,
      version: 1,
      definition_json:
        '{"nodes":[{"type":"trigger"},{"type":"qbittorrent"},{"type":"end"}]}',
      created_at: '2026-08-26T00:00:00Z',
      updated_at: '2026-08-26T00:00:00Z',
    },
  ],
  targets: [],
  recent_runs: [],
  total_entries: 0,
  pending_nodes: 0,
  running_nodes: 0,
  failed_runs: 0,
  scanning_count: 0,
};

describe('multi-trigger automation center', () => {
  beforeEach(() => {
    serviceMocks.getAutomationDashboard.mockResolvedValue({
      code: 0,
      data: dashboard,
    });
    serviceMocks.getCloudStorageList.mockResolvedValue({
      code: 0,
      data: {
        list: [
          {
            id: 8,
            storage_name: '115 主账号',
            storage_type: '115open',
            status: 'active',
          },
        ],
      },
    });
    serviceMocks.getCloudDirectoryList.mockResolvedValue({
      code: 0,
      data: { list: [] },
    });
    serviceMocks.scanAutomation.mockResolvedValue({
      code: 0,
      data: {
        source_id: 1,
        source_name: '115 入库监控',
        trigger_type: '115_directory',
        baseline: true,
        scanned_folders: 1,
        scanned_items: 42,
        baseline_items: 42,
        new_candidates: 0,
        created_entries: 0,
        created_runs: 0,
        pending_stable: 0,
        completed_at: '2026-08-25T00:00:00Z',
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('runs the first check as a non-triggering baseline scan', async () => {
    render(<AutomationPage />);

    expect(await screen.findByText('115 入库监控')).toBeTruthy();
    expect(screen.getByText('等待首次基线')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: /立即检查/ })[0]);

    await waitFor(() =>
      expect(serviceMocks.scanAutomation).toHaveBeenCalledWith(1),
    );
    expect(
      await screen.findByText(/基线建立完成：扫描 42 个对象/),
    ).toBeTruthy();
  });

  it('selects a trigger before opening the trigger editor', async () => {
    render(<AutomationPage />);
    await screen.findByText('115 入库监控');
    fireEvent.click(screen.getByRole('button', { name: /新建自动化/ }));
    expect(screen.getByText('选择触发器')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: '115 目录' }));
    fireEvent.click(screen.getByRole('button', { name: /下一步：配置触发器/ }));
    expect(screen.getByText('automation-editor-open')).toBeTruthy();
  });

  it('opens the RSS workflow wizard after choosing RSS', async () => {
    render(<AutomationPage />);
    await screen.findByText('新番下载');
    fireEvent.click(screen.getByRole('button', { name: /新建自动化/ }));
    fireEvent.click(screen.getByRole('radio', { name: 'RSS / Atom' }));
    fireEvent.click(screen.getByRole('button', { name: /下一步：配置触发器/ }));
    expect(screen.getByText('rss-wizard-open')).toBeTruthy();
  });
});
