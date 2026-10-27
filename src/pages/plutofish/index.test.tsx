import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { App, ConfigProvider } from 'antd';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getPlutoFishAccounts,
  getPlutoFishCloudPaths,
  getPlutoFishConfig,
  getPlutoFishEvents,
  getPlutoFishStatus,
  type PlutoFishConfig,
  type PlutoFishEvent,
  retryPlutoFishEvent,
  reviewPlutoFishEvent,
  startPlutoFish,
  stopPlutoFish,
  updatePlutoFishConfig,
} from '@/services/film-fusion/plutofish';
import PlutoFishPage, { redactPlutoFishError } from './index';

const renderReviewPage = () =>
  render(
    <ConfigProvider theme={{ token: { motion: false } }}>
      <App>
        <PlutoFishPage />
      </App>
    </ConfigProvider>,
  );

vi.mock('@/services/film-fusion/plutofish', () => ({
  getPlutoFishAccounts: vi.fn(),
  getPlutoFishCloudPaths: vi.fn(),
  getPlutoFishConfig: vi.fn(),
  getPlutoFishEvents: vi.fn(),
  getPlutoFishStatus: vi.fn(),
  updatePlutoFishConfig: vi.fn(),
  retryPlutoFishEvent: vi.fn(),
  reviewPlutoFishEvent: vi.fn(),
  startPlutoFish: vi.fn(),
  stopPlutoFish: vi.fn(),
  previewPlutoFishSTRMRepairs: vi.fn(),
  repairPlutoFishSTRMs: vi.fn(),
}));

const config: PlutoFishConfig = {
  enabled: true,
  baseURL: 'https://plutofish.shop',
  ownerUID: 'platform-user-1',
  mode: 'sse',
  keyConfigured: true,
  pollSeconds: 15,
  mappings: [{ targetAccountID: 'account-1', cloudPathID: 1 }],
};

const result = <T,>(data: T): API.Response<T> => ({
  code: 0,
  message: '',
  data,
});

const event = (
  id: number,
  status: string,
  state: PlutoFishEvent['state'],
): PlutoFishEvent => ({
  id,
  eventID: `opaque-event-${id}`,
  transferID: `transfer-${id}`,
  type: `transfer.${status}`,
  schemaVersion: 1,
  status,
  state,
  workTitle: `作品 ${id}`,
  fileName: `video-${id}.mkv`,
  reason:
    status === 'succeeded'
      ? '缺少目标目录路径，等待补充定位信息'
      : '仅记录转存结果',
  occurredAt: '2026-10-22T01:00:00Z',
});

