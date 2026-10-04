import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  AutomationCreateInput,
  AutomationDefinition,
} from '@/services/film-fusion';
import AutomationCopyModal from './AutomationCopyModal';
import AutomationParametersModal from './AutomationParametersModal';
import AutomationSettingsModal from './AutomationSettingsModal';
import AutomationTemplates from './AutomationTemplates';
import AutomationVersionsModal from './AutomationVersionsModal';
import { defaultAutomationSettings } from './management';

const api = vi.hoisted(() => ({
  getAutomationTemplates: vi.fn(),
  saveAutomationTemplate: vi.fn(),
  deleteAutomationTemplate: vi.fn(),
  getAutomationRevisions: vi.fn(),
  restoreAutomationRevision: vi.fn(),
}));
vi.mock('@/services/film-fusion', () => api);

const definition: AutomationDefinition = {
  schema_version: 1,
  parameters: { caption: '原文', count: 2 },
  nodes: [
    { id: 'trigger', type: 'trigger', position: { x: 0, y: 0 } },
    {
      id: 'notice',
      type: 'notification',
      name: '通知',
      position: { x: 260, y: 0 },
      config: { message: '原文' },
      parameter_bindings: { message: 'caption' },
    },
    { id: 'end', type: 'end', position: { x: 520, y: 0 } },
  ],
  edges: [
    { id: 'a', source: 'trigger', source_port: 'next', target: 'notice' },
    { id: 'b', source: 'notice', source_port: 'success', target: 'end' },
  ],
};
const configuration: AutomationCreateInput = {
  source: {
    name: 'RSS（副本）',
    description: '',
    enabled: false,
    trigger_type: 'rss',
    feed_url: 'https://example.com/rss.xml',
    interval_minutes: 5,
    mapping: { item_selector: 'channel/item', fields: [] },
  },
  workflow: {
    name: 'RSS（副本）',
    description: '',
    enabled: false,
    definition,
  },
};

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('automation management dialogs', () => {
  it('edits typed parameters while keeping their node bindings', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    render(
      <AutomationParametersModal
        definition={definition}
        onCancel={vi.fn()}
        onSave={save}
      />,
    );
    fireEvent.change(screen.getByLabelText('参数值 1'), {
      target: { value: '修改后的内容' },
    });
    fireEvent.change(screen.getByLabelText('参数值 2'), {
      target: { value: '7' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存参数' }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const saved = save.mock.calls[0][0];
    expect(saved.parameters).toEqual({ caption: '修改后的内容', count: 7 });
    expect(saved.nodes[1].parameter_bindings).toEqual({ message: 'caption' });
    expect(definition.parameters?.caption).toBe('原文');
  });

  it('rejects duplicate parameter names without saving', async () => {
    const save = vi.fn();
    render(
      <AutomationParametersModal
        definition={definition}
        onCancel={vi.fn()}
        onSave={save}
      />,
    );
    fireEvent.change(screen.getByLabelText('参数名称 2'), {
      target: { value: 'caption' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存参数' }));
    expect(await screen.findByText('参数名称不能重复')).toBeTruthy();
    expect(save).not.toHaveBeenCalled();
  });

  it('lets the user change the RSS source before creating a paused copy', async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    render(
      <AutomationCopyModal
        input={configuration}
        cloudStorages={[]}
        cloudDirectories={[]}
        targets={[]}
        onCancel={vi.fn()}
        onSubmit={submit}
      />,
    );
    expect(submit).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('RSS 地址'), {
      target: { value: 'https://example.com/another.xml' },
    });
    fireEvent.change(screen.getByLabelText('新流程名称'), {
      target: { value: '另一个用途' },
    });
    fireEvent.click(screen.getByRole('button', { name: '创建并编辑' }));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit.mock.calls[0][0].source).toMatchObject({
      name: '另一个用途',
      feed_url: 'https://example.com/another.xml',
      enabled: false,
    });
    expect(submit.mock.calls[0][0].workflow.definition).toEqual(definition);
  });

  it('saves alert thresholds with the selected group', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    render(
      <AutomationSettingsModal
        settings={{
          ...defaultAutomationSettings(7),
          group_name: '电影',
          alerts_enabled: true,
        }}
        groups={['电影']}
        onCancel={vi.fn()}
        onSave={save}
      />,
    );
    const threshold = screen.getByLabelText('连续失败次数') as HTMLInputElement;
    await waitFor(() => expect(threshold.disabled).toBe(false));
    fireEvent.change(threshold, {
      target: { value: '5' },
    });
    fireEvent.blur(threshold);
    fireEvent.click(screen.getByRole('button', { name: '保存设置' }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0][0]).toMatchObject({
      source_id: 7,
      group_name: '电影',
      failure_threshold: 5,
      alerts_enabled: true,
      cooldown_minutes: 60,
    });
  });

  it('loads a server template as an editable creation configuration', async () => {
    api.getAutomationTemplates.mockResolvedValue({
      code: 0,
      data: [
        {
          id: 9,
          name: '下载模板',
          description: '用于剧集',
          trigger_type: 'rss',
          configuration_json: JSON.stringify(configuration),
        },
      ],
    });
    const use = vi.fn();
    render(<AutomationTemplates onUse={use} />);
    fireEvent.click(await screen.findByRole('button', { name: /使用模板/ }));
    expect(use).toHaveBeenCalledWith(configuration, '下载模板');
    expect(api.saveAutomationTemplate).not.toHaveBeenCalled();
  });

  it('shows a version diff and restores with the latest version guard', async () => {
    const old = structuredClone(configuration);
    old.source.name = '以前的名称';
    api.getAutomationRevisions.mockResolvedValue({
      code: 0,
      data: [
        {
          id: 2,
          version: 2,
          configuration_json: JSON.stringify(configuration),
          created_at: '2026-10-04T00:00:00Z',
        },
        {
          id: 1,
          version: 1,
          configuration_json: JSON.stringify(old),
          created_at: '2026-10-03T00:00:00Z',
        },
      ],
    });
    api.restoreAutomationRevision.mockResolvedValue({ code: 0, data: {} });
    const restored = vi.fn().mockResolvedValue(undefined);
    render(
      <AutomationVersionsModal
        sourceID={7}
        current={configuration}
        onCancel={vi.fn()}
        onRestored={restored}
      />,
    );
    expect(await screen.findByText('"以前的名称"')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '恢复此版本' }));
    fireEvent.click(
      await screen.findByRole('button', { name: '恢复为新版本' }),
    );
    await waitFor(() =>
      expect(api.restoreAutomationRevision).toHaveBeenCalledWith(7, 1, 2),
    );
    expect(restored).toHaveBeenCalledTimes(1);
  });
});
