import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { App, ConfigProvider } from 'antd';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/lib/api-client';
import MedianameWorkbench, { PipelineDiagnostics } from './MedianameWorkbench';

vi.mock('@/lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));
const config = {
  category_yaml: 'movie:\n  Movie:\ntv:\n  TV:\n',
  movie_template: '{{.title}}/{{.title}}{{.fileExt}}',
  tv_template: '{{.title}}/{{.season_episode}}{{.fileExt}}',
  version: 'v0.1.1',
};
describe('medianame isolated workbench', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(apiClient.get).mockResolvedValue({
      code: 0,
      data: {
        config,
        package_version: 'v0.1.1',
        movie_variables: { title: 'Example' },
        tv_variables: { season: 0, season_episode: 'S00E01' },
      },
    });
    vi.mocked(apiClient.put).mockResolvedValue({ code: 0, data: config });
  });
  afterEach(cleanup);
  it('saves Go drafts only to the medianame endpoint', async () => {
    render(
      <App>
        <ConfigProvider theme={{ token: { motion: false } }}>
          <MedianameWorkbench />
        </ConfigProvider>
      </App>,
    );
    const movie = await screen.findByLabelText('medianame 电影模板');
    fireEvent.change(movie, {
      target: { value: '{{.title_year}}/{{.original_name}}' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: '保存 medianame 配置' }),
    );
    await waitFor(() =>
      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/media-recognition/medianame-config',
        { ...config, movie_template: '{{.title_year}}/{{.original_name}}' },
      ),
    );
    expect(apiClient.put).toHaveBeenCalledOnce();
  });
  it('uses selected engine and its independent draft for full-path shadow preview', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      code: 0,
      data: {
        pipeline: {
          schema: 1,
          source: 'shadow',
          package_version: 'v0.1.1',
          config_version: 'snapshot',
        },
        item: {
          engine: 'moviepilot',
          target_path: '/MP2/Example.mkv',
          shadow_comparison: {
            medianame: {
              target_path: '/NEW/Example.mkv',
              medianame: {
                result: {
                  status: 'review',
                  candidates: [
                    { conflicts: [{ field: 'tmdb_id', message: 'conflict' }] },
                  ],
                },
              },
            },
          },
        },
      },
    });
    render(
      <App>
        <MedianameWorkbench />
      </App>,
    );
    await screen.findByLabelText('medianame 分类规则');
    fireEvent.click(screen.getByText('影子对比'));
    fireEvent.click(screen.getByRole('button', { name: '预览完整流程' }));
    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/media-recognition/pipeline-test',
        expect.objectContaining({
          source: 'shadow',
          mode: 'file',
          medianame_config: config,
          classify: true,
        }),
      ),
    );
    expect((await screen.findByRole('status')).textContent).toContain('review');
    expect(screen.getByText('/MP2/Example.mkv')).toBeTruthy();
    expect(screen.getByText('/NEW/Example.mkv')).toBeTruthy();
    const table = within(screen.getByRole('table'));
    expect(
      table.getAllByRole('columnheader').map((cell) => cell.textContent),
    ).toEqual(['字段', 'medianame', 'MP2 / 对照']);
    expect(
      within(table.getByRole('row', { name: /完整目标路径/ }))
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['/NEW/Example.mkv', '/MP2/Example.mkv']);
    expect(apiClient.put).not.toHaveBeenCalled();
  });
  it('defaults the read-only full-flow test to medianame without saving an engine setting', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      code: 1,
      message: '测试诊断',
    });
    render(
      <App>
        <MedianameWorkbench />
      </App>,
    );
    await screen.findByLabelText('medianame 分类规则');
    expect(
      (
        screen.getByRole('radio', {
          name: 'medianame',
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '预览完整流程' }));
    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/media-recognition/pipeline-test',
        expect.objectContaining({ source: 'medianame' }),
      ),
    );
    expect(apiClient.put).not.toHaveBeenCalled();
  });
  it('shows request errors with their original diagnostic and no claimed path', () => {
    render(
      <PipelineDiagnostics
        item={{
          file_id: '1',
          file_name: 'unknown.mkv',
          target_path: '',
          error: 'TMDB HTTP 503',
          medianame: {
            engine: 'medianame',
            package_version: 'v0.1.1',
            result: {
              status: 'request_error',
              meta_info: { ids: { tmdb: '123' } },
            },
          },
        }}
      />,
    );
    expect(screen.getByRole('status').textContent).toContain('request_error');
    expect(screen.getByText('TMDB HTTP 503')).toBeTruthy();
  });
});
