import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { App } from 'antd';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getMediaRecognitionRenameConfig,
  type MediaRecognitionRenameConfigResult,
  previewMediaRecognitionRenameTemplate,
  saveMediaRecognitionRenameConfig,
  validateMediaRecognitionRenameTemplate,
} from '@/services/film-fusion';
import RenameConfigSection from './RenameConfigSection';

vi.mock('@/services/film-fusion', () => ({
  getMediaRecognitionRenameConfig: vi.fn(),
  previewMediaRecognitionRenameTemplate: vi.fn(),
  saveMediaRecognitionRenameConfig: vi.fn(),
  validateMediaRecognitionRenameTemplate: vi.fn(),
}));

const config: MediaRecognitionRenameConfigResult = {
  configured: false,
  active: false,
  movie_format: '{{title}}/{{title}}{{fileExt}}',
  tv_format: '{{title}}/Season {{season}}/{{season_episode}}{{fileExt}}',
  default_movie_format: '{{title}}/{{title}}{{fileExt}}',
  default_tv_format:
    '{{title}}/Season {{season}}/{{season_episode}}{{fileExt}}',
  common_variables: [
    {
      name: 'title',
      label: '标题',
      description: '媒体标题',
      example: '流浪地球',
    },
    {
      name: 'year',
      label: '年份',
      description: '上映年份',
      example: 2019,
    },
    {
      name: 'fileExt',
      label: '扩展名',
      description: '包含点号的文件扩展名',
      example: '.mkv',
    },
  ],
  tv_variables: [
    {
      name: 'season',
      label: '季号',
      description: '季号数字',
      example: 1,
    },
    {
      name: 'season_episode',
      label: '季集',
      description: '格式化季集',
      example: 'S01E02',
    },
  ],
  load_errors: [],
};

