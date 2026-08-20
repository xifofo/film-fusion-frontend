import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { App } from 'antd';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSystemInfo, type SystemInfo } from '@/services/film-fusion';
import SystemInfoPage, { formatBytes, formatDuration } from './index';

vi.mock('@/services/film-fusion', () => ({
  getSystemInfo: vi.fn(),
}));

const snapshot: SystemInfo = {
  collected_at: '2026-08-19T04:34:56Z',
  host: {
    hostname: 'film-fusion-host',
    os: 'linux',
    platform: 'ubuntu',
    platform_version: '24.04',
    kernel_version: '6.8.0',
    architecture: 'x86_64',
    virtualization_system: 'docker',
    virtualization_role: 'guest',
    uptime_seconds: 176400,
    boot_time: 1786939200,
    process_count: 128,
  },
  cpu: {
    model_name: 'Example 8-Core CPU',
    logical_cores: 8,
    physical_cores: 4,
    usage_percent: 37.5,
    load_1: 0.72,
    load_5: 0.64,
    load_15: 0.55,
  },
  memory: {
    total: 16 * 1024 ** 3,
    used: 8 * 1024 ** 3,
    available: 8 * 1024 ** 3,
    usage_percent: 50,
  },
  disk: {
    path: '/app',
    total: 512 * 1024 ** 3,
    used: 128 * 1024 ** 3,
    available: 384 * 1024 ** 3,
    usage_percent: 25,
  },
  process: {
    pid: 42,
    cpu_usage_percent: 3.2,
    memory_rss: 256 * 1024 ** 2,
    memory_usage_percent: 1.6,
    go_heap_alloc: 96 * 1024 ** 2,
    goroutines: 48,
    threads: 12,
    uptime_seconds: 7320,
    go_version: 'go1.26.5',
  },
};

describe('SystemInfoPage', () => {
  const getSystemInfoMock = vi.mocked(getSystemInfo);

  beforeEach(() => {
    getSystemInfoMock.mockResolvedValue({
      code: 0,
      message: '获取系统信息成功',
      data: snapshot,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders live CPU, memory, disk, and process metrics', async () => {
    render(
      <App>
        <SystemInfoPage />
      </App>,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: '系统信息' }),
    ).toBeTruthy();
    expect(screen.getByText('System monitor')).toBeTruthy();
    expect(await screen.findByText('37.5')).toBeTruthy();
    expect(screen.getByText('Example 8-Core CPU')).toBeTruthy();
    expect(screen.getByText('8 GB')).toBeTruthy();
    expect(screen.getByText('128 GB')).toBeTruthy();
    expect(screen.getByText('256 MB')).toBeTruthy();
    expect(screen.getByText('film-fusion-host')).toBeTruthy();
    expect(screen.getByText('go1.26.5')).toBeTruthy();
  });

  it('allows an immediate manual refresh', async () => {
    render(
      <App>
        <SystemInfoPage />
      </App>,
    );
    await screen.findByText('Example 8-Core CPU');
    expect(getSystemInfoMock).toHaveBeenCalledTimes(1);

    const refreshButton = screen.getByRole('button', {
      name: '刷新系统信息',
    });
    await waitFor(() =>
      expect(refreshButton.classList.contains('ant-btn-loading')).toBe(false),
    );
    fireEvent.click(refreshButton);
    await waitFor(() => expect(getSystemInfoMock).toHaveBeenCalledTimes(2));
  });
});

describe('system info formatters', () => {
  it('formats binary byte values and durations for display', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(8 * 1024 ** 3)).toBe('8 GB');
    expect(formatDuration(176400)).toBe('2 天 1 小时');
    expect(formatDuration(42)).toBe('42 秒');
  });
});
