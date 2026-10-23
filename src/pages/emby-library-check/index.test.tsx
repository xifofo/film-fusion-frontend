import {
  act,
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
  checkEmbyLibrary,
  type EmbyLibraryCheckResult,
} from '@/services/film-fusion/embyLibraryCheck';
import EmbyLibraryCheckPage from './index';

vi.mock('@/services/film-fusion/embyLibraryCheck', () => ({
  checkEmbyLibrary: vi.fn(),
}));

const result: EmbyLibraryCheckResult = {
  total: 4,
  duplicates_removed: 1,
  results: [
    {
      original_name: '星际穿越.mkv',
      name: '星际穿越',
      status: 'found',
      matches: [
        {
          id: '1',
          name: '星际穿越',
          type: 'Movie',
          year: 2014,
          path: '/movies/星际穿越/星际穿越.strm',
        },
      ],
    },
    {
      original_name: '流浪地球.mp4',
      name: '流浪地球',
      status: 'possible',
      matches: [{ id: '2', name: '流浪地球 2', type: 'Movie', year: 2023 }],
      truncated: true,
    },
    {
      original_name: '未收录.strm',
      name: '未收录',
      status: 'missing',
      matches: [],
    },
    {
      original_name: '未知剧集.mkv',
      name: '未知剧集',
      status: 'error',
      matches: [],
      error: 'Emby 请求超时',
    },
  ],
};

const inputValue =
  '  星际穿越.mkv  \r\n\r\n流浪地球.mp4\n未收录.strm\n未知剧集.mkv\n星际穿越.mp4';
const renderPage = () =>
  render(
    <App>
      <EmbyLibraryCheckPage />
    </App>,
  );
const enterNames = (value = inputValue) =>
  fireEvent.change(screen.getByRole('textbox', { name: '粘贴媒体名称' }), {
    target: { value },
  });
const start = () =>
  fireEvent.click(screen.getByRole('button', { name: /开始查询/ }));

