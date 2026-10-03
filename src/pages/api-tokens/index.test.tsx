import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { App } from 'antd';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type APIToken,
  createAPIToken,
  getAPITokenScopes,
  getAPITokens,
  revokeAPIToken,
} from '@/services/film-fusion/apiToken';
import APITokensPage from './index';

vi.mock('@/services/film-fusion/apiToken', () => ({
  createAPIToken: vi.fn(),
  getAPITokenScopes: vi.fn(),
  getAPITokens: vi.fn(),
  revokeAPIToken: vi.fn(),
}));

const record: APIToken = {
  id: 42,
  name: '客厅插件',
  prefix: 'ffapi_preview',
  scopes: ['emby-stats'],
  expires_at: null,
  revoked_at: null,
  last_used_at: null,
  created_at: '2026-01-01T00:00:00Z',
};

async function openCreate() {
  const button = await screen.findByRole('button', { name: /创建 Token/ });
  await waitFor(() =>
    expect((button as HTMLButtonElement).disabled).toBe(false),
  );
  fireEvent.click(button);
  return screen.getByRole('dialog', { name: '创建 API Token' });
}

describe('API Token management', () => {
  beforeEach(() => {
    vi.mocked(getAPITokens).mockResolvedValue({
      code: 0,
      message: '',
      data: [],
    });
    vi.mocked(getAPITokenScopes).mockResolvedValue({
      code: 0,
      message: '',
      data: [
        {
          id: 'emby-stats',
          name: 'Emby 媒体统计',
          description: '读取媒体统计',
          prefixes: ['/api/emby-stats'],
        },
      ],
    });
    vi.mocked(createAPIToken).mockResolvedValue({
      code: 0,
      message: '',
      data: { token: 'ffapi_test_credential_only_shown_once', record },
    });
    vi.mocked(revokeAPIToken).mockResolvedValue({
      code: 0,
      message: '',
      data: null,
    });
  });

  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it('requires explicit module selection, issues the token once and clears its secret on close', async () => {
    render(
      <App>
        <APITokensPage />
      </App>,
    );
    const dialog = await openCreate();
    fireEvent.change(within(dialog).getByLabelText('名称'), {
      target: { value: '  客厅插件  ' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: '创 建' }));
    await screen.findByText('请至少选择一个模块');
    expect(createAPIToken).not.toHaveBeenCalled();

    fireEvent.mouseDown(within(dialog).getByLabelText('授权模块'));
    fireEvent.click(await screen.findByText('Emby 媒体统计'));
    const start = Date.now();
    fireEvent.click(within(dialog).getByRole('button', { name: '创 建' }));
    await screen.findByText('完整 Token 仅显示这一次，请立即复制保存');
    expect(createAPIToken).toHaveBeenCalledTimes(1);
    const payload = vi.mocked(createAPIToken).mock.calls[0][0];
    expect(payload.name).toBe('客厅插件');
    expect(payload.scopes).toEqual(['emby-stats']);
    expect(new Date(payload.expires_at as string).valueOf()).toBeGreaterThan(
      start + 89 * 86400000,
    );
    expect(
      screen.getByText('ffapi_test_credential_only_shown_once'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '已保存，关闭' }));
    await waitFor(() =>
      expect(
        screen.queryByText('ffapi_test_credential_only_shown_once'),
      ).toBeNull(),
    );
  });

  it('revokes the selected token and refreshes its status without exposing credentials', async () => {
    vi.mocked(getAPITokens).mockResolvedValue({
      code: 0,
      message: '',
      data: [record],
    });
    render(
      <App>
        <APITokensPage />
      </App>,
    );
    await screen.findByText('客厅插件');
    fireEvent.click(screen.getByRole('button', { name: /撤\s*销/ }));
    const dialog = screen.getByRole('dialog', { name: '撤销 API Token' });
    vi.mocked(getAPITokens).mockResolvedValue({
      code: 0,
      message: '',
      data: [{ ...record, revoked_at: new Date().toISOString() }],
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /撤\s*销/ }));
    await waitFor(() => expect(revokeAPIToken).toHaveBeenCalledWith(42));
    await screen.findByText('已撤销');
    await waitFor(() =>
      expect(
        (
          within(screen.getByRole('table')).getByRole('button', {
            name: /撤\s*销/,
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true),
    );
  });

  it('disables issuance when module definitions fail to load', async () => {
    vi.mocked(getAPITokenScopes).mockRejectedValue(new Error('network'));
    render(
      <App>
        <APITokensPage />
      </App>,
    );
    await screen.findByText('加载失败，请刷新后重试');
    expect(
      (screen.getByRole('button', { name: /创建 Token/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
