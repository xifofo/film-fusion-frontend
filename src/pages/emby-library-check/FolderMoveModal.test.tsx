import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { App } from 'antd';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CloudDirectorySelection } from '@/components/CloudDirectoryPicker';
import {
  type CloudFolderMoveResult,
  getCloudFiles,
  moveCloudFileToFolder,
} from '@/services/film-fusion/cloudFileMove';
import { getCloudStorageList } from '@/services/film-fusion/cloudStorage';
import FolderMoveModal from './FolderMoveModal';

vi.mock('@/services/film-fusion/cloudStorage', () => ({
  getCloudStorageList: vi.fn(),
}));
vi.mock('@/services/film-fusion/cloudFileMove', () => ({
  getCloudFiles: vi.fn(),
  moveCloudFileToFolder: vi.fn(),
}));
vi.mock('@/components/CloudDirectoryPicker', () => ({
  default: ({
    onSelect,
  }: {
    onSelect: (selection: CloudDirectorySelection) => void;
  }) => (
    <div>
      <button
        type="button"
        onClick={() => onSelect({ id: '10', name: '下载', path: '/下载' })}
      >
        选中下载目录
      </button>
      <button
        type="button"
        onClick={() => onSelect({ id: '20', name: '媒体库', path: '/媒体库' })}
      >
        选中媒体库目录
      </button>
      <button
        type="button"
        onClick={() => onSelect({ id: '0', name: '根目录', path: '/' })}
      >
        选中根目录
      </button>
    </div>
  ),
}));

const item = {
  original_name: '未入库.mkv',
  name: '未入库',
  status: 'missing' as const,
  matches: [],
};
const storage = {
  id: 7,
  storage_name: '测试115',
  storage_type: '115open',
  status: 'active',
  cookie: 'test-only-cookie',
  access_token: 'test-only-token',
} as API.CloudStorage;
const file = {
  file_id: '101',
  parent_id: '10',
  name: '未入库.mkv',
  is_file: true,
  size: 12345,
};
const success: CloudFolderMoveResult = {
  status: 'moved',
  folder_id: '300',
  folder_name: '自定义名称',
  file_id: '101',
  file_name: '未入库.mkv',
  reused_folder: false,
};
const onClose = vi.fn();
const onMoved = vi.fn();
const page = (stale = false) => (
  <App>
    <FolderMoveModal
      item={item}
      stale={stale}
      onClose={onClose}
      onMoved={onMoved}
    />
  </App>
);
const chooseOption = async (label: string, option: string) => {
  fireEvent.mouseDown(screen.getByRole('combobox', { name: label }));
  fireEvent.click(
    await screen.findByText(option, {
      selector: '.ant-select-item-option-content',
    }),
  );
};
const chooseSource = async () => {
  fireEvent.click(screen.getByRole('button', { name: '选择来源目录' }));
  fireEvent.click(screen.getByRole('button', { name: '选中下载目录' }));
  await screen.findByRole('radio', { name: '未入库.mkv' });
};
const setupDraft = async () => {
  await waitFor(() => expect(getCloudStorageList).toHaveBeenCalled());
  await chooseOption('115 账号', '测试115');
  await chooseOption('访问方式', 'Cookie');
  await chooseSource();
  fireEvent.click(screen.getByRole('radio', { name: '未入库.mkv' }));
  fireEvent.click(screen.getByRole('button', { name: '选择目标父目录' }));
  fireEvent.click(screen.getByRole('button', { name: '选中媒体库目录' }));
  fireEvent.change(screen.getByRole('textbox', { name: '文件夹名称' }), {
    target: { value: '自定义名称' },
  });
};

