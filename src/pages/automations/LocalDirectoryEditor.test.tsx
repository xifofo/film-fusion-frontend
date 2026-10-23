import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AutomationDefinition,
  AutomationSource,
  AutomationWorkflow,
} from '@/services/film-fusion';
import LocalDirectoryEditor from './LocalDirectoryEditor';
import {
  defaultLocalDirectoryConfig,
  localDirectoryDefinition,
} from './localDirectory';

const validate = vi.hoisted(() => vi.fn());
vi.mock('@/services/film-fusion', () => ({
  validateAutomationWorkflow: validate,
}));
vi.mock('@/pages/rss-automation/WorkflowPanel', () => ({
  default: ({
    initialDefinition,
    onWizardNext,
    onWizardBack,
    itemReferences,
  }: {
    initialDefinition: AutomationDefinition;
    onWizardNext: (definition: AutomationDefinition) => void;
    onWizardBack: (definition: AutomationDefinition) => void;
    itemReferences: Array<{ value: string }>;
  }) => (
    <div>
      <span>{itemReferences.map((item) => item.value).join(' ')}</span>
      <button type="button" onClick={() => onWizardBack(initialDefinition)}>
        返回目录配置
      </button>
      <button type="button" onClick={() => onWizardNext(initialDefinition)}>
        完成流程设计
      </button>
    </div>
  ),
}));

const props = {
  cloudStorages: [],
  cloudDirectories: [],
  targets: [],
  nodeProtocols: [],
  onCancel: vi.fn(),
};
const source: AutomationSource = {
  id: 17,
  name: 'NAS 文件处理',
  description: '',
  enabled: false,
  trigger_type: 'local_directory',
  directory_path: '/mnt/nas/media',
  recursive: true,
  interval_seconds: 90,
  quiet_seconds: 45,
  initialized: true,
  created_at: '',
  updated_at: '',
  local_config_json: JSON.stringify({
    ...defaultLocalDirectoryConfig(),
    mode: 'poll',
    events: ['created', 'modified'],
    max_watches: 50,
    batch_size: 32,
  }),
};

