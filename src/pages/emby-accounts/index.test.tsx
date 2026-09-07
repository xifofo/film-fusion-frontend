import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { App } from 'antd';
import dayjs from 'dayjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type EmbyAccount,
  getEmbyAccounts,
  setEmbyAccountExpiry,
} from '@/services/film-fusion/embyAccount';
import EmbyAccountsPage from './index';

vi.mock('@/services/film-fusion/embyAccount', () => ({
  getEmbyAccounts: vi.fn(),
  setEmbyAccountExpiry: vi.fn(),
}));

const account: EmbyAccount = {
  server_id: 'server-a',
  emby_user_id: 'user-1',
  name: 'Alice',
  is_disabled: false,
  is_administrator: false,
  last_login_date: '2026-08-01T00:00:00Z',
  last_activity_date: '',
  expires_at: '2030-01-01T00:00:00Z',
  disabled_at: null,
  last_checked_at: null,
  last_error: '',
};

describe('EmbyAccountsPage', () => {
  beforeEach(() => {
    vi.mocked(getEmbyAccounts).mockResolvedValue({
      code: 0,
      message: '',
      data: [account],
    });
    vi.mocked(setEmbyAccountExpiry).mockResolvedValue({
      code: 0,
      message: '',
      data: null,
    });
  });
  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  const openEditor = async () => {
    render(
      <App>
        <EmbyAccountsPage />
      </App>,
    );
    fireEvent.click(
      await screen.findByRole('button', { name: '设置到期时间' }),
    );
    return screen.getByRole('dialog');
  };

  it('loads real API rows and filters by account name or ID', async () => {
    vi.mocked(getEmbyAccounts).mockResolvedValue({
      code: 0,
      message: '',
      data: [
        account,
        {
          ...account,
          emby_user_id: 'user-2',
          name: 'Bob',
          is_disabled: true,
          expires_at: null,
          last_error: 'Emby 请求失败（HTTP 403）',
        },
      ],
    });
    render(
      <App>
        <EmbyAccountsPage />
      </App>,
    );
    expect(await screen.findByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
    expect(screen.getByText('永不过期')).toBeTruthy();
    expect(screen.getByText(/等待重试.*403/)).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: '搜索 Emby 账户' }), {
      target: { value: 'user-2' },
    });
    expect(screen.queryByText('Alice')).toBeNull();
    expect(screen.getByText('Bob')).toBeTruthy();
  });

  it('round-trips a deadline without shifting the timezone', async () => {
    const dialog = await openEditor();
    const input = within(dialog).getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe(
      dayjs(account.expires_at).format('YYYY-MM-DD HH:mm:ss'),
    );
    fireEvent.click(within(dialog).getByRole('button', { name: /保\s*存/ }));
    await waitFor(() =>
      expect(setEmbyAccountExpiry).toHaveBeenCalledWith('user-1', {
        server_id: 'server-a',
        expires_at: '2030-01-01T00:00:00.000Z',
      }),
    );
  });

  it('saves a selected date as an absolute timestamp', async () => {
    const dialog = await openEditor();
    const input = within(dialog).getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '2031-02-03 12:30:00' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', keyCode: 13 });
    fireEvent.blur(input);
    fireEvent.click(within(dialog).getByRole('button', { name: /保\s*存/ }));
    await waitFor(() =>
      expect(setEmbyAccountExpiry).toHaveBeenCalledWith('user-1', {
        server_id: 'server-a',
        expires_at: dayjs('2031-02-03 12:30:00').toISOString(),
      }),
    );
  });

  it('clears a deadline with explicit null and keeps the draft on failure', async () => {
    vi.mocked(setEmbyAccountExpiry).mockRejectedValueOnce(new Error('offline'));
    const dialog = await openEditor();
    fireEvent.click(
      within(dialog).getByRole('button', { name: '设为永不过期' }),
    );
    fireEvent.click(within(dialog).getByRole('button', { name: /保\s*存/ }));
    await waitFor(() =>
      expect(setEmbyAccountExpiry).toHaveBeenCalledWith('user-1', {
        server_id: 'server-a',
        expires_at: null,
      }),
    );
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(
      (within(dialog).getByRole('textbox') as HTMLInputElement).value,
    ).toBe('');
  });

  it('shows loading failures and does not present them as an empty Emby server', async () => {
    vi.mocked(getEmbyAccounts).mockRejectedValue({
      response: { data: { message: 'Emby API Key 无效' } },
    });
    render(
      <App>
        <EmbyAccountsPage />
      </App>,
    );
    expect(await screen.findByText('Emby API Key 无效')).toBeTruthy();
    expect(screen.getByText('用户列表加载失败')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '设置到期时间' })).toBeNull();
  });
});