describe('FolderMoveModal', () => {
  beforeEach(() => {
    vi.mocked(getCloudStorageList).mockResolvedValue({
      code: 0,
      message: '',
      data: { list: [storage], total: 1, current: 1, pageSize: 100 },
    });
    vi.mocked(getCloudFiles).mockResolvedValue({
      code: 0,
      message: '',
      data: {
        items: [
          file,
          {
            file_id: '102',
            parent_id: '10',
            name: '这是文件夹',
            is_file: false,
            size: 0,
          },
        ],
        total: 2,
        cid: '10',
        offset: 0,
        limit: 100,
      },
    });
    vi.mocked(moveCloudFileToFolder).mockResolvedValue({
      code: 0,
      message: '',
      data: success,
    });
  });
  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it('requires a credential choice, a concrete file and an independent custom destination', async () => {
    render(page());
    expect(getCloudFiles).not.toHaveBeenCalled();
    await chooseOption('115 账号', '测试115');
    expect(
      (
        screen.getByRole('button', {
          name: '选择来源目录',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    await chooseOption('访问方式', 'Cookie');
    await chooseSource();
    expect(getCloudFiles).toHaveBeenCalledWith(
      7,
      { access_method: 'cookie', cid: '10', offset: 0, limit: 100 },
      expect.any(AbortSignal),
    );
    expect(screen.queryByRole('radio', { name: '这是文件夹' })).toBeNull();
    const submit = screen.getByRole('button', {
      name: '创建文件夹并移入',
    }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.click(screen.getByRole('radio', { name: '未入库.mkv' }));
    expect(submit.disabled).toBe(true);
    expect(
      screen.getByText('尚未选择；请指定新文件夹要创建在哪里'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '选择目标父目录' }));
    fireEvent.click(screen.getByRole('button', { name: '选中媒体库目录' }));
    fireEvent.change(screen.getByRole('textbox', { name: '文件夹名称' }), {
      target: { value: '自定义名称' },
    });
    expect(
      screen.getByText('最终位置：/媒体库/自定义名称/未入库.mkv'),
    ).toBeTruthy();
    expect(moveCloudFileToFolder).not.toHaveBeenCalled();
    fireEvent.click(submit);
    await waitFor(() =>
      expect(moveCloudFileToFolder).toHaveBeenCalledWith(7, {
        access_method: 'cookie',
        source_parent_id: '10',
        file_id: '101',
        file_name: '未入库.mkv',
        target_parent_id: '20',
        folder_name: '自定义名称',
      }),
    );
    expect(await screen.findByText('文件已移入目标文件夹')).toBeTruthy();
    expect(
      screen.getByText(/Emby 入库状态需等待媒体库扫描后重新查询/),
    ).toBeTruthy();
    expect(onMoved).toHaveBeenCalledWith('/媒体库/自定义名称/未入库.mkv');
    expect(onClose).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('button', { name: '创建文件夹并移入' }),
    ).toBeNull();
    expect(screen.queryByText('本地 STRM 已生成')).toBeNull();
    expect(screen.queryByRole('button', { name: '重试生成 STRM' })).toBeNull();
  });

  it('retains drafts and the folder ID after partial failure for safe retry', async () => {
    vi.mocked(moveCloudFileToFolder).mockRejectedValueOnce({
      response: {
        data: {
          message: '115 移动暂时失败',
          data: { ...success, status: 'pending' },
        },
      },
    });
    render(page());
    await setupDraft();
    fireEvent.click(screen.getByRole('button', { name: '创建文件夹并移入' }));
    expect(
      await screen.findByText('文件夹已创建或复用，文件移动尚未完成'),
    ).toBeTruthy();
    expect(screen.getByText('115 移动暂时失败')).toBeTruthy();
    expect(
      (screen.getByRole('textbox', { name: '文件夹名称' }) as HTMLInputElement)
        .value,
    ).toBe('自定义名称');
    expect(
      (screen.getByRole('radio', { name: '未入库.mkv' }) as HTMLInputElement)
        .checked,
    ).toBe(true);
    expect(onMoved).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '重试移入文件' }));
    await waitFor(() =>
      expect(moveCloudFileToFolder).toHaveBeenLastCalledWith(
        7,
        expect.objectContaining({
          folder_id: '300',
          target_parent_id: '20',
          file_id: '101',
        }),
      ),
    );
    expect(await screen.findByText('文件已移入目标文件夹')).toBeTruthy();
  });

  it('discards the retry folder when the destination or folder name changes', async () => {
    vi.mocked(moveCloudFileToFolder).mockResolvedValueOnce({
      code: 500,
      message: '移动失败',
      data: { ...success, status: 'pending' },
    });
    render(page());
    await setupDraft();
    fireEvent.click(screen.getByRole('button', { name: '创建文件夹并移入' }));
    await screen.findByText('文件夹已创建或复用，文件移动尚未完成');
    fireEvent.click(screen.getByRole('button', { name: '选择目标父目录' }));
    fireEvent.click(screen.getByRole('button', { name: '选中根目录' }));
    fireEvent.change(screen.getByRole('textbox', { name: '文件夹名称' }), {
      target: { value: '另一个文件夹' },
    });
    expect(
      screen.queryByText('文件夹已创建或复用，文件移动尚未完成'),
    ).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '创建文件夹并移入' }));
    await waitFor(() => expect(moveCloudFileToFolder).toHaveBeenCalledTimes(2));
    const params = vi.mocked(moveCloudFileToFolder).mock.calls[1][1];
    expect(params.folder_id).toBeUndefined();
    expect(params.target_parent_id).toBe('0');
    expect(params.folder_name).toBe('另一个文件夹');
  });

  it('prevents moving when the originating query becomes stale', async () => {
    const view = render(page());
    await setupDraft();
    view.rerender(page(true));
    expect(
      screen.getByText('查询名称已修改，请关闭弹窗并重新查询后再操作'),
    ).toBeTruthy();
    const submit = screen.getByRole('button', {
      name: '创建文件夹并移入',
    }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.click(submit);
    expect(moveCloudFileToFolder).not.toHaveBeenCalled();
  });

  it('paginates file reads only after explicit actions and keeps target independent', async () => {
    vi.mocked(getCloudFiles).mockResolvedValueOnce({
      code: 0,
      message: '',
      data: { items: [file], total: 101, cid: '10', offset: 0, limit: 100 },
    });
    vi.mocked(getCloudFiles).mockResolvedValueOnce({
      code: 0,
      message: '',
      data: {
        items: [{ ...file, file_id: '201', name: '第二页文件.mkv' }],
        total: 101,
        cid: '10',
        offset: 100,
        limit: 100,
      },
    });
    render(page());
    await chooseOption('115 账号', '测试115');
    await chooseOption('访问方式', 'OpenAPI');
    await chooseSource();
    fireEvent.click(screen.getByRole('button', { name: '下一页' }));
    expect(
      await screen.findByRole('radio', { name: '第二页文件.mkv' }),
    ).toBeTruthy();
    expect(getCloudFiles).toHaveBeenLastCalledWith(
      7,
      { access_method: 'openapi', cid: '10', offset: 100, limit: 100 },
      expect.any(AbortSignal),
    );
    expect(
      screen.getByText('尚未选择；请指定新文件夹要创建在哪里'),
    ).toBeTruthy();
  });

  it('rejects unsafe folder names and byte lengths', async () => {
    render(page());
    await setupDraft();
    const input = screen.getByRole('textbox', { name: '文件夹名称' });
    fireEvent.change(input, { target: { value: '../另一个目录' } });
    expect(
      (
        screen.getByRole('button', {
          name: '创建文件夹并移入',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.change(input, { target: { value: '文'.repeat(86) } });
    expect(
      screen.getByText('文件夹名称超过 255 字节，请缩短名称'),
    ).toBeTruthy();
    expect(moveCloudFileToFolder).not.toHaveBeenCalled();
  });

  it('shows STRM creation separately with its mapping and local path', async () => {
    vi.mocked(moveCloudFileToFolder).mockResolvedValueOnce({
      code: 0,
      message: '',
      data: {
        ...success,
        strm: {
          status: 'created',
          cloud_path_id: 12,
          local_path: '/media/自定义名称/未入库.strm',
          message: '本地 STRM 写入完成',
        },
      },
    });
    render(page());
    await setupDraft();
    fireEvent.click(screen.getByRole('button', { name: '创建文件夹并移入' }));
    expect(await screen.findByText('本地 STRM 已生成')).toBeTruthy();
    expect(screen.getByText('文件已移入目标文件夹')).toBeTruthy();
    expect(screen.getByText('云路径映射：#12')).toBeTruthy();
    expect(
      screen.getByText('本地路径：/media/自定义名称/未入库.strm'),
    ).toBeTruthy();
    expect(
      screen.getByText(/Emby 入库状态需等待媒体库扫描后重新查询/),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: '重试生成 STRM' })).toBeNull();
    expect(
      (screen.getByRole('textbox', { name: '文件夹名称' }) as HTMLInputElement)
        .disabled,
    ).toBe(true);
    expect(onMoved).toHaveBeenCalledTimes(1);
  });

  it('shows a skipped STRM reason without treating the cloud move as failed', async () => {
    vi.mocked(moveCloudFileToFolder).mockResolvedValueOnce({
      code: 0,
      message: '',
      data: {
        ...success,
        strm: { status: 'skipped', message: '目标目录未匹配到云路径映射' },
      },
    });
    render(page());
    await setupDraft();
    fireEvent.click(screen.getByRole('button', { name: '创建文件夹并移入' }));
    expect(await screen.findByText('已跳过 STRM 生成')).toBeTruthy();
    expect(screen.getByText('目标目录未匹配到云路径映射')).toBeTruthy();
    expect(screen.getByText('文件已移入目标文件夹')).toBeTruthy();
    expect(screen.queryByText('文件移动失败')).toBeNull();
    expect(screen.queryByRole('button', { name: '重试生成 STRM' })).toBeNull();
    expect(onMoved).toHaveBeenCalledWith('/媒体库/自定义名称/未入库.mkv');
  });

  it('retries STRM with the completed folder and preserves cloud success across request failures', async () => {
    const retryStrm = async (expectedCalls: number) => {
      // Ant Design settles its internal loading state after the error alert renders.
      const button = await waitFor(() => {
        const candidate = screen.getByRole('button', {
          name: '重试生成 STRM',
        }) as HTMLButtonElement;
        expect(candidate.disabled).toBe(false);
        expect(candidate.classList.contains('ant-btn-loading')).toBe(false);
        return candidate;
      });
      fireEvent.click(button);
      await waitFor(() =>
        expect(moveCloudFileToFolder).toHaveBeenCalledTimes(expectedCalls),
      );
    };

    vi.mocked(moveCloudFileToFolder)
      .mockResolvedValueOnce({
        code: 0,
        message: '',
        data: {
          ...success,
          strm: {
            status: 'failed',
            cloud_path_id: 12,
            local_path: '/media/自定义名称/未入库.strm',
            message: '本地目录暂不可写',
          },
        },
      })
      .mockRejectedValueOnce(new Error('连接中断'))
      .mockResolvedValueOnce({
        code: 500,
        message: '重试服务暂不可用',
        data: { ...success, status: 'pending' },
      })
      .mockResolvedValueOnce({
        code: 0,
        message: '',
        data: {
          ...success,
          status: 'already_moved',
          reused_folder: true,
          strm: {
            status: 'created',
            cloud_path_id: 12,
            local_path: '/media/自定义名称/未入库.strm',
            message: 'STRM 重试写入完成',
          },
        },
      });
    render(page());
    await setupDraft();
    fireEvent.click(screen.getByRole('button', { name: '创建文件夹并移入' }));
    expect(await screen.findByText('本地 STRM 生成失败')).toBeTruthy();
    expect(screen.getByText('本地目录暂不可写')).toBeTruthy();
    expect(screen.getByText('文件已移入目标文件夹')).toBeTruthy();
    expect(onMoved).toHaveBeenCalledTimes(1);

    await retryStrm(2);
    expect(
      await screen.findByText(
        '重试失败：连接中断。115 文件已移动，当前选择已保留。',
      ),
    ).toBeTruthy();
    expect(screen.getByText('文件已移入目标文件夹')).toBeTruthy();
    expect(screen.queryByText('文件移动失败')).toBeNull();
    expect(
      (screen.getByRole('textbox', { name: '文件夹名称' }) as HTMLInputElement)
        .disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole('button', {
          name: '选择目标父目录',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(moveCloudFileToFolder).toHaveBeenLastCalledWith(7, {
      access_method: 'cookie',
      source_parent_id: '10',
      file_id: '101',
      file_name: '未入库.mkv',
      target_parent_id: '20',
      folder_name: '自定义名称',
      folder_id: '300',
    });

    await retryStrm(3);
    expect(
      await screen.findByText(
        '重试失败：重试服务暂不可用。115 文件已移动，当前选择已保留。',
      ),
    ).toBeTruthy();
    expect(screen.getByText('文件已移入目标文件夹')).toBeTruthy();
    expect(onMoved).toHaveBeenCalledTimes(1);

    await retryStrm(4);
    expect(await screen.findByText('本地 STRM 已生成')).toBeTruthy();
    expect(screen.getByText('文件已在目标文件夹中')).toBeTruthy();
    expect(screen.getByText('STRM 重试写入完成')).toBeTruthy();
    expect(screen.queryByText('本地 STRM 生成失败')).toBeNull();
    expect(screen.queryByRole('button', { name: '重试生成 STRM' })).toBeNull();
    expect(onMoved).toHaveBeenCalledTimes(2);
    expect(moveCloudFileToFolder).toHaveBeenCalledTimes(4);
  });
});
