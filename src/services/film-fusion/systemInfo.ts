import { apiClient } from '@/lib/api-client';

export type SystemHostInfo = {
  hostname: string;
  os: string;
  platform: string;
  platform_version: string;
  kernel_version: string;
  architecture: string;
  virtualization_system?: string;
  virtualization_role?: string;
  uptime_seconds: number;
  boot_time: number;
  process_count: number;
};

export type SystemCPUInfo = {
  model_name: string;
  logical_cores: number;
  physical_cores: number;
  usage_percent: number;
  load_1: number;
  load_5: number;
  load_15: number;
};

export type SystemMemoryInfo = {
  total: number;
  used: number;
  available: number;
  usage_percent: number;
};

export type SystemDiskInfo = {
  path: string;
  total: number;
  used: number;
  available: number;
  usage_percent: number;
};

export type SystemProcessInfo = {
  pid: number;
  cpu_usage_percent: number;
  memory_rss: number;
  memory_usage_percent: number;
  go_heap_alloc: number;
  goroutines: number;
  threads: number;
  uptime_seconds: number;
  go_version: string;
};

export type SystemInfo = {
  collected_at: string;
  host: SystemHostInfo;
  cpu: SystemCPUInfo;
  memory: SystemMemoryInfo;
  disk: SystemDiskInfo;
  process: SystemProcessInfo;
  warnings?: string[];
};

export async function getSystemInfo() {
  return apiClient.get<API.Response<SystemInfo>>('/api/system-info', {
    headers: { 'Cache-Control': 'no-cache' },
  });
}
