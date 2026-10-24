import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { ConfigProvider } from 'antd';
import { StrictMode, useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type CloudBrowserPage,
  type CloudSTRMResult,
  cancelCloudBrowserSTRMJob,
  generateCloudBrowserSTRM,
  getActiveCloudBrowserSTRMJob,
  getCloudBrowserPage,
  getCloudBrowserSTRMJob,
} from '@/services/film-fusion/cloud-browser';
import CloudBrowser, { type CloudBrowserHandle } from './CloudBrowser';

vi.mock('@/services/film-fusion/cloud-browser', () => ({
  cancelCloudBrowserSTRMJob: vi.fn(),
  generateCloudBrowserSTRM: vi.fn(),
  getActiveCloudBrowserSTRMJob: vi.fn(),
  getCloudBrowserPage: vi.fn(),
  getCloudBrowserSTRMJob: vi.fn(),
}));

const directory: API.CloudDirectory = {
  id: 7,
  user_id: 1,
  cloud_storage_id: 3,
  directory_name: '电影目录',
  directory_id: '100',
  created_at: '',
  updated_at: '',
  cloud_storage: { id: 3, storage_name: '我的 115', storage_type: '115open' },
};
const firstPage: CloudBrowserPage = {
  cid: '100',
  offset: 0,
  limit: 50,
  total: 101,
  has_more: true,
  access_method: 'openapi',
  available_methods: ['cookie', 'openapi'],
  breadcrumbs: [
    { id: '0', parent_id: '', name: '根目录' },
    { id: '100', parent_id: '0', name: '电影' },
  ],
  matched_directory: { id: 7, directory_name: '电影目录' },
  current_directory_token: 'directory-100',
  items: [
    {
      file_id: '101',
      parent_id: '100',
      name: '子目录',
      is_file: false,
      size: 0,
      selection_token: 'directory-101',
      matched_directory_id: 7,
      matched_directory_name: '电影目录',
    },
    {
      file_id: '201',
      parent_id: '100',
      name: '电影.mkv',
      is_file: true,
      size: 1024,
      selection_token: 'file-201',
      matched_directory_id: 7,
      matched_directory_name: '电影目录',
    },
    {
      file_id: '202',
      parent_id: '100',
      name: '未匹配.mkv',
      is_file: true,
      size: 1024,
      strm_unavailable_reason: '未匹配目录配置',
    },
    {
      file_id: '203',
      parent_id: '100',
      name: '被过滤.txt',
      is_file: true,
      size: 1,
      selection_token: 'file-203',
      matched_directory_id: 7,
      strm_unavailable_reason: '文件扩展名不符合配置',
    },
  ],
};
const runningJob: CloudSTRMResult = {
  job_id: 'job-1',
  status: 'running',
  finished: false,
  generated: 0,
  skipped: 0,
  failed: 0,
  scanned_files: 0,
  visited_directories: 0,
  errors: [],
};
const ok = <T,>(data: T): API.Response<T> => ({ code: 0, message: '', data });

function Harness() {
  const ref = useRef<CloudBrowserHandle>(null);
  return (
    <ConfigProvider theme={{ token: { motion: false } }}>
      <button type="button" onClick={() => ref.current?.open(directory)}>
        浏览网盘
      </button>
      <CloudBrowser ref={ref} />
    </ConfigProvider>
  );
}

async function openBrowser() {
  fireEvent.click(screen.getByRole('button', { name: '浏览网盘' }));
  await screen.findByText('电影.mkv');
}

