import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RunPanel from './RunPanel';

const { listRuns } = vi.hoisted(() => ({ listRuns: vi.fn() }));

vi.mock('@/services/film-fusion', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    listRSSAutomationRuns: (...args: unknown[]) => listRuns(...args),
  };
});

describe('RunPanel', () => {
  beforeEach(() => {
    listRuns.mockResolvedValue({ code: 0, data: { items: [], total: 0 } });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('loads only the selected automation logs', async () => {
    render(<RunPanel workflowId={11} workflowName="下载新番" />);

    expect(screen.getByText('下载新番 · 运行日志')).toBeTruthy();
    await waitFor(() => {
      expect(listRuns).toHaveBeenCalledWith({
        workflowId: 11,
        status: undefined,
        limit: 30,
        offset: 0,
      });
    });
  });
});
