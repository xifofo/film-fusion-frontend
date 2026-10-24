import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type PlutoFishRepairItem,
  previewPlutoFishSTRMRepairs,
  repairPlutoFishSTRMs,
} from '@/services/film-fusion/plutofish';
import STRMRepairPanel from './STRMRepairPanel';

vi.mock('@/services/film-fusion/plutofish', () => ({
  previewPlutoFishSTRMRepairs: vi.fn(),
  repairPlutoFishSTRMs: vi.fn(),
}));

const result = <T,>(data: T): API.Response<T> => ({
  code: 0,
  message: '',
  data,
});
const item = (
  id: number,
  overrides: Partial<PlutoFishRepairItem> = {},
): PlutoFishRepairItem => ({
  eventID: id,
  fileName: `episode${id}.mkv`,
  workTitle: '尚公主',
  oldPath: `/strm/PlutoFish/hash/task${id}/episode${id}.strm`,
  newPath: `/strm/115LongTerm/影视中心/尚公主/Season 01/episode${id}.strm`,
  oldContent: `/old/episode${id}.mkv`,
  content: `/CloudNAS/CloudDrive/115LongTerm/影视中心/尚公主/Season 01/episode${id}.mkv`,
  state: 'ready',
  reason: '可修复',
  canRepair: true,
  snapshot: `${id}`.repeat(64),
  ...overrides,
});
const setup = () => {
  const onRepaired = vi.fn();
  const onBusyChange = vi.fn();
  const view = render(
    <STRMRepairPanel onRepaired={onRepaired} onBusyChange={onBusyChange} />,
  );
  return { ...view, onRepaired, onBusyChange };
};

const rowFor = (text: string) => {
  const row = screen.getByText(text).closest('tr');
  if (!row) throw new Error('Expected table row');
  return row;
};

