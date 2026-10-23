import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { App, ConfigProvider } from 'antd';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/lib/api-client';
import type {
  UpgradePolicy,
  UpgradeRuleGroup,
} from '@/services/film-fusion/upgrade';
import UpgradeRulesPage from './index';

vi.mock('@/lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

vi.mock(
  '@/pages/directories/components/UpgradePolicyEditor',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('@/pages/directories/components/UpgradePolicyEditor')
    >()),
    default: ({
      value,
      onChange,
      groupEditing,
    }: {
      value?: string;
      onChange?: (value: string) => void;
      groupEditing?: boolean;
    }) => (
      <textarea
        aria-label="测试策略编辑器"
        data-group-editing={String(groupEditing)}
        value={value || ''}
        onChange={(event) => onChange?.(event.target.value)}
      />
    ),
  }),
);

const endpoint = '/api/organize/upgrade/rule-groups';
const policy: UpgradePolicy = {
  enabled: false,
  name: '原策略名称',
  group_id: 42,
  group_revision: 3,
  rules: [
    {
      name: '4K 国语',
      resolutions: ['2160p'],
      audio_codecs: ['TrueHD'],
      audio_channels: ['7.1'],
      audio_languages: ['zh'],
      subtitles: ['zh-Hans'],
      include: 'WEB',
      exclude: 'CAM',
      include_regex: '(?i)S\\d{1,2}',
      exclude_regex: '(?i)sample',
      condition: {
        op: 'any',
        children: [
          {
            op: 'match',
            field: 'audio_language',
            values: ['zh'],
            match: 'equals',
          },
          {
            op: 'not',
            children: [
              {
                op: 'match',
                field: 'name',
                values: ['sample'],
                match: 'contains',
              },
            ],
          },
        ],
      },
    },
  ],
  bonuses: [{ name: '中文字幕', subtitles: ['zh-Hans'], score: 15 }],
  exclude: ['CAM'],
  exclude_condition: {
    op: 'match',
    field: 'name',
    values: ['sample'],
    match: 'contains',
  },
  max_size_mb: 50000,
  same_tier: true,
  min_score_gain: 15,
};
const referencedGroup: UpgradeRuleGroup = {
  id: 42,
  name: '4K 国语优先',
  description: '家庭影音收藏',
  revision: 3,
  policy,
  directory_count: 2,
  created_at: '2026-10-22T10:00:00Z',
  updated_at: '2026-10-22T10:00:00Z',
};
const unusedGroup: UpgradeRuleGroup = {
  ...referencedGroup,
  id: 43,
  name: '备用规则组',
  revision: 1,
  directory_count: 0,
};

function renderPage() {
  return render(
    <ConfigProvider theme={{ token: { motion: false } }}>
      <App>
        <UpgradeRulesPage />
      </App>
    </ConfigProvider>,
  );
}

function draftPolicy(dialog: HTMLElement) {
  return within(dialog).getByRole('textbox', {
    name: '测试策略编辑器',
  }) as HTMLTextAreaElement;
}