describe('115 directory browser', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCloudBrowserPage).mockResolvedValue(ok(firstPage));
    vi.mocked(getActiveCloudBrowserSTRMJob).mockResolvedValue(ok(null));
    vi.mocked(generateCloudBrowserSTRM).mockResolvedValue(ok(runningJob));
    vi.mocked(getCloudBrowserSTRMJob).mockResolvedValue(ok(runningJob));
    vi.mocked(cancelCloudBrowserSTRMJob).mockResolvedValue(
      ok({ ...runningJob, status: 'cancelled', finished: true }),
    );
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('loads no directory on mount and fetches exactly one page for each manual action', async () => {
    const view = render(
      <StrictMode>
        <Harness />
      </StrictMode>,
    );
    expect(getCloudBrowserPage).not.toHaveBeenCalled();
    expect(getActiveCloudBrowserSTRMJob).not.toHaveBeenCalled();
    await openBrowser();
    expect(getCloudBrowserPage).toHaveBeenCalledExactlyOnceWith(
      7,
      { access_method: 'openapi', cid: '100', offset: 0, limit: 50 },
      expect.any(AbortSignal),
    );
    view.rerender(
      <StrictMode>
        <Harness />
      </StrictMode>,
    );
    fireEvent.scroll(window, { target: { scrollY: 10000 } });
    fireEvent.focus(window);
    vi.useFakeTimers();
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(getCloudBrowserPage).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
    vi.mocked(getCloudBrowserPage).mockResolvedValueOnce(
      ok({ ...firstPage, offset: 4 }),
    );
    fireEvent.click(screen.getByRole('button', { name: '下一页' }));
    await screen.findByText('第 2 页 · 共 101 项');
    expect(getCloudBrowserPage).toHaveBeenLastCalledWith(
      7,
      expect.objectContaining({ offset: 4, limit: 50 }),
      expect.any(AbortSignal),
    );
    expect(getCloudBrowserPage).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: '子目录' }));
    await waitFor(() => expect(getCloudBrowserPage).toHaveBeenCalledTimes(3));
    expect(getCloudBrowserPage).toHaveBeenLastCalledWith(
      7,
      expect.objectContaining({ cid: '101', offset: 0 }),
      expect.any(AbortSignal),
    );
  });

  it('advances by returned items on short pages and returns to the previous actual offset', async () => {
    const shortPage = {
      ...firstPage,
      items: Array.from({ length: 10 }, (_, index) => ({
        ...firstPage.items[1],
        file_id: String(200 + index),
        name: `文件${index}.mkv`,
      })),
    };
    vi.mocked(getCloudBrowserPage).mockImplementation(async (_, query) =>
      ok({ ...shortPage, offset: query.offset }),
    );
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: '浏览网盘' }));
    await screen.findByText('文件0.mkv');
    expect(getCloudBrowserPage).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '下一页' }));
    await screen.findByText('第 2 页 · 共 101 项');
    expect(getCloudBrowserPage).toHaveBeenLastCalledWith(
      7,
      expect.objectContaining({ offset: 10, limit: 50 }),
      expect.any(AbortSignal),
    );
    expect(getCloudBrowserPage).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: '上一页' }));
    await screen.findByText('第 1 页 · 共 101 项');
    expect(getCloudBrowserPage).toHaveBeenLastCalledWith(
      7,
      expect.objectContaining({ offset: 0, limit: 50 }),
      expect.any(AbortSignal),
    );
    expect(getCloudBrowserPage).toHaveBeenCalledTimes(3);
  });

  it('blocks repeated clicks while a page is pending and aborts it on unmount', () => {
    vi.mocked(getCloudBrowserPage).mockReturnValue(new Promise(() => {}));
    const view = render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: '浏览网盘' }));
    fireEvent.click(screen.getByRole('button', { name: '浏览网盘' }));
    expect(getCloudBrowserPage).toHaveBeenCalledTimes(1);
    const signal = vi.mocked(getCloudBrowserPage).mock.calls[0][2];
    expect(signal?.aborted).toBe(false);
    view.unmount();
    expect(signal?.aborted).toBe(true);
  });

  it('ignores a late page response after closing and reopening the browser', async () => {
    const pending: {
      resolve?: (response: API.Response<CloudBrowserPage>) => void;
    } = {};
    vi.mocked(getCloudBrowserPage).mockReturnValueOnce(
      new Promise((resolve) => {
        pending.resolve = resolve;
      }),
    );
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: '浏览网盘' }));
    const firstSignal = vi.mocked(getCloudBrowserPage).mock.calls[0][2];
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(firstSignal?.aborted).toBe(true);
    await openBrowser();
    await act(async () => {
      pending.resolve?.(
        ok({
          ...firstPage,
          items: [{ ...firstPage.items[1], name: '已失效的响应.mkv' }],
        }),
      );
    });
    expect(screen.queryByText('已失效的响应.mkv')).toBeNull();
    expect(screen.getByText('电影.mkv')).toBeTruthy();
    expect(getCloudBrowserPage).toHaveBeenCalledTimes(2);
  });

  it('disables directory generation when the server reports an invalid configuration', async () => {
    vi.mocked(getCloudBrowserPage).mockResolvedValueOnce(
      ok({
        ...firstPage,
        strm_unavailable_reason: '当前目录匹配多个配置，请先调整目录配置',
        items: [
          { ...firstPage.items[0], strm_unavailable_reason: '保存路径未配置' },
        ],
      }),
    );
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: '浏览网盘' }));
    await screen.findByText('当前目录匹配多个配置，请先调整目录配置');
    expect(
      (
        screen.getByRole('button', {
          name: '生成当前目录 STRM',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole('button', {
          name: '生成目录 STRM',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(generateCloudBrowserSTRM).not.toHaveBeenCalled();
  });

  it('does not retry or switch access methods on failure; switching is explicit', async () => {
    vi.mocked(getCloudBrowserPage).mockRejectedValueOnce(
      new Error('请求过于频繁，请稍后重试'),
    );
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: '浏览网盘' }));
    await screen.findByText('请求过于频繁，请稍后重试');
    vi.useFakeTimers();
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(getCloudBrowserPage).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
    fireEvent.mouseDown(screen.getByRole('combobox', { name: '115 访问方式' }));
    fireEvent.click(await screen.findByText('Cookie'));
    await screen.findByText('电影.mkv');
    expect(getCloudBrowserPage).toHaveBeenCalledTimes(2);
    expect(getCloudBrowserPage).toHaveBeenLastCalledWith(
      7,
      expect.objectContaining({ access_method: 'cookie', offset: 0 }),
      expect.any(AbortSignal),
    );
  });

  it('requires a valid directory match and generates a single file without refreshing or paging', async () => {
    vi.mocked(generateCloudBrowserSTRM).mockResolvedValueOnce(
      ok({
        status: 'completed',
        finished: true,
        generated: 0,
        skipped: 0,
        failed: 1,
        results: [
          {
            file_id: '201',
            name: '电影.mkv',
            status: 'failed',
            message: '目标目录不可写',
          },
        ],
      }),
    );
    render(<Harness />);
    await openBrowser();
    const unmatched = screen.getByRole('row', { name: /未匹配.mkv/ });
    const filtered = screen.getByRole('row', { name: /被过滤.txt/ });
    expect(
      (
        within(unmatched).getByRole('button', {
          name: '重新生成 STRM',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        within(filtered).getByRole('button', {
          name: '重新生成 STRM',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(
      within(screen.getByRole('row', { name: /电影.mkv/ })).getByRole(
        'button',
        {
          name: '重新生成 STRM',
        },
      ),
    );
    await screen.findByText('电影.mkv：目标目录不可写');
    expect(generateCloudBrowserSTRM).toHaveBeenCalledExactlyOnceWith(
      7,
      'file-201',
      expect.any(AbortSignal),
    );
    expect(getCloudBrowserPage).toHaveBeenCalledTimes(1);
    expect(getCloudBrowserSTRMJob).not.toHaveBeenCalled();
  });

  it('starts recursive generation only after confirmation and polls only local job status', async () => {
    render(<Harness />);
    await openBrowser();
    fireEvent.click(screen.getByRole('button', { name: '生成目录 STRM' }));
    await screen.findByText('为“子目录”生成 STRM？');
    expect(generateCloudBrowserSTRM).not.toHaveBeenCalled();
    vi.useFakeTimers();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '开始生成' }));
    });
    expect(generateCloudBrowserSTRM).toHaveBeenCalledExactlyOnceWith(
      7,
      'directory-101',
      expect.any(AbortSignal),
    );
    expect(getCloudBrowserSTRMJob).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(getCloudBrowserSTRMJob).toHaveBeenCalledExactlyOnceWith(
      7,
      'job-1',
      expect.any(AbortSignal),
    );
    expect(getCloudBrowserPage).toHaveBeenCalledTimes(1);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '停止生成' }));
    });
    expect(cancelCloudBrowserSTRMJob).toHaveBeenCalledExactlyOnceWith(
      7,
      'job-1',
      expect.any(AbortSignal),
    );
    expect(screen.getByText('目录任务 · 子目录 · 已停止')).toBeTruthy();
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(getCloudBrowserSTRMJob).toHaveBeenCalledTimes(1);
    expect(getCloudBrowserPage).toHaveBeenCalledTimes(1);
  });

  it('stops status polling on close while leaving an explicitly started job running', async () => {
    render(<Harness />);
    await openBrowser();
    fireEvent.click(screen.getByRole('button', { name: '生成当前目录 STRM' }));
    await screen.findByText('为“电影”生成 STRM？');
    vi.useFakeTimers();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '开始生成' }));
    });
    expect(generateCloudBrowserSTRM).toHaveBeenCalledWith(
      7,
      'directory-100',
      expect.any(AbortSignal),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(getCloudBrowserSTRMJob).not.toHaveBeenCalled();
    expect(cancelCloudBrowserSTRMJob).not.toHaveBeenCalled();
    expect(getCloudBrowserPage).toHaveBeenCalledTimes(1);
  });

  it('rediscovers an existing task on explicit open after remount so it can be stopped', async () => {
    vi.mocked(getActiveCloudBrowserSTRMJob).mockResolvedValue(
      ok({ ...runningJob, name: '之前的子目录' }),
    );
    const first = render(<Harness />);
    expect(getActiveCloudBrowserSTRMJob).not.toHaveBeenCalled();
    await openBrowser();
    await screen.findByText('目录任务 · 之前的子目录 · 正在生成');
    first.unmount();
    render(<Harness />);
    expect(getActiveCloudBrowserSTRMJob).toHaveBeenCalledTimes(1);
    await openBrowser();
    await screen.findByText('目录任务 · 之前的子目录 · 正在生成');
    expect(getActiveCloudBrowserSTRMJob).toHaveBeenCalledTimes(2);
    expect(generateCloudBrowserSTRM).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '停止生成' }));
    await screen.findByText('目录任务 · 之前的子目录 · 已停止');
    expect(cancelCloudBrowserSTRMJob).toHaveBeenCalledExactlyOnceWith(
      7,
      'job-1',
      expect.any(AbortSignal),
    );
    expect(getCloudBrowserPage).toHaveBeenCalledTimes(2);
  });

  it('unblocks generation when the server no longer has a recovered task', async () => {
    vi.mocked(getActiveCloudBrowserSTRMJob).mockResolvedValue(
      ok({ ...runningJob, name: '丢失的任务' }),
    );
    vi.mocked(getCloudBrowserSTRMJob).mockRejectedValue({
      isAxiosError: true,
      response: { status: 404 },
    });
    render(<Harness />);
    vi.useFakeTimers();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '浏览网盘' }));
    });
    expect(
      (
        screen.getByRole('button', {
          name: '生成当前目录 STRM',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(screen.getByText('目录任务 · 丢失的任务 · 失败')).toBeTruthy();
    expect(
      screen.getByText(
        '任务已不存在，可能已因服务重启或清理而结束。可以重新生成。',
      ),
    ).toBeTruthy();
    expect(
      (
        screen.getByRole('button', {
          name: '生成当前目录 STRM',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    expect(screen.queryByRole('button', { name: '停止生成' })).toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(getCloudBrowserSTRMJob).toHaveBeenCalledTimes(1);
    expect(getCloudBrowserPage).toHaveBeenCalledTimes(1);
  });
});
