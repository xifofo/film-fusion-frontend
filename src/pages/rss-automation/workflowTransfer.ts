import type {
  RSSAutomationDefinition,
  RSSAutomationEdgeDefinition,
  RSSAutomationNodeDefinition,
  RSSAutomationNodeType,
} from '@/services/film-fusion';
import {
  automationJSONPointerError,
  automationVariableNameError,
} from './variableNodes';

export const RSS_WORKFLOW_TRANSFER_FORMAT = 'film-fusion-rss-workflow';
export const RSS_WORKFLOW_TRANSFER_VERSION = 1;
export const RSS_WORKFLOW_TRANSFER_MAX_BYTES = 1024 * 1024;

const nodeTypes: RSSAutomationNodeType[] = [
  'trigger',
  'delay',
  'regex',
  'keyword',
  'keyword_replace',
  'regex_replace',
  'convert',
  'set_variable',
  'template',
  'json_extract',
  'math',
  'datetime_operation',
  'list_operation',
  'switch',
  'coalesce',
  'deduplicate',
  'rate_limit',
  'foreach',
  'if',
  'parallel',
  'join',
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

const switchOperators = new Set([
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'contains',
  'not_contains',
  'starts_with',
  'ends_with',
  'regex',
  'in',
  'exists',
  'not_exists',
]);

const foreachTransformTypes = new Set([
  'template',
  'json_extract',
  'math',
  'coalesce',
  'datetime_operation',
]);

const compareAsValues = new Set([
  'auto',
  'string',
  'number',
  'boolean',
  'datetime',
]);
const variableValueTypes = new Set([
  'auto',
  'string',
  'integer',
  'number',
  'boolean',
  'datetime',
  'json',
]);
const datetimeFormats = new Set([
  'rfc3339',
  'rfc1123',
  'date',
  'datetime',
  'unix_seconds',
  'unix_milliseconds',
]);
const listOperations = new Set([
  'split',
  'join',
  'unique',
  'sort',
  'reverse',
  'slice',
  'pluck',
  'length',
]);

const configEnum = (
  config: Record<string, unknown> | undefined,
  key: string,
  fallback: string,
  allowed: Set<string>,
  label: string,
) => {
  const value = String(config?.[key] || fallback)
    .trim()
    .toLowerCase();
  if (!allowed.has(value)) throw new Error(`${label}无效`);
  return value;
};

const optionalBoolean = (
  config: Record<string, unknown> | undefined,
  key: string,
  label: string,
) => {
  if (config && key in config && typeof config[key] !== 'boolean') {
    throw new Error(`${label}必须是布尔值`);
  }
};

const optionalInteger = (
  config: Record<string, unknown> | undefined,
  key: string,
  fallback: number,
  minimum: number,
  maximum: number,
  label: string,
) => {
  const configured = config?.[key];
  const value =
    configured === undefined ||
    configured === null ||
    (typeof configured === 'string' && !configured.trim())
      ? fallback
      : Number(configured);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label}必须是 ${minimum} 到 ${maximum} 的整数`);
  }
  return value;
};

const validateVariableWriter = (
  id: string,
  config: Record<string, unknown> | undefined,
) => {
  const error = automationVariableNameError(config?.variable);
  if (error) throw new Error(`节点 ${id}：${error}`);
  configEnum(
    config,
    'overwrite',
    'overwrite',
    new Set(['overwrite', 'keep', 'error']),
    `节点 ${id} 的变量覆盖策略`,
  );
};

const validateCoalesceTransferConfig = (
  id: string,
  config: Record<string, unknown> | undefined,
) => {
  const candidates = config?.candidates ?? [];
  if (!Array.isArray(candidates) || candidates.length > 32) {
    throw new Error(`节点 ${id} 的候选值必须是最多 32 项的数组`);
  }
  configEnum(
    config,
    'missing',
    'skip',
    new Set(['skip', 'failure']),
    `节点 ${id} 的缺失策略`,
  );
  configEnum(
    config,
    'on_empty',
    'failure',
    new Set(['failure', 'default']),
    `节点 ${id} 的空值策略`,
  );
  configEnum(
    config,
    'value_type',
    'auto',
    variableValueTypes,
    `节点 ${id} 的结果类型`,
  );
  for (const key of [
    'skip_null',
    'skip_empty_string',
    'skip_empty_array',
    'skip_empty_object',
    'trim_strings',
  ]) {
    optionalBoolean(config, key, `节点 ${id} 的 ${key}`);
  }
};

const validateDatetimeTransferConfig = (
  id: string,
  config: Record<string, unknown> | undefined,
) => {
  const operation = configEnum(
    config,
    'operation',
    'parse',
    new Set(['parse', 'format', 'add', 'diff', 'start_of']),
    `节点 ${id} 的日期操作`,
  );
  const inputFormat = String(config?.input_format || 'auto')
    .trim()
    .toLowerCase();
  if (inputFormat !== 'auto' && !datetimeFormats.has(inputFormat)) {
    throw new Error(`节点 ${id} 的日期输入格式无效`);
  }
  configEnum(
    config,
    'output_format',
    'rfc3339',
    datetimeFormats,
    `节点 ${id} 的日期输出格式`,
  );
  const unit = String(config?.unit || 'second')
    .trim()
    .toLowerCase();
  const units =
    operation === 'start_of'
      ? new Set(['day', 'week', 'month', 'year'])
      : operation === 'diff'
        ? new Set(['millisecond', 'second', 'minute', 'hour', 'day', 'week'])
        : new Set([
            'millisecond',
            'second',
            'minute',
            'hour',
            'day',
            'week',
            'month',
            'year',
          ]);
  if (['add', 'diff', 'start_of'].includes(operation) && !units.has(unit)) {
    throw new Error(`节点 ${id} 的日期单位无效`);
  }
  if (operation === 'diff') {
    if (!config || !('right' in config)) {
      throw new Error(`节点 ${id} 的日期差缺少 right`);
    }
    optionalInteger(config, 'precision', 0, 0, 6, `节点 ${id} 的日期精度`);
  }
  const timezone = String(config?.timezone || 'Asia/Shanghai');
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(0);
  } catch {
    throw new Error(`节点 ${id} 的时区无效`);
  }
};

const validateTransferNodeConfig = (
  id: string,
  type: RSSAutomationNodeType,
  config?: Record<string, unknown>,
) => {
  if (
    ['datetime_operation', 'list_operation', 'coalesce', 'foreach'].includes(
      type,
    )
  ) {
    validateVariableWriter(id, config);
  }
  if (type === 'datetime_operation') validateDatetimeTransferConfig(id, config);
  if (type === 'list_operation') {
    configEnum(
      config,
      'operation',
      'unique',
      listOperations,
      `节点 ${id} 的列表操作`,
    );
    configEnum(
      config,
      'missing',
      'failure',
      new Set(['failure', 'skip', 'null']),
      `节点 ${id} 的列表缺失策略`,
    );
    configEnum(
      config,
      'direction',
      'asc',
      new Set(['asc', 'desc']),
      `节点 ${id} 的排序方向`,
    );
    configEnum(
      config,
      'compare_as',
      'auto',
      compareAsValues,
      `节点 ${id} 的比较类型`,
    );
    for (const key of ['trim_items', 'omit_empty']) {
      optionalBoolean(config, key, `节点 ${id} 的 ${key}`);
    }
    const pointerError = automationJSONPointerError(config?.pointer);
    if (pointerError) throw new Error(`节点 ${id}：${pointerError}`);
    optionalInteger(config, 'offset', 0, -10000, 10000, `节点 ${id} 的 offset`);
    optionalInteger(config, 'limit', 100, 0, 10000, `节点 ${id} 的 limit`);
  }
  if (type === 'switch') {
    configEnum(
      config,
      'compare_as',
      'auto',
      compareAsValues,
      `节点 ${id} 的比较类型`,
    );
    optionalBoolean(config, 'case_sensitive', `节点 ${id} 的大小写配置`);
    if (!Array.isArray(config?.cases) || config.cases.length === 0) {
      throw new Error(`节点 ${id} 至少需要一个多路分支条件`);
    }
    if (config.cases.length > 20) {
      throw new Error(`节点 ${id} 的多路分支条件不能超过 20 个`);
    }
    const caseIDs = new Set<string>();
    for (const candidate of config.cases) {
      if (!isRecord(candidate)) {
        throw new Error(`节点 ${id} 的多路分支条件格式不正确`);
      }
      const caseID = requiredString(candidate.id, `节点 ${id} 条件 ID`);
      if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/.test(caseID)) {
        throw new Error(`节点 ${id} 的条件 ID 无效`);
      }
      const normalizedCaseID = caseID.toLowerCase();
      if (caseIDs.has(normalizedCaseID)) {
        throw new Error(`节点 ${id} 存在重复条件 ID`);
      }
      caseIDs.add(normalizedCaseID);
      requiredString(candidate.label, `节点 ${id} 条件名称`);
      const operator = requiredString(
        candidate.operator,
        `节点 ${id} 条件比较符`,
      );
      if (!switchOperators.has(operator)) {
        throw new Error(`节点 ${id} 使用了未知比较符`);
      }
      if (
        !['exists', 'not_exists'].includes(operator) &&
        !('value' in candidate)
      ) {
        throw new Error(`节点 ${id} 的条件 ${caseID} 缺少比较值`);
      }
      if (
        operator === 'in' &&
        !Array.isArray(candidate.value) &&
        !(
          typeof candidate.value === 'string' &&
          (candidate.value.trim().startsWith('$') ||
            candidate.value.includes('{{'))
        )
      ) {
        throw new Error(`节点 ${id} 的条件 ${caseID} 必须使用数组比较值`);
      }
    }
  }
  if (type === 'coalesce') validateCoalesceTransferConfig(id, config);
  if (type === 'deduplicate' || type === 'rate_limit') {
    if (!config || !('key' in config)) throw new Error(`节点 ${id} 缺少状态键`);
    const scope = configEnum(
      config,
      'scope',
      'workflow',
      new Set(['source', 'workflow', 'global']),
      `节点 ${id} 的状态范围`,
    );
    const namespace = String(config.namespace || '').trim();
    if (scope === 'global' && !namespace) {
      throw new Error(`节点 ${id} 的全局范围必须填写命名空间`);
    }
    if (namespace && Array.from(namespace).length > 80) {
      throw new Error(`节点 ${id} 的命名空间不能超过 80 个字符`);
    }
    configEnum(
      config,
      'normalize',
      'trim',
      new Set(['none', 'trim', 'trim_lower']),
      `节点 ${id} 的键标准化方式`,
    );
  }
  if (type === 'deduplicate') {
    optionalInteger(
      config,
      'ttl_seconds',
      604800,
      60,
      31536000,
      `节点 ${id} 的 TTL`,
    );
    optionalBoolean(config, 'refresh_on_duplicate', `节点 ${id} 的刷新配置`);
  }
  if (type === 'rate_limit') {
    optionalInteger(config, 'limit', 1, 1, 10000, `节点 ${id} 的限额`);
    const window = optionalInteger(
      config,
      'window_seconds',
      60,
      1,
      2592000,
      `节点 ${id} 的窗口`,
    );
    optionalInteger(
      config,
      'max_wait_seconds',
      window,
      1,
      2592000,
      `节点 ${id} 的最长等待`,
    );
    configEnum(
      config,
      'behavior',
      'defer',
      new Set(['defer', 'branch']),
      `节点 ${id} 的限流行为`,
    );
  }
  if (type === 'foreach') {
    if (!isRecord(config?.transform)) {
      throw new Error(`节点 ${id} 缺少遍历变换`);
    }
    const transformType = requiredString(
      config.transform.type,
      `节点 ${id} 遍历变换类型`,
    );
    if (!foreachTransformTypes.has(transformType)) {
      throw new Error(`节点 ${id} 使用了不允许的遍历变换`);
    }
    if (!isRecord(config.transform.config)) {
      throw new Error(`节点 ${id} 的遍历变换配置不正确`);
    }
    if (
      'variable' in config.transform.config ||
      'overwrite' in config.transform.config
    ) {
      throw new Error(`节点 ${id} 的遍历变换不能写入流程变量`);
    }
    configEnum(
      config,
      'on_error',
      'fail_fast',
      new Set(['fail_fast', 'collect']),
      `节点 ${id} 的遍历失败策略`,
    );
    if (transformType === 'coalesce') {
      validateCoalesceTransferConfig(id, config.transform.config);
    }
    if (transformType === 'datetime_operation') {
      validateDatetimeTransferConfig(id, config.transform.config);
    }
    const maxItems = Number(config.max_items ?? 100);
    if (!Number.isInteger(maxItems) || maxItems < 1 || maxItems > 1000) {
      throw new Error(`节点 ${id} 的最大遍历数量无效`);
    }
  }
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
  validateTransferNodeConfig(id, node.type, config);
  if (config) {
    node.config = config;
  }
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

  const nodesByID = new Map(nodes.map((node) => [node.id, node]));
  for (const edge of edges) {
    const source = nodesByID.get(edge.source);
    if (!source) continue;
    const port = [
      'datetime_operation',
      'list_operation',
      'switch',
      'coalesce',
      'deduplicate',
      'rate_limit',
      'foreach',
    ].includes(source.type)
      ? edge.source_port.trim().toLowerCase()
      : edge.source_port;
    if (port !== edge.source_port) edge.source_port = port;
    if (port === 'always') continue;
    const fixedPorts: Partial<Record<RSSAutomationNodeType, string[]>> = {
      datetime_operation: ['success', 'failure'],
      list_operation: ['success', 'empty', 'failure'],
      coalesce: ['success', 'failure'],
      deduplicate: ['new', 'duplicate', 'failure'],
      rate_limit: ['allowed', 'throttled', 'failure'],
      foreach: ['success', 'partial', 'empty', 'failure'],
    };
    if (source.type === 'switch') {
      const casePorts = new Set(
        (Array.isArray(source.config?.cases) ? source.config.cases : [])
          .filter(isRecord)
          .map(
            (candidate) => `case-${String(candidate.id || '').toLowerCase()}`,
          )
          .concat(['default', 'failure']),
      );
      if (!casePorts.has(port)) {
        throw new Error(`连线 ${edge.id} 使用了不存在的多路分支出口`);
      }
      continue;
    }
    const allowed = fixedPorts[source.type];
    if (allowed && !allowed.includes(port)) {
      throw new Error(`连线 ${edge.id} 的出口不适用于 ${source.type} 节点`);
    }
  }

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
    if (
      node.type === 'offline115' ||
      node.type === 'offline115_openapi' ||
      node.type === 'rename115_openapi'
    ) {
      if ('cloud_storage_id' in config) {
        if (
          node.type === 'offline115_openapi' ||
          node.type === 'rename115_openapi'
        ) {
          removed.offline115_openapi_accounts += 1;
        } else {
          removed.offline115_accounts += 1;
        }
        delete config.cloud_storage_id;
      }
    }
    if (node.type === 'offline115' || node.type === 'offline115_openapi') {
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
    (node) =>
      node.type === 'offline115_openapi' || node.type === 'rename115_openapi',
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
