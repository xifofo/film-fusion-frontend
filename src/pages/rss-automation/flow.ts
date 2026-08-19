import { type Edge, MarkerType, type Node } from '@xyflow/react';
import type {
  RSSAutomationDefinition,
  RSSAutomationEdgeDefinition,
  RSSAutomationNodeDefinition,
  RSSAutomationNodeType,
} from '@/services/film-fusion';
import type { RSSAutomationNodePreview } from './preview';

export type RSSFlowNodeData = Record<string, unknown> & {
  definition: RSSAutomationNodeDefinition;
  status?: string;
  preview?: RSSAutomationNodePreview;
};

export type RSSFlowNode = Node<RSSFlowNodeData, 'rssAutomationNode'>;
export type RSSFlowEdge = Edge;

export const NODE_LABELS: Record<RSSAutomationNodeType, string> = {
  trigger: 'RSS 触发器',
  regex: '正则提取',
  keyword: '关键词匹配',
  convert: '类型转换',
  if: 'IF 条件',
  parallel: '并行分支',
  join: '汇合',
  qbittorrent: 'qBittorrent',
  wait_qbittorrent: '等待 qBittorrent 完成',
  moviepilot_transfer: 'MP2 整理入库',
  delete_qbittorrent: '删除 qB 做种任务',
  offline115: '115 Cookie 离线',
  offline115_openapi: '115 OpenAPI 离线',
  wait115: '等待 115 下载完成',
  moviepilot_title_recognize: 'MP 标题识别',
  filmfusion_recognize: 'FilmFusion 本地识别',
  media_exists: '本地 / Emby 查重',
  hdhive_query: 'HDHive 资源查询',
  hdhive_unlock: 'HDHive 资源解锁',
  moviepilot_recognize: 'MP 媒体识别',
  organize_strm: '整理生成 STRM',
  strm_verify: 'STRM 校验',
  strm_regenerate: 'STRM 重生成',
  emby_refresh_wait: 'Emby 刷新并等待入库',
  http_request: 'HTTP / Webhook',
  notification: '发送通知',
  end: '结束',
};

export const ACTION_NODE_TYPES: RSSAutomationNodeType[] = [
  'qbittorrent',
  'wait_qbittorrent',
  'moviepilot_transfer',
  'delete_qbittorrent',
  'offline115',
  'offline115_openapi',
  'wait115',
  'moviepilot_title_recognize',
  'filmfusion_recognize',
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
];

export const PORT_LABELS: Record<string, string> = {
  next: '继续',
  success: '成功',
  failure: '失败',
  matched: '匹配',
  unmatched: '不匹配',
  true: '是',
  false: '否',
  exists: '已存在',
  missing: '不存在',
  found: '找到资源',
  not_found: '没有资源',
  valid: '有效',
  invalid: '无效',
  always: '总是',
};

export const joinHasConditionalOutcome = (
  definition?: RSSAutomationNodeDefinition,
) =>
  definition?.type === 'join' &&
  ['all_success', 'any_success'].includes(
    String(definition.config?.policy || 'all_completed'),
  );

export const sourcePortLabel = (
  port: string,
  source?: RSSAutomationNodeDefinition,
) => {
  if (source?.type === 'join') {
    if (port === 'failure') return '未满足';
    return joinHasConditionalOutcome(source) ? '满足' : '继续';
  }
  return PORT_LABELS[port] || port.replace(/^branch-/, '分支 ');
};

export const nodeDefinitionToFlowNode = (
  definition: RSSAutomationNodeDefinition,
  status?: string,
): RSSFlowNode => ({
  id: definition.id,
  type: 'rssAutomationNode',
  position: definition.position,
  deletable: false,
  data: { definition, status },
});

export const edgeDefinitionToFlowEdge = (
  edge: RSSAutomationEdgeDefinition,
  source?: RSSAutomationNodeDefinition,
): RSSFlowEdge => ({
  id: edge.id,
  source: edge.source,
  sourceHandle: edge.source_port,
  target: edge.target,
  targetHandle: edge.target_port || 'input',
  label: sourcePortLabel(edge.source_port, source),
  markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
  type: 'smoothstep',
});

export const definitionToFlow = (
  definition: RSSAutomationDefinition,
  statuses?: Record<string, string>,
) => {
  const nodesByID = new Map(definition.nodes.map((node) => [node.id, node]));
  return {
    nodes: definition.nodes.map((node) =>
      nodeDefinitionToFlowNode(node, statuses?.[node.id]),
    ),
    edges: definition.edges.map((edge) =>
      edgeDefinitionToFlowEdge(edge, nodesByID.get(edge.source)),
    ),
  };
};

export const flowToDefinition = (
  nodes: RSSFlowNode[],
  edges: RSSFlowEdge[],
  viewport = { x: 0, y: 0, zoom: 1 },
): RSSAutomationDefinition => ({
  schema_version: 1,
  nodes: nodes.map((node) => ({
    ...node.data.definition,
    position: { x: node.position.x, y: node.position.y },
  })),
  edges: edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    source_port: edge.sourceHandle || 'success',
    target: edge.target,
    target_port: edge.targetHandle || 'input',
  })),
  viewport,
});

