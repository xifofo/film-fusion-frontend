import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import TemplateVariableInput from './TemplateVariableInput';

const references = [
  {
    kind: 'item' as const,
    name: 'title',
    value: '$item.title',
    preview: '名侦探柯南 第 124 集',
  },
  {
    kind: 'variable' as const,
    name: 'episode',
    value: '$vars.episode',
    preview: '124',
  },
  {
    kind: 'node' as const,
    name: 'MP 标题识别 · TMDB ID',
    value: '$nodes.mp.output.tmdb_id',
    dataType: 'string',
    description: '识别到的 TMDB 媒体 ID。',
    preview: '1396',
  },
];

const Harness = ({
  initialValue = '',
  insertMode = 'template',
}: {
  initialValue?: string;
  insertMode?: 'reference' | 'template';
}) => {
  const [value, setValue] = useState(initialValue);
  return (
    <TemplateVariableInput
      ariaLabel="通知内容"
      insertMode={insertMode}
      multiline
      onChange={setValue}
      references={references}
      value={value}
    />
  );
};

describe('TemplateVariableInput', () => {
  afterEach(cleanup);

  it('opens all variables from the visible button without requiring {{', () => {
    render(<Harness initialValue="标题：" />);
    const textarea = screen.getByRole('textbox', { name: '通知内容' });

    fireEvent.click(screen.getByRole('button', { name: '为通知内容插入变量' }));

    expect(
      screen.getByRole('listbox', { name: '模板变量智能提示' }),
    ).toBeTruthy();
    expect(screen.getByText('名侦探柯南 第 124 集')).toBeTruthy();
    fireEvent.mouseDown(screen.getByRole('option', { name: /\$item\.title/ }));

    expect((textarea as HTMLTextAreaElement).value).toBe(
      '标题：{{item.title}}',
    );
    expect(textarea.getAttribute('aria-expanded')).toBe('false');
  });

  it('filters variables as the user types and supports keyboard insertion', () => {
    render(<Harness />);
    const textarea = screen.getByRole('textbox', { name: '通知内容' });

    fireEvent.change(textarea, { target: { value: '{{vars.ep' } });

    expect(
      screen.getByRole('option', { name: /\$vars\.episode/ }),
    ).toBeTruthy();
    expect(screen.queryByRole('option', { name: /\$item\.title/ })).toBeNull();
    fireEvent.keyDown(textarea, { key: 'Enter' });

    expect((textarea as HTMLTextAreaElement).value).toBe('{{vars.episode}}');
    expect(textarea.getAttribute('aria-expanded')).toBe('false');
  });

  it('replaces an existing partial token without leaving old closing braces', () => {
    render(<Harness initialValue="旧：{{item.tit}} 后" />);
    const textarea = screen.getByRole('textbox', {
      name: '通知内容',
    }) as HTMLTextAreaElement;

    textarea.setSelectionRange(12, 12);
    fireEvent.click(textarea);
    fireEvent.mouseDown(screen.getByRole('option', { name: /\$item\.title/ }));

    expect(textarea.value).toBe('旧：{{item.title}} 后');
  });

  it('never consumes later text or a later variable while completing a token', () => {
    render(
      <Harness initialValue="旧：{{item.tit 后面保留 {{vars.episode}} 尾巴" />,
    );
    const textarea = screen.getByRole('textbox', {
      name: '通知内容',
    }) as HTMLTextAreaElement;

    textarea.setSelectionRange(12, 12);
    fireEvent.click(textarea);
    fireEvent.mouseDown(screen.getByRole('option', { name: /\$item\.title/ }));

    expect(textarea.value).toBe(
      '旧：{{item.title}} 后面保留 {{vars.episode}} 尾巴',
    );
  });

  it('inserts at the caret and preserves every character after it', () => {
    render(<Harness initialValue="开头 这些是我后面编辑的内容" />);
    const textarea = screen.getByRole('textbox', {
      name: '通知内容',
    }) as HTMLTextAreaElement;

    textarea.setSelectionRange(3, 3);
    fireEvent.click(textarea);
    fireEvent.click(screen.getByRole('button', { name: '为通知内容插入变量' }));
    fireEvent.mouseDown(screen.getByRole('option', { name: /\$item\.title/ }));

    expect(textarea.value).toBe('开头 {{item.title}}这些是我后面编辑的内容');
  });

  it('uses a plain reference for fields that expect one variable', () => {
    render(<Harness insertMode="reference" />);
    const textarea = screen.getByRole('textbox', { name: '通知内容' });

    fireEvent.click(screen.getByRole('button', { name: '为通知内容插入变量' }));
    fireEvent.mouseDown(screen.getByRole('option', { name: /\$item\.title/ }));

    expect((textarea as HTMLTextAreaElement).value).toBe('$item.title');
  });

  it('shows protocol type and Chinese description for upstream node outputs', () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: '为通知内容插入变量' }));

    expect(
      screen.getByRole('option', {
        name: /\$nodes\.mp\.output\.tmdb_id/,
      }),
    ).toBeTruthy();
    expect(screen.getByText('string')).toBeTruthy();
    expect(screen.getByTitle('识别到的 TMDB 媒体 ID。')).toBeTruthy();
  });
});
