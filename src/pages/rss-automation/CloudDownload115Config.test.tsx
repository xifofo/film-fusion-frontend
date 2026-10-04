import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RSSAutomationNodeDefinition } from '@/services/film-fusion';
import NodeConfigModal from './NodeConfigDrawer';

vi.mock('@/components/CloudDirectoryPicker', () => ({
  default: () => null,
  CLOUD_DIRECTORY_ROOT_ID: '0',
}));
const account = {
  id: 7,
  storage_type: '115open',
  storage_name: '模拟账号',
  status: 'active',
} as API.CloudStorage;
const renderNode = (
  type: RSSAutomationNodeDefinition['type'],
  config: Record<string, unknown>,
) => {
  const onChange = vi.fn();
  render(
    <NodeConfigModal
      node={{
        id: 'node',
        type,
        name: '测试节点',
        position: { x: 0, y: 0 },
        max_attempts: 1,
        config: { cloud_storage_id: 7, ...config },
      }}
      cloudDirectories={[]}
      cloudStorages={[account]}
      targets={[]}
      fieldReferences={[
        {
          kind: 'node',
          name: '添加任务 · info_hash',
          value: '$nodes.add.output.info_hash',
        },
      ]}
      onChange={onChange}
      onClose={vi.fn()}
      onDelete={vi.fn()}
    />,
  );
  return onChange;
};

describe('115 cloud download configuration persistence', () => {
  afterEach(cleanup);

  it('saves edited rename target and filename templates', async () => {
    const onChange = renderNode('rename115_openapi', {
      file_id: 'old-id',
      new_name: 'old-name',
    });
    fireEvent.change(screen.getByLabelText('115 重命名对象 ID'), {
      target: { value: '$nodes.wait.output.file_id' },
    });
    fireEvent.change(screen.getByLabelText('115 重命名新名称'), {
      target: { value: '{{item.title}}.mkv' },
    });
    fireEvent.click(screen.getByRole('button', { name: '应用配置' }));
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            file_id: '$nodes.wait.output.file_id',
            new_name: '{{item.title}}.mkv',
          }),
        }),
      ),
    );
  });

  it('keeps wanted zero and every BT parameter when applying the form', async () => {
    const onChange = renderNode('offline115_bt_openapi', {
      torrent_sha1: 'seed',
      pick_code: 'pick123',
      info_hash: '$nodes.parse.output.info_hash',
      wanted: '0',
      save_path: 'Show',
      directory_id: '9527',
    });
    fireEvent.change(screen.getByLabelText('种子文件提取码'), {
      target: { value: 'new-pick-code' },
    });
    fireEvent.click(screen.getByRole('button', { name: '应用配置' }));
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          max_attempts: 1,
          config: expect.objectContaining({
            torrent_sha1: 'seed',
            pick_code: 'new-pick-code',
            info_hash: '$nodes.parse.output.info_hash',
            wanted: '0',
            save_path: 'Show',
            directory_id: '9527',
          }),
        }),
      ),
    );
  });

  it('persists explicitly enabled source deletion and shows its effect', async () => {
    const onChange = renderNode('delete115_task_openapi', {
      info_hash: 'abc',
      delete_files: false,
    });
    fireEvent.click(screen.getByRole('switch'));
    expect(
      await screen.findByText('执行时将同时删除任务对应的云端源文件。'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '应用配置' }));
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            info_hash: 'abc',
            delete_files: true,
          }),
        }),
      ),
    );
  });

  it('saves hash lookup and a configured task page', async () => {
    const onChange = renderNode('list115_tasks_openapi', {
      info_hash: '',
      page: 3,
    });
    fireEvent.click(
      screen.getByRole('button', { name: '为查找任务 Hash插入变量' }),
    );
    fireEvent.click(
      await screen.findByRole('option', { name: /添加任务 · info_hash/ }),
    );
    fireEvent.click(screen.getByRole('button', { name: '应用配置' }));
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            info_hash: '$nodes.add.output.info_hash',
            page: 3,
          }),
        }),
      ),
    );
  });
});