beforeEach(() =>
  validate.mockResolvedValue({ code: 0, data: { valid: true } }),
);
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('local directory configuration and action workflow', () => {
  it('validates server absolute paths then creates a bounded monitor with notification', async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    render(<LocalDirectoryEditor {...props} onSubmit={submit} />);
    fireEvent.change(screen.getByLabelText('监控目录'), {
      target: { value: 'relative/downloads' },
    });
    fireEvent.click(screen.getByRole('button', { name: '下一步：设计流程' }));
    expect(
      await screen.findByText('请输入绝对路径，例如 /media/downloads'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: '完成流程设计' })).toBeNull();
    fireEvent.change(screen.getByLabelText('监控目录'), {
      target: { value: '/mnt/nas/media' },
    });
    fireEvent.click(screen.getByRole('button', { name: '下一步：设计流程' }));
    fireEvent.click(
      await screen.findByRole('button', { name: '完成流程设计' }),
    );
    expect(submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '创建目录监控' }));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit.mock.calls[0][0]).toMatchObject({
      source: {
        trigger_type: 'local_directory',
        directory_path: '/mnt/nas/media',
        recursive: true,
        interval_seconds: 300,
        quiet_seconds: 30,
        local_config: {
          max_watches: 1024,
          batch_size: 128,
          events: ['created'],
          initial_scan: 'baseline',
        },
      },
    });
    const definition = submit.mock.calls[0][0].workflow
      .definition as AutomationDefinition;
    expect(definition.nodes.map((node) => node.type)).toEqual([
      'trigger',
      'notification',
      'end',
    ]);
    expect(definition.edges[1].source_port).toBe('success');
    expect(submit.mock.calls[0][0].source.cloud_storage_id).toBeUndefined();
  });

  it('preserves custom branching workflow and monitor limits while editing source settings', async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    const definition = localDirectoryDefinition();
    definition.parameters = { endpoint: 'https://example.test/hooks' };
    definition.nodes[1] = {
      ...definition.nodes[1],
      type: 'http_request',
      config: {
        method: 'POST',
        url: '$params.endpoint',
        body: '{{item.path}}',
      },
    };
    const workflow: AutomationWorkflow = {
      id: 18,
      source_id: source.id,
      name: source.name,
      enabled: false,
      version: 4,
      definition_json: JSON.stringify(definition),
      created_at: '',
      updated_at: '',
    };
    render(
      <LocalDirectoryEditor
        {...props}
        source={source}
        workflow={workflow}
        onSubmit={submit}
      />,
    );
    fireEvent.change(screen.getByLabelText('监控目录'), {
      target: { value: '/mnt/nas/new' },
    });
    fireEvent.click(screen.getByRole('button', { name: '下一步：设计流程' }));
    expect(await screen.findByText(/\$item\.relative_path/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '返回目录配置' }));
    expect((screen.getByLabelText('监控目录') as HTMLInputElement).value).toBe(
      '/mnt/nas/new',
    );
    fireEvent.click(screen.getByRole('button', { name: '下一步：设计流程' }));
    fireEvent.click(
      await screen.findByRole('button', { name: '完成流程设计' }),
    );
    fireEvent.click(screen.getByRole('button', { name: '保存目录监控' }));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit.mock.calls[0][0]).toMatchObject({
      expected_version: 4,
      source: {
        directory_path: '/mnt/nas/new',
        enabled: false,
        local_config: {
          mode: 'poll',
          max_watches: 50,
          batch_size: 32,
          events: ['created', 'modified'],
        },
      },
      workflow: { definition },
    });
  });

  it('applies the large-directory preset without replacing the path, events or filters', async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    render(
      <LocalDirectoryEditor
        {...props}
        source={{
          ...source,
          local_config_json: JSON.stringify({
            ...defaultLocalDirectoryConfig(),
            events: ['modified'],
            exclude_patterns: ['*.part'],
            include_extensions: ['.mkv'],
          }),
        }}
        onSubmit={submit}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '应用大目录预设' }));
    expect(
      (screen.getByLabelText('每段扫描时间预算（毫秒）') as HTMLInputElement)
        .value,
    ).toBe('2000');
    expect(
      (screen.getByLabelText('完成任务历史上限') as HTMLInputElement).value,
    ).toBe('10000');
    expect(
      (screen.getByLabelText('运行历史保留天数') as HTMLInputElement).value,
    ).toBe('30');
    fireEvent.click(screen.getByRole('button', { name: '下一步：设计流程' }));
    fireEvent.click(
      await screen.findByRole('button', { name: '完成流程设计' }),
    );
    expect(screen.getByText(/每段时间预算 2000 毫秒/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '保存目录监控' }));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit.mock.calls[0][0].source).toMatchObject({
      directory_path: source.directory_path,
      interval_seconds: 900,
      quiet_seconds: 60,
      local_config: {
        mode: 'poll',
        events: ['modified'],
        exclude_patterns: ['*.part'],
        include_extensions: ['.mkv'],
        scan_budget_ms: 2000,
        scan_item_limit: 4096,
        max_pending_runs: 1000,
        history_retention_days: 30,
        history_max_runs: 10000,
        missing_retention_days: 7,
      },
    });
  });

  it('shows configuration corruption without replacing it with defaults', () => {
    render(
      <LocalDirectoryEditor
        {...props}
        source={{ ...source, local_config_json: '{broken' }}
        onSubmit={vi.fn()}
      />,
    );
    expect(
      screen.getByText('本地目录配置无法读取，请修复原配置后再编辑或复制'),
    ).toBeTruthy();
    expect(
      (
        screen.getByRole('button', {
          name: '下一步：设计流程',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});