describe('PlutoFish notification page', () => {
  beforeEach(() => {
    vi.mocked(getPlutoFishAccounts)
      .mockReset()
      .mockResolvedValue(
        result({
          ownerUID: config.ownerUID,
          items: [
            {
              id: 'account-1',
              name: '我的追剧网盘',
              provider: '115',
              enabled: true,
            },
          ],
        }),
      );
    vi.mocked(getPlutoFishConfig).mockResolvedValue(result(config));
    vi.mocked(getPlutoFishStatus).mockResolvedValue(
      result({
        state: 'streaming',
        lastError: '',
        cursor: 'opaque-cursor',
        pendingCount: 0,
        reviewCount: 1,
      }),
    );
    vi.mocked(getPlutoFishEvents).mockResolvedValue(
      result({
        items: [
          event(1, 'failed', 'recorded'),
          event(2, 'unknown', 'review'),
          event(3, 'succeeded', 'review'),
          {
            ...event(4, 'succeeded', 'review'),
            schemaVersion: 2,
            reason: '无法识别 schemaVersion，需要人工检查',
          },
        ],
        total: 4,
      }),
    );
    vi.mocked(getPlutoFishCloudPaths).mockResolvedValue(
      result({
        list: [
          {
            id: 1,
            user_id: 1,
            cloud_storage_id: 1,
            source_path: '/Movies',
            local_path: '/strm',
            link_type: 'strm',
            created_at: '',
            updated_at: '',
          },
        ],
        total: 1,
        current: 1,
        pageSize: 100,
      }),
    );
    vi.mocked(updatePlutoFishConfig).mockResolvedValue(result(config));
    vi.mocked(retryPlutoFishEvent).mockResolvedValue(result(null));
    vi.mocked(reviewPlutoFishEvent).mockReset().mockResolvedValue(result(null));
    vi.mocked(startPlutoFish).mockResolvedValue(result(null));
    vi.mocked(stopPlutoFish).mockResolvedValue(result(null));
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('preserves an existing secret on blank save and keeps string IDs and mapping', async () => {
    render(
      <App>
        <PlutoFishPage />
      </App>,
    );
    await screen.findByDisplayValue('platform-user-1');
    const secret = screen.getByLabelText(
      'API Key（已配置）',
    ) as HTMLInputElement;
    expect(secret.value).toBe('');
    fireEvent.click(screen.getByRole('button', { name: '保存配置' }));
    await waitFor(() => expect(updatePlutoFishConfig).toHaveBeenCalledTimes(1));
    const submitted = vi.mocked(updatePlutoFishConfig).mock.calls[0][0];
    expect(submitted.apiKey).toBeUndefined();
    expect(submitted.ownerUID).toBe('platform-user-1');
    expect(submitted.mappings).toEqual(config.mappings);
  });

  it('clears a newly entered key after saving without browser storage', async () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    render(
      <App>
        <PlutoFishPage />
      </App>,
    );
    await screen.findByDisplayValue('platform-user-1');
    const secret = screen.getByLabelText(
      'API Key（已配置）',
    ) as HTMLInputElement;
    fireEvent.change(secret, { target: { value: 'pf_events_mock_test_only' } });
    fireEvent.click(screen.getByRole('button', { name: '保存配置' }));
    await waitFor(() => expect(updatePlutoFishConfig).toHaveBeenCalledTimes(1));
    expect(vi.mocked(updatePlutoFishConfig).mock.calls[0][0].apiKey).toBe(
      'pf_events_mock_test_only',
    );
    await waitFor(() => expect(secret.value).toBe(''));
    expect(storage).not.toHaveBeenCalled();
  });

  it('adds and saves another cloud path for the same receiving account', async () => {
    vi.mocked(getPlutoFishCloudPaths).mockResolvedValue(
      result({
        list: [
          {
            id: 1,
            user_id: 1,
            cloud_storage_id: 1,
            source_path: '/Movies',
            local_path: '/strm/movies',
            link_type: 'strm',
            created_at: '',
            updated_at: '',
          },
          {
            id: 2,
            user_id: 1,
            cloud_storage_id: 1,
            source_path: '/TV',
            local_path: '/strm/tv',
            link_type: 'strm',
            created_at: '',
            updated_at: '',
          },
        ],
        total: 2,
        current: 1,
        pageSize: 100,
      }),
    );
    const saved = {
      ...config,
      mappings: [
        ...config.mappings,
        { targetAccountID: 'account-1', cloudPathID: 2 },
      ],
    };
    vi.mocked(updatePlutoFishConfig).mockResolvedValue(result(saved));
    render(
      <App>
        <PlutoFishPage />
      </App>,
    );
    await screen.findByRole('button', { name: /刷新接收网盘/ });
    fireEvent.click(
      screen.getByRole('button', { name: '添加网盘与 STRM 映射' }),
    );
    const accounts = screen.getAllByRole('combobox', {
      name: 'PlutoFish 接收网盘',
    });
    expect(accounts).toHaveLength(2);
    fireEvent.mouseDown(accounts[1]);
    fireEvent.click(
      await screen.findByText('我的追剧网盘 · 115', {
        selector: '.ant-select-item-option-content',
      }),
    );
    const paths = screen.getAllByRole('combobox', {
      name: 'FilmFusion 云路径映射',
    });
    fireEvent.mouseDown(paths[1]);
    fireEvent.click(
      await screen.findByText(/#2.*\/TV/, {
        selector: '.ant-select-item-option-content',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: '保存配置' }));
    await waitFor(() => expect(updatePlutoFishConfig).toHaveBeenCalledOnce());
    expect(vi.mocked(updatePlutoFishConfig).mock.calls[0][0].mappings).toEqual(
      saved.mappings,
    );
    expect(
      screen.getAllByRole('combobox', { name: 'FilmFusion 云路径映射' }),
    ).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: '移除第 1 条映射' }));
    fireEvent.click(screen.getByRole('button', { name: '保存配置' }));
    await waitFor(() => expect(updatePlutoFishConfig).toHaveBeenCalledTimes(2));
    expect(vi.mocked(updatePlutoFishConfig).mock.calls[1][0].mappings).toEqual([
      saved.mappings[1],
    ]);
  });

  it('offers local retry only for successful review events, never failed or unknown transfers', async () => {
    render(
      <App>
        <PlutoFishPage />
      </App>,
    );
    expect(await screen.findByText('转存失败')).toBeTruthy();
    expect(screen.getByText('转存待核对')).toBeTruthy();
    expect(
      screen.getByText('无法识别 schemaVersion，需要人工检查'),
    ).toBeTruthy();
    expect(screen.getByText('缺少目标目录路径，等待补充定位信息')).toBeTruthy();
    expect(screen.queryByText('本地处理完成')).toBeNull();
    const buttons = screen.getAllByRole('button', { name: '重新处理本地任务' });
    expect(buttons).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: '标记已核对' })).toHaveLength(
      3,
    );
    fireEvent.click(buttons[0]);
    await waitFor(() => expect(retryPlutoFishEvent).toHaveBeenCalledWith(3));
  });

  it('confirms an unknown result, refreshes the review count and preserves its original result and reason', async () => {
    const original = event(2, 'unknown', 'review');
    vi.mocked(getPlutoFishEvents).mockResolvedValue(
      result({ items: [original], total: 1 }),
    );
    renderReviewPage();
    expect(await screen.findByText('转存待核对')).toBeTruthy();
    expect(screen.getByText('待核对：1')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '标记已核对' }));
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText(
        /只关闭这条事件的本地待核对提醒，不代表转存成功/,
      ),
    ).toBeTruthy();
    expect(within(dialog).getByText(/不会删除历史记录/)).toBeTruthy();
    expect(reviewPlutoFishEvent).not.toHaveBeenCalled();
    const reviewedAt = '2026-10-27T02:30:00Z';
    vi.mocked(getPlutoFishEvents).mockResolvedValue(
      result({
        items: [{ ...original, state: 'reviewed', reviewedAt, reviewedBy: 1 }],
        total: 1,
      }),
    );
    vi.mocked(getPlutoFishStatus).mockResolvedValue(
      result({
        state: 'streaming',
        lastError: '',
        cursor: 'opaque-cursor',
        pendingCount: 0,
        reviewCount: 0,
      }),
    );
    fireEvent.click(within(dialog).getByRole('button', { name: '确认已核对' }));
    await waitFor(() =>
      expect(reviewPlutoFishEvent).toHaveBeenCalledExactlyOnceWith(2),
    );
    expect(await screen.findByText('已人工核对')).toBeTruthy();
    expect(screen.getByText('待核对：0')).toBeTruthy();
    expect(screen.getByText('转存待核对')).toBeTruthy();
    expect(screen.getByText(original.reason)).toBeTruthy();
    expect(
      screen.getByText(
        `核对时间：${new Date(reviewedAt).toLocaleString('zh-CN', { hour12: false })}`,
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: '标记已核对' })).toBeNull();
    expect(screen.queryByText('本地处理完成')).toBeNull();
    expect(retryPlutoFishEvent).not.toHaveBeenCalled();
  });

  it('does not send a review request when the confirmation is canceled', async () => {
    vi.mocked(getPlutoFishEvents).mockResolvedValue(
      result({ items: [event(2, 'unknown', 'review')], total: 1 }),
    );
    renderReviewPage();
    fireEvent.click(await screen.findByRole('button', { name: '标记已核对' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /取\s*消/ }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(reviewPlutoFishEvent).not.toHaveBeenCalled();
    expect(screen.getByText('待人工核对')).toBeTruthy();
    expect(screen.getByText('待核对：1')).toBeTruthy();
  });

  it('leaves an event in review when saving the acknowledgement fails', async () => {
    vi.mocked(getPlutoFishEvents).mockResolvedValue(
      result({ items: [event(2, 'unknown', 'review')], total: 1 }),
    );
    vi.mocked(reviewPlutoFishEvent).mockResolvedValue({
      code: 400,
      message: '模拟核对失败',
      data: null,
    });
    renderReviewPage();
    fireEvent.click(await screen.findByRole('button', { name: '标记已核对' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: '确认已核对' }));
    expect(await screen.findByText('模拟核对失败')).toBeTruthy();
    expect(reviewPlutoFishEvent).toHaveBeenCalledExactlyOnceWith(2);
    expect(screen.getByText('待人工核对')).toBeTruthy();
    expect(screen.getByText('待核对：1')).toBeTruthy();
    expect(screen.getByText('转存待核对')).toBeTruthy();
    expect(screen.queryByText('已人工核对')).toBeNull();
    expect(
      await screen.findByRole('button', { name: '标记已核对' }),
    ).toBeTruthy();
  });

  it('redacts event API keys and bearer credentials in displayed errors', () => {
    expect(redactPlutoFishError('invalid pf_events_mock_secret')).toBe(
      'invalid [已隐藏密钥]',
    );
    expect(redactPlutoFishError('Authorization: Bearer opaque-key')).toBe(
      'Authorization: Bearer [已隐藏密钥]',
    );
  });

  it('loads named receiving accounts and does not ask for account or owner IDs', async () => {
    render(
      <App>
        <PlutoFishPage />
      </App>,
    );
    expect(await screen.findByText('我的追剧网盘 · 115')).toBeTruthy();
    expect(screen.queryByLabelText('PlutoFish 用户 UID')).toBeNull();
    expect(screen.queryByLabelText('PlutoFish 接收网盘 ID')).toBeNull();
    expect(
      screen.getByRole('combobox', { name: 'PlutoFish 接收网盘' }),
    ).toBeTruthy();
    expect(vi.mocked(getPlutoFishAccounts).mock.calls[0][0]).toEqual({
      baseURL: config.baseURL,
      apiKey: undefined,
    });
  });

  it('ignores stale discovery and clears mappings when the key belongs to another user', async () => {
    let finishOld!: (
      value: Awaited<ReturnType<typeof getPlutoFishAccounts>>,
    ) => void;
    vi.mocked(getPlutoFishAccounts).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOld = resolve;
        }),
    );
    render(
      <App>
        <PlutoFishPage />
      </App>,
    );
    await waitFor(() => expect(getPlutoFishAccounts).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText('API Key（已配置）'), {
      target: { value: 'pf_events_new_user' },
    });
    expect(vi.mocked(getPlutoFishAccounts).mock.calls[0][1]?.aborted).toBe(
      true,
    );
    finishOld(
      result({
        ownerUID: 'old-user',
        items: [
          {
            id: 'stale-account',
            name: '过时的网盘',
            provider: '115',
            enabled: true,
          },
        ],
      }),
    );
    vi.mocked(getPlutoFishAccounts).mockResolvedValueOnce(
      result({
        ownerUID: 'new-user',
        items: [
          {
            id: 'new-account',
            name: '新账号的网盘',
            provider: '115',
            enabled: true,
          },
        ],
      }),
    );
    fireEvent.click(
      await screen.findByRole('button', { name: /获取接收网盘/ }),
    );
    await screen.findByRole('button', { name: /刷新接收网盘/ });
    expect(screen.queryByText('过时的网盘 · 115')).toBeNull();
    expect(
      screen.queryByRole('combobox', { name: 'PlutoFish 接收网盘' }),
    ).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '保存配置' }));
    await waitFor(() => expect(updatePlutoFishConfig).toHaveBeenCalledTimes(1));
    const submitted = vi.mocked(updatePlutoFishConfig).mock.calls[0][0];
    expect(submitted.ownerUID).toBe('new-user');
    expect(submitted.mappings).toEqual([]);
  });

  it('shows discovery errors without exposing secrets or losing saved mappings', async () => {
    vi.mocked(getPlutoFishAccounts).mockRejectedValueOnce(
      new Error('旧服务不支持接口 pf_events_mock_secret'),
    );
    render(
      <App>
        <PlutoFishPage />
      </App>,
    );
    expect(
      await screen.findByText('旧服务不支持接口 [已隐藏密钥]'),
    ).toBeTruthy();
    expect(screen.getByText('已保存的接收网盘（等待获取名称）')).toBeTruthy();
    expect(screen.queryByText('account-1')).toBeNull();
  });
});
