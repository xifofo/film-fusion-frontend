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
  offline115: '115 Cookie 离线',
  offline115_openapi: '115 OpenAPI 离线',
  notification: '发送通知',
  end: '结束',
};

export const PORT_LABELS: Record<string, string> = {
  next: '继续',
  success: '成功',
  failure: '失败',
  matched: '匹配',
  unmatched: '不匹配',
  true: '是',
  false: '否',
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
