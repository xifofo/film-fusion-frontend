import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { ConfigProvider } from 'antd';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  organize115Cookie,
  selectOrganizeMedianameCandidate,
} from '@/services/film-fusion';
import MedianameCandidatePicker from './MedianameCandidatePicker';
import OrganizeEngineConfirmation from './OrganizeEngineConfirmation';

vi.mock('@/services/film-fusion', () => ({
  organize115Cookie: vi.fn(),
  selectOrganizeMedianameCandidate: vi.fn(),
}));

const candidates: API.MedianameCandidate[] = [
  {
    media_info: {
      tmdb_id: '123',
      type: 'movie',
      title: '同名电影',
      year: 2020,
    },
  },
  {
    media_info: {
      tmdb_id: '123',
      type: 'tv',
      title: '候选剧集',
      year: 2024,
      overview: '用于核对的剧集简介',
    },
    conflicts: [{ field: 'year', expected: '2023', actual: '2024' }],
  },
];
const item: API.Organize115ItemResult = {
  file_id: '101',
  file_name: 'Show.S01E01.mkv',
  engine: 'medianame',
  error: 'medianame: ambiguous',
  medianame: {
    engine: 'medianame',
    package_version: 'v0.1.3',
    result: { status: 'ambiguous', meta_info: {}, candidates },
  },
};
const preview: API.Organize115CookieResult = {
  cloud_directory_id: 2,
  cloud_storage_id: 3,
  folder_id: '100',
  total: 3,
  plan_id: 'old-plan',
  recognition_source: 'medianame',
  dry_run: true,
  pipeline: {
    schema: 1,
    source: 'medianame',
    package_version: 'v0.1.3',
    config_version: 'test',
  },
  groups: [
    {
      folder_id: '100',
      total: 2,
      items: [item, { ...item, file_id: '102', file_name: 'Show.S01E02.mkv' }],
    },
    { folder_id: '200', total: 1, items: [{ ...item, file_id: '201' }] },
  ],
};
const resolved: API.Organize115CookieResult = {
  ...preview,
  plan_id: 'selected-plan',
  groups: [
    {
      folder_id: '100',
      total: 1,
      items: [
        {
          ...item,
          error: '',
          tmdb_id: '123',
          target_path: '/Chosen/S01E01.mkv',
        },
      ],
    },
  ],
};

const renderPicker = (onSelected = vi.fn(), value = preview) =>
  render(
    <ConfigProvider theme={{ token: { motion: false } }}>
      <MedianameCandidatePicker
        item={item}
        preview={value}
        previewTaskId={9}
        onClose={vi.fn()}
        onSelected={onSelected}
      />
    </ConfigProvider>,
  );

describe('Medianame candidate selection', () => {
  beforeEach(() => vi.resetAllMocks());
  afterEach(cleanup);

  it('shows identity and conflicts, then submits only the explicitly chosen file and typed identity', async () => {
    const selected = vi.fn();
    vi.mocked(selectOrganizeMedianameCandidate).mockResolvedValue({
      code: 0,
      message: '',
      data: resolved,
    });
    renderPicker(selected);
    expect(
      (
        screen.getByRole('button', {
          name: '采用候选并重新预览',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(screen.getByText('用于核对的剧集简介')).toBeTruthy();
    expect(screen.getByText(/年份：2023 → 2024/)).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: /候选剧集/ }));
    fireEvent.click(screen.getByRole('button', { name: '采用候选并重新预览' }));
    await waitFor(() => expect(selected).toHaveBeenCalledWith(resolved));
    expect(selectOrganizeMedianameCandidate).toHaveBeenCalledWith(
      {
        plan_id: 'old-plan',
        file_ids: ['101'],
        tmdb_id: '123',
        media_type: 'tv',
        preview_task_id: 9,
      },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(organize115Cookie).not.toHaveBeenCalled();
  });

  it('applies the candidate only to matching files in the same folder when requested', async () => {
    vi.mocked(selectOrganizeMedianameCandidate).mockResolvedValue({
      code: 0,
      message: '',
      data: resolved,
    });
    renderPicker();
    fireEvent.click(screen.getByRole('radio', { name: /候选剧集/ }));
    fireEvent.click(
      screen.getByRole('checkbox', { name: /相同候选的 2 个文件/ }),
    );
    fireEvent.click(screen.getByRole('button', { name: '采用候选并重新预览' }));
    await waitFor(() =>
      expect(selectOrganizeMedianameCandidate).toHaveBeenCalledWith(
        expect.objectContaining({ file_ids: ['101', '102'] }),
        expect.anything(),
      ),
    );
  });

  it('keeps the selection open on failure without replacing the old preview', async () => {
    const selected = vi.fn();
    vi.mocked(selectOrganizeMedianameCandidate).mockRejectedValue(
      new Error('源文件已变化'),
    );
    renderPicker(selected);
    fireEvent.click(screen.getByRole('radio', { name: /候选剧集/ }));
    fireEvent.click(screen.getByRole('button', { name: '采用候选并重新预览' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      '源文件已变化',
    );
    expect(selected).not.toHaveBeenCalled();
  });

  it('ignores a late response after the user leaves the preview', async () => {
    let finish!: (value: API.Response<API.Organize115CookieResult>) => void;
    vi.mocked(selectOrganizeMedianameCandidate).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const selected = vi.fn();
    const view = renderPicker(selected);
    fireEvent.click(screen.getByRole('radio', { name: /候选剧集/ }));
    fireEvent.click(screen.getByRole('button', { name: '采用候选并重新预览' }));
    view.unmount();
    finish({ code: 0, message: '', data: resolved });
    await Promise.resolve();
    expect(selected).not.toHaveBeenCalled();
  });

  it('unblocks confirmation only after selecting a candidate and receiving a valid new plan', async () => {
    const onChange = vi.fn();
    vi.mocked(selectOrganizeMedianameCandidate).mockResolvedValue({
      code: 0,
      message: '',
      data: resolved,
    });
    render(
      <ConfigProvider theme={{ token: { motion: false } }}>
        <OrganizeEngineConfirmation
          params={{
            cloud_directory_id: 2,
            folder_ids: ['100'],
            file_ids: ['101'],
            dry_run: false,
            plan_id: 'old-plan',
            recognition_source: 'medianame',
          }}
          preview={preview}
          onChange={onChange}
        />
      </ConfigProvider>,
    );
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ params: undefined }),
    );
    fireEvent.click(screen.getByRole('button', { name: /选择候选/ }));
    fireEvent.click(screen.getByRole('radio', { name: /候选剧集/ }));
    fireEvent.click(screen.getByRole('button', { name: '采用候选并重新预览' }));
    await screen.findByText('/Chosen/S01E01.mkv');
    expect(onChange).toHaveBeenLastCalledWith({
      source: 'medianame',
      loading: false,
      params: expect.objectContaining({
        plan_id: 'selected-plan',
        file_ids: ['101'],
        dry_run: false,
      }),
    });
    expect(organize115Cookie).not.toHaveBeenCalled();
  });
});
