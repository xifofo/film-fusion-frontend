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

const resolveConfiguredString = (
  context: Record<string, unknown>,
  configured: unknown,
) => {
  const expression = String(configured ?? '').trim();
  if (!expression) return '';
  if (expression.includes('{{')) return renderTemplate(expression, context);
  if (expression.startsWith('$') || /^(item|vars|nodes)\./.test(expression)) {
    const value = resolveReference(context, expression);
    return value == null ? '' : String(value);
  }
  return expression;
};

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

const resolveConditionOperand = (
  context: Record<string, unknown>,
  raw: unknown,
): { exists: boolean; value: unknown } => {
  if (Array.isArray(raw)) {
    const values = raw.map((item) => resolveConditionOperand(context, item));
    return {
      exists: values.every((item) => item.exists),
      value: values.map((item) => item.value),
    };
  }
  if (typeof raw !== 'string') return { exists: raw != null, value: raw };
  const expression = raw.trim();
  const exactTemplate = expression.match(/^\{\{\s*([^{}]+?)\s*\}\}$/);
  if (exactTemplate) {
    const value = resolveReference(context, exactTemplate[1]);
    return { exists: value !== undefined, value };
  }
  if (expression.startsWith('$') || /^(item|vars|nodes)\./.test(expression)) {
    const value = resolveReference(context, expression);
    return { exists: value !== undefined, value };
  }
  if (expression.includes('{{')) {
    return { exists: true, value: renderTemplate(expression, context) };
  }
  return { exists: true, value: raw };
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

  const leftOperand = resolveConditionOperand(
    context,
    condition.field ?? condition.left,
  );
  const left = leftOperand.value;
  const operator = String(
    condition.operator ?? condition.op ?? '',
  ).toLowerCase();
  const right = resolveConditionOperand(
    context,
    condition.value ?? condition.right,
  ).value;
  switch (operator) {
    case 'exists':
      return leftOperand.exists && left != null && String(left).trim() !== '';
    case 'not_exists':
      return !leftOperand.exists || left == null || String(left).trim() === '';
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
        const input = resolveConfiguredString(context, config.input);
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
        const input = resolveConfiguredString(context, config.input);
        if (!input) throw new Error('输入字段没有值');
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
        const input = resolveConfiguredString(context, config.input);
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
        const url = resolveConfiguredString(context, config.url);
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
        const url = resolveConfiguredString(context, config.url);
        return {
          active: true,
          tone: url ? 'success' : 'warning',
          label: '将通过 OpenAPI 提交到 115 离线',
          detail: String(url || '下载 URL 尚未解析'),
          selectedPorts: [url ? 'success' : 'failure'],
          output: url,
        };
      }
      case 'wait115':
        return {
          active: true,
          tone: 'success',
          label: '运行时等待 115 下载真正完成',
          detail: '样本预览不会查询真实 115 任务',
          selectedPorts: ['success'],
          output: {
            completed: true,
            percent: 100,
            file_id: '运行时返回',
            file_name: '运行时返回',
          },
        };
      case 'wait_qbittorrent':
        return {
          active: true,
          tone: 'success',
          label: '运行时等待 qBittorrent 下载完成',
          detail: '样本预览不会连接真实 qBittorrent',
          selectedPorts: ['success'],
          output: {
            completed: true,
            progress: 100,
            state: 'uploading',
            hash: '运行时返回',
            name: '运行时返回',
            save_path: '运行时返回',
            content_path: '运行时返回',
          },
        };
      case 'moviepilot_recognize': {
        const configuredTMDB = String(config.tmdb_id || '').trim();
        const tmdbID = resolveConfiguredString(context, configuredTMDB);
        return {
          active: true,
          tone: 'success',
          label: tmdbID
            ? `将用 TMDB ${String(tmdbID)} 辅助 MP 识别`
            : '将调用 MP 自动识别下载媒体',
          detail: '样本预览不会调用真实 MoviePilot',
          selectedPorts: ['success'],
          output: {
            tmdb_id: tmdbID || '运行时识别',
            title: '运行时识别',
            year: '运行时识别',
            media_type: '运行时识别',
            season_episode: '运行时识别',
            category: '运行时识别',
            rating: '运行时识别',
            quality: '运行时识别',
            poster_url: '运行时识别',
            recognized_count: 1,
          },
        };
      }
      case 'moviepilot_title_recognize': {
        const input = resolveConfiguredString(context, config.input);
        const configuredTMDB = String(config.tmdb_id || '').trim();
        const tmdbID = resolveConfiguredString(context, configuredTMDB);
        return {
          active: true,
          tone: input ? 'success' : 'warning',
          label: tmdbID
            ? `将用 TMDB ${String(tmdbID)} 辅助识别 RSS 标题`
            : '将调用 MP 识别 RSS 标题',
          detail: String(input || '标题尚未解析'),
          selectedPorts: [input ? 'success' : 'failure'],
          output: {
            tmdb_id: tmdbID || '运行时识别',
            title: '运行时识别',
            year: '运行时识别',
            media_type: '运行时识别',
            season_episode: '运行时识别',
            category: '运行时识别',
            rating: '运行时识别',
            quality: '运行时识别',
            poster_url: '运行时识别',
          },
        };
      }
      case 'media_exists': {
        const tmdbID = resolveConfiguredString(context, config.tmdb_id);
        const directoryID = Number(config.cloud_directory_id || 0);
        return {
          active: true,
          tone: directoryID > 0 && tmdbID ? 'success' : 'warning',
          label:
            directoryID > 0 && tmdbID
              ? `将检查 TMDB ${tmdbID} 是否已在本地 / Emby 中`
              : '请选择目录配置并提供 TMDB ID',
          detail:
            '样本预览默认演示“未存在”分支，不会查询真实 Emby 或本地媒体库',
          selectedPorts: [directoryID > 0 && tmdbID ? 'missing' : 'failure'],
          output: {
            exists: false,
            local_exists: false,
            target_dir: '运行时计算',
            existing_seasons: [],
          },
        };
      }
      case 'hdhive_query': {
        const tmdbID = resolveConfiguredString(context, config.tmdb_id);
        return {
          active: true,
          tone: tmdbID ? 'success' : 'warning',
          label: tmdbID
            ? `将在 HDHive 查询 TMDB ${tmdbID} 资源`
            : 'TMDB ID 尚未解析',
          detail: '样本预览不会查询真实 HDHive',
          selectedPorts: [tmdbID ? 'found' : 'failure'],
          output: {
            resource_count: tmdbID ? 1 : 0,
            selected_slug: tmdbID ? 'runtime-resource' : '',
            selected_title: '运行时返回',
            selected_size: '运行时返回',
            selected_resolution: [],
            is_unlocked: false,
            resources: [],
          },
        };
      }
      case 'hdhive_unlock': {
        const slug = resolveConfiguredString(context, config.slug);
        return {
          active: true,
          tone: slug ? 'success' : 'warning',
          label: slug ? `将解锁 HDHive 资源 ${slug}` : '资源 slug 尚未解析',
          detail: '样本预览不会解锁真实 HDHive 资源',
          selectedPorts: [slug ? 'success' : 'failure'],
          output: {
            download_url: slug
              ? 'https://example.invalid/runtime-resource'
              : '',
            url: slug ? 'https://example.invalid/runtime-resource' : '',
            access_code: '',
            already_owned: false,
          },
        };
      }
      case 'organize_strm': {
        const directoryID = Number(config.cloud_directory_id || 0);
        return {
          active: true,
          tone: directoryID > 0 ? 'success' : 'warning',
          label:
            directoryID > 0
              ? `将使用目录配置 #${directoryID} 整理并生成 STRM`
              : '尚未选择整理目录配置',
          detail:
            '样本预览不会查询、重命名或移动真实 115 文件，也不会写入 STRM',
          selectedPorts: [directoryID > 0 ? 'success' : 'failure'],
          output: {
            organized_count: directoryID > 0 ? 1 : 0,
            strm_count: directoryID > 0 ? 1 : 0,
            failed_count: 0,
            target_path: '运行时整理目标路径',
            strm_path: '运行时生成的 STRM 路径',
            strm_content: '运行时生成的 STRM 内容',
            cloud_directory_name: '运行时目录配置',
            source_folder_ids: ['运行时下载结果'],
            source_folder_deleted: false,
            source_folder_delete_pending: false,
          },
        };
      }
      case 'strm_verify': {
        const directoryID = Number(config.cloud_directory_id || 0);
        return {
          active: true,
          tone: directoryID > 0 ? 'success' : 'warning',
          label:
            directoryID > 0 ? '将校验上游生成的 STRM 文件' : '尚未选择目录配置',
          detail: '样本预览不会读取真实 STRM 文件',
          selectedPorts: [directoryID > 0 ? 'valid' : 'failure'],
          output: {
            valid: directoryID > 0,
            checked_count: directoryID > 0 ? 1 : 0,
            valid_count: directoryID > 0 ? 1 : 0,
            invalid_count: 0,
            strm_path: '运行时校验',
            strm_content: '运行时校验',
            errors: [],
          },
        };
      }
      case 'strm_regenerate': {
        const directoryID = Number(config.cloud_directory_id || 0);
        return {
          active: true,
          tone: directoryID > 0 ? 'success' : 'warning',
          label:
            directoryID > 0
              ? '将按上游整理结果重生成 STRM'
              : '尚未选择目录配置',
          detail: '样本预览不会写入真实 STRM，也不会请求 115',
          selectedPorts: [directoryID > 0 ? 'success' : 'failure'],
          output: {
            regenerated_count: directoryID > 0 ? 1 : 0,
            failed_count: 0,
            strm_path: '运行时重写',
            strm_paths: directoryID > 0 ? ['运行时重写'] : [],
            errors: [],
          },
        };
      }
      case 'emby_refresh_wait': {
        const tmdbID = resolveConfiguredString(context, config.tmdb_id);
        return {
          active: true,
          tone: tmdbID ? 'success' : 'warning',
          label: tmdbID
            ? `将刷新 Emby 并等待 TMDB ${tmdbID} 入库`
            : 'TMDB ID 尚未解析',
          detail: '样本预览不会请求真实 Emby',
          selectedPorts: [tmdbID ? 'success' : 'failure'],
          output: {
            found: Boolean(tmdbID),
            emby_item_id: '运行时返回',
            emby_url: '运行时返回',
            refresh_requested: Boolean(tmdbID),
            waiting_seconds: 0,
          },
        };
      }
      case 'http_request': {
        const requestURL = resolveConfiguredString(context, config.url);
        let host = '';
        try {
          host = new URL(requestURL).hostname;
        } catch {
          // The warning branch below explains an unresolved or invalid URL.
        }
        return {
          active: true,
          tone: host ? 'success' : 'warning',
          label: host
            ? `将请求 ${String(config.method || 'POST').toUpperCase()} ${host}`
            : 'HTTP 请求地址尚未解析',
          detail: '样本预览不会发起真实 HTTP 请求',
          selectedPorts: [host ? 'success' : 'failure'],
          output: {
            status_code: 200,
            content_type: 'application/json',
            body: '{"preview":true}',
            json: { preview: true },
            request_host: host,
            duration_ms: 0,
          },
        };
      }
      case 'notification': {
        const message = renderTemplate(config.message, context);
        const imageURL = renderTemplate(config.image_url, context);
        return {
          active: true,
          tone: message ? 'success' : 'warning',
          label: '将发送通知',
          detail:
            [message, imageURL ? `图片：${imageURL}` : '']
              .filter(Boolean)
              .join('\n') || '通知内容为空',
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
    (context.nodes as Record<string, unknown>)[nodeId] = {
      output: preview.output,
    };
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