describe('upgrade rule group management', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(apiClient.get).mockResolvedValue({
      code: 0,
      message: '',
      data: [referencedGroup, unusedGroup],
    });
    vi.mocked(apiClient.post).mockResolvedValue({
      code: 0,
      message: '',
      data: { ...referencedGroup, id: 99, revision: 1 },
    });
    vi.mocked(apiClient.put).mockResolvedValue({
      code: 0,
      message: '',
      data: { ...referencedGroup, revision: 4 },
    });
    vi.mocked(apiClient.delete).mockResolvedValue({
      code: 0,
      message: '',
      data: null,
    });
  });
  afterEach(cleanup);

  it('loads versions and reference counts and prevents deleting referenced groups', async () => {
    renderPage();
    const row = (await screen.findByText('4K 国语优先')).closest('tr');
    if (!row) throw new Error('规则组必须显示在表格行中');
    expect(within(row).getByText('v3')).toBeTruthy();
    expect(within(row).getByText('2 个')).toBeTruthy();
    expect(within(row).getByText('1 个档位 · 1 个偏好')).toBeTruthy();
    expect(apiClient.get).toHaveBeenCalledExactlyOnceWith(endpoint);
    const deleteReferenced = screen.getByRole('button', {
      name: '删除4K 国语优先',
    }) as HTMLButtonElement;
    expect(deleteReferenced.disabled).toBe(true);
    fireEvent.click(deleteReferenced);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(apiClient.delete).not.toHaveBeenCalled();
    expect(
      (
        screen.getByRole('button', {
          name: '删除备用规则组',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });

  it('copies into a new group and POSTs enhanced rules without identifiers or revision metadata', async () => {
    renderPage();
    fireEvent.click(
      await screen.findByRole('button', { name: '复制4K 国语优先' }),
    );
    const dialog = screen.getByRole('dialog', { name: '新建规则组' });
    expect(
      (
        within(dialog).getByRole('textbox', {
          name: '规则组名称',
        }) as HTMLInputElement
      ).value,
    ).toBe('4K 国语优先 副本');
    expect(draftPolicy(dialog).getAttribute('data-group-editing')).toBe('true');
    const {
      group_id: _id,
      group_revision: _revision,
      ...independentPolicy
    } = policy;
    expect(JSON.parse(draftPolicy(dialog).value)).toEqual({
      ...independentPolicy,
      enabled: true,
    });
    expect(within(dialog).queryByText(/此规则组被/)).toBeNull();
    fireEvent.change(
      within(dialog).getByRole('textbox', { name: '规则组名称' }),
      { target: { value: '  新目录规则  ' } },
    );
    fireEvent.change(
      within(dialog).getByRole('textbox', { name: '规则组说明' }),
      { target: { value: '  独立收藏规则  ' } },
    );
    fireEvent.click(within(dialog).getByRole('button', { name: '保存规则组' }));
    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledExactlyOnceWith(endpoint, {
        name: '新目录规则',
        description: '独立收藏规则',
        policy: { ...independentPolicy, enabled: true, name: '新目录规则' },
      }),
    );
    expect(apiClient.put).not.toHaveBeenCalled();
    expect(policy.group_id).toBe(42);
    expect(policy.group_revision).toBe(3);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(apiClient.get).toHaveBeenCalledTimes(2);
  });

  it.each(['HTTP conflict', 'application conflict'])(
    'sends the expected revision and preserves unsaved edits on %s',
    async (kind) => {
      const conflictMessage = '规则组已被其他操作修改，请重新加载后编辑';
      if (kind === 'HTTP conflict') {
        vi.mocked(apiClient.put).mockRejectedValue({
          response: { status: 409, data: { message: conflictMessage } },
        });
      } else {
        vi.mocked(apiClient.put).mockResolvedValue({
          code: 409,
          message: conflictMessage,
          data: null,
        });
      }
      renderPage();
      fireEvent.click(
        await screen.findByRole('button', { name: '编辑4K 国语优先' }),
      );
      const dialog = screen.getByRole('dialog', { name: '编辑规则组 · v3' });
      expect(within(dialog).getByText('此规则组被 2 个目录引用')).toBeTruthy();
      const editedPolicy: UpgradePolicy = JSON.parse(draftPolicy(dialog).value);
      editedPolicy.rules[0].audio_languages = ['zh', 'yue'];
      editedPolicy.rules[0].exclude_regex = '(?i)(sample|trailer)';
      fireEvent.change(draftPolicy(dialog), {
        target: { value: JSON.stringify(editedPolicy) },
      });
      fireEvent.change(
        within(dialog).getByRole('textbox', { name: '规则组名称' }),
        { target: { value: '国语粤语优先' } },
      );
      fireEvent.change(
        within(dialog).getByRole('textbox', { name: '规则组说明' }),
        { target: { value: '尚未保存的说明' } },
      );
      fireEvent.click(
        within(dialog).getByRole('button', { name: '保存规则组' }),
      );
      await screen.findByText(conflictMessage);
      expect(apiClient.put).toHaveBeenCalledExactlyOnceWith(`${endpoint}/42`, {
        expected_revision: 3,
        name: '国语粤语优先',
        description: '尚未保存的说明',
        policy: { ...editedPolicy, enabled: true, name: '国语粤语优先' },
      });
      expect(within(dialog).getByText('保存失败，编辑内容已保留')).toBeTruthy();
      expect(
        (
          within(dialog).getByRole('textbox', {
            name: '规则组名称',
          }) as HTMLInputElement
        ).value,
      ).toBe('国语粤语优先');
      expect(
        (
          within(dialog).getByRole('textbox', {
            name: '规则组说明',
          }) as HTMLTextAreaElement
        ).value,
      ).toBe('尚未保存的说明');
      expect(JSON.parse(draftPolicy(dialog).value)).toEqual(editedPolicy);
      expect(screen.getByRole('dialog', { name: '编辑规则组 · v3' })).toBe(
        dialog,
      );
      expect(apiClient.get).toHaveBeenCalledTimes(1);
      expect(apiClient.post).not.toHaveBeenCalled();
      await waitFor(() =>
        expect(
          (
            within(dialog).getByRole('button', {
              name: '保存规则组',
            }) as HTMLButtonElement
          ).disabled,
        ).toBe(false),
      );
    },
  );

  it('locks the draft while PUT is pending and closes only after the save succeeds', async () => {
    let finishSave: (response: API.Response<UpgradeRuleGroup>) => void = () => {
      throw new Error('延迟保存请求尚未初始化');
    };
    const pendingSave = new Promise<API.Response<UpgradeRuleGroup>>(
      (resolve) => {
        finishSave = resolve;
      },
    );
    vi.mocked(apiClient.put).mockReturnValue(pendingSave);
    renderPage();
    fireEvent.click(
      await screen.findByRole('button', { name: '编辑4K 国语优先' }),
    );
    const dialog = screen.getByRole('dialog', { name: '编辑规则组 · v3' });
    const nameInput = within(dialog).getByRole('textbox', {
      name: '规则组名称',
    }) as HTMLInputElement;
    const descriptionInput = within(dialog).getByRole('textbox', {
      name: '规则组说明',
    }) as HTMLTextAreaElement;
    const policyInput = draftPolicy(dialog);
    fireEvent.change(nameInput, { target: { value: '已提交的名称' } });
    fireEvent.change(descriptionInput, { target: { value: '已提交的说明' } });
    const submittedPolicy = policyInput.value;
    fireEvent.click(within(dialog).getByRole('button', { name: '保存规则组' }));
    await waitFor(() => expect(apiClient.put).toHaveBeenCalledTimes(1));
    expect(nameInput.disabled).toBe(true);
    expect(descriptionInput.disabled).toBe(true);
    expect(screen.getByRole('dialog', { name: '编辑规则组 · v3' })).toBe(
      dialog,
    );
    // The mock uses a native input, so it intentionally bypasses ConfigProvider
    // and verifies the page's onChange guard as well as its disabled controls.
    fireEvent.change(policyInput, {
      target: {
        value: JSON.stringify({ ...JSON.parse(submittedPolicy), rules: [] }),
      },
    });
    fireEvent.change(nameInput, { target: { value: '请求期间的新名称' } });
    fireEvent.change(descriptionInput, {
      target: { value: '请求期间的新说明' },
    });
    expect(policyInput.value).toBe(submittedPolicy);
    expect(nameInput.value).toBe('已提交的名称');
    expect(descriptionInput.value).toBe('已提交的说明');
    expect(apiClient.put).toHaveBeenCalledExactlyOnceWith(`${endpoint}/42`, {
      expected_revision: 3,
      name: '已提交的名称',
      description: '已提交的说明',
      policy: {
        ...JSON.parse(submittedPolicy),
        enabled: true,
        name: '已提交的名称',
      },
    });
    expect(apiClient.get).toHaveBeenCalledTimes(1);
    await act(async () => {
      finishSave({
        code: 0,
        message: '',
        data: { ...referencedGroup, revision: 4 },
      });
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(apiClient.get).toHaveBeenCalledTimes(2);
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('blocks saving a new group with no priority rules and keeps the draft open', async () => {
    renderPage();
    await screen.findByText('4K 国语优先');
    fireEvent.click(screen.getByRole('button', { name: '新建规则组' }));
    const dialog = screen.getByRole('dialog', { name: '新建规则组' });
    fireEvent.change(
      within(dialog).getByRole('textbox', { name: '规则组名称' }),
      { target: { value: '空规则组' } },
    );
    expect(JSON.parse(draftPolicy(dialog).value).rules).toEqual([]);
    fireEvent.click(within(dialog).getByRole('button', { name: '保存规则组' }));
    await within(dialog).findByText('请先选择预设，或添加至少一个优先级档位');
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(apiClient.put).not.toHaveBeenCalled();
    expect(
      (
        within(dialog).getByRole('textbox', {
          name: '规则组名称',
        }) as HTMLInputElement
      ).value,
    ).toBe('空规则组');
    expect(screen.getByRole('dialog', { name: '新建规则组' })).toBe(dialog);
  });
});