describe('历史 STRM 修复', () => {
  beforeEach(() => vi.resetAllMocks());
  afterEach(cleanup);

  it('先预览路径和播放内容，只提交所选可修复项，并逐条展示结果', async () => {
    const rows = [
      item(1),
      item(2, {
        state: 'blocked',
        canRepair: false,
        reason: '目标文件内容冲突',
      }),
      item(3),
    ];
    vi.mocked(previewPlutoFishSTRMRepairs).mockResolvedValue(
      result({ items: rows, hasMore: false, nextAfter: 3 }),
    );
    vi.mocked(repairPlutoFishSTRMs).mockResolvedValue(
      result({
        items: [
          item(1, { state: 'repaired', canRepair: false, reason: '已修复' }),
        ],
      }),
    );
    const view = setup();
    expect(previewPlutoFishSTRMRepairs).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '预览历史 STRM' }));
    await screen.findByText(rows[0].oldPath);
    expect(screen.getByText(rows[0].newPath)).toBeTruthy();
    expect(repairPlutoFishSTRMs).not.toHaveBeenCalled();
    const blockedRow = rowFor('目标文件内容冲突');
    expect(
      (within(blockedRow).getByRole('checkbox') as HTMLInputElement).disabled,
    ).toBe(true);
    const firstRow = rowFor(rows[0].oldPath);
    fireEvent.click(
      within(firstRow).getByRole('button', { name: /展开|expand/i }),
    );
    expect(await screen.findByText(rows[0].oldContent)).toBeTruthy();
    expect(screen.getByText(rows[0].content)).toBeTruthy();
    const thirdRow = rowFor(rows[2].oldPath);
    fireEvent.click(within(thirdRow).getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: '修复所选（1）' }));
    await waitFor(() =>
      expect(repairPlutoFishSTRMs).toHaveBeenCalledWith(
        [{ eventID: 1, snapshot: rows[0].snapshot }],
        expect.any(AbortSignal),
      ),
    );
    await screen.findByText('已修复 1 条，未完成 0 条；已处理 1 / 1 条。');
    expect(view.onRepaired).toHaveBeenCalledTimes(1);
    expect(view.onBusyChange).toHaveBeenLastCalledWith(false);
  });

  it('按批次游标翻页，不使用通知游标；返回首批重新计算', async () => {
    vi.mocked(previewPlutoFishSTRMRepairs)
      .mockResolvedValueOnce(
        result({ items: [item(4)], nextAfter: 4, hasMore: true }),
      )
      .mockResolvedValueOnce(
        result({ items: [item(6)], nextAfter: 6, hasMore: false }),
      )
      .mockResolvedValueOnce(
        result({ items: [item(4)], nextAfter: 4, hasMore: true }),
      );
    setup();
    fireEvent.click(screen.getByRole('button', { name: '预览历史 STRM' }));
    fireEvent.click(await screen.findByRole('button', { name: '下一批' }));
    await screen.findByText('episode6.mkv');
    expect(previewPlutoFishSTRMRepairs).toHaveBeenLastCalledWith(
      4,
      expect.any(AbortSignal),
    );
    fireEvent.click(screen.getByRole('button', { name: '返回首批' }));
    await screen.findByText('episode4.mkv');
    expect(previewPlutoFishSTRMRepairs).toHaveBeenLastCalledWith(
      0,
      expect.any(AbortSignal),
    );
    expect(repairPlutoFishSTRMs).not.toHaveBeenCalled();
  });

  it('小批执行保留已完成项，请求中断提示重新预览且不重复发送', async () => {
    const rows = Array.from({ length: 11 }, (_, i) => item(i + 1));
    vi.mocked(previewPlutoFishSTRMRepairs).mockResolvedValue(
      result({ items: rows, nextAfter: 11, hasMore: false }),
    );
    vi.mocked(repairPlutoFishSTRMs)
      .mockResolvedValueOnce(
        result({
          items: rows
            .slice(0, 10)
            .map((row) => ({ ...row, state: 'repaired', canRepair: false })),
        }),
      )
      .mockRejectedValueOnce(new Error('network timeout'));
    setup();
    fireEvent.click(screen.getByRole('button', { name: '预览历史 STRM' }));
    await screen.findByText('episode1.mkv');
    const button = screen.getByRole('button', { name: '修复所选（11）' });
    fireEvent.click(button);
    fireEvent.click(button);
    await screen.findByText(
      '修复请求未完成。已完成的记录会保留，请重新预览后继续。',
    );
    expect(repairPlutoFishSTRMs).toHaveBeenCalledTimes(2);
    expect(
      vi.mocked(repairPlutoFishSTRMs).mock.calls.map(([batch]) => batch.length),
    ).toEqual([10, 1]);
    expect(screen.getAllByText('已修复').length).toBe(10);
    await waitFor(() =>
      expect(
        (
          screen.getByRole('button', {
            name: /修复所选（1）/,
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
  });

  it('展示冲突和清理未完成的原因，可重新预览后继续', async () => {
    vi.mocked(previewPlutoFishSTRMRepairs).mockResolvedValue(
      result({ items: [item(1), item(2)], nextAfter: 2, hasMore: false }),
    );
    vi.mocked(repairPlutoFishSTRMs).mockResolvedValue(
      result({
        items: [
          item(1, {
            state: 'blocked',
            canRepair: false,
            reason: '预览已变化，请重新预览',
          }),
          item(2, {
            state: 'failed',
            reason: '数据库路径已同步，旧文件清理失败',
          }),
        ],
      }),
    );
    setup();
    fireEvent.click(screen.getByRole('button', { name: '预览历史 STRM' }));
    await screen.findByText('episode1.mkv');
    fireEvent.click(screen.getByRole('button', { name: '修复所选（2）' }));
    await screen.findByText('已修复 0 条，未完成 2 条；已处理 2 / 2 条。');
    expect(screen.getByText('预览已变化，请重新预览')).toBeTruthy();
    expect(screen.getByText('数据库路径已同步，旧文件清理失败')).toBeTruthy();
  });
});
