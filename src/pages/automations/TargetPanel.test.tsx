import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AutomationTarget,
  AutomationTargetStatus,
} from '@/services/film-fusion';
import TargetPanel from './TargetPanel';

const { createDownloader } = vi.hoisted(() => ({
  createDownloader: vi.fn(),
}));

vi.mock('@/services/film-fusion', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    createDownloader: (...args: unknown[]) => createDownloader(...args),
  };
});

const apiKey = 'qbt_ABCDEFGHIJKLMNOPQRSTUVWXYZ12';

describe('TargetPanel', () => {
  beforeEach(() => {
    createDownloader.mockResolvedValue({ code: 0, data: {} });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('allows creating a qBittorrent target with only an API Key', async () => {
    const onChanged = vi.fn();
    render(<TargetPanel onChanged={onChanged} targets={[]} />);

    fireEvent.click(screen.getByRole('button', { name: /添加 qBittorrent/ }));
    fireEvent.change(await screen.findByLabelText('账号名称'), {
      target: { value: '家庭 NAS qB' },
    });
    fireEvent.change(screen.getByLabelText('WebUI 地址'), {
      target: { value: 'http://192.168.1.10:8080' },
    });
    fireEvent.change(screen.getByLabelText('API Key（推荐）'), {
      target: { value: apiKey },
    });
    fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }));

    await waitFor(() => {
      expect(createDownloader).toHaveBeenCalledWith({
        enabled: true,
        name: '家庭 NAS qB',
        type: 'qbittorrent',
        config: {
          api_key: apiKey,
          base_url: 'http://192.168.1.10:8080',
          password: '',
          username: '',
        },
      });
    });
    expect(onChanged).toHaveBeenCalled();
  });

  it('shows concise connection status and live speeds in a downloader card', () => {
    const target: AutomationTarget = {
      id: 1,
      name: '新版 qB',
      type: 'qbittorrent',
      enabled: true,
      config_json: JSON.stringify({
        base_url: 'http://qb.example.test',
        username: '',
        password: '',
        api_key: '********',
      }),
      created_at: '2026-08-16T00:00:00Z',
      updated_at: '2026-08-16T00:00:00Z',
    };
    const status: AutomationTargetStatus = {
      target_id: 1,
      enabled: true,
      online: true,
      connection_status: 'connected',
      download_speed: 2 * 1024 * 1024,
      upload_speed: 512 * 1024,
      downloaded_session: 650 * 1024 * 1024,
      uploaded_session: 12 * 1024 * 1024,
      active_torrents: 3,
      dht_nodes: 386,
      checked_at: '2026-08-16T00:00:00Z',
    };

    render(
      <TargetPanel
        onChanged={vi.fn()}
        statuses={[status]}
        targets={[target]}
      />,
    );

    expect(screen.getByText('在线')).toBeTruthy();
    expect(screen.queryByText('在线 · BT 已连接')).toBeNull();
    expect(screen.queryByText('http://qb.example.test')).toBeNull();
    expect(screen.queryByText(/DHT/)).toBeNull();
    expect(screen.getByText('2 MB/s')).toBeTruthy();
    expect(screen.getByText('512 KB/s')).toBeTruthy();
    expect(screen.queryByText('活动任务')).toBeNull();
    expect(screen.queryByText('本次下载')).toBeNull();
    expect(screen.queryByText('本次上传')).toBeNull();
  });
});
