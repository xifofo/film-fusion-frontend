import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
        onToggle={onToggle}
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
        onToggle={vi.fn()}
      />,
    );

    expect(screen.getByText('已停用，不再检查 RSS 源')).toBeTruthy();
  });
});
