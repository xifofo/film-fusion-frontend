import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { App } from 'antd';
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
  startPlutoFish,
  stopPlutoFish,
  updatePlutoFishConfig,
} from '@/services/film-fusion/plutofish';
import PlutoFishPage, { redactPlutoFishError } from './index';

vi.mock('@/services/film-fusion/plutofish', () => ({
  getPlutoFishAccounts: vi.fn(),
  getPlutoFishCloudPaths: vi.fn(),
  getPlutoFishConfig: vi.fn(),
  getPlutoFishEvents: vi.fn(),
  getPlutoFishStatus: vi.fn(),
  updatePlutoFishConfig: vi.fn(),
  retryPlutoFishEvent: vi.fn(),
  startPlutoFish: vi.fn(),
  stopPlutoFish: vi.fn(),
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
          event(2, 'unknown', 'recorded'),
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
    fireEvent.click(buttons[0]);
    await waitFor(() => expect(retryPlutoFishEvent).toHaveBeenCalledWith(3));
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