export const parseWorkflowDefinition = (
  raw: string,
): RSSAutomationDefinition | undefined => {
  try {
    const parsed = JSON.parse(raw) as RSSAutomationDefinition;
    if (parsed.schema_version !== 1 || !Array.isArray(parsed.nodes)) {
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
};

export const createNodeDefinition = (
  type: RSSAutomationNodeType,
  position: { x: number; y: number },
): RSSAutomationNodeDefinition => {
  const suffix = `${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 7)}`;
  const config: Record<string, unknown> = {};
  if (type === 'regex') {
    Object.assign(config, {
      input: '$item.title',
      pattern: '(\\d+)集',
      group: '1',
      variable: 'episode',
      value_type: 'integer',
    });
  }
  if (type === 'keyword') {
    Object.assign(config, {
      input: '$item.title',
      keywords: [],
      match_mode: 'contains_any',
      case_sensitive: false,
    });
  }
  if (type === 'convert') {
    Object.assign(config, {
      input: '$item.size_bytes',
      variable: 'size',
      value_type: 'integer',
    });
  }
  if (type === 'if') {
    config.condition = {
      field: '$vars.episode',
      operator: 'gt',
      value: 1000,
    };
  }
  if (type === 'parallel') config.branches = ['branch-1', 'branch-2'];
  if (type === 'join') config.policy = 'all_completed';
  if (type === 'wait115') {
    Object.assign(config, {
      poll_interval_seconds: 30,
      max_wait_minutes: 10080,
    });
  }
  if (type === 'wait_qbittorrent') {
    Object.assign(config, {
      poll_interval_seconds: 30,
      max_wait_minutes: 10080,
    });
  }
  if (type === 'moviepilot_transfer') {
    Object.assign(config, {
      source_path: '',
      file_type: 'auto',
      tmdb_id: '',
      media_type: 'auto',
      transfer_type: '',
      scrape: false,
      timeout_seconds: 600,
    });
  }
  if (type === 'delete_qbittorrent') {
    Object.assign(config, { delete_files: false, timeout_seconds: 30 });
  }
  if (type === 'moviepilot_recognize') config.tmdb_id = '';
  if (type === 'moviepilot_title_recognize') {
    Object.assign(config, { input: '$item.title', tmdb_id: '' });
  }
  if (type === 'filmfusion_recognize') {
    Object.assign(config, {
      recognition_mode: 'title',
      input: '$item.title',
      tmdb_id: '',
      lookup_tmdb: true,
    });
  }
  if (type === 'media_exists') {
    Object.assign(config, {
      tmdb_id: '$item.tmdb_id',
      title: '$item.title',
      year: '$item.year',
      media_type: '$item.media_type',
      category: '$item.category',
    });
  }
  if (type === 'hdhive_query') {
    Object.assign(config, {
      tmdb_id: '$item.tmdb_id',
      media_type: '$item.media_type',
      resolution: '',
      pan_type: '',
    });
  }
  if (type === 'hdhive_unlock') config.slug = '$item.resource_slug';
  if (type === 'organize_strm') {
    Object.assign(config, {
      media_type: 'auto',
      best_version_enabled: false,
      delete_source_folder: false,
      filename_regex_enabled: false,
      timeout_seconds: 600,
    });
  }
  if (type === 'strm_regenerate') {
    Object.assign(config, { timeout_seconds: 60 });
  }
  if (type === 'emby_refresh_wait') {
    Object.assign(config, {
      tmdb_id: '$item.tmdb_id',
      media_type: '$item.media_type',
      refresh_library: true,
      poll_interval_seconds: 15,
      max_wait_minutes: 30,
    });
  }
  if (type === 'http_request') {
    Object.assign(config, {
      method: 'POST',
      url: '',
      headers: {},
      body: '',
      content_type: 'application/json',
      allow_private_network: false,
      follow_redirects: false,
      timeout_seconds: 30,
    });
  }
  if (
    type === 'qbittorrent' ||
    type === 'offline115' ||
    type === 'offline115_openapi'
  ) {
    config.url = '$item.download_url';
  }
  if (type === 'notification') {
    Object.assign(config, {
      title: 'RSS 自动化命中',
      message: '{{item.title}}\n{{item.detail_url}}',
    });
  }
  return {
    id: `${type}_${suffix}`,
    type,
    name: NODE_LABELS[type],
    position,
    config,
    max_attempts:
      type === 'qbittorrent' ||
      type === 'offline115' ||
      type === 'offline115_openapi' ||
      type === 'wait_qbittorrent' ||
      type === 'wait115' ||
      type === 'moviepilot_title_recognize' ||
      type === 'filmfusion_recognize' ||
      type === 'media_exists' ||
      type === 'hdhive_query' ||
      type === 'hdhive_unlock' ||
      type === 'moviepilot_recognize' ||
      type === 'emby_refresh_wait' ||
      type === 'notification'
        ? 3
        : 1,
  };
};

export const nodeBranches = (definition: RSSAutomationNodeDefinition) => {
  if (definition.type !== 'parallel') return [];
  const raw = definition.config?.branches;
  if (Array.isArray(raw)) {
    return raw
      .map((item) => String(item).trim())
      .filter((item) => item.startsWith('branch-'));
  }
  return ['branch-1', 'branch-2'];
};
