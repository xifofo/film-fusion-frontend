import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { ConfigProvider } from 'antd';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  get115CookieDirs,
  getAppConfig,
  getCloudDirectoryDetail,
  getOrganizeCategoryConfig,
  getOrganizePreviewTasks,
  subscribeOrganizePreviewTaskEvents,
} from '@/services/film-fusion';
import OrganizePage from './Organize';

vi.mock('@/services/film-fusion', () => ({
  assignOrganizePreviewTaskTMDB: vi.fn(),
  clearOrganizePreviewTasks: vi.fn(),
  createOrganizePreviewTasks: vi.fn(),
  deleteOrganizePreviewTask: vi.fn(),
  get115CookieDirs: vi.fn(),
  getAppConfig: vi.fn(),
  getCloudDirectoryDetail: vi.fn(),
  getOrganizeCategoryConfig: vi.fn(),
  getOrganizePreviewTask: vi.fn(),
  getOrganizePreviewTasks: vi.fn(),
  organize115Cookie: vi.fn(),
  requeueOrganizePreviewTask: vi.fn(),
  subscribeOrganizePreviewTaskEvents: vi.fn(),
}));

// Exercise the real Tree loading/selection behavior without browser layout.
vi.mock('antd', async (importOriginal) => {
  const antd = await importOriginal<typeof import('antd')>();
  return {
    ...antd,
    Tree: (props: React.ComponentProps<typeof antd.Tree>) => (
      <antd.Tree {...props} virtual={false} motion={null} />
    ),
  };
});

function directories(
  cid: string,
  entries: [string, string][],
): API.Response<API.Cookie115DirResponse> {
  return {
    code: 0,
    message: '',
    data: {
      cloud_storage_id: 3,
      cid,
      offset: 0,
      limit: 1150,
      total: entries.length,
      items: entries.map(([file_id, name]) => ({
        file_id,
        name,
        is_file: false,
      })),
    },
  };
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <ConfigProvider theme={{ token: { motion: false } }}>
        <MemoryRouter initialEntries={['/directories/organize/2']}>
          <Routes>
            <Route
              path="/directories/organize/:id"
              element={<OrganizePage />}
            />
          </Routes>
        </MemoryRouter>
      </ConfigProvider>
    </QueryClientProvider>,
  );
}

function treeControl(name: string, selector: string) {
  const node = screen.getByText(name).closest('.ant-tree-treenode');
  const control = node?.querySelector(selector);
  if (!control) throw new Error(`Missing ${selector} for ${name}`);
  return control;
}

function refresh() {
  fireEvent.click(screen.getByRole('button', { name: '刷新 115 目录' }));
}

