import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
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
  deleteOrganizePreviewTask,
  get115CookieDirs,
  getAppConfig,
  getCloudDirectoryDetail,
  getOrganizeCategoryConfig,
  getOrganizePreviewTask,
  getOrganizePreviewTasks,
  organize115Cookie,
  requeueOrganizePreviewTask,
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

// The virtualized tree needs browser layout; keep directory selection semantic here.
vi.mock('antd', async (importOriginal) => {
  const antd = await importOriginal<typeof import('antd')>();
  return {
    ...antd,
    Tree: ({ treeData, onCheck }: any) => (
      <div>
        {treeData.map((node: any) => (
          <label key={node.key}>
            <input
              type="checkbox"
              onChange={(event) =>
                onCheck(event.target.checked ? [node.key] : [])
              }
            />
            {node.title}
          </label>
        ))}
      </div>
    ),
  };
});

const preview: API.Organize115CookieResult = {
  cloud_directory_id: 2,
  cloud_storage_id: 3,
  folder_id: '100',
  recognition_source: 'moviepilot',
  dry_run: true,
  total: 1,
  groups: [
    {
      folder_id: '100',
      total: 1,
      items: [
        {
          file_id: '101',
          file_name: 'Show.S03E21.mkv',
          rename_to: 'Show.2019.S03E21.mkv',
          media_type: 'tv',
          tmdb_id: '91801',
          target_path: '/影视/Show/Season 3/Show.2019.S03E21.mkv',
          strm_path: '/library/影视/Show/Season 3/Show.2019.S03E21.strm',
          strm_content:
            'https://media.example/影视/Show/Season 3/Show.2019.S03E21.mkv',
        },
      ],
    },
  ],
};

const task: API.OrganizePreviewTask = {
  id: 9,
  user_id: 1,
  cloud_directory_id: 2,
  cloud_storage_id: 3,
  folder_id: '100',
  folder_name: 'Show S03',
  folder_path: '云下载 / Show S03',
  depth: 1,
  max_depth: 1,
  recognition_source: 'moviepilot',
  status: 'completed',
  total: 1,
  interval_seconds: 45,
  created_at: '2026-09-30T01:00:00Z',
  updated_at: '2026-09-30T01:00:00Z',
};

async function applyPreview(previewOnly = false, loadPreview = true) {
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
  fireEvent.click(await screen.findByRole('checkbox', { name: '云下载' }));
  if (loadPreview) {
    fireEvent.click(await screen.findByRole('button', { name: /查看结果/ }));
    await screen.findByRole('button', { name: /确认预览 \(1\/1\)/ });
  }
  if (!previewOnly) {
    fireEvent.click(screen.getByRole('switch', { name: '预览模式' }));
  }
  const confirm = await screen.findByRole('button', {
    name: new RegExp(
      `确认${previewOnly ? '预览' : '整理'} \\(1${loadPreview ? '\\/1' : ''}\\)`,
    ),
  });
  await waitFor(() =>
    expect((confirm as HTMLButtonElement).disabled).toBe(false),
  );
  fireEvent.click(confirm);
  if (previewOnly) {
    expect(screen.queryByText('整理完成后删除原文件夹')).toBeNull();
  }
  fireEvent.click(
    await screen.findByRole('button', {
      name: previewOnly ? /生成预览/ : /执行整理/,
    }),
  );
  await waitFor(() => expect(organize115Cookie).toHaveBeenCalledOnce());
}

