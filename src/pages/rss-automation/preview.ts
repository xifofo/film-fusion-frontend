import type {
  RSSAutomationDefinition,
  RSSAutomationNodeDefinition,
} from '@/services/film-fusion';

export type RSSAutomationNodePreview = {
  active: boolean;
  tone: 'success' | 'warning' | 'neutral';
  label: string;
  detail?: string;
  selectedPorts: string[];
  output?: unknown;
};

export type RSSAutomationFlowPreview = {
  nodes: Record<string, RSSAutomationNodePreview>;
  activeEdgeIds: string[];
  activeNodeIds: string[];
  variables: Record<string, unknown>;
};

const resolveReference = (
  context: Record<string, unknown>,
  reference: unknown,
) => {
  const path = String(reference ?? '')
    .trim()
    .replace(/^\$/, '')
    .split('.')
    .filter(Boolean);
  let current: unknown = context;
  for (const key of path) {
    if (!current || typeof current !== 'object' || !(key in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
};

const renderTemplate = (template: unknown, context: Record<string, unknown>) =>
  String(template ?? '').replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, path) => {
    const value = resolveReference(context, path);
    return value == null ? '' : String(value);
  });

const convertValue = (value: unknown, valueType: unknown) => {
  const raw = String(value ?? '').trim();
  switch (String(valueType || 'string')) {
    case 'integer': {
      if (!/^[+-]?\d+$/.test(raw)) throw new Error(`${raw || '空值'} 不是整数`);
      return Number.parseInt(raw, 10);
    }
    case 'number': {
      const parsed = Number(raw);
      if (!Number.isFinite(parsed))
        throw new Error(`${raw || '空值'} 不是数字`);
      return parsed;
    }
    case 'boolean':
      if (['true', '1'].includes(raw.toLowerCase())) return true;
      if (['false', '0'].includes(raw.toLowerCase())) return false;
      throw new Error(`${raw || '空值'} 不是布尔值`);
    case 'datetime': {
      const timestamp = Date.parse(raw);
      if (Number.isNaN(timestamp)) throw new Error(`${raw || '空值'} 不是日期`);
      return new Date(timestamp).toISOString();
    }
    default:
      return raw;
  }
};

const compare = (left: unknown, right: unknown) => {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (
    left !== '' &&
    right !== '' &&
    Number.isFinite(leftNumber) &&
    Number.isFinite(rightNumber)
  ) {
    return leftNumber === rightNumber ? 0 : leftNumber > rightNumber ? 1 : -1;
  }
  const leftText = String(left ?? '');
  const rightText = String(right ?? '');
  return leftText === rightText ? 0 : leftText > rightText ? 1 : -1;
};

const evaluateCondition = (
  raw: unknown,
  context: Record<string, unknown>,
): boolean => {
  if (!raw || typeof raw !== 'object') throw new Error('判断条件尚未配置');
  const condition = raw as Record<string, unknown>;
  if (Array.isArray(condition.all)) {
    return condition.all.every((item) => evaluateCondition(item, context));
  }
  if (Array.isArray(condition.any)) {
    return condition.any.some((item) => evaluateCondition(item, context));
  }
  if (condition.not) return !evaluateCondition(condition.not, context);

  const left = resolveReference(context, condition.field ?? condition.left);
  const operator = String(
    condition.operator ?? condition.op ?? '',
  ).toLowerCase();
  let right = condition.value ?? condition.right;
  if (typeof right === 'string' && right.trim().startsWith('$')) {
    right = resolveReference(context, right);
  }
  switch (operator) {
    case 'exists':
      return left != null && String(left).trim() !== '';
    case 'not_exists':
      return left == null || String(left).trim() === '';
    case 'eq':
      return compare(left, right) === 0;
    case 'neq':
      return compare(left, right) !== 0;
    case 'gt':
      return compare(left, right) > 0;
    case 'gte':
      return compare(left, right) >= 0;
    case 'lt':
      return compare(left, right) < 0;
    case 'lte':
      return compare(left, right) <= 0;
    case 'contains':
      return String(left ?? '').includes(String(right ?? ''));
    case 'not_contains':
      return !String(left ?? '').includes(String(right ?? ''));
    case 'starts_with':
      return String(left ?? '').startsWith(String(right ?? ''));
    case 'ends_with':
      return String(left ?? '').endsWith(String(right ?? ''));
    case 'regex':
      return new RegExp(String(right ?? '')).test(String(left ?? ''));
    case 'in':
      return (
        Array.isArray(right) && right.some((item) => compare(left, item) === 0)
      );
    default:
      throw new Error('判断条件尚未配置');
  }
};

const orderedNodes = (definition: RSSAutomationDefinition) => {
  const indegree = new Map(definition.nodes.map((node) => [node.id, 0]));
  const outgoing = new Map<string, string[]>();
  for (const edge of definition.edges) {
    indegree.set(edge.target, (indegree.get(edge.target) || 0) + 1);
    outgoing.set(edge.source, [
      ...(outgoing.get(edge.source) || []),
      edge.target,
    ]);
  }
  const queue = definition.nodes
    .filter((node) => (indegree.get(node.id) || 0) === 0)
    .map((node) => node.id);
  const result: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    result.push(id);
    for (const target of outgoing.get(id) || []) {
      const next = (indegree.get(target) || 0) - 1;
      indegree.set(target, next);
      if (next === 0) queue.push(target);
    }
  }
  for (const node of definition.nodes) {
    if (!result.includes(node.id)) result.push(node.id);
  }
  return result;
};

