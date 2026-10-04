import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AutomationCreateInput,
  AutomationDashboard,
  AutomationSource,
  AutomationWorkflow,
} from '@/services/film-fusion';
import AutomationPage from './index';
import {
  buildAutomationDefinition,
  defaultAutomationActions,
} from './workflow';

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
  default: ({
    open,
    source,
    workflow,
    onSubmit,
  }: {
    open: boolean;
    source?: AutomationSource;
    workflow?: AutomationWorkflow;
    onSubmit: (input: AutomationCreateInput) => Promise<void>;
  }) =>
    open ? (
      <div>
        automation-editor-open
        <span data-testid="directory-editor-source">{source?.id}</span>
        <span data-testid="directory-editor-workflow">{workflow?.id}</span>
        {source && workflow && (
          <button
            onClick={() =>
              onSubmit({
                source: {
                  ...source,
                  directory_id: 'new-root',
                  name: '其他用途',
                },
                workflow: {
                  name: '其他用途',
                  description: '',
                  enabled: false,
                  definition: JSON.parse(workflow.definition_json),
                },
              })
            }
            type="button"
          >
            保存副本修改
          </button>
        )}
      </div>
    ) : null,
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
  default: ({
    sources,
    workflows,
  }: {
    sources: AutomationSource[];
    workflows: AutomationWorkflow[];
  }) => (
    <div>
      rss-workflow-panel
      <span data-testid="rss-editor-source">{sources[0]?.id}</span>
      <span data-testid="rss-editor-workflow">{workflows[0]?.id}</span>
    </div>
  ),
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
      definition_json: JSON.stringify(
        buildAutomationDefinition({
          ...defaultAutomationActions(),
          recognition: 'local',
        }),
      ),
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
        '{"schema_version":1,"nodes":[{"id":"trigger","type":"trigger","position":{"x":0,"y":0}},{"id":"download","type":"qbittorrent","position":{"x":260,"y":0},"config":{"target_id":9,"url":"$item.download_url"}},{"id":"end","type":"end","position":{"x":520,"y":0}}],"edges":[{"id":"a","source":"trigger","source_port":"next","target":"download"},{"id":"b","source":"download","source_port":"success","target":"end"}]}',
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
    serviceMocks.createAutomation.mockImplementation(
      async (input: AutomationCreateInput) => ({
        code: 0,
        data: {
          source: {
            ...input.source,
            id: 10,
            initialized: false,
            created_at: '',
            updated_at: '',
            mapping_json: JSON.stringify(input.source.mapping),
          },
          workflow: {
            id: 11,
            source_id: 10,
            name: input.workflow.name,
            description: input.workflow.description,
            enabled: false,
            version: 1,
            definition_json: JSON.stringify(input.workflow.definition),
            created_at: '',
            updated_at: '',
          },
          validation: { valid: true, errors: [], warnings: [] },
        },
      }),
    );
    serviceMocks.updateAutomation.mockResolvedValue({ code: 0, data: {} });
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

  it('filters workflows by name and trigger without changing their enabled state', async () => {
    render(<AutomationPage />);
    await screen.findByText('115 入库监控');
    fireEvent.change(screen.getByRole('textbox', { name: '搜索自动化' }), {
      target: { value: '新番' },
    });
    expect(screen.getByRole('heading', { name: '新番下载' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: '115 入库监控' })).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: '115 目录' }));
    expect(screen.getByText('没有符合条件的自动化')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '清除筛选' }));
    expect(screen.getByRole('heading', { name: '115 入库监控' })).toBeTruthy();
    expect(serviceMocks.setAutomationEnabled).not.toHaveBeenCalled();
    expect(serviceMocks.scanAutomation).not.toHaveBeenCalled();
  });

  it('shows an initial fetch failure instead of claiming there are no automations', async () => {
    serviceMocks.getAutomationDashboard.mockRejectedValueOnce(
      new Error('服务不可用'),
    );
    render(<AutomationPage />);
    expect(await screen.findByText('暂时无法加载自动化')).toBeTruthy();
    expect(screen.queryByText('让重复的工作，自动完成')).toBeNull();
    expect(screen.queryByLabelText('自动化运行概况')).toBeNull();
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
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('radio', {
        name: '115 目录',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: /下一步：配置触发器/ }));
    expect(screen.getByText('automation-editor-open')).toBeTruthy();
  });

  it('opens the RSS workflow wizard after choosing RSS', async () => {
    render(<AutomationPage />);
    await screen.findByText('新番下载');
    fireEvent.click(screen.getByRole('button', { name: /新建自动化/ }));
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('radio', {
        name: 'RSS / Atom',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: /下一步：配置触发器/ }));
    expect(screen.getByText('rss-wizard-open')).toBeTruthy();
  });

  it('copies a paused directory workflow and saves subsequent changes to the copy', async () => {
    const original = structuredClone(dashboard);
    render(<AutomationPage />);
    fireEvent.click(
      await screen.findByRole('button', { name: '复制115 入库监控' }),
    );

    expect(serviceMocks.createAutomation).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '创建并编辑' }));
    await screen.findByText('automation-editor-open');
    expect(serviceMocks.createAutomation).toHaveBeenCalledTimes(1);
    expect(serviceMocks.createAutomation.mock.calls[0][0]).toMatchObject({
      source: {
        name: '115 入库监控（副本）',
        enabled: false,
        cloud_storage_id: 8,
        directory_id: 'root',
        recursive: true,
        interval_seconds: 300,
        quiet_seconds: 120,
      },
      workflow: {
        name: '115 入库监控（副本）',
        enabled: false,
        definition: JSON.parse(dashboard.workflows[0].definition_json),
      },
    });
    expect(screen.getByTestId('directory-editor-source').textContent).toBe(
      '10',
    );
    expect(screen.getByTestId('directory-editor-workflow').textContent).toBe(
      '11',
    );
    expect(dashboard).toEqual(original);
    expect(serviceMocks.updateAutomation).not.toHaveBeenCalled();
    expect(serviceMocks.setAutomationEnabled).not.toHaveBeenCalled();
    expect(serviceMocks.scanAutomation).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '保存副本修改' }));
    await waitFor(() =>
      expect(serviceMocks.updateAutomation).toHaveBeenCalledWith(
        10,
        expect.objectContaining({
          source: expect.objectContaining({
            name: '其他用途',
            directory_id: 'new-root',
          }),
        }),
      ),
    );
  });

  it('copies an RSS workflow and opens its existing workflow editor', async () => {
    render(<AutomationPage />);
    fireEvent.click(
      await screen.findByRole('button', { name: '复制新番下载' }),
    );

    fireEvent.click(screen.getByRole('button', { name: '创建并编辑' }));
    await screen.findByText('rss-workflow-panel');
    expect(screen.getByTestId('rss-editor-source').textContent).toBe('10');
    expect(screen.getByTestId('rss-editor-workflow').textContent).toBe('11');
    expect(
      screen.getByRole('heading', { name: '新番下载（副本）' }),
    ).toBeTruthy();
    const input = serviceMocks.createAutomation.mock.calls[0][0];
    expect(input.source).toEqual({
      name: '新番下载（副本）',
      description: dashboard.sources[1].description,
      enabled: false,
      trigger_type: 'rss',
      feed_url: 'https://example.com/rss.xml',
      interval_minutes: 5,
      mapping: { item_selector: 'channel/item', fields: [] },
    });
    expect(input.workflow.definition).toEqual(
      JSON.parse(dashboard.workflows[1].definition_json),
    );
    expect(serviceMocks.updateAutomation).not.toHaveBeenCalled();
    expect(serviceMocks.setAutomationEnabled).not.toHaveBeenCalled();
  });

  it('prevents repeated copies while saving and keeps the original visible on failure', async () => {
    let rejectCopy!: (error: Error) => void;
    serviceMocks.createAutomation.mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectCopy = reject;
      }),
    );
    render(<AutomationPage />);
    const copyButton = await screen.findByRole('button', {
      name: '复制115 入库监控',
    });
    fireEvent.click(copyButton);
    const submit = screen.getByRole('button', { name: '创建并编辑' });
    fireEvent.click(submit);
    await waitFor(() =>
      expect(serviceMocks.createAutomation).toHaveBeenCalledTimes(1),
    );
    fireEvent.click(submit);
    expect(
      (
        screen.getByRole('button', {
          name: '复制新番下载',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    rejectCopy(new Error('复制请求失败'));

    expect(await screen.findByText('复制请求失败')).toBeTruthy();
    expect(screen.queryByText('automation-editor-open')).toBeNull();
    expect(screen.getByRole('heading', { name: '115 入库监控' })).toBeTruthy();
    fireEvent.click(submit);
    await screen.findByText('automation-editor-open');
    expect(serviceMocks.createAutomation).toHaveBeenCalledTimes(2);
  });

  it('opens the created copy even when the follow-up dashboard refresh fails', async () => {
    serviceMocks.getAutomationDashboard
      .mockResolvedValueOnce({ code: 0, data: dashboard })
      .mockRejectedValueOnce(new Error('刷新失败'));
    render(<AutomationPage />);
    fireEvent.click(
      await screen.findByRole('button', { name: '复制新番下载' }),
    );
    fireEvent.click(screen.getByRole('button', { name: '创建并编辑' }));
    await screen.findByText('rss-workflow-panel');
    expect(screen.getByTestId('rss-editor-source').textContent).toBe('10');
    expect(screen.getByTestId('rss-editor-workflow').textContent).toBe('11');
    expect(serviceMocks.createAutomation).toHaveBeenCalledTimes(1);
  });
});
