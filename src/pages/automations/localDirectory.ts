import type { NodeFieldReference } from '@/pages/rss-automation/NodeConfigDrawer';
import type {
  AutomationDefinition,
  AutomationScanResult,
  AutomationSource,
  AutomationTriggerType,
  LocalDirectoryConfig,
  LocalDirectoryStatus,
} from '@/services/film-fusion';

export const automationTriggerLabel = (trigger: AutomationTriggerType) =>
  ({
    rss: 'RSS / Atom',
    '115_directory': '115 目录',
    local_directory: '本机 / NAS 目录',
  })[trigger];

export const defaultLocalDirectoryConfig = (): LocalDirectoryConfig => ({
  mode: 'auto',
  events: ['created'],
  item_type: 'file',
  include_extensions: [],
  exclude_patterns: [],
  max_watches: 1024,
  batch_size: 128,
  scan_budget_ms: 2000,
  scan_item_limit: 4096,
  max_pending_runs: 1000,
  history_retention_days: 30,
  history_max_runs: 10000,
  missing_retention_days: 7,
  initial_scan: 'baseline',
});

export const largeLocalDirectoryPreset = () => ({
  interval_seconds: 900,
  quiet_seconds: 60,
  local_config: {
    mode: 'poll' as const,
    max_watches: 1024,
    batch_size: 128,
    scan_budget_ms: 2000,
    scan_item_limit: 4096,
    max_pending_runs: 1000,
    history_retention_days: 30,
    history_max_runs: 10000,
    missing_retention_days: 7,
  },
});

export const localDirectoryPhaseLabel = (phase?: string) =>
  (
    ({
      enumerate: '遍历目录',
      verify: '复核子树',
      aggregate: '汇总目录稳定状态',
      reconcile: '确认消失对象',
      dispatch: '派发稳定事件',
      cleanup: '清理过期记录',
      idle: '等待下一轮',
    }) as Record<string, string>
  )[phase || ''] || '处理中';

export const localDirectoryScanMessage = (
  result: AutomationScanResult,
  initialScan: LocalDirectoryConfig['initial_scan'],
) => {
  const status = result.local_monitor;
  if (status?.in_progress || status?.cycle_completed === false) {
    const progress = `本地目录分段检查完成：本段扫描 ${result.scanned_items} 个对象，${status.pending_directories ?? 0} 个目录待扫描，本轮尚未完成`;
    if (status.backpressured && status.backpressure_reason === 'readers') {
      return `${progress}；等待其他扫描释放目录读取资源后继续`;
    }
    return status.backpressured
      ? `${progress}；${status.backpressure_reason === 'history' ? '历史记录超过保留上限' : `运行积压 ${status.queued_runs ?? 0} 项`}，暂缓派发新运行`
      : progress;
  }
  const inspected = `${status?.cycle_completed ? '本段检查' : '扫描'} ${result.scanned_items} 个对象`;
  if (result.baseline) {
    return initialScan === 'process_existing'
      ? `本地目录首次扫描完成：${inspected}，${result.pending_stable} 个对象等待稳定后进入流程`
      : `本地目录基线建立完成：${inspected}，未触发存量内容`;
  }
  return `${status?.cycle_completed ? '本地目录本轮扫描完成' : '本地目录检查完成'}：${inspected}，创建 ${result.created_runs} 次运行，${result.pending_stable} 个对象等待稳定`;
};

export const readLocalDirectoryConfig = (
  source?: Pick<AutomationSource, 'local_config' | 'local_config_json'>,
): LocalDirectoryConfig => {
  try {
    const config = source?.local_config_json
      ? JSON.parse(source.local_config_json)
      : structuredClone(source?.local_config);
    if (config != null && (typeof config !== 'object' || Array.isArray(config)))
      throw new Error('Invalid config');
    const normalized = {
      ...defaultLocalDirectoryConfig(),
      ...config,
    } as LocalDirectoryConfig;
    if (
      !['auto', 'poll'].includes(normalized.mode) ||
      !['file', 'directory', 'all'].includes(normalized.item_type) ||
      !['baseline', 'process_existing'].includes(normalized.initial_scan) ||
      !Array.isArray(normalized.events) ||
      !normalized.events.length ||
      normalized.events.some(
        (event) => !['created', 'modified'].includes(event),
      ) ||
      !Array.isArray(normalized.include_extensions) ||
      normalized.include_extensions.some(
        (value) => typeof value !== 'string',
      ) ||
      !Array.isArray(normalized.exclude_patterns) ||
      normalized.exclude_patterns.some((value) => typeof value !== 'string')
    )
      throw new Error('Invalid config');
    return normalized;
  } catch {
    throw new Error('本地目录配置无法读取，请修复原配置后再编辑或复制');
  }
};

export const readLocalDirectoryStatus = (
  raw?: string,
): LocalDirectoryStatus | undefined => {
  try {
    const status = JSON.parse(raw || '') as LocalDirectoryStatus;
    return typeof status?.watched_directories === 'number' ? status : undefined;
  } catch {
    return undefined;
  }
};

export const localDirectoryDefinition = (): AutomationDefinition => ({
  schema_version: 1,
  nodes: [
    {
      id: 'trigger',
      type: 'trigger',
      name: '目录内容变化',
      position: { x: 80, y: 200 },
      config: {},
    },
    {
      id: 'notification',
      type: 'notification',
      name: '发送通知',
      position: { x: 400, y: 200 },
      config: {
        title: '目录内容变化',
        message: '{{item.event_type}}：{{item.path}}',
      },
    },
    {
      id: 'end',
      type: 'end',
      name: '结束',
      position: { x: 720, y: 200 },
      config: {},
    },
  ],
  edges: [
    {
      id: 'trigger-notification',
      source: 'trigger',
      source_port: 'next',
      target: 'notification',
    },
    {
      id: 'notification-end',
      source: 'notification',
      source_port: 'success',
      target: 'end',
    },
  ],
});

const localFields: Array<[string, string, NodeFieldReference['dataType']]> = [
  ['event_id', '稳定的事件标识，可用于 HTTP 接收端幂等处理', 'string'],
  ['event_type', '事件类型：created（新增）或 modified（修改）', 'string'],
  ['path', '文件或目录的绝对路径', 'string'],
  ['relative_path', '相对监控根目录的路径', 'string'],
  ['root_path', '监控根目录的绝对路径', 'string'],
  ['name', '文件或目录名称', 'string'],
  ['title', '文件或目录名称，可用于标题识别', 'string'],
  ['is_directory', '是否为目录', 'boolean'],
  ['size', '文件大小（字节）', 'integer'],
  ['modified_at', '最后修改时间', 'datetime'],
];

export const localDirectoryReferences: NodeFieldReference[] = localFields.map(
  ([name, description, dataType]) => ({
    kind: 'item',
    name,
    value: `$item.${name}`,
    description,
    dataType,
  }),
);

export const localDirectoryExample = (root: string) => ({
  title: '本地目录事件示例（仅模拟，不读取磁盘）',
  items: [
    {
      fields: {
        event_id: 'local-example-event-001',
        event_type: 'created',
        path: `${root.replace(/\/$/, '')}/Example.Movie.2026.mkv`,
        relative_path: 'Example.Movie.2026.mkv',
        root_path: root,
        name: 'Example.Movie.2026.mkv',
        title: 'Example.Movie.2026.mkv',
        is_directory: false,
        size: 1048576,
        modified_at: '2026-01-01T00:00:00Z',
      },
    },
  ],
});
