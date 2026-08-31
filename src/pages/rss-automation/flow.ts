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
  delay: '延迟执行',
  regex: '正则提取',
  keyword: '关键词匹配',
  keyword_replace: '关键词替换',
  regex_replace: '正则替换',
  convert: '类型转换',
  set_variable: '设置变量',
  template: '文本模板',
  json_extract: 'JSON 取值',
  math: '数学运算',
  datetime_operation: '日期时间运算',
  list_operation: '列表运算',
  switch: '多路分支',
  coalesce: '候选值合并',
  deduplicate: '运行去重',
  rate_limit: '频率限制',
  foreach: '遍历映射',
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
  rename115_openapi: '115 API 重命名',
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
  'rename115_openapi',
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
  empty: '空列表',
  default: '默认',
  new: '首次',
  duplicate: '重复',
  allowed: '允许',
  throttled: '受限',
  partial: '部分成功',
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
  if (source?.type === 'switch' && port.startsWith('case-')) {
    const caseID = port.slice('case-'.length);
    const cases = Array.isArray(source.config?.cases)
      ? source.config.cases
      : [];
    const matched = cases.find(
      (candidate) =>
        candidate &&
        typeof candidate === 'object' &&
        String(
          (candidate as Record<string, unknown>).id || '',
        ).toLowerCase() === caseID.toLowerCase(),
    ) as Record<string, unknown> | undefined;
    return String(matched?.label || `条件 ${caseID}`);
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
  if (type === 'delay') config.delay_seconds = 600;
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
  if (type === 'keyword_replace') {
    Object.assign(config, {
      input: '$item.title',
      replacements: [{ keyword: '', replacement: '' }],
      case_sensitive: false,
      variable: 'normalized_title',
    });
  }
  if (type === 'regex_replace') {
    Object.assign(config, {
      input: '$item.title',
      pattern: '[._-]+',
      replacement: ' ',
      variable: 'normalized_title',
    });
  }
  if (type === 'convert') {
    Object.assign(config, {
      input: '$item.size_bytes',
      variable: 'size',
      value_type: 'integer',
    });
  }
  if (type === 'set_variable') {
    Object.assign(config, {
      variable: 'result',
      value: '',
      value_type: 'auto',
      overwrite: 'overwrite',
    });
  }
  if (type === 'template') {
    Object.assign(config, {
      template: '{{item.title}}',
      variable: 'rendered_text',
      missing: 'error',
      trim: false,
      overwrite: 'overwrite',
    });
  }
  if (type === 'json_extract') {
    Object.assign(config, {
      input: '$item',
      pointer: '',
      variable: 'extracted_value',
      missing: 'failure',
      default_value: '',
      value_type: 'auto',
      overwrite: 'overwrite',
    });
  }
  if (type === 'math') {
    Object.assign(config, {
      operation: 'add',
      left: 0,
      right: 0,
      precision: 2,
      result_type: 'number',
      variable: 'result',
      overwrite: 'overwrite',
    });
  }
  if (type === 'datetime_operation') {
    Object.assign(config, {
      operation: 'parse',
      input: '',
      right: '',
      input_format: 'auto',
      output_format: 'rfc3339',
      timezone: 'Asia/Shanghai',
      amount: 0,
      unit: 'second',
      precision: 0,
      variable: 'datetime_result',
      overwrite: 'overwrite',
    });
  }
  if (type === 'list_operation') {
    Object.assign(config, {
      operation: 'unique',
      input: '',
      separator: ',',
      trim_items: true,
      omit_empty: true,
      pointer: '',
      missing: 'failure',
      direction: 'asc',
      compare_as: 'auto',
      offset: 0,
      limit: 100,
      variable: 'list_result',
      overwrite: 'overwrite',
    });
  }
  if (type === 'switch') {
    Object.assign(config, {
      input: '',
      compare_as: 'auto',
      case_sensitive: false,
      cases: [
        {
          id: 'case1',
          label: '条件 1',
          operator: 'eq',
          value: '',
        },
      ],
    });
  }
  if (type === 'coalesce') {
    Object.assign(config, {
      candidates: [],
      missing: 'skip',
      skip_null: true,
      skip_empty_string: true,
      skip_empty_array: false,
      skip_empty_object: false,
      trim_strings: false,
      on_empty: 'failure',
      default_value: '',
      value_type: 'auto',
      variable: 'coalesced',
      overwrite: 'overwrite',
    });
  }
  if (type === 'deduplicate') {
    Object.assign(config, {
      key: '',
      scope: 'workflow',
      namespace: '',
      normalize: 'trim',
      ttl_seconds: 604800,
      refresh_on_duplicate: false,
      preview_assumption: 'new',
    });
  }
  if (type === 'rate_limit') {
    Object.assign(config, {
      key: '',
      scope: 'workflow',
      namespace: '',
      normalize: 'trim',
      limit: 5,
      window_seconds: 60,
      behavior: 'defer',
      max_wait_seconds: 60,
      preview_assumption: 'allowed',
    });
  }
  if (type === 'foreach') {
    Object.assign(config, {
      input: '',
      transform: {
        type: 'template',
        config: { template: '{{each.item}}', missing: 'error', trim: false },
      },
      on_error: 'fail_fast',
      max_items: 100,
      variable: 'mapped_items',
      overwrite: 'overwrite',
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
  if (type === 'rename115_openapi') {
    Object.assign(config, {
      file_id: '',
      new_name: '{{item.title}}',
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
      type === 'rename115_openapi' ||
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
