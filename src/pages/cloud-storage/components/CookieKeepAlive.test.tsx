import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refreshWeb115Cookie } from '@/services/film-fusion';
import { CookieRefreshAction } from './CookieKeepAlive';

vi.mock('@/services/film-fusion', () => ({
  refreshWeb115Cookie: vi.fn(),
}));

const record = {
  id: 115,
  storage_name: '永V',
  storage_type: '115open',
} as API.CloudStorage;

const status = {
  storage_id: 115,
  storage_name: '永V',
  app: 'alipaymini',
  use_default: false,
  healthy: true,
  has_cookie: true,
} as API.Web115CookieStatus;

describe('CookieRefreshAction', () => {
  const refreshMock = vi.mocked(refreshWeb115Cookie);

  beforeEach(() => {
    refreshMock.mockResolvedValue({
      code: 0,
      data: { cloud_storage_id: 115, storage_name: '永V' },
      message: 'cookie 续期成功',
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('submits the selected app for this and future automatic refreshes', async () => {
    const onChanged = vi.fn();
    render(
      <CookieRefreshAction
        record={record}
        status={status}
        onChanged={onChanged}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '立即续期' }));
    fireEvent.mouseDown(
      screen.getByRole('combobox', { name: '自动续期设备端' }),
    );
    fireEvent.click(await screen.findByText('tv（115生活・安卓电视端）'));
    fireEvent.click(screen.getByRole('button', { name: '续期并保存' }));

    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalledWith({
        cloud_storage_id: 115,
        app: 'tv',
      });
    });
    expect(onChanged).toHaveBeenCalledOnce();
  });

  it('can keep a storage on the global automatic refresh default', async () => {
    render(
      <CookieRefreshAction
        record={record}
        status={{ ...status, app: 'tv', use_default: true }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '立即续期' }));
    expect(screen.getByText('跟随系统默认（当前：tv）')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '续期并保存' }));

    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalledWith({
        cloud_storage_id: 115,
        app: 'default',
      });
    });
  });
});