describe('organize directory refresh', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.localStorage.clear();
    vi.mocked(getAppConfig).mockRejectedValue(new Error('No app config'));
    vi.mocked(getCloudDirectoryDetail).mockResolvedValue({
      code: 0,
      message: '',
      data: {
        id: 2,
        user_id: 1,
        cloud_storage_id: 3,
        directory_name: '影视',
        directory_id: '0',
        created_at: '',
        updated_at: '',
      },
    });
    vi.mocked(getOrganizeCategoryConfig).mockResolvedValue({
      code: 0,
      message: '',
      data: { all: [], movie: [], tv: [] },
    });
    vi.mocked(getOrganizePreviewTasks).mockResolvedValue({
      code: 0,
      message: '',
      data: { list: [], total: 0 },
    });
    vi.mocked(get115CookieDirs).mockResolvedValue(
      directories('0', [['500', '云下载']]),
    );
    vi.mocked(subscribeOrganizePreviewTaskEvents).mockImplementation(
      async (_params, options) => {
        options.onOpen?.();
        await new Promise<void>((resolve) => {
          options.signal.addEventListener('abort', () => resolve(), {
            once: true,
          });
        });
      },
    );
  });

  afterEach(cleanup);

  it('refreshes the root when no directory is selected', async () => {
    renderPage();
    await screen.findByText('云下载');
    vi.mocked(get115CookieDirs).mockResolvedValue(
      directories('0', [['600', '新下载目录']]),
    );

    refresh();

    await screen.findByText('新下载目录');
    expect(screen.queryByText('云下载')).toBeNull();
    expect(get115CookieDirs).toHaveBeenLastCalledWith({
      cloud_storage_id: 3,
      cid: '0',
      offset: 0,
      limit: 1150,
    });
  });

  it('clears removed children and their checks, then reopens an empty directory', async () => {
    renderPage();
    fireEvent.click(await screen.findByText('云下载'));
    vi.mocked(get115CookieDirs).mockResolvedValue(
      directories('500', [['501', '旧子目录']]),
    );
    refresh();
    await screen.findByText('旧子目录');
    fireEvent.click(treeControl('旧子目录', '.ant-tree-checkbox'));
    expect(screen.getByText('已选 1')).toBeTruthy();

    vi.mocked(get115CookieDirs).mockResolvedValue(directories('500', []));
    refresh();
    await waitFor(() => expect(screen.queryByText('旧子目录')).toBeNull());
    expect(screen.getByText('已选 0')).toBeTruthy();

    vi.mocked(get115CookieDirs).mockResolvedValue(
      directories('500', [['502', '最新子目录']]),
    );
    refresh();
    await screen.findByText('最新子目录');
    expect(get115CookieDirs).toHaveBeenLastCalledWith({
      cloud_storage_id: 3,
      cid: '500',
      offset: 0,
      limit: 1150,
    });
  });

  it('preserves expanded descendants and checks while updating child names', async () => {
    renderPage();
    await screen.findByText('云下载');
    vi.mocked(get115CookieDirs).mockResolvedValue(
      directories('500', [['501', '剧集']]),
    );
    fireEvent.click(treeControl('云下载', '.ant-tree-switcher'));
    await screen.findByText('剧集');
    vi.mocked(get115CookieDirs).mockResolvedValue(
      directories('501', [['502', '第一季']]),
    );
    fireEvent.click(treeControl('剧集', '.ant-tree-switcher'));
    await screen.findByText('第一季');
    fireEvent.click(treeControl('第一季', '.ant-tree-checkbox'));
    fireEvent.click(screen.getByText('云下载'));
    vi.mocked(get115CookieDirs).mockResolvedValue(
      directories('500', [
        ['501', '剧集改名'],
        ['503', '新增剧集'],
      ]),
    );

    refresh();

    await screen.findByText('新增剧集');
    expect(screen.getByText('剧集改名')).toBeTruthy();
    expect(screen.getByText('第一季')).toBeTruthy();
    expect(screen.getByText('已选 1')).toBeTruthy();
    expect(
      treeControl('第一季', '.ant-tree-checkbox').classList.contains(
        'ant-tree-checkbox-checked',
      ),
    ).toBe(true);
    expect(screen.getByText('云下载 / 剧集改名 / 第一季')).toBeTruthy();
  });

  it('retains existing contents after a failed refresh and prevents repeated clicks', async () => {
    renderPage();
    await screen.findByText('云下载');
    fireEvent.click(treeControl('云下载', '.ant-tree-checkbox'));
    let rejectRequest!: (error: Error) => void;
    vi.mocked(get115CookieDirs).mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectRequest = reject;
        }),
    );
    refresh();
    refresh();
    expect(get115CookieDirs).toHaveBeenCalledTimes(2);

    await act(async () => rejectRequest(new Error('115 暂时不可用')));

    await screen.findByText('115 暂时不可用');
    expect(
      screen.getByText('云下载', { selector: '.ant-tree-title' }),
    ).toBeTruthy();
    expect(screen.getByText('已选 1')).toBeTruthy();
    expect(screen.queryByText('目录已刷新')).toBeNull();
    expect(
      screen
        .getByRole('button', { name: '刷新 115 目录' })
        .classList.contains('ant-btn-loading'),
    ).toBe(false);
  });

  it('ignores an older expansion response that arrives after a refresh', async () => {
    renderPage();
    await screen.findByText('云下载');
    let resolveExpansion!: (
      response: API.Response<API.Cookie115DirResponse>,
    ) => void;
    vi.mocked(get115CookieDirs).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveExpansion = resolve;
        }),
    );
    fireEvent.click(treeControl('云下载', '.ant-tree-switcher'));
    fireEvent.click(screen.getByText('云下载'));
    vi.mocked(get115CookieDirs).mockResolvedValue(
      directories('500', [['502', '新内容']]),
    );
    refresh();
    await screen.findByText('新内容');

    await act(async () => {
      resolveExpansion(directories('500', [['501', '过期内容']]));
    });

    expect(screen.queryByText('过期内容')).toBeNull();
    expect(screen.getByText('新内容')).toBeTruthy();
  });
});
