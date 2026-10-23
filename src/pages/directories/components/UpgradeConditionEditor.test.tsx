import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { ConfigProvider } from 'antd';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UpgradeCondition } from '@/services/film-fusion/upgrade';
import UpgradeConditionEditor from './UpgradeConditionEditor';

function Editor({
  initial,
  onChange,
  disabled,
}: {
  initial?: UpgradeCondition;
  onChange: (value?: UpgradeCondition) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState(initial);
  return (
    <ConfigProvider theme={{ token: { motion: false } }}>
      <UpgradeConditionEditor
        label="规则"
        value={value}
        disabled={disabled}
        onChange={(next) => {
          setValue(next);
          onChange(next);
        }}
      />
    </ConfigProvider>
  );
}

const resolution: UpgradeCondition = {
  op: 'match',
  field: 'resolution',
  values: ['2160p'],
  match: 'equals',
};

async function choose(label: string, option: string) {
  fireEvent.mouseDown(screen.getByRole('combobox', { name: label }));
  fireEvent.click(await screen.findByText(option));
}

describe('upgrade condition editor', () => {
  afterEach(cleanup);

  it('labels language suggestions in Chinese and keeps canonical condition values', async () => {
    const change = vi.fn();
    render(
      <Editor
        onChange={change}
        initial={{
          op: 'match',
          field: 'audio_language',
          match: 'equals',
          values: ['yue'],
        }}
      />,
    );
    expect(screen.getByText('粤语（yue）')).toBeTruthy();
    await choose('规则字段', '字幕标记');
    fireEvent.mouseDown(screen.getByRole('combobox', { name: '规则匹配值' }));
    fireEvent.change(screen.getByRole('combobox', { name: '规则匹配值' }), {
      target: { value: '繁体' },
    });
    fireEvent.click(await screen.findByText('繁体中文（zh-Hant）'));
    expect(change.mock.lastCall?.[0]).toMatchObject({
      field: 'subtitle',
      values: ['zh-Hant'],
    });
  });

  it('does not save the empty state and supports building and clearing a condition tree', () => {
    const change = vi.fn();
    render(<Editor onChange={change} />);
    expect(change).not.toHaveBeenCalled();
    expect(
      screen.getByText(/音轨和字幕条件不代表对媒体内容的实测/),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: '规则添加全部满足（AND）' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: '规则添加任一满足（OR）' }),
    );
    expect(change.mock.lastCall?.[0]).toMatchObject({
      op: 'all',
      children: [{ op: 'match' }, { op: 'any', children: [{ op: 'match' }] }],
    });
    fireEvent.click(screen.getByRole('button', { name: '删除规则' }));
    expect(change).toHaveBeenLastCalledWith(undefined);
    expect(screen.getByText(/未设置组合条件/)).toBeTruthy();
  });

  it('edits a nested leaf and removes it without changing its sibling', async () => {
    const change = vi.fn();
    const initial: UpgradeCondition = {
      op: 'all',
      children: [
        resolution,
        {
          op: 'any',
          children: [
            {
              op: 'match',
              field: 'audio_language',
              values: ['en'],
              match: 'equals',
            },
          ],
        },
      ],
    };
    render(<Editor initial={initial} onChange={change} />);
    await choose('规则.2.1字段', '字幕标记');
    expect(change.mock.lastCall?.[0]).toEqual({
      op: 'all',
      children: [
        resolution,
        {
          op: 'any',
          children: [
            { op: 'match', field: 'subtitle', values: [], match: 'equals' },
          ],
        },
      ],
    });
    const input = screen.getByRole('combobox', { name: '规则.2.1匹配值' });
    fireEvent.change(input, { target: { value: 'zh-Hans' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', keyCode: 13 });
    await waitFor(() =>
      expect(change.mock.lastCall?.[0].children[1].children[0].values).toEqual([
        'zh-Hans',
      ]),
    );
    fireEvent.click(screen.getByRole('button', { name: '删除规则.2.1' }));
    expect(change.mock.lastCall?.[0]).toEqual({
      op: 'all',
      children: [resolution, { op: 'any', children: [] }],
    });
    expect(initial.children?.[1].children?.[0].values).toEqual(['en']);
  });

  it('limits NOT to one child and allows replacing that child after removal', () => {
    const change = vi.fn();
    render(
      <Editor
        initial={{ op: 'not', children: [resolution] }}
        onChange={change}
      />,
    );
    const add = screen.getByRole('button', {
      name: '规则添加匹配条件',
    }) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    fireEvent.click(add);
    expect(change).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '删除规则.1' }));
    expect(add.disabled).toBe(false);
    fireEvent.click(
      screen.getByRole('button', { name: '规则添加任一满足（OR）' }),
    );
    expect(change.mock.lastCall?.[0]).toMatchObject({
      op: 'not',
      children: [{ op: 'any', children: [{ op: 'match' }] }],
    });
    expect(add.disabled).toBe(true);
  });

  it('wraps an existing match in a group without discarding its values', async () => {
    const change = vi.fn();
    render(<Editor initial={resolution} onChange={change} />);
    await choose('规则组合方式', '全部满足（AND）');
    expect(change).toHaveBeenLastCalledWith({
      op: 'all',
      children: [resolution],
    });
    fireEvent.click(screen.getByRole('button', { name: '规则添加匹配条件' }));
    expect(change.mock.lastCall?.[0].children).toHaveLength(2);
    expect(change.mock.lastCall?.[0].children[0]).toEqual(resolution);
  });

  it('preserves all children when switching between AND and OR and disallows a lossy NOT conversion', async () => {
    const change = vi.fn();
    const children: UpgradeCondition[] = [
      resolution,
      { op: 'match', field: 'source', values: ['WEB-DL'], match: 'equals' },
    ];
    render(<Editor initial={{ op: 'all', children }} onChange={change} />);
    fireEvent.mouseDown(screen.getByRole('combobox', { name: '规则组合方式' }));
    const notOption = await screen.findByText('不满足（NOT）');
    expect(
      notOption
        .closest('.ant-select-item-option')
        ?.getAttribute('aria-disabled'),
    ).toBe('true');
    fireEvent.click(notOption);
    expect(change).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByText('任一满足（OR）'));
    expect(change).toHaveBeenLastCalledWith({ op: 'any', children });
  });

  it('keeps regex commas and escapes in a single value and supports contains matching', async () => {
    const change = vi.fn();
    render(
      <Editor
        initial={{ op: 'match', field: 'name', values: [], match: 'equals' }}
        onChange={change}
      />,
    );
    await choose('规则匹配方式', '正则表达式');
    const expression = '(?i)S\\d{1,2}E\\d+';
    const input = screen.getByRole('combobox', { name: '规则匹配值' });
    fireEvent.change(input, { target: { value: expression } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', keyCode: 13 });
    await waitFor(() =>
      expect(change).toHaveBeenLastCalledWith({
        op: 'match',
        field: 'name',
        values: [expression],
        match: 'regex',
      }),
    );
    await choose('规则匹配方式', '包含');
    expect(change).toHaveBeenLastCalledWith({
      op: 'match',
      field: 'name',
      values: [expression],
      match: 'contains',
    });
  });

  it('prevents additions past five levels while allowing an existing deeper tree to be edited', async () => {
    const change = vi.fn();
    let initial: UpgradeCondition = resolution;
    for (let level = 0; level < 5; level += 1)
      initial = { op: 'all', children: [initial] };
    render(<Editor initial={initial} onChange={change} />);
    expect(
      (
        screen.getByRole('button', {
          name: '规则.1.1.1.1添加匹配条件',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole('button', {
          name: '规则.1.1.1添加任一满足（OR）',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    await choose('规则.1.1.1.1.1匹配方式', '包含');
    let leaf = change.mock.lastCall?.[0] as UpgradeCondition;
    while (leaf.children?.length) leaf = leaf.children[0];
    expect(leaf).toEqual({ ...resolution, match: 'contains' });
  });

  it('disables every edit and removal control when disabled', () => {
    const change = vi.fn();
    render(
      <Editor
        initial={{ op: 'all', children: [resolution] }}
        disabled
        onChange={change}
      />,
    );
    for (const button of screen.getAllByRole('button'))
      expect((button as HTMLButtonElement).disabled).toBe(true);
    for (const input of screen.getAllByRole('combobox'))
      expect((input as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '删除规则' }));
    expect(change).not.toHaveBeenCalled();
  });
});
