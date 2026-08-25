import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { App } from 'antd';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RSSAutomationNodeDefinition } from '@/services/film-fusion';
import NodeConfigModal from './NodeConfigDrawer';

describe('RSS automation replacement node config', () => {
  afterEach(cleanup);

  it('keeps ordered keyword replacement rules, including an empty deletion value', async () => {
    const onChange = vi.fn();
    const node: RSSAutomationNodeDefinition = {
      id: 'replace_title',
      type: 'keyword_replace',
      name: '清理标题',
      position: { x: 100, y: 100 },
      config: {
        input: '$item.title',
        replacements: [{ keyword: '[字幕组]', replacement: '' }],
        case_sensitive: false,
        variable: 'clean_title',
      },
      max_attempts: 1,
    };

    render(
      <App>
        <NodeConfigModal
          cloudDirectories={[]}
          cloudStorages={[]}
          fieldReferences={[]}
          node={node}
          onChange={onChange}
          onClose={vi.fn()}
          onDelete={vi.fn()}
          targets={[]}
        />
      </App>,
    );

    fireEvent.click(screen.getByRole('button', { name: /添加替换规则/ }));
    const keywordInputs = screen.getAllByPlaceholderText('例如：WEB-DL');
    const replacementInputs = screen.getAllByPlaceholderText('例如：WEB');
    fireEvent.change(keywordInputs[1], { target: { value: 'web-dl' } });
    fireEvent.change(replacementInputs[1], { target: { value: 'WEB' } });
    fireEvent.click(screen.getByRole('button', { name: '应用配置' }));

    await waitFor(() => expect(onChange).toHaveBeenCalledOnce());
    expect(onChange.mock.calls[0][0]).toMatchObject({
      config: {
        input: '$item.title',
        replacements: [
          { keyword: '[字幕组]', replacement: '' },
          { keyword: 'web-dl', replacement: 'WEB' },
        ],
        case_sensitive: false,
        variable: 'clean_title',
      },
    });
  });

  it('keeps the 115 OpenAPI account, file ID variable and new-name template', async () => {
    const onChange = vi.fn();
    const node: RSSAutomationNodeDefinition = {
      id: 'rename_cloud_file',
      type: 'rename115_openapi',
      name: '重命名下载结果',
      position: { x: 100, y: 100 },
      config: {
        cloud_storage_id: 7,
        file_id: '$nodes.wait.output.file_id',
        new_name: '{{item.title}}.mkv',
      },
      max_attempts: 3,
    };

    render(
      <App>
        <NodeConfigModal
          cloudDirectories={[]}
          cloudStorages={
            [
              {
                id: 7,
                storage_name: '家庭 115',
                storage_type: '115open',
                status: 'active',
              },
            ] as API.CloudStorage[]
          }
          fieldReferences={[]}
          node={node}
          onChange={onChange}
          onClose={vi.fn()}
          onDelete={vi.fn()}
          targets={[]}
        />
      </App>,
    );

    expect(
      (screen.getByLabelText('115 重命名对象 ID') as HTMLInputElement).value,
    ).toBe('$nodes.wait.output.file_id');
    expect(
      (screen.getByLabelText('115 重命名新名称') as HTMLInputElement).value,
    ).toBe('{{item.title}}.mkv');
    fireEvent.click(screen.getByRole('button', { name: '应用配置' }));

    await waitFor(() => expect(onChange).toHaveBeenCalledOnce());
    expect(onChange.mock.calls[0][0]).toMatchObject({
      type: 'rename115_openapi',
      max_attempts: 3,
      config: {
        cloud_storage_id: 7,
        file_id: '$nodes.wait.output.file_id',
        new_name: '{{item.title}}.mkv',
      },
    });
  });
});
