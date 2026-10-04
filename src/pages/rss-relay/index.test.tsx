import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { ConfigProvider } from 'antd';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RSSRelay } from '@/services/film-fusion/rssRelay';
import RSSRelayPage from './index';

const mocks = vi.hoisted(() => ({
  getRSSRelays: vi.fn(),
  createRSSRelay: vi.fn(),
  updateRSSRelay: vi.fn(),
  setRSSRelayEnabled: vi.fn(),
  refreshRSSRelay: vi.fn(),
  rotateRSSRelayToken: vi.fn(),
  deleteRSSRelay: vi.fn(),
}));
vi.mock('@/services/film-fusion/rssRelay', () => mocks);
const base: RSSRelay = {
  id: 8,
  name: '测试订阅',
  feed_url: 'https://example.com/rss?passkey=upstream-private',
  enabled: true,
  min_interval_seconds: 180,
  has_cache: true,
  relay_path: '/api/rss-relay/8/relay-secret',
  last_success_at: '2026-10-03T08:00:00Z',
};
const success = (data: unknown) => ({ code: 0, data });

describe('independent RSS relay page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRSSRelays.mockResolvedValue(success([]));
  });
  afterEach(cleanup);

  it('creates a relay directly without choosing an automation', async () => {
    render(
      <ConfigProvider theme={{ token: { motion: false } }}>
        <RSSRelayPage />
      </ConfigProvider>,
    );
    await screen.findByText('还没有 RSS 中转，点击右上角添加即可独立使用');
    fireEvent.click(screen.getByRole('button', { name: /添加 RSS 中转/ }));
    fireEvent.change(screen.getByRole('textbox', { name: '名称' }), {
      target: { value: base.name },
    });
    fireEvent.change(screen.getByRole('textbox', { name: '原始 RSS 地址' }), {
      target: { value: base.feed_url },
    });
    fireEvent.change(
      screen.getByRole('spinbutton', { name: '最小抓取间隔（秒）' }),
      { target: { value: '240' } },
    );
    mocks.createRSSRelay.mockResolvedValue(
      success({ ...base, min_interval_seconds: 240 }),
    );
    mocks.getRSSRelays.mockResolvedValue(
      success([{ ...base, min_interval_seconds: 240 }]),
    );
    fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }));
    await waitFor(() =>
      expect(mocks.createRSSRelay).toHaveBeenCalledWith({
        name: base.name,
        feed_url: base.feed_url,
        min_interval_seconds: 240,
        enabled: true,
      }),
    );
    expect(
      await screen.findByText(`${window.location.origin}${base.relay_path}`),
    ).toBeTruthy();
    expect(screen.getByText('240 秒')).toBeTruthy();
  });

  it('edits the relay and toggles only its own state', async () => {
    mocks.getRSSRelays.mockResolvedValue(success([base]));
    mocks.updateRSSRelay.mockResolvedValue(success(base));
    mocks.setRSSRelayEnabled.mockResolvedValue(
      success({ ...base, enabled: false }),
    );
    render(
      <ConfigProvider theme={{ token: { motion: false } }}>
        <RSSRelayPage />
      </ConfigProvider>,
    );
    fireEvent.click(
      await screen.findByRole('button', { name: `编辑${base.name}` }),
    );
    fireEvent.change(screen.getByRole('textbox', { name: '名称' }), {
      target: { value: '独立订阅' },
    });
    fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }));
    await waitFor(() =>
      expect(mocks.updateRSSRelay).toHaveBeenCalledWith(8, {
        name: '独立订阅',
        feed_url: base.feed_url,
        enabled: true,
        min_interval_seconds: 180,
      }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    mocks.getRSSRelays.mockResolvedValue(
      success([{ ...base, enabled: false }]),
    );
    fireEvent.click(
      screen.getByRole('switch', { name: `${base.name}启用状态` }),
    );
    await waitFor(() =>
      expect(mocks.setRSSRelayEnabled).toHaveBeenCalledWith(8, false),
    );
    expect(await screen.findByText('启用后可访问')).toBeTruthy();
  });

  it('refreshes cache and replaces a rotated link without modifying consumers', async () => {
    mocks.getRSSRelays.mockResolvedValue(success([base]));
    mocks.refreshRSSRelay.mockResolvedValue(success(base));
    mocks.rotateRSSRelayToken.mockResolvedValue(
      success({ ...base, relay_path: '/api/rss-relay/8/new' }),
    );
    render(
      <ConfigProvider theme={{ token: { motion: false } }}>
        <RSSRelayPage />
      </ConfigProvider>,
    );
    fireEvent.click(
      await screen.findByRole('button', { name: `刷新${base.name}` }),
    );
    await waitFor(() => expect(mocks.refreshRSSRelay).toHaveBeenCalledWith(8));
    await waitFor(() =>
      expect(
        (
          screen.getByRole('button', {
            name: `重置${base.name}的链接`,
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    fireEvent.click(
      screen.getByRole('button', { name: `重置${base.name}的链接` }),
    );
    await screen.findByText(
      '旧链接将立即失效，请同步更新 FilmFusion 自动化和 MP2。',
    );
    mocks.getRSSRelays.mockResolvedValue(
      success([{ ...base, relay_path: '/api/rss-relay/8/new' }]),
    );
    fireEvent.click(screen.getByRole('button', { name: '重新生成' }));
    await waitFor(() =>
      expect(mocks.rotateRSSRelayToken).toHaveBeenCalledWith(8),
    );
    expect(
      await screen.findByText(`${window.location.origin}/api/rss-relay/8/new`),
    ).toBeTruthy();
    expect(
      screen.queryByText(`${window.location.origin}${base.relay_path}`),
    ).toBeNull();
  });

  it('shows upstream failures while preserving last successful cache and can delete a relay', async () => {
    mocks.getRSSRelays.mockResolvedValue(
      success([{ ...base, last_error: 'RSS 源返回 HTTP 429' }]),
    );
    mocks.deleteRSSRelay.mockResolvedValue(success({}));
    render(
      <ConfigProvider theme={{ token: { motion: false } }}>
        <RSSRelayPage />
      </ConfigProvider>,
    );
    expect(await screen.findByText('上游异常 · 提供缓存')).toBeTruthy();
    expect(screen.getByText(/最近成功：/).textContent).not.toContain('暂无');
    fireEvent.click(screen.getByRole('button', { name: `删除${base.name}` }));
    mocks.getRSSRelays.mockResolvedValue(success([]));
    fireEvent.click(await screen.findByRole('button', { name: /^删\s*除$/ }));
    await waitFor(() => expect(mocks.deleteRSSRelay).toHaveBeenCalledWith(8));
    expect(
      await screen.findByText('还没有 RSS 中转，点击右上角添加即可独立使用'),
    ).toBeTruthy();
  });

  it('keeps the editor open and reports errors if creation fails', async () => {
    mocks.createRSSRelay.mockRejectedValue(new Error('保存失败，请重试'));
    render(
      <ConfigProvider theme={{ token: { motion: false } }}>
        <RSSRelayPage />
      </ConfigProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /添加 RSS 中转/ }));
    fireEvent.change(screen.getByRole('textbox', { name: '名称' }), {
      target: { value: base.name },
    });
    fireEvent.change(screen.getByRole('textbox', { name: '原始 RSS 地址' }), {
      target: { value: base.feed_url },
    });
    fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }));
    expect(await screen.findByText('保存失败，请重试')).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
