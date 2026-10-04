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
  testUpgradePolicy,
  type UpgradePolicy,
} from '@/services/film-fusion/upgrade';
import UpgradePolicyEditor from './UpgradePolicyEditor';

vi.mock('@/services/film-fusion/upgrade', async (original) => ({
  ...(await original<typeof import('@/services/film-fusion/upgrade')>()),
  getUpgradePresets: vi.fn(),
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

function Editor({ onChange }: { onChange: (value: string) => void }) {
  const [value, setValue] = useState('');
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
  });
  afterEach(cleanup);

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
