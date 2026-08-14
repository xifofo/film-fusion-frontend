import type {
  RSSAutomationDefinition,
  RSSAutomationEdgeDefinition,
  RSSAutomationNodeDefinition,
  RSSAutomationNodeType,
} from '@/services/film-fusion';

export const RSS_WORKFLOW_TRANSFER_FORMAT = 'film-fusion-rss-workflow';
export const RSS_WORKFLOW_TRANSFER_VERSION = 1;
export const RSS_WORKFLOW_TRANSFER_MAX_BYTES = 1024 * 1024;

const nodeTypes: RSSAutomationNodeType[] = [
  'trigger',
  'regex',
  'keyword',
  'convert',
  'if',
  'parallel',
  'join',
  'qbittorrent',
  'wait_qbittorrent',
  'offline115',
  'offline115_openapi',
  'wait115',
  'moviepilot_title_recognize',
  'media_exists',
  'hdhive_query',
  'hdhive_unlock',
  'moviepilot_recognize',
  'organize_strm',
  'strm_verify',
  'strm_regenerate',
  'emby_refresh_wait',
  'http_request',
  'notification',
  'end',
];
const nodeTypeSet = new Set<string>(nodeTypes);

type WorkflowTransferPackage = {
  format: typeof RSS_WORKFLOW_TRANSFER_FORMAT;
  format_version: typeof RSS_WORKFLOW_TRANSFER_VERSION;
  exported_at: string;
  name: string;
  definition: RSSAutomationDefinition;
  removed_bindings: WorkflowRemovedBindings;
};

export type WorkflowRemovedBindings = {
  qbittorrent_targets: number;
  offline115_accounts: number;
  offline115_openapi_accounts: number;
  offline115_directories: number;
  organize_directories: number;
};

export type WorkflowImportRequirements = {
  qbittorrentTargets: number;
  offline115Accounts: number;
  offline115OpenAPIAccounts: number;
  directorySelections: number;
  organizeDirectories: number;
};

