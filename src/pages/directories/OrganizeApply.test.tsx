import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
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

const preview = {
  plan_id: 'confirmed-plan',
  pipeline: {
    schema: 1,
    source: 'moviepilot',
    package_version: 'v0.1.1',
    config_version: 'frozen-config',
  },
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
} satisfies API.Organize115CookieResult;

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

const enginePreview = (
  source: 'moviepilot' | 'medianame',
  error?: string,
): API.Organize115CookieResult => ({
  ...preview,
  plan_id: `${source}-selected-plan`,
  recognition_source: source,
  pipeline: { ...preview.pipeline, source },
  groups: [
    {
      ...preview.groups[0],
      items: [
        {
          ...preview.groups[0].items[0],
          engine: source,
          error,
          target_path: error ? '' : `/影视/${source}/Selected.S03E21.mkv`,
          strm_path: `/library/影视/${source}/Selected.S03E21.strm`,
        },
      ],
    },
  ],
});

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
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

async function applyPreview(
  previewOnly = false,
  loadPreview = true,
  historical = false,
  beforeConfirm?: () => Promise<boolean | undefined>,
  beforeOpenConfirm?: () => Promise<void>,
) {
  renderPage();
  fireEvent.click(await screen.findByRole('checkbox', { name: '云下载' }));
  if (loadPreview) {
    fireEvent.click(await screen.findByRole('button', { name: /查看结果/ }));
    await screen.findByRole('button', { name: /确认预览 \(1\/1\)/ });
  }
  await beforeOpenConfirm?.();
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
  if (historical) {
    await screen.findByText('历史预览缺少引擎与配置快照，请重新预览');
    return;
  }
  if (beforeConfirm && (await beforeConfirm()) === false) return;
  const callsBeforeConfirm = vi.mocked(organize115Cookie).mock.calls.length;
  if (previewOnly) {
    expect(screen.queryByText('整理完成后删除原文件夹')).toBeNull();
  }
  const execute = await screen.findByRole('button', {
    name: previewOnly ? /生成预览/ : /执行整理/,
  });
  await waitFor(() =>
    expect((execute as HTMLButtonElement).disabled).toBe(false),
  );
  fireEvent.click(execute);
  await waitFor(() =>
    expect(organize115Cookie).toHaveBeenCalledTimes(callsBeforeConfirm + 1),
  );
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

  it('remembers both preview mode choices across visits and loading task results', async () => {
    const firstVisit = renderPage();
    await screen.findByRole('button', { name: /查看结果/ });
    expect(
      screen
        .getByRole('switch', { name: '预览模式' })
        .getAttribute('aria-checked'),
    ).toBe('true');
    fireEvent.click(screen.getByRole('switch', { name: '预览模式' }));
    firstVisit.unmount();

    const secondVisit = renderPage();
    expect(
      screen
        .getByRole('switch', { name: '预览模式' })
        .getAttribute('aria-checked'),
    ).toBe('false');
    fireEvent.click(await screen.findByRole('button', { name: /查看结果/ }));
    await screen.findByRole('button', { name: /确认整理 \(1\/1\)/ });
    expect(
      screen
        .getByRole('switch', { name: '预览模式' })
        .getAttribute('aria-checked'),
    ).toBe('false');
    fireEvent.click(screen.getByRole('switch', { name: '预览模式' }));
    secondVisit.unmount();

    renderPage();
    expect(
      screen
        .getByRole('switch', { name: '预览模式' })
        .getAttribute('aria-checked'),
    ).toBe('true');
    fireEvent.click(await screen.findByRole('button', { name: /查看结果/ }));
    await screen.findByRole('button', { name: /确认预览 \(1\/1\)/ });
    expect(organize115Cookie).not.toHaveBeenCalled();
  });

  it('executes an upgrade with the original source directory retained for recovery', async () => {
    const policy = {
      enabled: true,
      name: '画质优先',
      rules: [],
      bonuses: [],
      exclude: [],
      max_size_mb: 0,
      same_tier: false,
      min_score_gain: 10,
    };
    const upgraded: API.Organize115CookieResult = {
      ...preview,
      upgrade_policy: policy,
      groups: [
        {
          ...preview.groups[0],
          items: [
            {
              ...preview.groups[0].items[0],
              upgrade: {
                action: 'replace',
                reason: '优先级提升',
                media_key: 'tv:91801:s3:e21',
                rank: { tier: 1, label: '2160p REMUX', score: 0, reasons: [] },
                existing: [],
                bindings: [],
                changes: [],
              },
            },
          ],
        },
      ],
    };
    vi.mocked(getOrganizePreviewTask).mockResolvedValue({
      code: 0,
      message: '',
      data: { task, result: upgraded },
    });
    vi.mocked(organize115Cookie).mockResolvedValue({
      code: 0,
      message: '',
      data: { ...upgraded, dry_run: false },
    });
    await applyPreview(false, true, false, async () => {
      const checkbox = screen.getByRole('checkbox', {
        name: '洗版保留源目录，用于失败恢复',
      }) as HTMLInputElement;
      expect(checkbox.disabled).toBe(true);
      expect(checkbox.checked).toBe(false);
      expect(
        screen.getByText(/旧 STRM 和字幕内容保存在恢复记录中/),
      ).toBeTruthy();
      return undefined;
    });
    expect(organize115Cookie).toHaveBeenCalledWith(
      expect.objectContaining({ plan_id: 'confirmed-plan', file_ids: ['101'] }),
    );
    expect(
      vi.mocked(organize115Cookie).mock.lastCall?.[0].delete_source_folder,
    ).not.toBe(true);
  });

  it('prefers medianame for display without changing the engine or plan used at confirmation', async () => {
    const mp2Item = preview.groups[0].items[0];
    const medianame = {
      ...mp2Item,
      engine: 'medianame',
      title_year: 'medianame 标题 (2024)',
      tmdb_id: '123',
      target_path: '/medianame/Show/S03E21.mkv',
    };
    const shadow: API.Organize115CookieResult = {
      ...preview,
      recognition_source: 'shadow',
      pipeline: { ...preview.pipeline, source: 'shadow' },
      groups: [
        {
          ...preview.groups[0],
          items: [
            {
              ...mp2Item,
              shadow_comparison: {
                medianame,
                status: 'different',
                matched: false,
                differences: [],
              },
            },
          ],
        },
      ],
    };
    vi.mocked(getOrganizePreviewTask).mockResolvedValue({
      code: 0,
      message: '',
      data: { task, result: shadow },
    });
    vi.mocked(organize115Cookie).mockResolvedValue({
      code: 0,
      message: '',
      data: { ...shadow, dry_run: false },
    });
    await applyPreview(
      false,
      true,
      false,
      async () => {
        const dialog = within(screen.getByRole('dialog'));
        expect(
          (dialog.getByRole('radio', { name: 'MP2' }) as HTMLInputElement)
            .checked,
        ).toBe(true);
        expect(dialog.getByText(mp2Item.target_path)).toBeTruthy();
        expect(dialog.queryByText(medianame.target_path)).toBeNull();
        return undefined;
      },
      async () => {
        expect(
          (
            screen.getByRole('radio', {
              name: 'medianame 识别',
            }) as HTMLInputElement
          ).checked,
        ).toBe(true);
        expect(screen.getByText(medianame.target_path)).toBeTruthy();
        expect(screen.getByText(medianame.title_year)).toBeTruthy();
        expect(screen.queryByText(mp2Item.target_path)).toBeNull();
        fireEvent.click(screen.getByRole('radio', { name: 'MP2 识别' }));
        await screen.findByText(mp2Item.target_path);
        expect(screen.queryByText(medianame.target_path)).toBeNull();
        fireEvent.click(screen.getByRole('radio', { name: 'medianame 识别' }));
        await screen.findByText(medianame.target_path);
        expect(organize115Cookie).not.toHaveBeenCalled();
        expect(deleteOrganizePreviewTask).not.toHaveBeenCalled();
      },
    );
    expect(organize115Cookie).toHaveBeenCalledWith(
      expect.objectContaining({
        plan_id: 'confirmed-plan',
        recognition_source: 'shadow',
        dry_run: false,
        file_ids: ['101'],
      }),
    );
    expect(shadow.groups?.[0].items?.[0].target_path).toBe(mp2Item.target_path);
  });

  it.each(['medianame', 'moviepilot'] as const)(
    'can select %s at confirmation and execute only its newly previewed plan',
    async (source) => {
      const original =
        source === 'medianame'
          ? {
              ...preview,
              recognition_source: 'shadow' as const,
              pipeline: { ...preview.pipeline, source: 'shadow' },
            }
          : enginePreview('medianame');
      vi.mocked(getOrganizePreviewTask).mockResolvedValue({
        code: 0,
        message: '',
        data: { task, result: original },
      });
      const selected = enginePreview(source);
      vi.mocked(organize115Cookie)
        .mockResolvedValueOnce({ code: 0, message: '', data: selected })
        .mockResolvedValueOnce({
          code: 0,
          message: '',
          data: { ...selected, dry_run: false },
        });

      await applyPreview(false, true, false, async () => {
        const dialog = within(screen.getByRole('dialog'));
        expect(
          (
            dialog.getByRole('radio', {
              name: source === 'medianame' ? 'MP2' : 'medianame',
            }) as HTMLInputElement
          ).checked,
        ).toBe(true);
        fireEvent.click(
          dialog.getByRole('radio', {
            name: source === 'medianame' ? 'medianame' : 'MP2',
          }),
        );
        await dialog.findByText(`/影视/${source}/Selected.S03E21.mkv`);
        expect(organize115Cookie).toHaveBeenCalledOnce();
        expect(vi.mocked(organize115Cookie).mock.calls[0][0]).toMatchObject({
          dry_run: true,
          recognition_source: source,
          folder_ids: ['100'],
          file_ids: ['101'],
          folder_contexts: [
            {
              folder_id: '100',
              folder_name: 'Show S03',
              folder_path: '云下载 / Show S03',
            },
          ],
        });
        expect(
          vi.mocked(organize115Cookie).mock.calls[0][0].plan_id,
        ).toBeUndefined();
        expect(
          vi.mocked(organize115Cookie).mock.calls[0][0].delete_source_folder,
        ).toBeUndefined();
        expect(deleteOrganizePreviewTask).not.toHaveBeenCalled();
        return undefined;
      });
      expect(vi.mocked(organize115Cookie).mock.calls[1][0]).toMatchObject({
        dry_run: false,
        recognition_source: source,
        plan_id: `${source}-selected-plan`,
        file_ids: ['101'],
      });
      await waitFor(() =>
        expect(deleteOrganizePreviewTask).toHaveBeenCalledWith(9),
      );
    },
  );

  it('blocks execution when the selected engine needs review instead of falling back to MP2', async () => {
    const failed = enginePreview(
      'medianame',
      'medianame: review，需要核对冲突',
    );
    vi.mocked(organize115Cookie).mockResolvedValue({
      code: 0,
      message: '',
      data: failed,
    });
    await applyPreview(false, true, false, async () => {
      const dialog = within(screen.getByRole('dialog'));
      fireEvent.click(dialog.getByRole('radio', { name: 'medianame' }));
      expect((await dialog.findByRole('alert')).textContent).toContain(
        'review',
      );
      const execute = dialog.getByRole('button', {
        name: /执行整理/,
      }) as HTMLButtonElement;
      expect(execute.disabled).toBe(true);
      fireEvent.click(execute);
      expect(organize115Cookie).toHaveBeenCalledOnce();
      expect(deleteOrganizePreviewTask).not.toHaveBeenCalled();
      return false;
    });
  });

  it('ignores a late preview response after switching back to the original engine', async () => {
    let finishPreview!: (
      value: API.Response<API.Organize115CookieResult>,
    ) => void;
    vi.mocked(organize115Cookie)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishPreview = resolve;
          }),
      )
      .mockResolvedValueOnce({
        code: 0,
        message: '',
        data: { ...preview, dry_run: false },
      });
    await applyPreview(false, true, false, async () => {
      const dialog = within(screen.getByRole('dialog'));
      fireEvent.click(dialog.getByRole('radio', { name: 'medianame' }));
      expect(
        (dialog.getByRole('button', { name: /执行整理/ }) as HTMLButtonElement)
          .disabled,
      ).toBe(true);
      fireEvent.click(dialog.getByRole('radio', { name: 'MP2' }));
      finishPreview({ code: 0, message: '', data: enginePreview('medianame') });
      await waitFor(() =>
        expect(
          (dialog.getByRole('radio', { name: 'MP2' }) as HTMLInputElement)
            .checked,
        ).toBe(true),
      );
      expect(
        dialog.queryByText('/影视/medianame/Selected.S03E21.mkv'),
      ).toBeNull();
      return undefined;
    });
    expect(vi.mocked(organize115Cookie).mock.calls[1][0]).toMatchObject({
      plan_id: 'confirmed-plan',
      recognition_source: 'moviepilot',
      dry_run: false,
    });
  });

  it('requires a new preview for historical results without a saved plan', async () => {
    vi.mocked(getOrganizePreviewTask).mockResolvedValue({
      code: 0,
      message: '',
      data: {
        task,
        result: { ...preview, plan_id: undefined, pipeline: undefined },
      },
    });
    await applyPreview(false, true, true);
    expect(organize115Cookie).not.toHaveBeenCalled();
  });

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
    expect(organize115Cookie).toHaveBeenCalledWith(
      expect.objectContaining({
        plan_id: 'confirmed-plan',
        recognition_source: 'moviepilot',
      }),
    );
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
