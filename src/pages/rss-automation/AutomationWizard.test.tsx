import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RSSAutomationDefinition } from '@/services/film-fusion';
import AutomationWizard from './AutomationWizard';
import { RSS_AUTOMATION_WIZARD_DRAFT_STORAGE_KEY } from './wizardDraft';

const { sampleRSSAutomationSource, workflowPanelState } = vi.hoisted(() => ({
  sampleRSSAutomationSource: vi.fn(),
  workflowPanelState: {
    props: undefined as
      | {
          initialDefinition: RSSAutomationDefinition;
          onWizardSaveDraft?: (definition: RSSAutomationDefinition) => void;
        }
      | undefined,
  },
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
  default: (props: {
    initialDefinition: RSSAutomationDefinition;
    onWizardSaveDraft?: (definition: RSSAutomationDefinition) => void;
  }) => {
    workflowPanelState.props = props;
    return (
      <div>
        <div>workflow-panel</div>
        <button
          onClick={() =>
            props.onWizardSaveDraft?.({
              ...props.initialDefinition,
              viewport: { x: 120, y: 48, zoom: 0.8 },
            })
          }
          type="button"
        >
          保存画布草稿
        </button>
      </div>
    );
  },
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
    window.localStorage.clear();
    workflowPanelState.props = undefined;
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
    window.localStorage.clear();
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

  it('saves the current canvas and restores it when creation is reopened', async () => {
    const firstRender = renderWizard();

    fireEvent.change(
      screen.getByPlaceholderText('https://example.com/rss.xml'),
      {
        target: { value: 'https://example.com/feed.xml' },
      },
    );
    fireEvent.click(screen.getByRole('button', { name: /^解\s*析$/ }));
    await screen.findByText('解析成功');
    fireEvent.click(screen.getByRole('button', { name: /下一步：设计流程/ }));
    await screen.findByText('workflow-panel');

    fireEvent.click(screen.getByRole('button', { name: '保存画布草稿' }));

    await waitFor(() => {
      const stored = JSON.parse(
        window.localStorage.getItem(RSS_AUTOMATION_WIZARD_DRAFT_STORAGE_KEY) ||
          '{}',
      );
      expect(stored.step).toBe(1);
      expect(stored.definition.viewport).toEqual({
        x: 120,
        y: 48,
        zoom: 0.8,
      });
    });
    firstRender.unmount();
    workflowPanelState.props = undefined;

    renderWizard();

    expect(await screen.findByText('本机已有可恢复草稿')).toBeTruthy();
    expect(await screen.findByText('workflow-panel')).toBeTruthy();
    const restoredProps = workflowPanelState.props as
      | { initialDefinition: RSSAutomationDefinition }
      | undefined;
    expect(restoredProps?.initialDefinition.viewport).toEqual({
      x: 120,
      y: 48,
      zoom: 0.8,
    });
  });
});