export type ParsedWorkflowTransfer = {
  name: string;
  definition: RSSAutomationDefinition;
  requirements: WorkflowImportRequirements;
  source: 'workflow-package' | 'bare-definition';
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const requiredString = (value: unknown, label: string) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label}不能为空`);
  }
  if (value.length > 200) throw new Error(`${label}过长`);
  return value;
};

const optionalRecord = (value: unknown, label: string) => {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new Error(`${label}格式不正确`);
  return structuredClone(value);
};

const parseNode = (value: unknown): RSSAutomationNodeDefinition => {
  if (!isRecord(value)) throw new Error('流程节点格式不正确');
  const id = requiredString(value.id, '节点 ID');
  const type = requiredString(value.type, `节点 ${id} 类型`);
  if (!nodeTypeSet.has(type)) throw new Error(`节点 ${id} 使用了未知类型`);
  if (!isRecord(value.position)) throw new Error(`节点 ${id} 缺少画板位置`);
  const x = Number(value.position.x);
  const y = Number(value.position.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`节点 ${id} 的画板位置无效`);
  }

  const node: RSSAutomationNodeDefinition = {
    id,
    type: type as RSSAutomationNodeType,
    position: { x, y },
  };
  if (typeof value.name === 'string') node.name = value.name.slice(0, 120);
  const config = optionalRecord(value.config, `节点 ${id} 配置`);
  if (config) node.config = config;
  const ui = optionalRecord(value.ui, `节点 ${id} 界面配置`);
  if (ui) node.ui = ui;
  if (value.max_attempts !== undefined) {
    const attempts = Number(value.max_attempts);
    if (!Number.isInteger(attempts) || attempts < 1 || attempts > 100) {
      throw new Error(`节点 ${id} 的尝试次数无效`);
    }
    node.max_attempts = attempts;
  }
  return node;
};

const parseEdge = (
  value: unknown,
  nodeIDs: Set<string>,
): RSSAutomationEdgeDefinition => {
  if (!isRecord(value)) throw new Error('流程连线格式不正确');
  const id = requiredString(value.id, '连线 ID');
  const source = requiredString(value.source, `连线 ${id} 起点`);
  const target = requiredString(value.target, `连线 ${id} 终点`);
  const sourcePort = requiredString(value.source_port, `连线 ${id} 出口`);
  if (!nodeIDs.has(source) || !nodeIDs.has(target)) {
    throw new Error(`连线 ${id} 指向不存在的节点`);
  }
  if (source === target) throw new Error(`连线 ${id} 不能连接节点自身`);
  return {
    id,
    source,
    source_port: sourcePort,
    target,
    ...(typeof value.target_port === 'string' && value.target_port
      ? { target_port: value.target_port }
      : {}),
  };
};

export const validateWorkflowTransferDefinition = (
  value: unknown,
): RSSAutomationDefinition => {
  if (!isRecord(value) || value.schema_version !== 1) {
    throw new Error('不是受支持的 RSS 流程定义');
  }
  if (!Array.isArray(value.nodes) || value.nodes.length === 0) {
    throw new Error('流程至少需要一个节点');
  }
  if (value.nodes.length > 200) throw new Error('流程节点不能超过 200 个');
  if (!Array.isArray(value.edges)) throw new Error('流程缺少连线列表');
  if (value.edges.length > 500) throw new Error('流程连线不能超过 500 条');

  const nodes = value.nodes.map(parseNode);
  const nodeIDs = new Set(nodes.map((node) => node.id));
  if (nodeIDs.size !== nodes.length) throw new Error('流程中存在重复节点 ID');
  if (nodes.filter((node) => node.type === 'trigger').length !== 1) {
    throw new Error('流程必须包含且只能包含一个 RSS 触发器');
  }
  if (!nodes.some((node) => node.type === 'end')) {
    throw new Error('流程至少需要一个结束节点');
  }

  const edges = value.edges.map((edge) => parseEdge(edge, nodeIDs));
  const edgeIDs = new Set(edges.map((edge) => edge.id));
  if (edgeIDs.size !== edges.length) throw new Error('流程中存在重复连线 ID');

  let viewport: RSSAutomationDefinition['viewport'];
  if (value.viewport !== undefined) {
    if (!isRecord(value.viewport)) throw new Error('画板视口格式不正确');
    const x = Number(value.viewport.x);
    const y = Number(value.viewport.y);
    const zoom = Number(value.viewport.zoom);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !(zoom > 0)) {
      throw new Error('画板视口无效');
    }
    viewport = { x, y, zoom };
  }

  return {
    schema_version: 1,
    nodes,
    edges,
    ...(viewport ? { viewport } : {}),
  };
};

const makePortable = (definition: RSSAutomationDefinition) => {
  const portable = validateWorkflowTransferDefinition(definition);
  const removed: WorkflowRemovedBindings = {
    qbittorrent_targets: 0,
    offline115_accounts: 0,
    offline115_openapi_accounts: 0,
    offline115_directories: 0,
    organize_directories: 0,
  };

  portable.nodes = portable.nodes.map((node) => {
    const config = { ...(node.config || {}) };
    const ui = { ...(node.ui || {}) };
    if (node.type === 'qbittorrent' && 'target_id' in config) {
      removed.qbittorrent_targets += 1;
      delete config.target_id;
    }
    if (node.type === 'offline115' || node.type === 'offline115_openapi') {
      if ('cloud_storage_id' in config) {
        if (node.type === 'offline115_openapi') {
          removed.offline115_openapi_accounts += 1;
        } else {
          removed.offline115_accounts += 1;
        }
        delete config.cloud_storage_id;
      }
      if ('directory_id' in config) {
        removed.offline115_directories += 1;
        delete config.directory_id;
      }
      delete ui.directory_path;
    }
    if (
      [
        'organize_strm',
        'media_exists',
        'strm_verify',
        'strm_regenerate',
      ].includes(node.type) &&
      Number(config.cloud_directory_id || 0) > 0
    ) {
      removed.organize_directories += 1;
      delete config.cloud_directory_id;
    }
    return {
      ...node,
      config,
      ...(Object.keys(ui).length > 0 ? { ui } : { ui: undefined }),
    };
  });
  return { definition: portable, removed };
};

export const getWorkflowImportRequirements = (
  definition: RSSAutomationDefinition,
): WorkflowImportRequirements => ({
  qbittorrentTargets: definition.nodes.filter(
    (node) => node.type === 'qbittorrent',
  ).length,
  offline115Accounts: definition.nodes.filter(
    (node) => node.type === 'offline115',
  ).length,
  offline115OpenAPIAccounts: definition.nodes.filter(
    (node) => node.type === 'offline115_openapi',
  ).length,
  directorySelections: definition.nodes.filter(
    (node) =>
      (node.type === 'offline115' || node.type === 'offline115_openapi') &&
      (node.config?.directory_id !== undefined || node.ui?.directory_path),
  ).length,
  organizeDirectories: definition.nodes.filter(
    (node) =>
      [
        'organize_strm',
        'media_exists',
        'strm_verify',
        'strm_regenerate',
      ].includes(node.type) && node.config?.cloud_directory_id !== undefined,
  ).length,
});

export const createWorkflowTransferPackage = (
  definition: RSSAutomationDefinition,
  name: string,
): WorkflowTransferPackage => {
  const portable = makePortable(definition);
  return {
    format: RSS_WORKFLOW_TRANSFER_FORMAT,
    format_version: RSS_WORKFLOW_TRANSFER_VERSION,
    exported_at: new Date().toISOString(),
    name: name.trim() || 'RSS 自动化流程',
    definition: portable.definition,
    removed_bindings: portable.removed,
  };
};

export const parseWorkflowTransferText = (
  text: string,
): ParsedWorkflowTransfer => {
  if (new Blob([text]).size > RSS_WORKFLOW_TRANSFER_MAX_BYTES) {
    throw new Error('流程文件不能超过 1 MB');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('流程文件不是有效的 JSON');
  }

  let name = '导入的 RSS 流程';
  let definitionValue: unknown = parsed;
  let source: ParsedWorkflowTransfer['source'] = 'bare-definition';
  let exportedDirectorySelections = 0;
  let exportedOrganizeDirectories = 0;
  if (isRecord(parsed) && parsed.format === RSS_WORKFLOW_TRANSFER_FORMAT) {
    if (parsed.format_version !== RSS_WORKFLOW_TRANSFER_VERSION) {
      throw new Error('流程文件版本不受支持，请升级 Film Fusion');
    }
    name =
      typeof parsed.name === 'string' && parsed.name.trim()
        ? parsed.name.trim()
        : name;
    definitionValue = parsed.definition;
    source = 'workflow-package';
    if (isRecord(parsed.removed_bindings)) {
      exportedDirectorySelections = Math.max(
        0,
        Number(parsed.removed_bindings.offline115_directories) || 0,
      );
      exportedOrganizeDirectories = Math.max(
        0,
        Number(parsed.removed_bindings.organize_directories) || 0,
      );
    }
  }

  const validated = validateWorkflowTransferDefinition(definitionValue);
  const requirements = getWorkflowImportRequirements(validated);
  requirements.directorySelections = Math.max(
    requirements.directorySelections,
    exportedDirectorySelections,
  );
  requirements.organizeDirectories = Math.max(
    requirements.organizeDirectories,
    exportedOrganizeDirectories,
  );
  const portable = makePortable(validated).definition;
  return {
    name,
    definition: portable,
    requirements,
    source,
  };
};

export const workflowTransferFileName = (name: string) => {
  const safeName = name
    .normalize('NFKC')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return `${safeName || 'rss-workflow'}.rssflow.json`;
};