const previewNode = (
  node: RSSAutomationNodeDefinition,
  context: Record<string, unknown>,
  activeInputs: number,
): RSSAutomationNodePreview => {
  const config = node.config || {};
  try {
    switch (node.type) {
      case 'trigger':
        return {
          active: true,
          tone: 'success',
          label: '样本从这里进入',
          selectedPorts: ['next'],
        };
      case 'regex': {
        const input = String(resolveReference(context, config.input) ?? '');
        const expression = new RegExp(String(config.pattern || ''));
        const match = expression.exec(input);
        if (!match) {
          return {
            active: true,
            tone: 'warning',
            label: '没有匹配，走失败出口',
            detail: `输入：${input || '空'}`,
            selectedPorts: ['failure'],
          };
        }
        const group = String(config.group ?? '');
        const captured = /^\d+$/.test(group)
          ? match[Number(group)]
          : group
            ? match.groups?.[group]
            : (match[1] ?? match[0]);
        const value = convertValue(captured, config.value_type);
        const variable = String(config.variable || 'result');
        (context.vars as Record<string, unknown>)[variable] = value;
        return {
          active: true,
          tone: 'success',
          label: `${variable} = ${String(value)}`,
          detail: `从“${input}”提取`,
          selectedPorts: ['success'],
          output: value,
        };
      }
      case 'keyword': {
        const rawInput = resolveReference(context, config.input);
        if (rawInput == null) throw new Error('输入字段没有值');
        const input = String(rawInput);
        const keywords = Array.isArray(config.keywords)
          ? config.keywords
              .map(String)
              .map((keyword) => keyword.trim())
              .filter(Boolean)
          : [];
        if (keywords.length === 0) throw new Error('请至少添加一个关键词');
        const caseSensitive = Boolean(config.case_sensitive);
        const haystack = caseSensitive ? input : input.toLowerCase();
        const matchedKeywords = keywords.filter((keyword) =>
          haystack.includes(caseSensitive ? keyword : keyword.toLowerCase()),
        );
        const mode = String(config.match_mode || 'contains_any');
        const matched =
          mode === 'contains_any'
            ? matchedKeywords.length > 0
            : mode === 'contains_all'
              ? matchedKeywords.length === keywords.length
              : mode === 'contains_none'
                ? matchedKeywords.length === 0
                : (() => {
                    throw new Error('关键词规则尚未配置');
                  })();
        const found = matchedKeywords.join('、');
        return {
          active: true,
          tone: matched ? 'success' : 'warning',
          label:
            mode === 'contains_none'
              ? matched
                ? '未发现禁用关键词，走“匹配”'
                : `发现禁用关键词 ${found}，走“不匹配”`
              : matched
                ? `匹配到 ${found}，走“匹配”`
                : '没有满足关键词规则，走“不匹配”',
          detail: `输入：${input || '空'}`,
          selectedPorts: [matched ? 'matched' : 'unmatched'],
          output: { matched, matchedKeywords },
        };
      }
      case 'convert': {
        const input = resolveReference(context, config.input);
        const value = convertValue(input, config.value_type);
        const variable = String(config.variable || 'result');
        (context.vars as Record<string, unknown>)[variable] = value;
        return {
          active: true,
          tone: 'success',
          label: `${variable} = ${String(value)}`,
          selectedPorts: ['success'],
          output: value,
        };
      }
      case 'if': {
        const matched = evaluateCondition(config.condition, context);
        return {
          active: true,
          tone: matched ? 'success' : 'warning',
          label: matched ? '条件成立，走“是”' : '条件不成立，走“否”',
          selectedPorts: [matched ? 'true' : 'false'],
          output: matched,
        };
      }
      case 'parallel': {
        const branches = Array.isArray(config.branches)
          ? config.branches.map(String)
          : [];
        return {
          active: true,
          tone: 'success',
          label: `同时进入 ${branches.length || 2} 条分支`,
          selectedPorts: branches.length ? branches : ['*'],
        };
      }
      case 'join':
        return {
          active: true,
          tone: 'success',
          label: `${activeInputs} 条有效路径在此汇合`,
          selectedPorts: ['success'],
        };
      case 'qbittorrent':
      case 'offline115': {
        const url = resolveReference(context, config.url);
        return {
          active: true,
          tone: url ? 'success' : 'warning',
          label:
            node.type === 'qbittorrent'
              ? '将提交到 qBittorrent'
              : '将通过 Cookie 提交到 115 离线',
          detail: String(url || '下载 URL 尚未解析'),
          selectedPorts: [url ? 'success' : 'failure'],
          output: url,
        };
      }
      case 'offline115_openapi': {
        const url = resolveReference(context, config.url);
        return {
          active: true,
          tone: url ? 'success' : 'warning',
          label: '将通过 OpenAPI 提交到 115 离线',
          detail: String(url || '下载 URL 尚未解析'),
          selectedPorts: [url ? 'success' : 'failure'],
          output: url,
        };
      }
      case 'notification': {
        const message = renderTemplate(config.message, context);
        return {
          active: true,
          tone: message ? 'success' : 'warning',
          label: '将发送通知',
          detail: message || '通知内容为空',
          selectedPorts: [message ? 'success' : 'failure'],
          output: message,
        };
      }
      case 'end':
        return {
          active: true,
          tone: 'success',
          label: '当前样本会到达这里',
          selectedPorts: [],
        };
      default:
        throw new Error('暂不支持预览');
    }
  } catch (error: any) {
    return {
      active: true,
      tone: 'warning',
      label: '当前配置无法预览',
      detail: error?.message,
      selectedPorts: ['failure'],
    };
  }
};

