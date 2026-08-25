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

const escapeRegularExpression = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const compilePreviewRegularExpression = (raw: unknown, global = false) => {
  let source = String(raw ?? '');
  const flags = new Set(global ? ['g'] : []);
  const inlineFlags = source.match(/^\(\?([ims]+)\)/);
  if (inlineFlags) {
    for (const flag of inlineFlags[1]) flags.add(flag);
    source = source.slice(inlineFlags[0].length);
  }
  source = source.replace(/\(\?P<([A-Za-z_][A-Za-z0-9_]*)>/g, '(?<$1>');
  return new RegExp(source, [...flags].join(''));
};

const regularExpressionReplacementNameCharacter = /[\p{L}\p{N}_]/u;

const expandGoRegularExpressionReplacement = (
  replacement: string,
  match: RegExpExecArray,
) => {
  let result = '';
  let index = 0;
  while (index < replacement.length) {
    if (replacement[index] !== '$') {
      result += replacement[index];
      index += 1;
      continue;
    }
    if (replacement[index + 1] === '$') {
      result += '$';
      index += 2;
      continue;
    }

    let name = '';
    let nextIndex = index + 1;
    if (replacement[nextIndex] === '{') {
      const closingBrace = replacement.indexOf('}', nextIndex + 1);
      if (closingBrace < 0) {
        result += '$';
        index += 1;
        continue;
      }
      name = replacement.slice(nextIndex + 1, closingBrace);
      nextIndex = closingBrace + 1;
    } else {
      const start = nextIndex;
      while (
        regularExpressionReplacementNameCharacter.test(
          replacement[nextIndex] || '',
        )
      ) {
        nextIndex += 1;
      }
      name = replacement.slice(start, nextIndex);
    }
    if (!name) {
      result += '$';
      index += 1;
      continue;
    }
    const captured = /^\d+$/.test(name)
      ? match[Number(name)]
      : match.groups?.[name];
    result += captured ?? '';
    index = nextIndex;
  }
  return result;
};

const replaceWithGoRegularExpression = (
  input: string,
  pattern: unknown,
  replacement: unknown,
) => {
  const expression = compilePreviewRegularExpression(pattern, true);
  const template = String(replacement ?? '');
  let result = '';
  let cursor = 0;
  let replacementCount = 0;
  let match = expression.exec(input);
  while (match) {
    result += input.slice(cursor, match.index);
    result += expandGoRegularExpressionReplacement(template, match);
    cursor = match.index + match[0].length;
    replacementCount += 1;
    if (match[0] === '') {
      if (expression.lastIndex >= input.length) break;
      expression.lastIndex +=
        (input.codePointAt(expression.lastIndex) || 0) > 0xffff ? 2 : 1;
    }
    match = expression.exec(input);
  }
  return {
    result: result + input.slice(cursor),
    replacementCount,
  };
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
        const expression = compilePreviewRegularExpression(config.pattern);
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
          detail: `匹配内容：${match[0]}`,
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
      case 'keyword_replace': {
        const input = resolveConfiguredString(context, config.input);
        const rules = Array.isArray(config.replacements)
          ? config.replacements
              .map((value) =>
                value && typeof value === 'object'
                  ? (value as Record<string, unknown>)
                  : {},
              )
              .map((rule) => ({
                keyword: String(rule.keyword ?? '').trim(),
                replacement: String(rule.replacement ?? ''),
              }))
              .filter((rule) => rule.keyword)
          : [];
        if (rules.length === 0) {
          throw new Error('请至少添加一条关键词替换规则');
        }
        const caseSensitive = Boolean(config.case_sensitive);
        let result = input;
        let replacementCount = 0;
        for (const rule of rules) {
          if (caseSensitive) {
            replacementCount += result.split(rule.keyword).length - 1;
            result = result.split(rule.keyword).join(rule.replacement);
            continue;
          }
          const expression = new RegExp(
            escapeRegularExpression(rule.keyword),
            'giu',
          );
          result = result.replace(expression, () => {
            replacementCount += 1;
            return rule.replacement;
          });
        }
        const variable = String(config.variable || 'result');
        (context.vars as Record<string, unknown>)[variable] = result;
        const output = {
          result,
          replacement_count: replacementCount,
          variables: { [variable]: result },
        };
        return {
          active: true,
          tone: 'success',
          label: `${variable} = ${result || '空文本'}`,
          detail: `按顺序替换 ${replacementCount} 处 · 原文：${input || '空'}`,
          selectedPorts: ['success'],
          output,
        };
      }
      case 'regex_replace': {
        const input = resolveConfiguredString(context, config.input);
        const { result, replacementCount } = replaceWithGoRegularExpression(
          input,
          config.pattern,
          config.replacement,
        );
        const variable = String(config.variable || 'result');
        (context.vars as Record<string, unknown>)[variable] = result;
        const output = {
          result,
          replacement_count: replacementCount,
          variables: { [variable]: result },
        };
        return {
          active: true,
          tone: 'success',
          label: `${variable} = ${result || '空文本'}`,
          detail: `正则替换 ${replacementCount} 处 · 原文：${input || '空'}`,
          selectedPorts: ['success'],
          output,
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
      case 'rename115_openapi': {
        const fileID = resolveConfiguredString(context, config.file_id);
        const newName = resolveConfiguredString(context, config.new_name);
        if (!fileID) throw new Error('文件或文件夹 ID 尚未解析');
        if (!newName) throw new Error('115 新名称尚未解析');
        if (
          newName === '.' ||
          newName === '..' ||
          /[\\/]/.test(newName) ||
          Array.from(newName).some((character) => {
            const codePoint = character.codePointAt(0) || 0;
            return codePoint < 32 || codePoint === 127;
          })
        ) {
          throw new Error('115 新名称包含无效字符');
        }
        if (new TextEncoder().encode(newName).length > 255) {
          throw new Error('115 新名称不能超过 255 字节');
        }
        const output = {
          renamed: true,
          file_id: fileID,
          file_name: newName,
          new_name: newName,
          access_method: 'openapi',
        };
        return {
          active: true,
          tone: 'success',
          label: `将重命名为 ${newName}`,
          detail: `115 ID：${fileID} · 样本预览不会调用真实接口`,
          selectedPorts: ['success'],
          output,
        };
      }
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
            content_type: 'dir',
            file_count: 1,
          },
        };
      case 'moviepilot_transfer': {
        const sourcePath = resolveConfiguredString(context, config.source_path);
        const tmdbID = resolveConfiguredString(context, config.tmdb_id);
        return {
          active: true,
          tone: 'success',
          label: tmdbID
            ? `下载完成后将用 TMDB ${tmdbID} 辅助 MP2 整理`
            : '下载完成后将交给 MP2 整理入库',
          detail: sourcePath
            ? `MP2 可见路径：${sourcePath}`
            : '运行时使用上游 qBittorrent 完成路径；样本预览不会整理真实文件',
          selectedPorts: ['success'],
          output: {
            organized: true,
            source_path: sourcePath || '运行时使用 qB 完成路径',
            content_type: String(config.file_type || 'auto'),
            tmdb_id: tmdbID || '',
            media_type: String(config.media_type || 'auto'),
            hash: '运行时透传',
            target_id: '运行时透传',
            target_name: '运行时透传',
            message: '运行时返回',
          },
        };
      }
      case 'delete_qbittorrent': {
        const deleteFiles = Boolean(config.delete_files);
        return {
          active: true,
          tone: deleteFiles ? 'warning' : 'success',
          label: deleteFiles
            ? 'MP2 整理成功后将删除 qB 任务和下载文件'
            : '将删除 qB 做种任务并保留下载文件',
          detail: deleteFiles
            ? '只有直接连接 MP2 整理成功出口才能保存并执行'
            : '样本预览不会删除真实 qBittorrent 任务',
          selectedPorts: ['success'],
          output: {
            deleted: true,
            already_missing: false,
            delete_files: deleteFiles,
            hash: '运行时透传',
            target_id: '运行时透传',
            target_name: '运行时透传',
          },
        };
      }
      case 'filmfusion_recognize': {
        const mode = String(config.recognition_mode || 'title');
        const configuredTMDB = String(config.tmdb_id || '').trim();
        const tmdbID = resolveConfiguredString(context, configuredTMDB);
        const lookupTMDB = config.lookup_tmdb !== false;
        if (mode === 'file') {
          return {
            active: true,
            tone: 'success',
            label: tmdbID
              ? `将用 TMDB ${tmdbID} 辅助本地识别 115 文件`
              : '将用 FilmFusion 本地词表识别 115 文件',
            detail: `${lookupTMDB ? '本地解析后查询 TMDB' : '仅执行本地解析'}；样本预览不会读取真实 115 文件或调用 MP2`,
            selectedPorts: ['success'],
            output: {
              engine: 'local',
              mode: 'file',
              requested_tmdb_id: tmdbID,
              tmdb_id: tmdbID || '本地解析或运行时匹配',
              title: '运行时本地识别',
              media_type: '运行时本地识别',
              tmdb_status: lookupTMDB ? '运行时查询' : 'skipped',
              applied_words: [],
              total_files: 1,
              recognized_count: 1,
              failed_count: 0,
              items: [],
              failed_items: [],
              partial: false,
            },
          };
        }

        const input = resolveConfiguredString(context, config.input);
        return {
          active: true,
          tone: input ? 'success' : 'warning',
          label: tmdbID
            ? `将用 TMDB ${tmdbID} 辅助 FilmFusion 本地识别`
            : '将用 FilmFusion 本地词表识别标题',
          detail: `${String(input || '标题尚未解析')} · ${lookupTMDB ? '查询 TMDB' : '仅本地解析'} · 不调用 MP2`,
          selectedPorts: [input ? 'success' : 'failure'],
          output: {
            engine: 'local',
            mode: 'title',
            input,
            recognize_input: input,
            processed_input: input,
            requested_tmdb_id: tmdbID,
            tmdb_id: tmdbID || '本地解析或运行时匹配',
            title: '运行时本地识别',
            year: '运行时本地识别',
            media_type: '运行时本地识别',
            season_episode: '运行时本地识别',
            category: '运行时匹配',
            rating: '运行时匹配',
            quality: '运行时本地识别',
            poster_url: '运行时匹配',
            tmdb_status: lookupTMDB ? '运行时查询' : 'skipped',
            applied_words: [],
          },
        };
      }
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
