import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AutomationSource,
  AutomationWorkflow,
} from '@/services/film-fusion';
import AutomationEditorModal from './AutomationEditorModal';
import {
  buildAutomationDefinition,
  defaultAutomationActions,
} from './workflow';

const validate = vi.hoisted(() => vi.fn());
vi.mock('@/services/film-fusion', () => ({
  validateAutomationWorkflow: validate,
}));
vi.mock('./DirectoryIdInput', () => ({
  default: ({ value }: { value?: string }) => (
    <input aria-label="监控目录选择" readOnly value={value || ''} />
  ),
}));

const source: AutomationSource = {
  id: 1,
  name: '媒体入库',
  description: '保留预览模式',
  enabled: true,
  trigger_type: '115_directory',
  cloud_storage_id: 8,
  directory_id: '123',
  directory_path: '/待整理',
  recursive: true,
  interval_seconds: 300,
  quiet_seconds: 120,
  initialized: true,
  created_at: '',
  updated_at: '',
};
const definition = buildAutomationDefinition({
  ...defaultAutomationActions(),
  recognition: 'medianame',
  organize_enabled: true,
  organize_dry_run: true,
  cloud_directory_id: 9,
});
const workflow: AutomationWorkflow = {
  id: 2,
  source_id: 1,
  name: source.name,
  enabled: true,
  version: 1,
  definition_json: JSON.stringify(definition),
  created_at: '',
  updated_at: '',
};

describe('directory automation steps', () => {
  beforeEach(() =>
    validate.mockResolvedValue({ code: 0, data: { valid: true } }),
  );
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('stays on the trigger step until the account is selected', async () => {
    const submit = vi.fn();
    render(
      <AutomationEditorModal
        cloudDirectories={[]}
        cloudStorages={[]}
        onCancel={vi.fn()}
        onSubmit={submit}
        open
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /下一步：设计流程/ }));
    expect(await screen.findByText('请选择 115 OpenAPI 账号')).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: '从哪里发现新媒体？' }),
    ).toBeTruthy();
    expect(submit).not.toHaveBeenCalled();
    expect(validate).not.toHaveBeenCalled();
  });

  it('only saves on confirmation and retains recognition and preview settings across steps', async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    render(
      <AutomationEditorModal
        cloudDirectories={[
          {
            id: 9,
            cloud_storage_id: 8,
            directory_id: '456',
            directory_name: '媒体库',
          } as API.CloudDirectory,
        ]}
        cloudStorages={[
          {
            id: 8,
            storage_name: '115 账号',
            storage_type: '115open',
            status: 'active',
            cookie: 'test-only',
          } as API.CloudStorage,
        ]}
        onCancel={vi.fn()}
        onSubmit={submit}
        open
        source={source}
        workflow={workflow}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /下一步：设计流程/ }));
    await screen.findByRole('heading', { name: '发现新媒体后，做什么？' });
    fireEvent.change(screen.getByLabelText('通知内容'), {
      target: { value: '{{item.title}} 已完成' },
    });
    fireEvent.click(screen.getByRole('button', { name: /下一步：确认启用/ }));
    await screen.findByRole('heading', { name: '确认这条自动化' });
    expect(submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /上一步/ }));
    expect((screen.getByLabelText('通知内容') as HTMLInputElement).value).toBe(
      '{{item.title}} 已完成',
    );
    fireEvent.click(screen.getByRole('button', { name: /下一步：确认启用/ }));
    await screen.findByRole('heading', { name: '确认这条自动化' });
    fireEvent.click(screen.getByRole('button', { name: /保存更改/ }));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    const saved = submit.mock.calls[0][0];
    expect(saved.source.directory_id).toBe('123');
    expect(saved.workflow.definition.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'moviepilot_recognize',
          config: expect.objectContaining({ recognition_source: 'medianame' }),
        }),
        expect.objectContaining({
          type: 'organize_strm',
          config: expect.objectContaining({
            dry_run: true,
            cloud_directory_id: 9,
          }),
        }),
        expect.objectContaining({
          type: 'notification',
          config: expect.objectContaining({ message: '{{item.title}} 已完成' }),
        }),
      ]),
    );
  });
});
