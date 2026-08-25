import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RSSAutomationDashboard } from '@/services/film-fusion';
import AutomationOverview from './AutomationOverview';

const dashboard: RSSAutomationDashboard = {
  sources: [
    {
      id: 7,
      name: '动漫 RSS',
      enabled: true,
      feed_url: 'https://example.com/feed.xml',
      interval_minutes: 5,
      mapping_json: '{}',
      initialized: true,
      created_at: '2026-08-12T00:00:00Z',
      updated_at: '2026-08-12T00:00:00Z',
    },
  ],
  workflows: [
    {
      id: 11,
      source_id: 7,
      name: '下载新番',
      enabled: true,
      version: 1,
      definition_json: JSON.stringify({
        schema_version: 1,
        nodes: [],
        edges: [],
      }),
      created_at: '2026-08-12T00:00:00Z',
      updated_at: '2026-08-12T00:00:00Z',
    },
  ],
  targets: [],
  recent_runs: [],
  total_entries: 0,
  pending_nodes: 0,
  running_nodes: 0,
  failed_runs: 0,
  source_running: false,
};

describe('AutomationOverview', () => {
  afterEach(cleanup);

  it('lets the user stop an enabled automation from its card', () => {
    const onToggle = vi.fn();
    render(
      <AutomationOverview
        data={dashboard}
        loading={false}
        onCreate={vi.fn()}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        onManualRun={vi.fn()}
        onToggle={onToggle}
        onViewLogs={vi.fn()}
      />,
    );

    const toggle = screen.getByRole('switch', {
      name: '停用自动化 下载新番',
    });
    expect(toggle.getAttribute('aria-checked')).toBe('true');

    fireEvent.click(toggle);

    expect(onToggle).toHaveBeenCalledWith(7, false);
  });

  it('makes it clear that a stopped automation no longer checks its feed', () => {
    render(
      <AutomationOverview
        data={{
          ...dashboard,
          sources: dashboard.sources.map((source) => ({
            ...source,
            enabled: false,
          })),
          workflows: dashboard.workflows.map((workflow) => ({
            ...workflow,
            enabled: false,
          })),
        }}
        loading={false}
        onCreate={vi.fn()}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        onManualRun={vi.fn()}
        onToggle={vi.fn()}
        onViewLogs={vi.fn()}
      />,
    );

    expect(screen.getByText('已停用，不再检查 RSS 源')).toBeTruthy();
  });

  it('opens the selected automation editor from its card', () => {
    const onEdit = vi.fn();
    render(
      <AutomationOverview
        data={dashboard}
        loading={false}
        onCreate={vi.fn()}
        onDelete={vi.fn()}
        onEdit={onEdit}
        onManualRun={vi.fn()}
        onToggle={vi.fn()}
        onViewLogs={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: '编辑自动化 下载新番' }),
    );

    expect(onEdit).toHaveBeenCalledWith(11);
  });

  it('opens manual selection and logs for the selected automation', () => {
    const onManualRun = vi.fn();
    const onViewLogs = vi.fn();
    render(
      <AutomationOverview
        data={dashboard}
        loading={false}
        onCreate={vi.fn()}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        onManualRun={onManualRun}
        onToggle={vi.fn()}
        onViewLogs={onViewLogs}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: '手动运行已有条目 下载新番' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: '查看运行日志 下载新番' }),
    );

    expect(onManualRun).toHaveBeenCalledWith(11);
    expect(onViewLogs).toHaveBeenCalledWith(11);
  });

  it('places deletion under more actions and confirms before deleting', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(
      <AutomationOverview
        data={dashboard}
        loading={false}
        onCreate={vi.fn()}
        onDelete={onDelete}
        onEdit={vi.fn()}
        onManualRun={vi.fn()}
        onToggle={vi.fn()}
        onViewLogs={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '更多操作 下载新番' }));
    fireEvent.click(
      await screen.findByRole('menuitem', { name: /删除自动化/ }),
    );

    expect(screen.getByText('删除这个 RSS 自动化？')).toBeTruthy();
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '确认删除' }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(7));
  });

  it('hides an earlier source error when the latest run succeeded', () => {
    render(
      <AutomationOverview
        data={{
          ...dashboard,
          sources: dashboard.sources.map((source) => ({
            ...source,
            last_error: '解析 RSS XML 失败: XML syntax error',
          })),
          recent_runs: [
            {
              id: 23,
              workflow_id: 11,
              workflow_name: '下载新番',
              workflow_version: 1,
              entry_id: 19,
              definition_json: '{}',
              context_json: '{}',
              status: 'succeeded',
              started_at: '2026-08-18T09:12:34',
              created_at: '2026-08-18T00:00:00Z',
              updated_at: '2026-08-18T00:01:00Z',
            },
          ],
        }}
        loading={false}
        onCreate={vi.fn()}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        onManualRun={vi.fn()}
        onToggle={vi.fn()}
        onViewLogs={vi.fn()}
      />,
    );

    expect(screen.getByText('成功')).toBeTruthy();
    expect(screen.getByText('2026-08-18 09:12')).toBeTruthy();
    expect(
      screen.queryByText('解析 RSS XML 失败: XML syntax error'),
    ).toBeNull();
  });

  it('keeps the source error when the latest run did not succeed', () => {
    render(
      <AutomationOverview
        data={{
          ...dashboard,
          sources: dashboard.sources.map((source) => ({
            ...source,
            last_error: '解析 RSS XML 失败: XML syntax error',
          })),
          recent_runs: [
            {
              id: 23,
              workflow_id: 11,
              workflow_name: '下载新番',
              workflow_version: 1,
              entry_id: 19,
              definition_json: '{}',
              context_json: '{}',
              status: 'failed',
              created_at: '2026-08-18T00:00:00Z',
              updated_at: '2026-08-18T00:01:00Z',
            },
          ],
        }}
        loading={false}
        onCreate={vi.fn()}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        onManualRun={vi.fn()}
        onToggle={vi.fn()}
        onViewLogs={vi.fn()}
      />,
    );

    expect(
      screen.getByText('解析 RSS XML 失败: XML syntax error'),
    ).toBeTruthy();
  });
});
