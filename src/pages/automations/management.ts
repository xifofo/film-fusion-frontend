import type {
  AutomationCreateInput,
  AutomationDefinition,
  AutomationSettings,
} from '@/services/film-fusion';

export const defaultAutomationSettings = (
  source_id: number,
): AutomationSettings => ({
  source_id,
  group_name: '',
  alerts_enabled: false,
  failure_threshold: 3,
  stuck_minutes: 60,
  source_errors: true,
  cooldown_minutes: 60,
});

export const parameterNamePattern = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const forbiddenNames = new Set(['__proto__', 'prototype', 'constructor']);
export const validateParameters = (
  parameters: AutomationDefinition['parameters'] = {},
) => {
  if (Object.keys(parameters).length > 100)
    throw new Error('流程参数不能超过 100 个');
  for (const [name, value] of Object.entries(parameters)) {
    if (
      !parameterNamePattern.test(name) ||
      forbiddenNames.has(name.toLowerCase())
    )
      throw new Error(`参数名 ${name} 无效，请使用字母、数字和下划线`);
    if (!['string', 'number', 'boolean'].includes(typeof value))
      throw new Error(`参数 ${name} 只支持文本、数字或布尔值`);
    if (typeof value === 'number' && !Number.isFinite(value))
      throw new Error(`参数 ${name} 不是有效数字`);
  }
};