describe('EmbyLibraryCheckPage', () => {
  beforeEach(() => {
    vi.mocked(checkEmbyLibrary).mockResolvedValue({
      code: 0,
      message: '',
      data: result,
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });
  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it('waits for user submission and preserves original names for server normalization', async () => {
    renderPage();
    expect(checkEmbyLibrary).not.toHaveBeenCalled();
    expect(screen.getByText('粘贴名称后开始查询')).toBeTruthy();
    expect(screen.queryByRole('region', { name: '入库查询结果' })).toBeNull();
    enterNames();
    start();
    await screen.findByRole('region', { name: '入库查询结果' });
    expect(checkEmbyLibrary).toHaveBeenCalledWith(
      [
        '星际穿越.mkv',
        '流浪地球.mp4',
        '未收录.strm',
        '未知剧集.mkv',
        '星际穿越.mp4',
      ],
      expect.any(AbortSignal),
    );
    expect(screen.getByText('原始名称：星际穿越.mkv')).toBeTruthy();
    expect(screen.getByText('电影 · 2014')).toBeTruthy();
    expect(screen.getByText('/movies/星际穿越/星际穿越.strm')).toBeTruthy();
    expect(
      screen.getByText('共查询 4 个名称，已合并 1 个重复名称'),
    ).toBeTruthy();
    expect(screen.getByText('候选过多，请缩小名称范围。')).toBeTruthy();
    expect(
      (
        screen.getByRole('textbox', {
          name: '粘贴媒体名称',
        }) as HTMLTextAreaElement
      ).value,
    ).toContain('星际穿越.mkv');
  });

  it('filters results and copies only cleaned missing names, excluding failed and possible checks', async () => {
    renderPage();
    enterNames();
    start();
    await screen.findByRole('region', { name: '入库查询结果' });
    const filters = screen.getByRole('group', { name: '按入库状态筛选' });
    fireEvent.click(
      within(filters).getByRole('button', { name: '查询失败 1' }),
    );
    expect(screen.getByText('Emby 请求超时')).toBeTruthy();
    expect(screen.queryByText('流浪地球 2')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '复制未找到的名称' }));
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('未收录'),
    );
    fireEvent.click(within(filters).getByRole('button', { name: '未找到 1' }));
    expect(screen.getByText('未收录')).toBeTruthy();
    expect(screen.queryByText('Emby 请求超时')).toBeNull();
  });

  it('marks results stale after editing and prevents copying them until checked again', async () => {
    renderPage();
    enterNames();
    start();
    await screen.findByRole('region', { name: '入库查询结果' });
    enterNames('新名称.mp4');
    expect(screen.getByText('名称已修改，下方是上一次查询结果')).toBeTruthy();
    const copy = screen.getByRole('button', {
      name: '复制未找到的名称',
    }) as HTMLButtonElement;
    expect(copy.disabled).toBe(true);
    expect(
      (
        screen.getByRole('button', {
          name: '创建文件夹并移入',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(copy);
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    start();
    await waitFor(() =>
      expect(screen.queryByText('名称已修改，下方是上一次查询结果')).toBeNull(),
    );
    await screen.findByRole('region', { name: '入库查询结果' });
  });

  it('handles edits while a request is running without mislabelling the response', async () => {
    let resolve!: (response: API.Response<EmbyLibraryCheckResult>) => void;
    vi.mocked(checkEmbyLibrary).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    renderPage();
    enterNames();
    start();
    expect(screen.getByText('正在查询 Emby 媒体库')).toBeTruthy();
    enterNames('查询期间的新名称');
    await act(async () => resolve({ code: 0, message: '', data: result }));
    expect(screen.getByText('名称已修改，下方是上一次查询结果')).toBeTruthy();
    expect(
      (
        screen.getByRole('button', {
          name: '复制未找到的名称',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it('shows API errors without reporting missing media or clearing input', async () => {
    vi.mocked(checkEmbyLibrary).mockRejectedValueOnce({
      response: { data: { message: '请先配置 Emby 服务器' } },
    });
    renderPage();
    enterNames();
    start();
    expect(await screen.findByText('请先配置 Emby 服务器')).toBeTruthy();
    expect(screen.getByText('批量查询失败')).toBeTruthy();
    expect(screen.queryByRole('region', { name: '入库查询结果' })).toBeNull();
    expect(
      (
        screen.getByRole('textbox', {
          name: '粘贴媒体名称',
        }) as HTMLTextAreaElement
      ).value,
    ).toContain('星际穿越.mkv');
    start();
    await screen.findByRole('region', { name: '入库查询结果' });
  });

  it('rejects empty or excessive batches and clears completed work', async () => {
    renderPage();
    const query = screen.getByRole('button', {
      name: /开始查询/,
    }) as HTMLButtonElement;
    expect(query.disabled).toBe(true);
    enterNames(
      Array.from({ length: 201 }, (_, index) => `名称${index}`).join('\n'),
    );
    expect(query.disabled).toBe(true);
    expect(screen.getByText('201 / 200 行，请减少名称后再查询')).toBeTruthy();
    fireEvent.click(query);
    expect(checkEmbyLibrary).not.toHaveBeenCalled();
    enterNames();
    start();
    await screen.findByRole('region', { name: '入库查询结果' });
    fireEvent.click(screen.getByRole('button', { name: /清\s*空/ }));
    expect(
      (
        screen.getByRole('textbox', {
          name: '粘贴媒体名称',
        }) as HTMLTextAreaElement
      ).value,
    ).toBe('');
    expect(screen.getByText('粘贴名称后开始查询')).toBeTruthy();
    expect(screen.queryByRole('region', { name: '入库查询结果' })).toBeNull();
  });

  it('aborts a pending request when leaving the page', () => {
    vi.mocked(checkEmbyLibrary).mockReturnValue(new Promise(() => {}));
    const page = renderPage();
    enterNames();
    start();
    const signal = vi.mocked(checkEmbyLibrary).mock.calls[0][1];
    page.unmount();
    expect(signal?.aborted).toBe(true);
  });

  it('links to safe Emby item URLs and rejects unsafe URL schemes or embedded credentials', async () => {
    vi.mocked(checkEmbyLibrary).mockResolvedValueOnce({
      code: 0,
      message: '',
      data: {
        total: 1,
        duplicates_removed: 0,
        results: [
          {
            ...result.results[0],
            matches: [
              {
                id: '1',
                name: '安全影片',
                type: 'Movie',
                emby_url:
                  'https://emby.example/emby/web/index.html#!/item?id=1',
              },
              {
                id: '2',
                name: '危险链接',
                type: 'Movie',
                emby_url: 'javascript:alert(1)',
              },
              {
                id: '3',
                name: '含凭据链接',
                type: 'Movie',
                emby_url: 'https://username:secret@emby.example/web/index.html',
              },
            ],
          },
        ],
      },
    });
    renderPage();
    enterNames('安全影片');
    start();
    const link = await screen.findByRole('link', {
      name: '在 Emby 打开：安全影片',
    });
    expect(link.getAttribute('href')).toBe(
      'https://emby.example/emby/web/index.html#!/item?id=1',
    );
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(
      screen.queryByRole('link', { name: '在 Emby 打开：危险链接' }),
    ).toBeNull();
    expect(
      screen.queryByRole('link', { name: '在 Emby 打开：含凭据链接' }),
    ).toBeNull();
    enterNames('已修改的输入');
    expect(
      screen.queryByRole('link', { name: '在 Emby 打开：安全影片' }),
    ).toBeNull();
  });
});
