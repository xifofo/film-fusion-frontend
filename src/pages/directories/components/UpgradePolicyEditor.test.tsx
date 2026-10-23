import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { ConfigProvider } from 'antd';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getUpgradePresets,
  getUpgradeRuleGroups,
  testUpgradePolicy,
  type UpgradePolicy,
} from '@/services/film-fusion/upgrade';
import UpgradePolicyEditor, { parseUpgradePolicy } from './UpgradePolicyEditor';

vi.mock('@/services/film-fusion/upgrade', async (original) => ({
  ...(await original<typeof import('@/services/film-fusion/upgrade')>()),
  getUpgradePresets: vi.fn(),
  getUpgradeRuleGroups: vi.fn(),
  testUpgradePolicy: vi.fn(),
}));

const quality: UpgradePolicy = {
  enabled: false,
  name: '画质优先',
  same_tier: false,
  min_score_gain: 10,
  max_size_mb: 0,
  exclude: ['CAM'],
  rules: [
    { name: '4K WEB', resolutions: ['2160p'], sources: ['WEB-DL'] },
    { name: '1080 WEB', resolutions: ['1080p'], sources: ['WEB-DL'] },
  ],
  bonuses: [{ name: '修正版', effects: ['PROPER', 'REPACK'], score: 10 }],
};

function Editor({
  onChange,
  initialValue = '',
}: {
  onChange: (value: string) => void;
  initialValue?: string;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <ConfigProvider theme={{ token: { motion: false } }}>
      <UpgradePolicyEditor
        value={value}
        onChange={(next) => {
          setValue(next);
          onChange(next);
        }}
      />
    </ConfigProvider>
  );
}