export const simulateRSSAutomation = (
  definition: RSSAutomationDefinition,
  item: Record<string, unknown>,
): RSSAutomationFlowPreview => {
  const context: Record<string, unknown> = {
    item,
    vars: {},
    nodes: {},
  };
  const previews: Record<string, RSSAutomationNodePreview> = {};
  const activeEdgeIds = new Set<string>();
  const selectedPorts = new Map<string, string[]>();
  const nodes = new Map(definition.nodes.map((node) => [node.id, node]));

  for (const nodeId of orderedNodes(definition)) {
    const node = nodes.get(nodeId);
    if (!node) continue;
    const incoming = definition.edges.filter((edge) => edge.target === nodeId);
    const activeIncoming = incoming.filter((edge) => {
      const ports = selectedPorts.get(edge.source) || [];
      const active =
        edge.source_port === 'always' ||
        ports.includes('*') ||
        ports.includes(edge.source_port);
      if (active) activeEdgeIds.add(edge.id);
      return active;
    });
    const active = node.type === 'trigger' || activeIncoming.length > 0;
    if (!active) {
      previews[nodeId] = {
        active: false,
        tone: 'neutral',
        label: '当前样本不会经过',
        selectedPorts: [],
      };
      continue;
    }
    const preview = previewNode(node, context, activeIncoming.length);
    previews[nodeId] = preview;
    selectedPorts.set(nodeId, preview.selectedPorts);
    (context.nodes as Record<string, unknown>)[nodeId] = preview.output;
  }

  return {
    nodes: previews,
    activeEdgeIds: [...activeEdgeIds],
    activeNodeIds: Object.entries(previews)
      .filter(([, preview]) => preview.active)
      .map(([id]) => id),
    variables: context.vars as Record<string, unknown>,
  };
};
