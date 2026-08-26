import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DirectoryIdInput from './DirectoryIdInput';

vi.mock('@/components/CloudDirectoryPicker', () => ({
  CLOUD_DIRECTORY_ROOT_ID: '0',
  default: ({
    open,
    onSelect,
  }: {
    open: boolean;
    onSelect: (selection: { id: string; name: string; path: string }) => void;
  }) =>
    open ? (
      <button
        onClick={() =>
          onSelect({ id: '90210', name: '动漫', path: '/媒体/动漫' })
        }
        type="button"
      >
        使用测试目录
      </button>
    ) : null,
}));

describe('DirectoryIdInput', () => {
  afterEach(cleanup);

  it('shows a readable path while returning the selected directory id', () => {
    const onChange = vi.fn();
    const onSelectedPathChange = vi.fn();
    render(
      <DirectoryIdInput
        cloudStorageId={115}
        onChange={onChange}
        onSelectedPathChange={onSelectedPathChange}
      />,
    );

    expect(
      (screen.getByRole('textbox', { name: '保存目录' }) as HTMLInputElement)
        .value,
    ).toBe('根目录');
    fireEvent.click(screen.getByRole('button', { name: '选择目录' }));
    fireEvent.click(screen.getByRole('button', { name: '使用测试目录' }));

    expect(onChange).toHaveBeenCalledWith('90210');
    expect(onSelectedPathChange).toHaveBeenCalledWith('/媒体/动漫');
  });
});