export const resolveDefinitionParameters = (
  definition: AutomationDefinition,
): AutomationDefinition => {
  const parameters = definition.parameters || {};
  validateParameters(parameters);
  const lookup = (name: string) => {
    if (!Object.hasOwn(parameters, name))
      throw new Error(`流程参数 ${name} 未定义`);
    return parameters[name];
  };
  const resolve = (raw: unknown): unknown => {
    if (typeof raw === 'string') {
      if (/^\$params\.[A-Za-z_][A-Za-z0-9_]*$/.test(raw))
        return lookup(raw.slice(8));
      return raw.replace(
        /\{\{\s*params\.([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g,
        (_, name) => String(lookup(name)),
      );
    }
    if (Array.isArray(raw)) return raw.map(resolve);
    if (raw && typeof raw === 'object')
      return Object.fromEntries(
        Object.entries(raw).map(([key, value]) => [key, resolve(value)]),
      );
    return raw;
  };
  return {
    ...definition,
    nodes: definition.nodes.map((node) => {
      const config = resolve(node.config || {}) as Record<string, unknown>;
      for (const [field, name] of Object.entries(
        node.parameter_bindings || {},
      )) {
        if (
          !parameterNamePattern.test(field) ||
          forbiddenNames.has(field.toLowerCase())
        )
          throw new Error('参数绑定字段无效');
        config[field] = lookup(name);
      }
      return { ...node, config };
    }),
  };
};

export const bindingLabels: Record<string, string> = {
  cloud_storage_id: '115 账号',
  target_id: '下载器',
  cloud_directory_id: '整理目录配置',
  directory_id: '网盘目录 ID',
  directory_path: '目录路径',
  save_path: '下载保存路径',
  category: '媒体分类',
  channel: '通知渠道',
  url: '请求或下载地址',
  torrent_url: '种子地址',
};

export const parameterFieldLabels: Record<string, string> = {
  ...bindingLabels,
  title: '标题',
  message: '通知内容',
  delay_seconds: '延迟秒数',
  timeout_seconds: '超时秒数',
  poll_interval_seconds: '检查间隔秒数',
  dry_run: '仅预览',
  media_type: '媒体类型',
  recognition_source: '识别引擎',
  lookup_tmdb: '查询 TMDB',
  field: '输入字段',
  value: '值',
  expression: '表达式',
  pattern: '匹配规则',
  replacement: '替换内容',
  template: '文本模板',
  method: '请求方法',
  body: '请求内容',
};

export type AutomationBinding = {
  key: string;
  field: string;
  value: string | number;
  locations: { nodeID?: string; label: string }[];
};
export const collectAutomationBindings = (
  input: AutomationCreateInput,
): AutomationBinding[] => {
  const groups = new Map<string, AutomationBinding>();
  const add = (
    field: string,
    value: unknown,
    label: string,
    nodeID?: string,
  ) => {
    if (
      !(field in bindingLabels) ||
      (typeof value !== 'string' && typeof value !== 'number')
    )
      return;
    const key = `${field}:${JSON.stringify(value)}`;
    const group = groups.get(key) || { key, field, value, locations: [] };
    group.locations.push({ nodeID, label });
    groups.set(key, group);
  };
  if (input.source.trigger_type === '115_directory') {
    add('cloud_storage_id', input.source.cloud_storage_id || 0, '触发器');
    add('directory_id', input.source.directory_id || '', '触发器');
    add('directory_path', input.source.directory_path || '/', '触发器');
  }
  const definition = resolveDefinitionParameters(input.workflow.definition);
  for (const node of definition.nodes) {
    const config = { ...node.config };
    if (node.type === 'qbittorrent') config.target_id ??= 0;
    if (
      [
        'offline115',
        'offline115_openapi',
        'rename115_openapi',
        'torrent115_openapi',
        'offline115_bt_openapi',
        'list115_tasks_openapi',
        'quota115_openapi',
        'delete115_task_openapi',
        'clear115_tasks_openapi',
      ].includes(node.type)
    )
      config.cloud_storage_id ??= 0;
    if (
      ['offline115', 'offline115_openapi', 'offline115_bt_openapi'].includes(
        node.type,
      )
    )
      config.directory_id ??= '';
    if (
      [
        'organize_strm',
        'media_exists',
        'strm_verify',
        'strm_regenerate',
      ].includes(node.type)
    )
      config.cloud_directory_id ??= 0;
    for (const [field, value] of Object.entries(config))
      add(field, value, node.name || node.type, node.id);
  }
  return [...groups.values()];
};

export const replaceAutomationBindings = (
  input: AutomationCreateInput,
  replacements: Record<string, string | number>,
): AutomationCreateInput => {
  const copy = structuredClone(input);
  for (const binding of collectAutomationBindings(input)) {
    if (!Object.hasOwn(replacements, binding.key)) continue;
    const value = replacements[binding.key];
    for (const location of binding.locations) {
      if (!location.nodeID) {
        Object.assign(copy.source, { [binding.field]: value });
        continue;
      }
      const node = copy.workflow.definition.nodes.find(
        (candidate) => candidate.id === location.nodeID,
      );
      if (!node) continue;
      const raw = node.config?.[binding.field];
      const parameter =
        node.parameter_bindings?.[binding.field] ||
        (typeof raw === 'string' && /^\$params\.[A-Za-z_]\w*$/.test(raw)
          ? raw.slice(8)
          : undefined);
      if (parameter)
        copy.workflow.definition.parameters = {
          ...copy.workflow.definition.parameters,
          [parameter]: value,
        };
      else node.config = { ...node.config, [binding.field]: value };
    }
  }
  return copy;
};

export const automationChanges = (
  before: AutomationCreateInput,
  after: AutomationCreateInput,
) => {
  const changes: {
    key: string;
    label: string;
    before: unknown;
    after: unknown;
  }[] = [];
  const add = (key: string, label: string, a: unknown, b: unknown) => {
    if (JSON.stringify(a) !== JSON.stringify(b))
      changes.push({ key, label, before: a, after: b });
  };
  for (const key of new Set([
    ...Object.keys(before.source),
    ...Object.keys(after.source),
  ])) {
    if (key === 'enabled') continue;
    add(
      `source.${key}`,
      `来源 · ${bindingLabels[key] || ({ name: '名称', description: '说明', feed_url: 'RSS 地址', mapping: '解析字段', interval_minutes: '检查间隔', interval_seconds: '检查间隔', quiet_seconds: '稳定等待', recursive: '包含子目录' } as Record<string, string>)[key] || key}`,
      (before.source as Record<string, unknown>)[key],
      (after.source as Record<string, unknown>)[key],
    );
  }
  add('name', '流程名称', before.workflow.name, after.workflow.name);
  add(
    'description',
    '流程说明',
    before.workflow.description,
    after.workflow.description,
  );
  add(
    'parameters',
    '流程参数',
    before.workflow.definition.parameters || {},
    after.workflow.definition.parameters || {},
  );
  const previous = new Map(
    before.workflow.definition.nodes.map((node) => [node.id, node]),
  );
  const current = new Map(
    after.workflow.definition.nodes.map((node) => [node.id, node]),
  );
  for (const id of new Set([...previous.keys(), ...current.keys()]))
    add(
      `node.${id}`,
      `节点 · ${current.get(id)?.name || previous.get(id)?.name || id}`,
      previous.get(id),
      current.get(id),
    );
  add(
    'edges',
    '节点连线',
    before.workflow.definition.edges,
    after.workflow.definition.edges,
  );
  return changes;
};

export const readTemplateConfiguration = (
  raw: string,
): AutomationCreateInput => {
  if (new TextEncoder().encode(raw).length > 1024 * 1024)
    throw new Error('模板不能超过 1 MiB');
  const input = JSON.parse(raw) as AutomationCreateInput;
  if (
    !input.source ||
    !['rss', '115_directory'].includes(input.source.trigger_type) ||
    input.workflow?.definition?.schema_version !== 1 ||
    !Array.isArray(input.workflow.definition.nodes) ||
    !input.workflow.definition.nodes.length ||
    !Array.isArray(input.workflow.definition.edges)
  )
    throw new Error('模板格式不正确');
  if (
    input.workflow.definition.nodes.length > 200 ||
    input.workflow.definition.edges.length > 500
  )
    throw new Error('模板流程过大');
  resolveDefinitionParameters(input.workflow.definition);
  input.source.enabled = false;
  input.workflow.enabled = false;
  delete input.expected_version;
  return input;
};

// A shared template keeps structure and references, with values cleared for its
// recipient to provide. Custom URL/text fields can carry private credentials.
export const portableAutomationTemplate = (
  input: AutomationCreateInput,
): AutomationCreateInput => {
  const copy = structuredClone(input);
  copy.source.enabled = copy.workflow.enabled = false;
  delete copy.expected_version;
  copy.source.feed_url = '';
  copy.source.cloud_storage_id = 0;
  copy.source.directory_id = '';
  copy.source.directory_path = '';
  for (const [name, value] of Object.entries(
    copy.workflow.definition.parameters || {},
  )) {
    copy.workflow.definition.parameters = {
      ...copy.workflow.definition.parameters,
      [name]:
        typeof value === 'boolean' ? false : typeof value === 'number' ? 0 : '',
    };
  }
  for (const node of copy.workflow.definition.nodes) {
    for (const key of Object.keys(node.config || {})) {
      if (
        key in bindingLabels ||
        /url|token|secret|password|cookie|authorization|headers|api_key/i.test(
          key,
        )
      ) {
        const value = node.config?.[key];
        if (
          typeof value === 'string' &&
          (/^\$(?:params|item|nodes|vars)\.[A-Za-z0-9_.]+$/.test(value) ||
            (/\{\{\s*(?:params|item|nodes|vars)\.[A-Za-z0-9_.]+\s*\}\}/.test(
              value,
            ) &&
              value
                .replace(
                  /\{\{\s*(?:params|item|nodes|vars)\.[A-Za-z0-9_.]+\s*\}\}/g,
                  '',
                )
                .trim() === ''))
        )
          continue;
        node.config = {
          ...node.config,
          [key]: typeof value === 'number' ? 0 : key === 'headers' ? {} : '',
        };
      }
    }
    if (node.ui) {
      delete node.ui.directory_path;
      delete node.ui.preview;
    }
  }
  return copy;
};