describe('confirm organize error reporting', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.localStorage.clear();
    Element.prototype.scrollIntoView = vi.fn();
    vi.mocked(getAppConfig).mockResolvedValue({ code: 0, data: {} } as any);
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
    vi.mocked(get115CookieDirs).mockResolvedValue({
      code: 0,
      data: { items: [{ file_id: '500', name: '云下载' }] },
    } as any);
    vi.mocked(getOrganizeCategoryConfig).mockResolvedValue({
      code: 0,
      data: { all: [], movie: [], tv: [] },
    } as any);
    vi.mocked(getOrganizePreviewTasks).mockResolvedValue({
      code: 0,
      message: '',
      data: { list: [task], total: 1 },
    });
    vi.mocked(getOrganizePreviewTask).mockResolvedValue({
      code: 0,
      message: '',
      data: { task, result: preview },
    });
    vi.mocked(deleteOrganizePreviewTask).mockResolvedValue({
      code: 0,
      data: {},
    } as any);
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

  it('keeps directory failures and raw response, without reporting success or deleting the preview task', async () => {
    const error = '批量重命名失败: 115 Cookie 已失效';
    vi.mocked(organize115Cookie).mockResolvedValue({
      code: 0,
      message: '整理完成',
      data: {
        ...preview,
        dry_run: false,
        groups: [{ ...preview.groups?.[0], folder_id: '100', total: 1, error }],
      },
    });
    await applyPreview();
    await screen.findByText('有 1 个目录整理失败');
    expect(screen.getByText(error)).toBeTruthy();
    expect(screen.queryByText(/整理完成，共/)).toBeNull();
    expect(deleteOrganizePreviewTask).not.toHaveBeenCalled();
    expect(requeueOrganizePreviewTask).not.toHaveBeenCalled();
    expect(
      (
        screen.getByRole('button', {
          name: /确认整理 \(1\)/,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole('tab', { name: '原始响应' }));
    expect(screen.getByText(/"error": "批量重命名失败/)).toBeTruthy();
  });

  it('retains failures even when some directories succeed', async () => {
    vi.mocked(organize115Cookie).mockResolvedValue({
      code: 0,
      message: '整理完成',
      data: {
        ...preview,
        dry_run: false,
        groups: [
          { folder_id: '100', total: 1 },
          {
            folder_id: '200',
            total: 0,
            error: '创建 STRM 目录失败: permission denied',
          },
        ],
      },
    });
    await applyPreview();
    await screen.findByText('创建 STRM 目录失败: permission denied');
    expect(screen.queryByText(/整理完成，共/)).toBeNull();
    expect(deleteOrganizePreviewTask).not.toHaveBeenCalled();
  });

  it('persists HTTP request errors alongside the preview', async () => {
    vi.mocked(organize115Cookie).mockRejectedValue(
      new Error('获取媒体分类配置失败'),
    );
    await applyPreview();
    await screen.findByText('整理请求失败');
    expect(screen.getAllByText('获取媒体分类配置失败').length).toBeGreaterThan(
      0,
    );
    expect(screen.getByRole('tab', { name: /处理明细 \(1\)/ })).toBeTruthy();
    expect(deleteOrganizePreviewTask).not.toHaveBeenCalled();
  });

  it('cleans up only after all directories succeed', async () => {
    vi.mocked(organize115Cookie).mockResolvedValue({
      code: 0,
      message: '整理完成',
      data: { ...preview, dry_run: false },
    });
    await applyPreview();
    await waitFor(() =>
      expect(deleteOrganizePreviewTask).toHaveBeenCalledWith(9),
    );
    expect(vi.mocked(organize115Cookie).mock.calls[0][0]).toMatchObject({
      dry_run: false,
      delete_source_folder: true,
    });
    expect(screen.queryByRole('tab', { name: '原始响应' })).toBeNull();
  });

  it('defaults to preview and confirms only the selected files without cleaning the queue', async () => {
    vi.mocked(organize115Cookie).mockResolvedValue({
      code: 0,
      message: '整理预览已生成',
      data: preview,
    });
    await applyPreview(true);
    expect(organize115Cookie).toHaveBeenCalledWith(
      expect.objectContaining({
        dry_run: true,
        folder_ids: ['100'],
        file_ids: ['101'],
      }),
    );
    expect(
      vi.mocked(organize115Cookie).mock.calls[0][0].delete_source_folder,
    ).toBeUndefined();
    await screen.findByText('预览结果');
    expect(deleteOrganizePreviewTask).not.toHaveBeenCalled();
    expect(requeueOrganizePreviewTask).not.toHaveBeenCalled();
    expect(screen.getByText('当前预整理：云下载 / Show S03')).toBeTruthy();
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /生成预览/ })).toBeNull(),
    );
    fireEvent.click(screen.getByRole('button', { name: /确认预览 \(1\/1\)/ }));
    fireEvent.click(await screen.findByRole('button', { name: /生成预览/ }));
    await waitFor(() => expect(organize115Cookie).toHaveBeenCalledTimes(2));
    expect(vi.mocked(organize115Cookie).mock.calls[1][0].folder_ids).toEqual([
      '100',
    ]);
  });

  it('confirms a directory as a preview even without a loaded preview task', async () => {
    vi.mocked(organize115Cookie).mockResolvedValue({
      code: 0,
      message: '整理预览已生成',
      data: preview,
    });
    await applyPreview(true, false);
    expect(organize115Cookie).toHaveBeenCalledWith(
      expect.objectContaining({
        dry_run: true,
        folder_ids: ['500'],
      }),
    );
    expect(
      vi.mocked(organize115Cookie).mock.calls[0][0].delete_source_folder,
    ).toBeUndefined();
    expect(deleteOrganizePreviewTask).not.toHaveBeenCalled();
    expect(requeueOrganizePreviewTask).not.toHaveBeenCalled();
  });
});