describe('RenameConfigSection', () => {
  const getConfigMock = vi.mocked(getMediaRecognitionRenameConfig);
  const previewTemplateMock = vi.mocked(previewMediaRecognitionRenameTemplate);
  const saveConfigMock = vi.mocked(saveMediaRecognitionRenameConfig);
  const validateTemplateMock = vi.mocked(
    validateMediaRecognitionRenameTemplate,
  );

  beforeEach(() => {
    getConfigMock.mockResolvedValue({ code: 0, message: 'ok', data: config });
    previewTemplateMock.mockResolvedValue({
      code: 0,
      message: 'ok',
      data: {
        path: '流浪地球/流浪地球.mkv',
        template: '{{title}}/草稿-{{title}}{{fileExt}}',
        variables: { title: '流浪地球', year: 2019, fileExt: '.mkv' },
        warnings: [],
      },
    });
    saveConfigMock.mockResolvedValue({
      code: 0,
      message: 'ok',
      data: { ...config, configured: true, active: true },
    });
    validateTemplateMock.mockResolvedValue({
      code: 0,
      message: 'ok',
      data: { valid: true, errors: [], warnings: [], variables: ['title'] },
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('previews the unsaved movie template with a filled example', async () => {
    render(
      <App>
        <RenameConfigSection />
      </App>,
    );

    expect(await screen.findByText('尚未保存 · 沿用兼容命名')).toBeTruthy();
    const editor = screen.getByRole('textbox', {
      name: '电影重命名格式',
    });
    fireEvent.change(editor, {
      target: { value: '{{title}}/草稿-{{title}}{{fileExt}}' },
    });
    fireEvent.click(screen.getByRole('button', { name: /填入示例/ }));

    await waitFor(() => {
      expect(previewTemplateMock).toHaveBeenCalledWith({
        media_type: 'movie',
        template: '{{title}}/草稿-{{title}}{{fileExt}}',
        sample: { title: '流浪地球', year: 2019, fileExt: '.mkv' },
      });
    });
    expect(await screen.findByText('流浪地球/流浪地球.mkv')).toBeTruthy();
  });

  it('renders a successful backend preview whose warnings field is null', async () => {
    previewTemplateMock.mockResolvedValueOnce({
      code: 0,
      message: 'ok',
      data: {
        path: '流浪地球/流浪地球.mkv',
        template: config.movie_format,
        variables: { title: '流浪地球' },
        warnings: null,
      } as unknown as Awaited<
        ReturnType<typeof previewMediaRecognitionRenameTemplate>
      >['data'],
    });
    render(
      <App>
        <RenameConfigSection />
      </App>,
    );

    await screen.findByText('尚未保存 · 沿用兼容命名');

    expect(await screen.findByText('流浪地球/流浪地球.mkv')).toBeTruthy();
  });

  it('keeps variable insertion in the editor dropdown without a duplicate list', async () => {
    render(
      <App>
        <RenameConfigSection />
      </App>,
    );

    await screen.findByText('尚未保存 · 沿用兼容命名');
    const editor = screen.getByRole('textbox', {
      name: '电影重命名格式',
    }) as HTMLTextAreaElement;
    expect(screen.queryByText('选择变量插入')).toBeNull();
    editor.setSelectionRange(10, 10);
    fireEvent.select(editor);
    fireEvent.mouseDown(
      screen.getByRole('combobox', {
        name: '选择要插入的模板变量',
      }),
    );
    fireEvent.click(await screen.findByText('年份 · {{year}}'));

    expect(editor.value).toBe('{{title}}/{{year}}{{title}}{{fileExt}}');
    await waitFor(() => {
      expect(previewTemplateMock).toHaveBeenCalledWith({
        media_type: 'movie',
        template: '{{title}}/{{year}}{{title}}{{fileExt}}',
      });
    });
  });

  it('allows the displayed defaults to be saved once to activate the feature', async () => {
    render(
      <App>
        <RenameConfigSection />
      </App>,
    );

    await screen.findByText('尚未保存 · 沿用兼容命名');
    fireEvent.click(screen.getByRole('button', { name: /保存并立即生效/ }));

    await waitFor(() => {
      expect(saveConfigMock).toHaveBeenCalledWith({
        movie_format: config.movie_format,
        tv_format: config.tv_format,
      });
    });
  });

  it('switches to and persistently displays the template that blocked saving', async () => {
    saveConfigMock.mockRejectedValueOnce({
      response: {
        data: {
          message: '电视剧重命名格式无效',
          data: {
            media_type: 'tv',
            validation: {
              valid: false,
              errors: ['路径包含目录穿越'],
              warnings: [],
              variables: ['title'],
            },
          },
        },
      },
    });
    render(
      <App>
        <RenameConfigSection />
      </App>,
    );

    await screen.findByText('尚未保存 · 沿用兼容命名');
    fireEvent.click(screen.getByRole('button', { name: /保存并立即生效/ }));

    expect(await screen.findByText('路径包含目录穿越')).toBeTruthy();
    expect(
      screen.getByRole('textbox', { name: '电视剧重命名格式' }),
    ).toBeTruthy();
  });

  it('does not show an obsolete preview after changing template type', async () => {
    let resolvePreview:
      | ((
          value: Awaited<
            ReturnType<typeof previewMediaRecognitionRenameTemplate>
          >,
        ) => void)
      | undefined;
    previewTemplateMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePreview = resolve;
        }),
    );
    render(
      <App>
        <RenameConfigSection />
      </App>,
    );

    await screen.findByText('尚未保存 · 沿用兼容命名');
    fireEvent.click(screen.getByRole('button', { name: '立即刷新实时预览' }));
    fireEvent.click(screen.getByText('电视剧模板'));
    await act(async () => {
      resolvePreview?.({
        code: 0,
        message: 'ok',
        data: {
          path: '过期电影预览.mkv',
          template: config.movie_format,
          variables: {},
          warnings: [],
        },
      });
    });

    expect(screen.queryByText('过期电影预览.mkv')).toBeNull();
  });
});