describe('organize upgrade policy editor', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getUpgradePresets).mockResolvedValue({
      code: 0,
      message: '',
      data: { quality },
    });
    vi.mocked(getUpgradeRuleGroups).mockResolvedValue({
      code: 0,
      message: '',
      data: [
        {
          id: 7,
          name: '共享画质',
          description: '多个目录共用',
          revision: 3,
          directory_count: 2,
          policy: { ...quality, enabled: true },
          created_at: '',
          updated_at: '',
        },
      ],
    });
  });
  afterEach(cleanup);

  it('shows readable audio and subtitle labels while preserving their stored codes', async () => {
    const change = vi.fn();
    const localized = {
      ...quality,
      rules: [
        {
          ...quality.rules[0],
          audio_languages: ['zh'],
          subtitles: ['zh-Hans'],
        },
      ],
    };
    render(
      <Editor onChange={change} initialValue={JSON.stringify(localized)} />,
    );
    fireEvent.click(await screen.findByText('1. 4K WEB'));
    expect(await screen.findByText('国语（zh）')).toBeTruthy();
    expect(await screen.findByText('简体中文（zh-Hans）')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: '策略名称' }), {
      target: { value: '国语与中文字幕' },
    });
    expect(JSON.parse(change.mock.lastCall?.[0]).rules[0]).toMatchObject({
      audio_languages: ['zh'],
      subtitles: ['zh-Hans'],
    });
  });

  it('accepts reference JSON without requiring inline rules and rejects invalid group IDs', () => {
    expect(
      parseUpgradePolicy('{"enabled":true,"group_id":7,"group_revision":3}'),
    ).toEqual({ enabled: true, group_id: 7 });
    expect(() => parseUpgradePolicy('{"enabled":true,"group_id":0}')).toThrow(
      '请选择有效',
    );
    expect(parseUpgradePolicy(JSON.stringify(quality))).toEqual(quality);
  });

  it('switches to a shared group without saving inline rules and restores the independent draft', async () => {
    const change = vi.fn();
    render(
      <Editor
        onChange={change}
        initialValue={JSON.stringify({ ...quality, name: '我的独立策略' })}
      />,
    );
    await waitFor(() => expect(getUpgradeRuleGroups).toHaveBeenCalled());
    fireEvent.mouseDown(screen.getByRole('combobox', { name: '策略来源' }));
    fireEvent.click(await screen.findByText('引用规则组'));
    await screen.findByText('引用 共享画质 · v3');
    expect(JSON.parse(change.mock.lastCall?.[0])).toEqual({
      enabled: false,
      group_id: 7,
    });
    expect(screen.queryByRole('textbox', { name: '策略名称' })).toBeNull();
    fireEvent.click(screen.getByRole('switch', { name: '启用洗版' }));
    expect(JSON.parse(change.mock.lastCall?.[0])).toEqual({
      enabled: true,
      group_id: 7,
    });
    fireEvent.mouseDown(screen.getByRole('combobox', { name: '策略来源' }));
    fireEvent.click(await screen.findByText('独立配置'));
    expect(JSON.parse(change.mock.lastCall?.[0])).toEqual({
      ...quality,
      name: '我的独立策略',
      enabled: true,
    });
  });

  it('copies a reference into an independent policy and preserves advanced rule fields', async () => {
    const enhanced = {
      ...quality,
      rules: [
        {
          ...quality.rules[0],
          audio_languages: ['zh'],
          subtitles: ['zh-Hans'],
          exclude: '删减',
          include_regex: '(?i)proper',
          condition: {
            op: 'any' as const,
            children: [
              {
                op: 'match' as const,
                field: 'name' as const,
                values: ['中字'],
                match: 'contains' as const,
              },
            ],
          },
        },
      ],
      group_id: 7,
      group_revision: 3,
    };
    vi.mocked(getUpgradeRuleGroups).mockResolvedValue({
      code: 0,
      message: '',
      data: [
        {
          id: 7,
          name: '共享画质',
          description: '',
          revision: 3,
          policy: enhanced,
          directory_count: 1,
          created_at: '',
          updated_at: '',
        },
      ],
    });
    const change = vi.fn();
    render(
      <Editor onChange={change} initialValue='{"enabled":true,"group_id":7}' />,
    );
    fireEvent.click(
      await screen.findByRole('button', { name: '复制规则组为独立配置' }),
    );
    const saved = JSON.parse(change.mock.lastCall?.[0]);
    expect(saved.rules).toEqual(enhanced.rules);
    expect(saved.enabled).toBe(true);
    expect(saved.group_id).toBeUndefined();
    expect(saved.group_revision).toBeUndefined();
  });

  it('does not cache a malformed independent policy when switching to and from a group', async () => {
    const change = vi.fn();
    render(<Editor onChange={change} initialValue='{"rules":"broken"}' />);
    await screen.findByText('洗版策略格式错误，请选择预设重新配置');
    await waitFor(() => expect(getUpgradeRuleGroups).toHaveBeenCalled());
    fireEvent.mouseDown(screen.getByRole('combobox', { name: '策略来源' }));
    fireEvent.click(await screen.findByText('引用规则组'));
    await screen.findByText('引用 共享画质 · v3');
    fireEvent.mouseDown(screen.getByRole('combobox', { name: '策略来源' }));
    fireEvent.click(await screen.findByText('独立配置'));
    expect(JSON.parse(change.mock.lastCall?.[0])).toEqual(quality);
  });

  it('tests a referenced policy through the backend without flattening its current version', async () => {
    vi.mocked(testUpgradePolicy).mockResolvedValue({
      code: 0,
      message: '',
      data: {
        action: 'review',
        reason: '字幕标签未知',
        incoming: { tier: 0, label: '未知', score: 0, reasons: [] },
        existing: { tier: 1, label: '4K WEB', score: 0, reasons: [] },
      },
    });
    render(
      <Editor
        onChange={vi.fn()}
        initialValue='{"enabled":true,"group_id":7}'
      />,
    );
    fireEvent.click(await screen.findByText('试一试：比较两个版本'));
    fireEvent.click(screen.getByRole('button', { name: '比较质量' }));
    await screen.findByText('字幕标签未知');
    expect(testUpgradePolicy).toHaveBeenCalledWith(
      expect.objectContaining({ policy: { enabled: true, group_id: 7 } }),
    );
  });

  it('keeps a missing reference visible instead of replacing it with the default preset', async () => {
    vi.mocked(getUpgradeRuleGroups).mockResolvedValue({
      code: 0,
      message: '',
      data: [],
    });
    const change = vi.fn();
    render(
      <Editor
        onChange={change}
        initialValue='{"enabled":true,"group_id":77}'
      />,
    );
    await screen.findByText('引用的规则组无法读取');
    expect(change).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: '画质优先' })).toBeNull();
    expect(screen.queryByText('试一试：比较两个版本')).toBeNull();
  });

  it('loads defaults without enabling or saving and preserves rule order and weights on edits', async () => {
    const change = vi.fn();
    render(<Editor onChange={change} />);
    await screen.findByRole('button', { name: '画质优先' });
    expect(change).not.toHaveBeenCalled();
    expect(
      screen
        .getByRole('switch', { name: '启用洗版' })
        .getAttribute('aria-checked'),
    ).toBe('false');
    fireEvent.click(screen.getByRole('switch', { name: '启用洗版' }));
    fireEvent.click(screen.getByRole('button', { name: '1080 WEB上移' }));
    fireEvent.click(screen.getByText('同档位权重'));
    fireEvent.click(
      await screen.findByRole('switch', { name: '允许同档升级' }),
    );
    const saved = JSON.parse(change.mock.lastCall?.[0]);
    expect(saved).toMatchObject({
      enabled: true,
      same_tier: true,
      min_score_gain: 10,
      bonuses: quality.bonuses,
    });
    expect(saved.rules.map((rule: { name: string }) => rule.name)).toEqual([
      '1080 WEB',
      '4K WEB',
    ]);
    expect(testUpgradePolicy).not.toHaveBeenCalled();
  });

  it('tests the edited policy using the backend and shows why the existing copy is kept', async () => {
    vi.mocked(testUpgradePolicy).mockResolvedValue({
      code: 0,
      message: '',
      data: {
        action: 'keep',
        reason: '同档位保留已有版本',
        incoming: { tier: 1, label: '4K WEB', score: 0, reasons: [] },
        existing: { tier: 1, label: '4K WEB', score: 0, reasons: [] },
      },
    });
    render(<Editor onChange={vi.fn()} />);
    fireEvent.click(await screen.findByText('试一试：比较两个版本'));
    fireEvent.change(
      await screen.findByRole('textbox', { name: '已有文件名' }),
      { target: { value: 'Same.2160p.WEB-DL.mkv' } },
    );
    fireEvent.click(screen.getByRole('button', { name: '比较质量' }));
    await screen.findByText('同档位保留已有版本');
    expect(testUpgradePolicy).toHaveBeenCalledWith(
      expect.objectContaining({
        existing: 'Same.2160p.WEB-DL.mkv',
        policy: quality,
      }),
    );
    expect(
      screen.getByText(/整理时还会校验 TMDB、季集和文件归属/),
    ).toBeTruthy();
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: '比较质量' }) as HTMLButtonElement)
          .disabled,
      ).toBe(false),
    );
  });
});
