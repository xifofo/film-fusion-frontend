import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AutomationWizard from './AutomationWizard';

const { sampleRSSAutomationSource } = vi.hoisted(() => ({
  sampleRSSAutomationSource: vi.fn(),
}));

vi.mock('@/services/film-fusion', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    sampleRSSAutomationSource: (...args: unknown[]) =>
      sampleRSSAutomationSource(...args),
  };
});

vi.mock('./WorkflowPanel', () => ({
  default: () => <div>workflow-panel</div>,
}));

const renderWizard = () =>
  render(
    <AutomationWizard
      cloudDirectories={[]}
      cloudStorages={[]}
      onCancel={vi.fn()}
      onCreated={vi.fn()}
      targets={[]}
    />,
  );

describe('RSS automation wizard source step', () => {
  beforeEach(() => {
    window.scrollTo = vi.fn();
    sampleRSSAutomationSource.mockResolvedValue({
      code: 0,
      data: {
        title: 'Mikan Project',
        items: [
          {
            fields: {
              download_url: 'https://example.com/episode-09.torrent',
              guid: 'episode-09',
              title: '第 09 话',
            },
          },
        ],
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('keeps guidance in tooltips and presents parsing as the main action', () => {
    renderWizard();

    expect(screen.getByText('RSS 来源')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: '查看 RSS 解析说明' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: /^解\s*析$/ })).toBeTruthy();
    expect(screen.getByText('解析选项')).toBeTruthy();
    expect(screen.queryByText(/我们会先读取最多 20 条内容/)).toBeNull();
  });

  it('summarizes a parsed feed and keeps raw fields collapsed', async () => {
    renderWizard();

    fireEvent.change(
      screen.getByPlaceholderText('https://example.com/rss.xml'),
      {
        target: { value: 'https://example.com/feed.xml' },
      },
    );
    fireEvent.click(screen.getByRole('button', { name: /^解\s*析$/ }));

    await waitFor(() => {
      expect(sampleRSSAutomationSource).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText('Mikan Project')).toBeTruthy();
    expect(screen.getByText('1 条样本')).toBeTruthy();
    expect(screen.getByText('解析成功')).toBeTruthy();
    expect(screen.getByText('解析字段')).toBeTruthy();
    expect(
      screen.queryByText('https://example.com/episode-09.torrent'),
    ).toBeNull();

    fireEvent.click(screen.getByText('解析字段'));

    expect(
      await screen.findByText('https://example.com/episode-09.torrent'),
    ).toBeTruthy();
    expect(screen.getByText('download_url')).toBeTruthy();
    expect(
      (
        screen.getByRole('button', {
          name: /下一步：设计流程/,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });
});
