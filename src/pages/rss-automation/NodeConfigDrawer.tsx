import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import {
  Alert,
  AutoComplete,
  Button,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Typography,
} from 'antd';
import { useEffect } from 'react';
import type {
  RSSAutomationNodeDefinition,
  RSSAutomationNodeProtocol,
  RSSAutomationTarget,
} from '@/services/film-fusion';
import {
  AUTOMATION_DELAY_MAX_SECONDS,
  type AutomationDelayUnit,
  automationDelayMaxValue,
  automationDelayParts,
  automationDelayUnitOptions,
  toAutomationDelaySeconds,
} from '../automations/delay';
import {
  automationCompareAsOptions,
  automationDatetimeDifferenceUnitOptions,
  automationDatetimeDurationUnitOptions,
  automationDatetimeInputFormatOptions,
  automationDatetimeOperationOptions,
  automationDatetimeOutputFormatOptions,
  automationDatetimeStartUnitOptions,
  automationForeachTransformOptions,
  automationGuardNormalizeOptions,
  automationGuardScopeOptions,
  automationListOperationOptions,
  automationSwitchOperatorOptions,
} from './advancedNodes';
import DirectoryIdInput from './DirectoryIdInput';
import { NODE_LABELS } from './flow';
import styles from './index.module.less';
import type { RSSAutomationNodePreview } from './preview';
import TemplateVariableInput from './TemplateVariableInput';
import {
  automationJSONPointerError,
  automationMathOperationOptions,
  automationUnaryMathOperations,
  automationVariableNameError,
  automationVariableOverwriteOptions,
  automationVariableValueTypeOptions,
  normalizeAutomationVariableName,
} from './variableNodes';

const { Text } = Typography;

type NodeConfigModalProps = {
  node?: RSSAutomationNodeDefinition;
  targets: RSSAutomationTarget[];
  cloudStorages: API.CloudStorage[];
  cloudDirectories: API.CloudDirectory[];
  fieldReferences: NodeFieldReference[];
  nodeProtocol?: RSSAutomationNodeProtocol;
  preview?: RSSAutomationNodePreview;
  onClose: () => void;
  onChange: (node: RSSAutomationNodeDefinition) => void;
  onDelete: (node: RSSAutomationNodeDefinition) => void;
};

export type NodeFieldReference = {
  kind: 'item' | 'variable' | 'node' | 'each';
  name: string;
  value: string;
  preview?: string;
  dataType?: string;
  description?: string;
};

type NodeInputProtocolMap = Map<
  string,
  RSSAutomationNodeProtocol['inputs'][number]
>;

const valueTypeOptions = [
  { label: '文本 string', value: 'string' },
  { label: '整数 integer', value: 'integer' },
  { label: '小数 number', value: 'number' },
  { label: '布尔 boolean', value: 'boolean' },
  { label: '日期 datetime', value: 'datetime' },
];

const conditionOperators = [
  ['大于', 'gt'],
  ['大于等于', 'gte'],
  ['小于', 'lt'],
  ['小于等于', 'lte'],
  ['等于', 'eq'],
  ['不等于', 'neq'],
  ['包含', 'contains'],
  ['不包含', 'not_contains'],
  ['开头是', 'starts_with'],
  ['结尾是', 'ends_with'],
  ['正则匹配', 'regex'],
  ['属于列表', 'in'],
  ['存在', 'exists'],
  ['不存在', 'not_exists'],
].map(([label, value]) => ({ label, value }));

const keywordModeOptions = [
  { label: '包含任一关键词', value: 'contains_any' },
  { label: '包含全部关键词', value: 'contains_all' },
  { label: '不能包含任一关键词', value: 'contains_none' },
];

const normalizeKeywords = (raw: unknown) => {
  const values = Array.isArray(raw) ? raw : [];
  return values
    .map((value) => String(value).trim())
    .filter(Boolean)
    .filter((value, index, keywords) => keywords.indexOf(value) === index);
};

const normalizeReplacementRules = (raw: unknown) => {
  const values = Array.isArray(raw) ? raw : [];
  return values.map((value) => {
    const rule =
      value && typeof value === 'object'
        ? (value as Record<string, unknown>)
        : {};
    return {
      keyword: String(rule.keyword ?? '').trim(),
      replacement: String(rule.replacement ?? ''),
    };
  });
};

const normalizeBranches = (raw: unknown) => {
  const values = Array.isArray(raw) ? raw : [];
  return values
    .map((value) => String(value).trim())
    .filter(Boolean)
    .map((value) => (value.startsWith('branch-') ? value : `branch-${value}`))
    .filter((value, index, branches) => branches.indexOf(value) === index);
};

const normalizeSwitchCases = (raw: unknown) => {
  const cases = Array.isArray(raw) ? raw : [];
  const used = new Set<string>();
  return cases.map((candidate, index) => {
    const record =
      candidate && typeof candidate === 'object' && !Array.isArray(candidate)
        ? (candidate as Record<string, unknown>)
        : {};
    let id = String(record.id || `case${index + 1}`)
      .trim()
      .replace(/[^A-Za-z0-9_-]/g, '_')
      .slice(0, 40);
    if (!/^[A-Za-z0-9]/.test(id)) id = `case${index + 1}_${id}`.slice(0, 40);
    if (!id) id = `case${index + 1}`;
    const baseID = id;
    let suffix = 2;
    while (used.has(id.toLowerCase())) {
      const addition = `_${suffix}`;
      id = `${baseID.slice(0, 40 - addition.length)}${addition}`;
      suffix += 1;
    }
    used.add(id.toLowerCase());
    const operator = String(record.operator || 'eq');
    let value = record.value ?? '';
    if (operator === 'in' && typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) value = parsed;
        } catch {
          // Preserve invalid editor text; the form validator explains the issue.
        }
      }
    } else {
      value = variableEditorValue(value, 'auto');
    }
    return {
      id,
      label: String(record.label || `条件 ${index + 1}`).trim(),
      operator,
      value,
    };
  });
};

const foreachReferences: NodeFieldReference[] = [
  {
    kind: 'each',
    name: '当前项',
    value: '$each.item',
    dataType: 'any',
    description: '当前正在映射的列表项',
  },
  {
    kind: 'each',
    name: '索引',
    value: '$each.index',
    dataType: 'integer',
    description: '从 0 开始的当前项索引',
  },
  {
    kind: 'each',
    name: '总数',
    value: '$each.count',
    dataType: 'integer',
    description: '输入列表的总项数',
  },
  {
    kind: 'each',
    name: '是否首项',
    value: '$each.first',
    dataType: 'boolean',
    description: '当前项是否为列表第一项',
  },
  {
    kind: 'each',
    name: '是否末项',
    value: '$each.last',
    dataType: 'boolean',
    description: '当前项是否为列表最后一项',
  },
];

const parseHTTPHeaders = (raw: unknown): Record<string, string> => {
  const text = String(raw ?? '').trim();
  if (!text) return {};
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('请求头必须是 JSON 对象');
  }
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(parsed)) {
    if (
      !name.trim() ||
      !['string', 'number', 'boolean'].includes(typeof value)
    ) {
      throw new Error('请求头的名称不能为空，值必须是文本或标量');
    }
    headers[name] = String(value);
  }
  return headers;
};

const conditionValue = (operator: string, raw: unknown) => {
  if (operator === 'in') {
    return String(raw ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (['gt', 'gte', 'lt', 'lte'].includes(operator)) {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : raw;
  }
  return raw;
};

const variableEditorValue = (raw: unknown, valueType: unknown) => {
  if (typeof raw !== 'string') return raw;
  const text = raw.trim();
  if (!text || text.startsWith('$') || text.includes('{{')) return raw;
  if (valueType !== 'auto' && valueType !== 'json') return raw;
  if (
    valueType === 'json' ||
    /^(?:null|true|false|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|\[|\{)/.test(
      text,
    )
  ) {
    try {
      return JSON.parse(text);
    } catch {
      return raw;
    }
  }
  return raw;
};

const TemplateConfigField = ({
  field,
  label,
  references,
  protocol,
  placeholder,
  required = false,
  insertMode = 'reference',
}: {
  field: string;
  label: string;
  references: NodeFieldReference[];
  protocol?: RSSAutomationNodeProtocol['inputs'][number];
  placeholder?: string;
  required?: boolean;
  insertMode?: 'reference' | 'template';
}) => (
  <Form.Item
    className={styles.nodeConfigFull}
    extra={protocol ? protocolFieldExtra(protocol) : undefined}
    label={label}
    name={field}
    rules={required ? [{ required: true }] : undefined}
  >
    <TemplateVariableInput
      ariaLabel={label}
      insertMode={insertMode}
      placeholder={placeholder || '输入内容，或点击“插入变量”'}
      references={references}
    />
  </Form.Item>
);

const displayReferencePreview = (value?: string) => {
  const preview = String(value || '').trim();
  return preview ? ` · 当前样本：${preview}` : '';
};

const VariableNameField = ({
  references,
  label = '保存变量名',
}: {
  references: NodeFieldReference[];
  label?: string;
}) => {
  const options = references
    .filter((reference) => reference.kind === 'variable')
    .map((reference) => ({
      label: `${reference.name}${reference.description ? ` · ${reference.description}` : ''}${displayReferencePreview(reference.preview)}`,
      value: reference.name,
    }));
  return (
    <Form.Item
      label={label}
      name="variable"
      rules={[
        { required: true, message: '请输入变量名' },
        {
          validator: (_, value) => {
            const error = automationVariableNameError(value);
            return error ? Promise.reject(new Error(error)) : Promise.resolve();
          },
        },
      ]}
    >
      <VariableNameInput options={options} />
    </Form.Item>
  );
};

const VariableNameInput = ({
  options,
  value,
  onChange,
}: {
  options: Array<{ label: string; value: string }>;
  value?: string;
  onChange?: (value: string) => void;
}) => (
  <Space.Compact block>
    <Input
      aria-label="流程变量前缀"
      readOnly
      style={{ width: 76 }}
      tabIndex={-1}
      value="$vars."
    />
    <AutoComplete
      onChange={onChange}
      options={options}
      placeholder="输入新变量名，或选择上游变量"
      showSearch={{
        filterOption: (input, option) =>
          `${option?.label || ''} ${option?.value || ''}`
            .toLowerCase()
            .includes(input.toLowerCase()),
      }}
      style={{ width: 'calc(100% - 76px)' }}
      value={value}
    >
      <Input maxLength={64} />
    </AutoComplete>
  </Space.Compact>
);

const VariableWriteFields = ({
  references,
  variable,
  overwrite,
}: {
  references: NodeFieldReference[];
  variable: unknown;
  overwrite: unknown;
}) => {
  const normalized = normalizeAutomationVariableName(variable);
  const existing = references.find(
    (reference) =>
      reference.kind === 'variable' && reference.name === normalized,
  );
  return (
    <>
      <VariableNameField references={references} />
      <Form.Item
        extra="目标变量不存在时，三种策略都会创建变量。"
        label="已有变量时"
        name="overwrite"
        rules={[{ required: true }]}
      >
        <Select options={automationVariableOverwriteOptions} />
      </Form.Item>
      {existing && (
        <Alert
          className={styles.nodeConfigFull}
          description={`${existing.description || '由上游节点写入'}${displayReferencePreview(existing.preview)}。当前策略：${
            overwrite === 'keep'
              ? '保留上游值，本节点不会写入'
              : overwrite === 'error'
                ? '运行到这里会走失败出口'
                : '用本节点结果覆盖上游值'
          }。`}
          showIcon
          title={`$vars.${normalized} 已由上游流程生成`}
          type={overwrite === 'overwrite' ? 'warning' : 'info'}
        />
      )}
    </>
  );
};

const protocolExample = (value: unknown) => {
  if (value == null || value === '') return '';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.replace(
    /\{\{([^{}]+)\}\}/g,
    (_, path: string) => `[变量：$${path}]`,
  );
};

const protocolFieldExtra = (
  protocol?: RSSAutomationNodeProtocol['inputs'][number],
) => {
  if (!protocol) return undefined;
  const example = protocolExample(protocol.example);
  return `${protocol.description}（${protocol.type}）${example ? ` 例：${example}` : ''}`;
};

const NodeConfigModal = ({
  node,
  targets,
  cloudStorages,
  cloudDirectories,
  fieldReferences,
  nodeProtocol,
  preview,
  onClose,
  onChange,
  onDelete,
}: NodeConfigModalProps) => {
  const [form] = Form.useForm<Record<string, any>>();
  const operator = Form.useWatch('condition_operator', form);
  const cloudStorageID = Form.useWatch('cloud_storage_id', form);
  const directoryPath = Form.useWatch('directory_path', form);
  const delayUnit = (Form.useWatch('delay_unit', form) ||
    'minutes') as AutomationDelayUnit;
  const filenameRegexEnabled = Form.useWatch('filename_regex_enabled', form);
  const recognitionMode = Form.useWatch('recognition_mode', form);
  const variable = Form.useWatch('variable', form);
  const overwrite = Form.useWatch('overwrite', form);
  const variableValueType = Form.useWatch('value_type', form);
  const jsonMissing = Form.useWatch('missing', form);
  const coalesceOnEmpty = Form.useWatch('on_empty', form);
  const mathOperation = Form.useWatch('operation', form);
  const mathResultType = Form.useWatch('result_type', form);
  const datetimeOperation = Form.useWatch('operation', form);
  const listOperation = Form.useWatch('operation', form);
  const guardScope = Form.useWatch('scope', form);
  const rateBehavior = Form.useWatch('behavior', form);
  const foreachTransformType = Form.useWatch('transform_type', form);
  const foreachJSONMissing = Form.useWatch('transform_json_missing', form);
  const foreachMathOperation = Form.useWatch('transform_math_operation', form);
  const foreachMathResultType = Form.useWatch(
    'transform_math_result_type',
    form,
  );
  const foreachCoalesceOnEmpty = Form.useWatch(
    'transform_coalesce_on_empty',
    form,
  );
  const foreachDatetimeOperation = Form.useWatch(
    'transform_datetime_operation',
    form,
  );
  const foreachFieldReferences = [...fieldReferences, ...foreachReferences];
  const inputProtocols: NodeInputProtocolMap = new Map(
    (nodeProtocol?.inputs || []).map((protocol) => [protocol.name, protocol]),
  );
  const inputProtocol = (field: string) => inputProtocols.get(field);
  useEffect(() => {
    if (!node) return;
    form.resetFields();
    const config = node.config || {};
    const delay = automationDelayParts(config.delay_seconds);
    const condition = (config.condition || {}) as Record<string, unknown>;
    const transform =
      config.transform &&
      typeof config.transform === 'object' &&
      !Array.isArray(config.transform)
        ? (config.transform as Record<string, unknown>)
        : {};
    const transformConfig =
      transform.config &&
      typeof transform.config === 'object' &&
      !Array.isArray(transform.config)
        ? (transform.config as Record<string, unknown>)
        : {};
    const rawConditionValue = condition.value;
    const editorValue = (value: unknown) => {
      if (value === undefined) return '';
      if (value === null) return 'null';
      if (typeof value === 'string') return value;
      if (typeof value === 'object') return JSON.stringify(value, null, 2);
      return String(value);
    };
    form.setFieldsValue({
      name: node.name || NODE_LABELS[node.type],
      max_attempts: node.max_attempts || 1,
      ...config,
      delay_value: delay.value,
      delay_unit: delay.unit,
      branches: normalizeBranches(config.branches),
      cases: normalizeSwitchCases(config.cases).map((candidate) => ({
        ...candidate,
        value: editorValue(candidate.value),
      })),
      candidates: Array.isArray(config.candidates)
        ? config.candidates.map(editorValue)
        : [],
      condition_field: condition.field,
      condition_operator: condition.operator || 'eq',
      condition_value: Array.isArray(rawConditionValue)
        ? rawConditionValue.join(', ')
        : rawConditionValue,
      headers_json: JSON.stringify(config.headers || {}, null, 2),
      value: editorValue(config.value),
      default_value: editorValue(config.default_value),
      left: editorValue(config.left),
      right: editorValue(config.right),
      overwrite: config.overwrite || 'overwrite',
      transform_type: transform.type || 'template',
      transform_template: transformConfig.template ?? '{{each.item}}',
      transform_template_missing: transformConfig.missing || 'error',
      transform_template_trim: transformConfig.trim === true,
      transform_json_input: editorValue(transformConfig.input ?? '$each.item'),
      transform_json_pointer: transformConfig.pointer || '',
      transform_json_missing: transformConfig.missing || 'failure',
      transform_json_default_value: editorValue(transformConfig.default_value),
      transform_json_value_type: transformConfig.value_type || 'auto',
      transform_math_operation: transformConfig.operation || 'add',
      transform_math_left: editorValue(transformConfig.left ?? '$each.item'),
      transform_math_right: editorValue(transformConfig.right ?? 0),
      transform_math_precision: transformConfig.precision ?? 2,
      transform_math_result_type: transformConfig.result_type || 'number',
      transform_coalesce_candidates: Array.isArray(transformConfig.candidates)
        ? transformConfig.candidates.map(editorValue)
        : ['$each.item'],
      transform_coalesce_missing: transformConfig.missing || 'skip',
      transform_coalesce_skip_null: transformConfig.skip_null !== false,
      transform_coalesce_skip_empty_string:
        transformConfig.skip_empty_string !== false,
      transform_coalesce_skip_empty_array:
        transformConfig.skip_empty_array === true,
      transform_coalesce_skip_empty_object:
        transformConfig.skip_empty_object === true,
      transform_coalesce_trim_strings: transformConfig.trim_strings === true,
      transform_coalesce_on_empty: transformConfig.on_empty || 'failure',
      transform_coalesce_default_value: editorValue(
        transformConfig.default_value,
      ),
      transform_coalesce_value_type: transformConfig.value_type || 'auto',
      transform_datetime_operation: transformConfig.operation || 'parse',
      transform_datetime_input: editorValue(
        transformConfig.input ?? '$each.item',
      ),
      transform_datetime_right: editorValue(transformConfig.right),
      transform_datetime_input_format: transformConfig.input_format || 'auto',
      transform_datetime_output_format:
        transformConfig.output_format || 'rfc3339',
      transform_datetime_timezone: transformConfig.timezone || 'Asia/Shanghai',
      transform_datetime_amount: editorValue(transformConfig.amount ?? 0),
      transform_datetime_unit: transformConfig.unit || 'second',
      transform_datetime_precision: transformConfig.precision ?? 0,
      directory_path:
        typeof node.ui?.directory_path === 'string'
          ? node.ui.directory_path
          : undefined,
    });
  }, [form, node]);

  const save = async () => {
    if (!node) return;
    const values = await form.validateFields();
    const config = { ...(node.config || {}) };
    const configKeys = [
      'input',
      'pattern',
      'group',
      'variable',
      'value_type',
      'value',
      'template',
      'missing',
      'trim',
      'overwrite',
      'pointer',
      'default_value',
      'operation',
      'left',
      'right',
      'precision',
      'result_type',
      'input_format',
      'output_format',
      'timezone',
      'amount',
      'unit',
      'separator',
      'trim_items',
      'omit_empty',
      'direction',
      'compare_as',
      'offset',
      'limit',
      'candidates',
      'skip_null',
      'skip_empty_string',
      'skip_empty_array',
      'skip_empty_object',
      'trim_strings',
      'on_empty',
      'cases',
      'key',
      'scope',
      'namespace',
      'normalize',
      'ttl_seconds',
      'refresh_on_duplicate',
      'preview_assumption',
      'window_seconds',
      'behavior',
      'max_wait_seconds',
      'on_error',
      'max_items',
      'keywords',
      'replacements',
      'replacement',
      'match_mode',
      'case_sensitive',
      'policy',
      'target_id',
      'cloud_storage_id',
      'url',
      'save_path',
      'category',
      'tags',
      'paused',
      'sequential',
      'directory_id',
      'poll_interval_seconds',
      'max_wait_minutes',
      'image_url',
      'tmdb_id',
      'recognition_mode',
      'lookup_tmdb',
      'input',
      'year',
      'resolution',
      'pan_type',
      'slug',
      'cloud_directory_id',
      'media_type',
      'best_version_enabled',
      'delete_source_folder',
      'filename_regex_enabled',
      'filename_regex_pattern',
      'filename_regex_replacement',
      'title',
      'message',
      'refresh_library',
      'method',
      'body',
      'content_type',
      'allow_private_network',
      'follow_redirects',
      'timeout_seconds',
    ];
    for (const key of configKeys) {
      if (key in values) config[key] = values[key];
    }
    if (node.type === 'parallel') {
      config.branches = normalizeBranches(values.branches);
    }
    if (node.type === 'delay') {
      config.delay_seconds = toAutomationDelaySeconds(
        values.delay_value,
        values.delay_unit,
      );
    }
    if (node.type === 'keyword') {
      config.keywords = normalizeKeywords(values.keywords);
    }
    if (node.type === 'keyword_replace') {
      config.replacements = normalizeReplacementRules(values.replacements);
    }
    if (node.type === 'switch') {
      config.cases = normalizeSwitchCases(values.cases);
      config.input = variableEditorValue(values.input, 'auto');
    }
    if (node.type === 'if') {
      config.condition = {
        field: values.condition_field,
        operator: values.condition_operator,
        ...(!['exists', 'not_exists'].includes(values.condition_operator)
          ? {
              value: conditionValue(
                values.condition_operator,
                values.condition_value,
              ),
            }
          : {}),
      };
    }
    if (node.type === 'http_request') {
      config.headers = parseHTTPHeaders(values.headers_json);
    }
    if (
      [
        'regex',
        'keyword_replace',
        'regex_replace',
        'convert',
        'set_variable',
        'template',
        'json_extract',
        'math',
        'datetime_operation',
        'list_operation',
        'coalesce',
        'foreach',
      ].includes(node.type)
    ) {
      config.variable = normalizeAutomationVariableName(values.variable);
    }
    if (node.type === 'math' && values.result_type === 'integer') {
      config.precision = 0;
    }
    if (node.type === 'set_variable') {
      config.value = variableEditorValue(values.value, values.value_type);
    }
    if (node.type === 'json_extract' && values.missing === 'default') {
      config.default_value = variableEditorValue(
        values.default_value,
        values.value_type,
      );
    }
    if (node.type === 'coalesce') {
      config.candidates = Array.isArray(values.candidates)
        ? values.candidates.map((candidate: unknown) =>
            variableEditorValue(candidate, 'auto'),
          )
        : [];
      if (values.on_empty === 'default') {
        config.default_value = variableEditorValue(
          values.default_value,
          values.value_type,
        );
      }
    }
    if (node.type === 'foreach') {
      const transformType = String(values.transform_type || 'template');
      const transformConfig: Record<string, unknown> = {};
      if (transformType === 'template') {
        Object.assign(transformConfig, {
          template: values.transform_template,
          missing: values.transform_template_missing,
          trim: values.transform_template_trim === true,
        });
      }
      if (transformType === 'json_extract') {
        Object.assign(transformConfig, {
          input: values.transform_json_input,
          pointer: values.transform_json_pointer || '',
          missing: values.transform_json_missing,
          value_type: values.transform_json_value_type,
        });
        if (values.transform_json_missing === 'default') {
          transformConfig.default_value = variableEditorValue(
            values.transform_json_default_value,
            values.transform_json_value_type,
          );
        }
      }
      if (transformType === 'math') {
        Object.assign(transformConfig, {
          operation: values.transform_math_operation,
          left: variableEditorValue(values.transform_math_left, 'auto'),
          right: variableEditorValue(values.transform_math_right, 'auto'),
          precision:
            values.transform_math_result_type === 'integer'
              ? 0
              : values.transform_math_precision,
          result_type: values.transform_math_result_type,
        });
      }
      if (transformType === 'coalesce') {
        Object.assign(transformConfig, {
          candidates: Array.isArray(values.transform_coalesce_candidates)
            ? values.transform_coalesce_candidates.map((candidate: unknown) =>
                variableEditorValue(candidate, 'auto'),
              )
            : [],
          missing: values.transform_coalesce_missing,
          skip_null: values.transform_coalesce_skip_null === true,
          skip_empty_string:
            values.transform_coalesce_skip_empty_string === true,
          skip_empty_array: values.transform_coalesce_skip_empty_array === true,
          skip_empty_object:
            values.transform_coalesce_skip_empty_object === true,
          trim_strings: values.transform_coalesce_trim_strings === true,
          on_empty: values.transform_coalesce_on_empty,
          value_type: values.transform_coalesce_value_type,
        });
        if (values.transform_coalesce_on_empty === 'default') {
          transformConfig.default_value = variableEditorValue(
            values.transform_coalesce_default_value,
            values.transform_coalesce_value_type,
          );
        }
      }
      if (transformType === 'datetime_operation') {
        Object.assign(transformConfig, {
          operation: values.transform_datetime_operation,
          input: values.transform_datetime_input,
          right: values.transform_datetime_right,
          input_format: values.transform_datetime_input_format,
          output_format: values.transform_datetime_output_format,
          timezone: values.transform_datetime_timezone,
          amount: variableEditorValue(values.transform_datetime_amount, 'auto'),
          unit: values.transform_datetime_unit,
          precision: values.transform_datetime_precision,
        });
      }
      config.transform = { type: transformType, config: transformConfig };
    }
    const ui = { ...(node.ui || {}) };
    if (node.type === 'offline115' || node.type === 'offline115_openapi') {
      if (values.directory_path) {
        ui.directory_path = values.directory_path;
      } else {
        delete ui.directory_path;
      }
    }
    onChange({
      ...node,
      name: values.name,
      max_attempts: values.max_attempts,
      config,
      ui,
    });
    onClose();
  };

  const renderConfig = () => {
    if (!node) return null;
    switch (node.type) {
      case 'delay':
        return (
          <>
            <Text className={styles.nodeConfigHint} type="secondary">
              到达节点后将等待固定时长，再从成功出口继续。等待状态会持久化，服务重启不会重新计时。
            </Text>
            <Form.Item
              className={styles.nodeConfigFull}
              extra="最长 30 天；样本预览只显示等待时长，不会真的暂停。"
              label="等待时长"
              required
            >
              <Space.Compact block>
                <Form.Item
                  name="delay_value"
                  noStyle
                  rules={[
                    { required: true, message: '请输入等待时长' },
                    {
                      validator: (_, value) => {
                        const numeric = Number(value);
                        const seconds = toAutomationDelaySeconds(
                          value,
                          form.getFieldValue('delay_unit') || 'minutes',
                        );
                        if (!Number.isInteger(numeric) || numeric < 1) {
                          return Promise.reject(
                            new Error('等待时长必须是大于 0 的整数'),
                          );
                        }
                        if (seconds > AUTOMATION_DELAY_MAX_SECONDS) {
                          return Promise.reject(
                            new Error('等待时长不能超过 30 天'),
                          );
                        }
                        return Promise.resolve();
                      },
                    },
                  ]}
                >
                  <InputNumber
                    max={automationDelayMaxValue(delayUnit)}
                    min={1}
                    precision={0}
                    style={{ width: 'calc(100% - 110px)' }}
                  />
                </Form.Item>
                <Form.Item name="delay_unit" noStyle>
                  <Select
                    options={automationDelayUnitOptions}
                    style={{ width: 110 }}
                  />
                </Form.Item>
              </Space.Compact>
            </Form.Item>
          </>
        );
      case 'regex':
        return (
          <>
            <Text className={styles.nodeConfigHint} type="secondary">
              从字段取出文本后，将捕获组保存为变量；后续可用 $vars.变量名引用。
            </Text>
            <Form.Item
              className={styles.nodeConfigFull}
              extra={
                protocolFieldExtra(inputProtocol('input')) ||
                '选择当前 RSS 字段，或前面节点已经生成的变量。'
              }
              label="输入字段"
              name="input"
              rules={[{ required: true }]}
            >
              <TemplateVariableInput
                ariaLabel="输入字段"
                placeholder="点击“插入变量”选择 RSS 字段或上游变量"
                references={fieldReferences}
              />
            </Form.Item>
            <Form.Item
              label="正则表达式"
              name="pattern"
              rules={[{ required: true }]}
            >
              <Input placeholder="(\d+)集" />
            </Form.Item>
            <Form.Item label="捕获组" name="group">
              <Input placeholder="1 或命名捕获组 episode" />
            </Form.Item>
            <VariableNameField references={fieldReferences} />
            <Form.Item
              label="变量类型"
              name="value_type"
              rules={[{ required: true }]}
            >
              <Select options={valueTypeOptions} />
            </Form.Item>
          </>
        );
      case 'keyword':
        return (
          <>
            <Text className={styles.nodeConfigHint} type="secondary">
              检查字段中是否包含关键词，再从“匹配”或“不匹配”出口继续流程。
            </Text>
            <Form.Item
              className={styles.nodeConfigFull}
              extra={
                protocolFieldExtra(inputProtocol('input')) ||
                '选择当前 RSS 字段，或前面节点已经生成的变量。'
              }
              label="输入字段"
              name="input"
              rules={[{ required: true }]}
            >
              <TemplateVariableInput
                ariaLabel="输入字段"
                placeholder="点击“插入变量”选择 RSS 字段或上游变量"
                references={fieldReferences}
              />
            </Form.Item>
            <Form.Item
              className={styles.nodeConfigFull}
              extra="输入一个关键词后按回车；支持英文或中文逗号批量分隔。"
              label="关键词"
              name="keywords"
              rules={[
                { required: true, message: '请至少添加一个关键词' },
                {
                  validator: (_, value) =>
                    normalizeKeywords(value).length > 0
                      ? Promise.resolve()
                      : Promise.reject(new Error('请至少添加一个关键词')),
                },
              ]}
            >
              <Select
                aria-label="关键词"
                maxTagCount="responsive"
                mode="tags"
                placeholder="例如：CAM、TS"
                tokenSeparators={[',', '，']}
              />
            </Form.Item>
            <Form.Item
              label="匹配规则"
              name="match_mode"
              rules={[{ required: true }]}
            >
              <Select options={keywordModeOptions} />
            </Form.Item>
            <Form.Item
              label="区分大小写"
              name="case_sensitive"
              valuePropName="checked"
            >
              <Switch checkedChildren="区分" unCheckedChildren="忽略" />
            </Form.Item>
          </>
        );
      case 'keyword_replace':
        return (
          <>
            <Text className={styles.nodeConfigHint} type="secondary">
              按列表顺序执行字面量全局替换，并将最终文本保存到 $vars.变量名。
            </Text>
            <TemplateConfigField
              field="input"
              label="输入字段"
              protocol={inputProtocol('input')}
              references={fieldReferences}
              required
            />
            <Form.List
              name="replacements"
              rules={[
                {
                  validator: (_, rules) => {
                    if (!Array.isArray(rules) || rules.length === 0) {
                      return Promise.reject(
                        new Error('请至少添加一条关键词替换规则'),
                      );
                    }
                    if (rules.length > 100) {
                      return Promise.reject(
                        new Error('关键词替换规则不能超过 100 条'),
                      );
                    }
                    return Promise.resolve();
                  },
                },
              ]}
            >
              {(fields, { add, remove }, { errors }) => (
                <div
                  className={`${styles.nodeConfigFull} ${styles.replacementRuleList}`}
                >
                  {fields.map((field, index) => (
                    <div className={styles.replacementRuleRow} key={field.key}>
                      <Form.Item
                        label={`关键词 ${index + 1}`}
                        name={[field.name, 'keyword']}
                        rules={[
                          {
                            required: true,
                            whitespace: true,
                            message: '请输入要替换的关键词',
                          },
                        ]}
                      >
                        <Input maxLength={200} placeholder="例如：WEB-DL" />
                      </Form.Item>
                      <Form.Item
                        extra="留空表示删除关键词"
                        label="替换为"
                        name={[field.name, 'replacement']}
                      >
                        <Input maxLength={2000} placeholder="例如：WEB" />
                      </Form.Item>
                      <Button
                        aria-label={`删除关键词替换规则 ${index + 1}`}
                        className={styles.replacementRuleDelete}
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => remove(field.name)}
                        type="text"
                      />
                    </div>
                  ))}
                  <Button
                    block
                    icon={<PlusOutlined />}
                    onClick={() => add({ keyword: '', replacement: '' })}
                    type="dashed"
                  >
                    添加替换规则
                  </Button>
                  <Form.ErrorList errors={errors} />
                </div>
              )}
            </Form.List>
            <Form.Item
              label="区分大小写"
              name="case_sensitive"
              valuePropName="checked"
            >
              <Switch checkedChildren="区分" unCheckedChildren="忽略" />
            </Form.Item>
            <VariableNameField references={fieldReferences} />
          </>
        );
      case 'regex_replace':
        return (
          <>
            <Text className={styles.nodeConfigHint} type="secondary">
              使用 Go/RE2 正则全局替换所有命中内容，并将结果保存到
              $vars.变量名。
            </Text>
            <TemplateConfigField
              field="input"
              label="输入字段"
              protocol={inputProtocol('input')}
              references={fieldReferences}
              required
            />
            <Form.Item
              label="正则表达式"
              name="pattern"
              rules={[{ required: true }]}
            >
              <Input placeholder="[._-]+" />
            </Form.Item>
            <Form.Item
              extra="支持 ${1} 或 ${name} 捕获组；捕获组后紧接文字时必须使用花括号。留空表示删除命中内容。"
              label="替换内容"
              name="replacement"
            >
              <Input placeholder="例如：${name} 第${2}集" />
            </Form.Item>
            <VariableNameField references={fieldReferences} />
          </>
        );
      case 'convert':
        return (
          <>
            <Form.Item
              className={styles.nodeConfigFull}
              extra={
                protocolFieldExtra(inputProtocol('input')) ||
                '选择当前 RSS 字段，或前面节点已经生成的变量。'
              }
              label="输入字段"
              name="input"
              rules={[{ required: true }]}
            >
              <TemplateVariableInput
                ariaLabel="输入字段"
                placeholder="点击“插入变量”选择 RSS 字段或上游变量"
                references={fieldReferences}
              />
            </Form.Item>
            <VariableNameField references={fieldReferences} />
            <Form.Item
              label="转换类型"
              name="value_type"
              rules={[{ required: true }]}
            >
              <Select options={valueTypeOptions} />
            </Form.Item>
          </>
        );
      case 'set_variable':
        return (
          <>
            <Text className={styles.nodeConfigHint} type="secondary">
              将固定值、RSS 字段或上游输出写入流程变量；精确引用会保留原始类型。
            </Text>
            <Form.Item
              className={styles.nodeConfigFull}
              extra="输入固定值，或点击“插入变量”。仅包含一个精确引用时会保留 object、array、number 等原始类型。"
              label="变量值"
              name="value"
            >
              <TemplateVariableInput
                ariaLabel="变量值"
                multiline={variableValueType === 'json'}
                placeholder={
                  variableValueType === 'json'
                    ? '输入 JSON，或插入一个对象变量'
                    : '输入固定值，或点击“插入变量”'
                }
                references={fieldReferences}
              />
            </Form.Item>
            <Form.Item
              extra="自动模式会保留精确引用的原始类型；模板拼接的结果始终是文本。"
              label="值类型"
              name="value_type"
              rules={[{ required: true }]}
            >
              <Select options={automationVariableValueTypeOptions} />
            </Form.Item>
            <VariableWriteFields
              overwrite={overwrite}
              references={fieldReferences}
              variable={variable}
            />
          </>
        );
      case 'template':
        return (
          <>
            <Text className={styles.nodeConfigHint} type="secondary">
              用 RSS 字段和上游变量拼接文本，例如：
              {'{{item.title}} · {{vars.quality}}'}。
            </Text>
            <Form.Item
              className={styles.nodeConfigFull}
              extra="点击“插入变量”会在当前光标位置插入 {{...}}；对象和数组会转换为 JSON 文本。"
              label="模板内容"
              name="template"
            >
              <TemplateVariableInput
                ariaLabel="模板内容"
                insertMode="template"
                multiline
                placeholder="例如：{{item.title}} · {{vars.quality}}"
                references={fieldReferences}
              />
            </Form.Item>
            <Form.Item
              label="变量不存在时"
              name="missing"
              rules={[{ required: true }]}
            >
              <Select
                options={[
                  { label: '失败并走失败出口', value: 'error' },
                  { label: '替换为空文本并继续', value: 'empty' },
                ]}
              />
            </Form.Item>
            <Form.Item label="去除首尾空白" name="trim" valuePropName="checked">
              <Switch checkedChildren="去除" unCheckedChildren="保留" />
            </Form.Item>
            <VariableWriteFields
              overwrite={overwrite}
              references={fieldReferences}
              variable={variable}
            />
          </>
        );
      case 'json_extract':
        return (
          <>
            <Text className={styles.nodeConfigHint} type="secondary">
              从 JSON 对象、数组或 JSON 文本中按 RFC 6901 JSON Pointer 读取值。
            </Text>
            <TemplateConfigField
              field="input"
              label="JSON 输入"
              protocol={inputProtocol('input')}
              references={fieldReferences}
              required
            />
            <Form.Item
              className={styles.nodeConfigFull}
              extra="空值表示整个 JSON；例如 /items/0/title。属性名中的 / 写作 ~1，~ 写作 ~0。"
              label="JSON Pointer"
              name="pointer"
              rules={[
                {
                  validator: (_, value) => {
                    const error = automationJSONPointerError(value);
                    return error
                      ? Promise.reject(new Error(error))
                      : Promise.resolve();
                  },
                },
              ]}
            >
              <Input placeholder="/items/0/title" />
            </Form.Item>
            <Form.Item
              label="路径不存在时"
              name="missing"
              rules={[{ required: true }]}
            >
              <Select
                options={[
                  { label: '失败并走失败出口', value: 'failure' },
                  { label: '使用默认值', value: 'default' },
                ]}
              />
            </Form.Item>
            {jsonMissing === 'default' && (
              <Form.Item
                className={styles.nodeConfigFull}
                extra="支持固定值和精确变量引用；false、0、null 都会作为有效默认值。"
                label="默认值"
                name="default_value"
              >
                <TemplateVariableInput
                  ariaLabel="JSON 默认值"
                  multiline={variableValueType === 'json'}
                  placeholder="路径不存在时写入此值"
                  references={fieldReferences}
                />
              </Form.Item>
            )}
            <Form.Item
              label="结果类型"
              name="value_type"
              rules={[{ required: true }]}
            >
              <Select options={automationVariableValueTypeOptions} />
            </Form.Item>
            <VariableWriteFields
              overwrite={overwrite}
              references={fieldReferences}
              variable={variable}
            />
          </>
        );
      case 'math': {
        const unary = automationUnaryMathOperations.has(mathOperation);
        return (
          <>
            <Text className={styles.nodeConfigHint} type="secondary">
              对固定数字或上游变量执行数学运算；除零、非数字和非有限结果会走失败出口。
            </Text>
            <Form.Item
              label="运算"
              name="operation"
              rules={[{ required: true }]}
            >
              <Select options={automationMathOperationOptions} />
            </Form.Item>
            <Form.Item
              label={unary ? '操作数' : '左操作数'}
              name="left"
              rules={[{ required: true }]}
            >
              <TemplateVariableInput
                ariaLabel={unary ? '数学操作数' : '数学左操作数'}
                placeholder="输入数字，或点击“插入变量”"
                references={fieldReferences}
              />
            </Form.Item>
            {!unary && (
              <Form.Item
                label="右操作数"
                name="right"
                rules={[{ required: true }]}
              >
                <TemplateVariableInput
                  ariaLabel="数学右操作数"
                  placeholder="输入数字，或点击“插入变量”"
                  references={fieldReferences}
                />
              </Form.Item>
            )}
            <Form.Item
              extra={
                mathResultType === 'integer'
                  ? '整数结果不做隐式取整；需要取整时请选择 round、floor 或 ceil。'
                  : '按 half-away-from-zero 规则保留小数。'
              }
              label="结果类型"
              name="result_type"
              rules={[{ required: true }]}
            >
              <Select
                onChange={(value) => {
                  if (value === 'integer') form.setFieldValue('precision', 0);
                }}
                options={[
                  { label: '小数 number', value: 'number' },
                  { label: '整数 integer', value: 'integer' },
                ]}
              />
            </Form.Item>
            <Form.Item
              label="小数精度"
              name="precision"
              rules={[
                { required: true },
                {
                  validator: (_, value) =>
                    Number.isInteger(Number(value)) &&
                    Number(value) >= 0 &&
                    Number(value) <= 12 &&
                    (mathResultType !== 'integer' || Number(value) === 0)
                      ? Promise.resolve()
                      : Promise.reject(
                          new Error(
                            mathResultType === 'integer'
                              ? '整数结果的小数精度必须为 0'
                              : '小数精度必须是 0 到 12 的整数',
                          ),
                        ),
                },
              ]}
            >
              <InputNumber
                disabled={mathResultType === 'integer'}
                max={12}
                min={0}
                precision={0}
              />
            </Form.Item>
            <VariableWriteFields
              overwrite={overwrite}
              references={fieldReferences}
              variable={variable}
            />
          </>
        );
      }
      case 'datetime_operation':
        return (
          <>
            <Text className={styles.nodeConfigHint} type="secondary">
              解析、格式化或计算日期时间，并将结果保存到流程变量。无时区的日期会按配置时区解释。
            </Text>
            <Form.Item
              label="日期操作"
              name="operation"
              rules={[{ required: true }]}
            >
              <Select options={automationDatetimeOperationOptions} />
            </Form.Item>
            <Form.Item
              className={styles.nodeConfigFull}
              label="日期输入"
              name="input"
              rules={[{ required: true, message: '请输入日期或选择变量' }]}
            >
              <TemplateVariableInput
                ariaLabel="日期输入"
                placeholder="例如 2026-08-30T12:00:00+08:00，或插入变量"
                references={fieldReferences}
              />
            </Form.Item>
            {datetimeOperation === 'diff' && (
              <Form.Item
                className={styles.nodeConfigFull}
                extra="结果为“日期输入 − 对比日期”。"
                label="对比日期"
                name="right"
                rules={[{ required: true, message: '请输入对比日期' }]}
              >
                <TemplateVariableInput
                  ariaLabel="日期对比值"
                  placeholder="输入日期，或插入变量"
                  references={fieldReferences}
                />
              </Form.Item>
            )}
            <Form.Item label="输入格式" name="input_format">
              <Select options={automationDatetimeInputFormatOptions} />
            </Form.Item>
            {datetimeOperation !== 'diff' && (
              <Form.Item label="输出格式" name="output_format">
                <Select options={automationDatetimeOutputFormatOptions} />
              </Form.Item>
            )}
            <Form.Item
              extra="使用 IANA 时区名称。"
              label="时区"
              name="timezone"
              rules={[{ required: true, message: '请输入时区' }]}
            >
              <Input placeholder="Asia/Shanghai" />
            </Form.Item>
            {datetimeOperation === 'add' && (
              <>
                <Form.Item label="增减数量" name="amount" required>
                  <TemplateVariableInput
                    ariaLabel="日期增减数量"
                    placeholder="正数增加，负数减少；可插入变量"
                    references={fieldReferences}
                  />
                </Form.Item>
                <Form.Item label="时间单位" name="unit">
                  <Select options={automationDatetimeDurationUnitOptions} />
                </Form.Item>
              </>
            )}
            {datetimeOperation === 'diff' && (
              <>
                <Form.Item label="时间差单位" name="unit">
                  <Select options={automationDatetimeDifferenceUnitOptions} />
                </Form.Item>
                <Form.Item label="小数精度" name="precision">
                  <InputNumber max={6} min={0} precision={0} />
                </Form.Item>
              </>
            )}
            {datetimeOperation === 'start_of' && (
              <Form.Item label="周期" name="unit">
                <Select options={automationDatetimeStartUnitOptions} />
              </Form.Item>
            )}
            <VariableWriteFields
              overwrite={overwrite}
              references={fieldReferences}
              variable={variable}
            />
          </>
        );
      case 'list_operation':
        return (
          <>
            <Text className={styles.nodeConfigHint} type="secondary">
              对文本或数组执行常用列表操作。列表去重只处理当前数组；跨运行去重请使用“运行去重”节点。
            </Text>
            <Form.Item label="列表操作" name="operation">
              <Select options={automationListOperationOptions} />
            </Form.Item>
            <Form.Item
              className={styles.nodeConfigFull}
              label={listOperation === 'split' ? '文本输入' : '列表输入'}
              name="input"
              rules={[{ required: true, message: '请选择输入值' }]}
            >
              <TemplateVariableInput
                ariaLabel="列表运算输入"
                placeholder={
                  listOperation === 'split'
                    ? '输入文本，或插入变量'
                    : '插入一个 array 类型变量'
                }
                references={fieldReferences}
              />
            </Form.Item>
            {['split', 'join'].includes(listOperation) && (
              <Form.Item
                label={listOperation === 'split' ? '拆分符' : '连接符'}
                name="separator"
                extra={
                  listOperation === 'split'
                    ? '留空时按单个 Unicode 字符拆分。'
                    : undefined
                }
              >
                <Input placeholder="," />
              </Form.Item>
            )}
            {['split', 'join'].includes(listOperation) && (
              <Space className={styles.nodeConfigFull} size="large">
                <Form.Item
                  label="去除每项首尾空白"
                  name="trim_items"
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
                <Form.Item
                  label="忽略空项"
                  name="omit_empty"
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
              </Space>
            )}
            {['unique', 'sort', 'pluck'].includes(listOperation) && (
              <>
                <Form.Item
                  className={styles.nodeConfigFull}
                  extra="空值表示使用整个列表项；对象字段例如 /title。"
                  label="比较 / 提取路径"
                  name="pointer"
                  rules={[
                    {
                      validator: (_, value) => {
                        const error = automationJSONPointerError(value);
                        return error
                          ? Promise.reject(new Error(error))
                          : Promise.resolve();
                      },
                    },
                  ]}
                >
                  <Input placeholder="/title" />
                </Form.Item>
                <Form.Item label="路径不存在时" name="missing">
                  <Select
                    options={[
                      { label: '节点失败', value: 'failure' },
                      { label: '跳过该项', value: 'skip' },
                      { label: '按 null 处理', value: 'null' },
                    ]}
                  />
                </Form.Item>
              </>
            )}
            {['unique', 'sort'].includes(listOperation) && (
              <>
                {listOperation === 'sort' && (
                  <Form.Item label="排序方向" name="direction">
                    <Select
                      options={[
                        { label: '升序', value: 'asc' },
                        { label: '降序', value: 'desc' },
                      ]}
                    />
                  </Form.Item>
                )}
                <Form.Item label="比较类型" name="compare_as">
                  <Select options={automationCompareAsOptions} />
                </Form.Item>
              </>
            )}
            {listOperation === 'slice' && (
              <>
                <Form.Item label="起始索引" name="offset">
                  <InputNumber max={10000} min={-10000} precision={0} />
                </Form.Item>
                <Form.Item label="最多保留" name="limit">
                  <InputNumber max={10000} min={0} precision={0} />
                </Form.Item>
              </>
            )}
            <VariableWriteFields
              overwrite={overwrite}
              references={fieldReferences}
              variable={variable}
            />
          </>
        );
      case 'switch':
        return (
          <>
            <Text className={styles.nodeConfigHint} type="secondary">
              按顺序检查条件，第一条命中后从对应出口继续；全部未命中时走“默认”出口。
            </Text>
            <Form.Item
              className={styles.nodeConfigFull}
              label="比较输入"
              name="input"
              rules={[{ required: true, message: '请选择比较输入' }]}
            >
              <TemplateVariableInput
                ariaLabel="多路分支比较输入"
                placeholder="选择 RSS 字段或上游变量"
                references={fieldReferences}
              />
            </Form.Item>
            <Form.Item label="比较类型" name="compare_as">
              <Select options={automationCompareAsOptions} />
            </Form.Item>
            <Form.Item
              label="区分大小写"
              name="case_sensitive"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Form.List
              name="cases"
              rules={[
                {
                  validator: (_, cases) =>
                    Array.isArray(cases) && cases.length > 0
                      ? Promise.resolve()
                      : Promise.reject(new Error('请至少添加一个分支条件')),
                },
              ]}
            >
              {(fields, { add, remove }, { errors }) => (
                <div className={styles.nodeConfigFull}>
                  <Text strong>分支条件（顺序优先）</Text>
                  {fields.map((field, index) => (
                    <Space
                      align="start"
                      key={field.key}
                      style={{ display: 'flex', marginTop: 10 }}
                      wrap
                    >
                      <Form.Item hidden name={[field.name, 'id']}>
                        <Input />
                      </Form.Item>
                      <Form.Item
                        label={`条件 ${index + 1} 名称`}
                        name={[field.name, 'label']}
                        rules={[{ required: true, message: '请输入出口名称' }]}
                      >
                        <Input maxLength={120} placeholder="例如：电影" />
                      </Form.Item>
                      <Form.Item
                        label="比较符"
                        name={[field.name, 'operator']}
                        rules={[{ required: true }]}
                      >
                        <Select
                          options={automationSwitchOperatorOptions}
                          style={{ width: 150 }}
                        />
                      </Form.Item>
                      <Form.Item noStyle shouldUpdate>
                        {({ getFieldValue }) => {
                          const selectedOperator = getFieldValue([
                            'cases',
                            field.name,
                            'operator',
                          ]);
                          return ['exists', 'not_exists'].includes(
                            selectedOperator,
                          ) ? null : (
                            <Form.Item
                              label="比较值"
                              name={[field.name, 'value']}
                              rules={[
                                { required: true, message: '请输入比较值' },
                                {
                                  validator: (_, value) => {
                                    if (selectedOperator !== 'in') {
                                      return Promise.resolve();
                                    }
                                    const text = String(value ?? '').trim();
                                    if (
                                      /^\$(?:item|vars|nodes|each)(?:\.|$)/.test(
                                        text,
                                      ) ||
                                      text.includes('{{')
                                    ) {
                                      return Promise.resolve();
                                    }
                                    try {
                                      return Array.isArray(JSON.parse(text))
                                        ? Promise.resolve()
                                        : Promise.reject(
                                            new Error('请输入 JSON 数组'),
                                          );
                                    } catch {
                                      return Promise.reject(
                                        new Error('请输入 JSON 数组或数组变量'),
                                      );
                                    }
                                  },
                                },
                              ]}
                            >
                              <TemplateVariableInput
                                ariaLabel={`条件 ${index + 1} 比较值`}
                                placeholder={
                                  selectedOperator === 'in'
                                    ? '["电影", "剧集"] 或数组变量'
                                    : '固定值或变量'
                                }
                                references={fieldReferences}
                              />
                            </Form.Item>
                          );
                        }}
                      </Form.Item>
                      <Button
                        aria-label={`删除条件 ${index + 1}`}
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => remove(field.name)}
                        style={{ marginTop: 30 }}
                        type="text"
                      />
                    </Space>
                  ))}
                  <Button
                    block
                    disabled={fields.length >= 20}
                    icon={<PlusOutlined />}
                    onClick={() =>
                      add({
                        id: `case${Date.now().toString(36)}`,
                        label: `条件 ${fields.length + 1}`,
                        operator: 'eq',
                        value: '',
                      })
                    }
                    type="dashed"
                  >
                    添加分支条件
                  </Button>
                  <Form.ErrorList errors={errors} />
                </div>
              )}
            </Form.List>
          </>
        );
      case 'coalesce':
        return (
          <>
            <Text className={styles.nodeConfigHint} type="secondary">
              按顺序选择第一个存在且未被跳过的值；数字 0 和布尔 false
              始终是有效值。
            </Text>
            <Form.List
              name="candidates"
              rules={[
                {
                  validator: (_, candidates) =>
                    Array.isArray(candidates) && candidates.length > 0
                      ? Promise.resolve()
                      : Promise.reject(new Error('请至少添加一个候选值')),
                },
              ]}
            >
              {(fields, { add, remove }, { errors }) => (
                <div className={styles.nodeConfigFull}>
                  <Text strong>候选值（顺序优先）</Text>
                  {fields.map((field, index) => (
                    <Space.Compact
                      block
                      key={field.key}
                      style={{ marginTop: 10 }}
                    >
                      <Form.Item
                        name={field.name}
                        noStyle
                        rules={[{ required: true, message: '请输入候选值' }]}
                      >
                        <TemplateVariableInput
                          ariaLabel={`候选值 ${index + 1}`}
                          placeholder="固定值或变量"
                          references={fieldReferences}
                        />
                      </Form.Item>
                      <Button
                        aria-label={`删除候选值 ${index + 1}`}
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => remove(field.name)}
                      />
                    </Space.Compact>
                  ))}
                  <Button
                    block
                    disabled={fields.length >= 32}
                    icon={<PlusOutlined />}
                    onClick={() => add('')}
                    style={{ marginTop: 10 }}
                    type="dashed"
                  >
                    添加候选值
                  </Button>
                  <Form.ErrorList errors={errors} />
                </div>
              )}
            </Form.List>
            <Form.Item label="引用不存在时" name="missing">
              <Select
                options={[
                  { label: '跳过并继续检查', value: 'skip' },
                  { label: '节点失败', value: 'failure' },
                ]}
              />
            </Form.Item>
            <Form.Item label="全部为空时" name="on_empty">
              <Select
                options={[
                  { label: '节点失败', value: 'failure' },
                  { label: '使用默认值', value: 'default' },
                ]}
              />
            </Form.Item>
            {coalesceOnEmpty === 'default' && (
              <Form.Item
                className={styles.nodeConfigFull}
                label="默认值"
                name="default_value"
              >
                <TemplateVariableInput
                  ariaLabel="候选值默认值"
                  placeholder="固定值或变量"
                  references={fieldReferences}
                />
              </Form.Item>
            )}
            <Space className={styles.nodeConfigFull} size="large" wrap>
              <Form.Item
                label="跳过 null"
                name="skip_null"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
              <Form.Item
                label="跳过空文本"
                name="skip_empty_string"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
              <Form.Item
                label="跳过空数组"
                name="skip_empty_array"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
              <Form.Item
                label="跳过空对象"
                name="skip_empty_object"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
              <Form.Item
                label="文本先去首尾空白"
                name="trim_strings"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Space>
            <Form.Item label="结果类型" name="value_type">
              <Select options={automationVariableValueTypeOptions} />
            </Form.Item>
            <VariableWriteFields
              overwrite={overwrite}
              references={fieldReferences}
              variable={variable}
            />
          </>
        );
      case 'deduplicate':
        return (
          <>
            <Alert
              className={styles.nodeConfigFull}
              description="样本预览只按下方假设显示分支；真实执行会查询持久去重状态，结果可能不同。"
              showIcon
              title="这是跨运行的持久去重门"
              type="info"
            />
            <Form.Item
              className={styles.nodeConfigFull}
              label="去重键"
              name="key"
              rules={[{ required: true, message: '请输入去重键' }]}
            >
              <TemplateVariableInput
                ariaLabel="运行去重键"
                placeholder="例如 $item.guid 或 {{item.title}}"
                references={fieldReferences}
              />
            </Form.Item>
            <Form.Item label="状态范围" name="scope">
              <Select options={automationGuardScopeOptions} />
            </Form.Item>
            <Form.Item
              extra={
                guardScope === 'global'
                  ? '全局范围必须填写；相同命名空间会跨流程共享状态。'
                  : '留空时自动使用当前节点 ID。'
              }
              label="命名空间"
              name="namespace"
              rules={[
                {
                  validator: (_, value) =>
                    guardScope !== 'global' || String(value || '').trim()
                      ? Promise.resolve()
                      : Promise.reject(new Error('全局范围必须填写命名空间')),
                },
              ]}
            >
              <Input maxLength={80} placeholder="可选" />
            </Form.Item>
            <Form.Item label="键标准化" name="normalize">
              <Select options={automationGuardNormalizeOptions} />
            </Form.Item>
            <Form.Item
              extra="允许 60 秒到 365 天。"
              label="去重有效期（秒）"
              name="ttl_seconds"
              rules={[{ required: true }]}
            >
              <InputNumber max={31536000} min={60} precision={0} />
            </Form.Item>
            <Form.Item
              label="重复时刷新有效期"
              name="refresh_on_duplicate"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Form.Item
              extra="只影响本地样本预览，不改变真实去重结果。"
              label="预览假设"
              name="preview_assumption"
            >
              <Select
                options={[
                  { label: '假设首次出现', value: 'new' },
                  { label: '假设已经重复', value: 'duplicate' },
                ]}
              />
            </Form.Item>
          </>
        );
      case 'rate_limit':
        return (
          <>
            <Alert
              className={styles.nodeConfigFull}
              description="样本预览只按下方假设显示；真实执行会查询持久限流状态，结果可能不同。"
              showIcon
              title="限流状态跨运行保存"
              type="info"
            />
            <Form.Item
              className={styles.nodeConfigFull}
              label="限流键"
              name="key"
              rules={[{ required: true, message: '请输入限流键' }]}
            >
              <TemplateVariableInput
                ariaLabel="频率限制键"
                placeholder="例如 $item.category；全流程共用时可输入固定值"
                references={fieldReferences}
              />
            </Form.Item>
            <Form.Item label="状态范围" name="scope">
              <Select options={automationGuardScopeOptions} />
            </Form.Item>
            <Form.Item
              extra={
                guardScope === 'global'
                  ? '全局范围必须填写；相同命名空间会跨流程共享额度。'
                  : '留空时自动使用当前节点 ID。'
              }
              label="命名空间"
              name="namespace"
              rules={[
                {
                  validator: (_, value) =>
                    guardScope !== 'global' || String(value || '').trim()
                      ? Promise.resolve()
                      : Promise.reject(new Error('全局范围必须填写命名空间')),
                },
              ]}
            >
              <Input maxLength={80} placeholder="可选" />
            </Form.Item>
            <Form.Item label="键标准化" name="normalize">
              <Select options={automationGuardNormalizeOptions} />
            </Form.Item>
            <Form.Item label="窗口内最多次数" name="limit">
              <InputNumber max={10000} min={1} precision={0} />
            </Form.Item>
            <Form.Item label="统计窗口（秒）" name="window_seconds">
              <InputNumber max={2592000} min={1} precision={0} />
            </Form.Item>
            <Form.Item label="达到限额时" name="behavior">
              <Select
                options={[
                  { label: '等待额度恢复', value: 'defer' },
                  { label: '立即走“受限”出口', value: 'branch' },
                ]}
              />
            </Form.Item>
            {rateBehavior === 'defer' && (
              <Form.Item
                extra="等待超过此时长会走失败出口。"
                label="最长等待（秒）"
                name="max_wait_seconds"
              >
                <InputNumber max={2592000} min={1} precision={0} />
              </Form.Item>
            )}
            <Form.Item
              extra="只影响本地样本预览，不改变真实限流结果。等待模式下，受限假设会停在当前节点。"
              label="预览假设"
              name="preview_assumption"
            >
              <Select
                options={[
                  { label: '假设仍有额度', value: 'allowed' },
                  { label: '假设已经受限', value: 'throttled' },
                ]}
              />
            </Form.Item>
          </>
        );
      case 'foreach': {
        const transformMathUnary =
          automationUnaryMathOperations.has(foreachMathOperation);
        return (
          <>
            <Alert
              className={styles.nodeConfigFull}
              description="每项只能执行模板、JSON 取值、数学、候选值或日期时间变换，不会创建子画布或流程回边。单项失败时保留 null，从而保持原列表索引。"
              showIcon
              title="有界纯映射"
              type="info"
            />
            <Form.Item
              className={styles.nodeConfigFull}
              label="输入列表"
              name="input"
              rules={[{ required: true, message: '请选择 array 类型变量' }]}
            >
              <TemplateVariableInput
                ariaLabel="遍历输入列表"
                placeholder="插入一个 array 类型变量"
                references={fieldReferences}
              />
            </Form.Item>
            <Form.Item label="单项变换" name="transform_type">
              <Select options={automationForeachTransformOptions} />
            </Form.Item>
            <Form.Item label="单项失败时" name="on_error">
              <Select
                options={[
                  { label: '立即失败', value: 'fail_fast' },
                  { label: '以 null 占位并继续', value: 'collect' },
                ]}
              />
            </Form.Item>
            <Form.Item
              extra="输入超过上限时节点失败，避免单次运行失控。"
              label="最大项数"
              name="max_items"
            >
              <InputNumber max={1000} min={1} precision={0} />
            </Form.Item>

            {foreachTransformType === 'template' && (
              <>
                <Form.Item
                  className={styles.nodeConfigFull}
                  label="模板内容"
                  name="transform_template"
                  rules={[{ required: true }]}
                >
                  <TemplateVariableInput
                    ariaLabel="遍历文本模板"
                    insertMode="template"
                    multiline
                    placeholder="例如 {{each.index}}. {{each.item}}"
                    references={foreachFieldReferences}
                  />
                </Form.Item>
                <Form.Item
                  label="引用不存在时"
                  name="transform_template_missing"
                >
                  <Select
                    options={[
                      { label: '单项失败', value: 'error' },
                      { label: '替换为空文本', value: 'empty' },
                    ]}
                  />
                </Form.Item>
                <Form.Item
                  label="去除首尾空白"
                  name="transform_template_trim"
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
              </>
            )}

            {foreachTransformType === 'json_extract' && (
              <>
                <Form.Item
                  className={styles.nodeConfigFull}
                  label="JSON 输入"
                  name="transform_json_input"
                  rules={[{ required: true }]}
                >
                  <TemplateVariableInput
                    ariaLabel="遍历 JSON 输入"
                    placeholder="$each.item"
                    references={foreachFieldReferences}
                  />
                </Form.Item>
                <Form.Item
                  className={styles.nodeConfigFull}
                  label="JSON Pointer"
                  name="transform_json_pointer"
                  rules={[
                    {
                      validator: (_, value) => {
                        const error = automationJSONPointerError(value);
                        return error
                          ? Promise.reject(new Error(error))
                          : Promise.resolve();
                      },
                    },
                  ]}
                >
                  <Input placeholder="/title" />
                </Form.Item>
                <Form.Item label="路径不存在时" name="transform_json_missing">
                  <Select
                    options={[
                      { label: '单项失败', value: 'failure' },
                      { label: '使用默认值', value: 'default' },
                    ]}
                  />
                </Form.Item>
                {foreachJSONMissing === 'default' && (
                  <Form.Item label="默认值" name="transform_json_default_value">
                    <TemplateVariableInput
                      ariaLabel="遍历 JSON 默认值"
                      placeholder="固定值或变量"
                      references={foreachFieldReferences}
                    />
                  </Form.Item>
                )}
                <Form.Item label="结果类型" name="transform_json_value_type">
                  <Select options={automationVariableValueTypeOptions} />
                </Form.Item>
              </>
            )}

            {foreachTransformType === 'math' && (
              <>
                <Form.Item label="运算" name="transform_math_operation">
                  <Select options={automationMathOperationOptions} />
                </Form.Item>
                <Form.Item
                  label={transformMathUnary ? '操作数' : '左操作数'}
                  name="transform_math_left"
                  rules={[{ required: true }]}
                >
                  <TemplateVariableInput
                    ariaLabel="遍历数学左操作数"
                    placeholder="$each.item"
                    references={foreachFieldReferences}
                  />
                </Form.Item>
                {!transformMathUnary && (
                  <Form.Item
                    label="右操作数"
                    name="transform_math_right"
                    rules={[{ required: true }]}
                  >
                    <TemplateVariableInput
                      ariaLabel="遍历数学右操作数"
                      placeholder="固定数字或变量"
                      references={foreachFieldReferences}
                    />
                  </Form.Item>
                )}
                <Form.Item label="结果类型" name="transform_math_result_type">
                  <Select
                    onChange={(value) => {
                      if (value === 'integer') {
                        form.setFieldValue('transform_math_precision', 0);
                      }
                    }}
                    options={[
                      { label: '小数 number', value: 'number' },
                      { label: '整数 integer', value: 'integer' },
                    ]}
                  />
                </Form.Item>
                <Form.Item label="小数精度" name="transform_math_precision">
                  <InputNumber
                    disabled={foreachMathResultType === 'integer'}
                    max={12}
                    min={0}
                    precision={0}
                  />
                </Form.Item>
              </>
            )}

            {foreachTransformType === 'coalesce' && (
              <>
                <Form.List name="transform_coalesce_candidates">
                  {(fields, { add, remove }) => (
                    <div className={styles.nodeConfigFull}>
                      <Text strong>候选值（顺序优先）</Text>
                      {fields.map((field, index) => (
                        <Space.Compact
                          block
                          key={field.key}
                          style={{ marginTop: 10 }}
                        >
                          <Form.Item name={field.name} noStyle>
                            <TemplateVariableInput
                              ariaLabel={`遍历候选值 ${index + 1}`}
                              placeholder="$each.item 或其他值"
                              references={foreachFieldReferences}
                            />
                          </Form.Item>
                          <Button
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => remove(field.name)}
                          />
                        </Space.Compact>
                      ))}
                      <Button
                        block
                        disabled={fields.length >= 32}
                        icon={<PlusOutlined />}
                        onClick={() => add('')}
                        style={{ marginTop: 10 }}
                        type="dashed"
                      >
                        添加候选值
                      </Button>
                    </div>
                  )}
                </Form.List>
                <Form.Item
                  label="引用不存在时"
                  name="transform_coalesce_missing"
                >
                  <Select
                    options={[
                      { label: '跳过', value: 'skip' },
                      { label: '单项失败', value: 'failure' },
                    ]}
                  />
                </Form.Item>
                <Form.Item
                  label="全部为空时"
                  name="transform_coalesce_on_empty"
                >
                  <Select
                    options={[
                      { label: '单项失败', value: 'failure' },
                      { label: '使用默认值', value: 'default' },
                    ]}
                  />
                </Form.Item>
                {foreachCoalesceOnEmpty === 'default' && (
                  <Form.Item
                    label="默认值"
                    name="transform_coalesce_default_value"
                  >
                    <TemplateVariableInput
                      ariaLabel="遍历候选默认值"
                      placeholder="固定值或变量"
                      references={foreachFieldReferences}
                    />
                  </Form.Item>
                )}
                <Space className={styles.nodeConfigFull} size="large" wrap>
                  <Form.Item
                    label="跳过 null"
                    name="transform_coalesce_skip_null"
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                  <Form.Item
                    label="跳过空文本"
                    name="transform_coalesce_skip_empty_string"
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                  <Form.Item
                    label="跳过空数组"
                    name="transform_coalesce_skip_empty_array"
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                  <Form.Item
                    label="跳过空对象"
                    name="transform_coalesce_skip_empty_object"
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                  <Form.Item
                    label="文本先去空白"
                    name="transform_coalesce_trim_strings"
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                </Space>
                <Form.Item
                  label="结果类型"
                  name="transform_coalesce_value_type"
                >
                  <Select options={automationVariableValueTypeOptions} />
                </Form.Item>
              </>
            )}

            {foreachTransformType === 'datetime_operation' && (
              <>
                <Form.Item label="日期操作" name="transform_datetime_operation">
                  <Select options={automationDatetimeOperationOptions} />
                </Form.Item>
                <Form.Item
                  className={styles.nodeConfigFull}
                  label="日期输入"
                  name="transform_datetime_input"
                  rules={[{ required: true }]}
                >
                  <TemplateVariableInput
                    ariaLabel="遍历日期输入"
                    placeholder="$each.item"
                    references={foreachFieldReferences}
                  />
                </Form.Item>
                {foreachDatetimeOperation === 'diff' && (
                  <Form.Item
                    className={styles.nodeConfigFull}
                    label="对比日期"
                    name="transform_datetime_right"
                    rules={[{ required: true }]}
                  >
                    <TemplateVariableInput
                      ariaLabel="遍历日期对比值"
                      placeholder="固定日期或变量"
                      references={foreachFieldReferences}
                    />
                  </Form.Item>
                )}
                <Form.Item
                  label="输入格式"
                  name="transform_datetime_input_format"
                >
                  <Select options={automationDatetimeInputFormatOptions} />
                </Form.Item>
                {foreachDatetimeOperation !== 'diff' && (
                  <Form.Item
                    label="输出格式"
                    name="transform_datetime_output_format"
                  >
                    <Select options={automationDatetimeOutputFormatOptions} />
                  </Form.Item>
                )}
                <Form.Item label="时区" name="transform_datetime_timezone">
                  <Input placeholder="Asia/Shanghai" />
                </Form.Item>
                {foreachDatetimeOperation === 'add' && (
                  <>
                    <Form.Item
                      label="增减数量"
                      name="transform_datetime_amount"
                    >
                      <TemplateVariableInput
                        ariaLabel="遍历日期增减数量"
                        placeholder="固定数字或变量"
                        references={foreachFieldReferences}
                      />
                    </Form.Item>
                    <Form.Item label="单位" name="transform_datetime_unit">
                      <Select options={automationDatetimeDurationUnitOptions} />
                    </Form.Item>
                  </>
                )}
                {foreachDatetimeOperation === 'diff' && (
                  <>
                    <Form.Item label="单位" name="transform_datetime_unit">
                      <Select
                        options={automationDatetimeDifferenceUnitOptions}
                      />
                    </Form.Item>
                    <Form.Item
                      label="小数精度"
                      name="transform_datetime_precision"
                    >
                      <InputNumber max={6} min={0} precision={0} />
                    </Form.Item>
                  </>
                )}
                {foreachDatetimeOperation === 'start_of' && (
                  <Form.Item label="周期" name="transform_datetime_unit">
                    <Select options={automationDatetimeStartUnitOptions} />
                  </Form.Item>
                )}
              </>
            )}

            <Divider className={styles.nodeConfigFull} />
            <VariableWriteFields
              overwrite={overwrite}
              references={fieldReferences}
              variable={variable}
            />
          </>
        );
      }
      case 'if':
        return (
          <>
            <Text className={styles.nodeConfigHint} type="secondary">
              例如：$vars.episode 大于
              1000。连接“是”和“否”两个出口决定后续流程。
            </Text>
            <Form.Item
              className={styles.nodeConfigFull}
              extra={
                protocolFieldExtra(inputProtocol('condition.field')) ||
                '只列出当前 RSS 字段和这个判断节点之前生成的变量。'
              }
              label="比较字段"
              name="condition_field"
              rules={[{ required: true }]}
            >
              <TemplateVariableInput
                ariaLabel="比较字段"
                placeholder="点击“插入变量”选择要判断的字段或变量"
                references={fieldReferences}
              />
            </Form.Item>
            <Form.Item
              label="判断方式"
              name="condition_operator"
              rules={[{ required: true }]}
            >
              <Select options={conditionOperators} />
            </Form.Item>
            {!['exists', 'not_exists'].includes(operator) && (
              <Form.Item
                label="比较值"
                name="condition_value"
                rules={[{ required: true }]}
                extra={
                  protocolFieldExtra(inputProtocol('condition.value')) ||
                  (operator === 'in' ? '多个值用英文逗号分隔' : undefined)
                }
              >
                <TemplateVariableInput
                  ariaLabel="比较值"
                  placeholder={
                    operator === 'in'
                      ? '多个值用英文逗号分隔'
                      : '输入固定值，或点击“插入变量”'
                  }
                  references={fieldReferences}
                />
              </Form.Item>
            )}
          </>
        );
      case 'parallel':
        return (
          <Form.Item
            className={styles.nodeConfigFull}
            label="并行分支"
            name="branches"
            rules={[
              {
                validator: (_, value) =>
                  normalizeBranches(value).length >= 2
                    ? Promise.resolve()
                    : Promise.reject(new Error('至少配置两个并行分支')),
              },
            ]}
            extra="输入分支名后回车；每个出口同一时间并发执行。"
          >
            <Select mode="tags" tokenSeparators={[',']} />
          </Form.Item>
        );
      case 'join':
        return (
          <>
            <Text className={styles.nodeConfigHint} type="secondary">
              完成型策略只有“继续”出口；按成功结果判断时，才会显示“满足”和“未满足”。
            </Text>
            <Form.Item
              className={styles.nodeConfigFull}
              label="汇合策略"
              name="policy"
            >
              <Select
                options={[
                  { label: '全部完成后继续', value: 'all_completed' },
                  { label: '任一完成立即继续', value: 'any_completed' },
                  { label: '全部成功才满足', value: 'all_success' },
                  { label: '任一成功就满足', value: 'any_success' },
                ]}
              />
            </Form.Item>
          </>
        );
      case 'qbittorrent':
        return (
          <>
            <Form.Item
              className={styles.nodeConfigFull}
              label="qBittorrent 目标"
              name="target_id"
              rules={[{ required: true }]}
            >
              <Select
                options={targets
                  .filter((target) => target.enabled)
                  .map((target) => ({ label: target.name, value: target.id }))}
                placeholder="请先在“下载器设置”添加 qBittorrent 账号"
              />
            </Form.Item>
            <ActionFields fieldReferences={fieldReferences} showQB />
          </>
        );
      case 'wait_qbittorrent':
        return (
          <>
            <Alert
              className={styles.nodeConfigFull}
              description="直接连接 qBittorrent 下载节点的成功出口。FilmFusion 会用提交时附加的内部标签定位任务，服务重启后仍可继续等待。"
              title="只有 qBittorrent 下载完成后才走成功出口"
              showIcon
              type="info"
            />
            <Form.Item
              label="检查间隔（秒）"
              name="poll_interval_seconds"
              rules={[{ required: true }]}
            >
              <InputNumber max={300} min={5} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              extra="默认 10080 分钟，即 7 天。"
              label="最长等待（分钟）"
              name="max_wait_minutes"
              rules={[{ required: true }]}
            >
              <InputNumber max={43200} min={1} style={{ width: '100%' }} />
            </Form.Item>
          </>
        );
      case 'moviepilot_transfer':
        return (
          <>
            <Alert
              className={styles.nodeConfigFull}
              description="直接连接“等待 qBittorrent 完成”的成功出口。节点会同步调用 MP2 手动整理接口；只有 MP2 明确返回成功，后续删种节点才会执行。"
              title="先完成 MP2 整理，再继续后续操作"
              showIcon
              type="info"
            />
            <Form.Item
              className={styles.nodeConfigFull}
              extra="留空使用 qB 返回的 content_path；如果 qB 与 MP2 的容器挂载路径不同，请填写 MP2 容器内可见的路径或流程变量。"
              label="MP2 可见源路径（可选）"
              name="source_path"
            >
              <TemplateVariableInput
                ariaLabel="MP2 可见源路径"
                placeholder="留空自动使用 qB 完成路径，或点击“插入变量”"
                references={fieldReferences}
              />
            </Form.Item>
            <Form.Item label="源路径类型" name="file_type">
              <Select
                options={[
                  { label: '自动判断', value: 'auto' },
                  { label: '单个文件', value: 'file' },
                  { label: '文件夹', value: 'dir' },
                ]}
              />
            </Form.Item>
            <Form.Item label="媒体类型" name="media_type">
              <Select
                options={[
                  { label: '自动识别', value: 'auto' },
                  { label: '电影', value: 'movie' },
                  { label: '电视剧', value: 'tv' },
                ]}
              />
            </Form.Item>
            <Form.Item
              className={styles.nodeConfigFull}
              extra="可留空让 MP2 自动识别；也可引用下载前的 MP 标题识别结果。"
              label="辅助 TMDB ID（可选）"
              name="tmdb_id"
              rules={[
                {
                  validator: (_, value) => {
                    const text = String(value || '').trim();
                    if (
                      !text ||
                      /^[1-9]\d{0,19}$/.test(text) ||
                      text.startsWith('$') ||
                      text.includes('{{')
                    ) {
                      return Promise.resolve();
                    }
                    return Promise.reject(
                      new Error('请输入正整数 TMDB ID 或流程变量'),
                    );
                  },
                },
              ]}
            >
              <TemplateVariableInput
                ariaLabel="MP2 整理辅助 TMDB ID"
                placeholder="例如 1396，或点击“插入变量”"
                references={fieldReferences}
              />
            </Form.Item>
            <Form.Item
              extra="留空沿用 MP2 目录配置；也可填写 MP2 支持的 copy、move、link 等方式。"
              label="整理方式（可选）"
              name="transfer_type"
            >
              <Input placeholder="留空沿用 MP2 配置" />
            </Form.Item>
            <Form.Item label="刮削元数据" name="scrape" valuePropName="checked">
              <Switch />
            </Form.Item>
          </>
        );
      case 'delete_qbittorrent':
        return (
          <>
            <Alert
              className={styles.nodeConfigFull}
              description="默认只从 qBittorrent 删除任务并停止做种，不删除下载数据。若开启同时删除文件，流程必须直接连接在“MP2 整理入库”成功出口之后。"
              title="删除操作不会自动重试"
              showIcon
              type="warning"
            />
            <Form.Item
              className={styles.nodeConfigFull}
              extra="开启后会让 qBittorrent 删除源下载数据；后端会强制校验 MP2 已整理成功。"
              label="同时删除下载文件"
              name="delete_files"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </>
        );
      case 'offline115':
      case 'offline115_openapi': {
        const isOpenAPI = node.type === 'offline115_openapi';
        return (
          <>
            <Text className={styles.nodeConfigHint} type="secondary">
              {isOpenAPI
                ? '使用 115 开放平台 AccessToken 提交离线任务。'
                : '使用 115 网页 Cookie 提交离线任务。'}
            </Text>
            <Form.Item
              className={styles.nodeConfigFull}
              label="115 账号"
              name="cloud_storage_id"
              rules={[{ required: true }]}
            >
              <Select
                onChange={() =>
                  form.setFieldsValue({
                    directory_id: undefined,
                    directory_path: undefined,
                  })
                }
                options={cloudStorages
                  .filter(
                    (storage) =>
                      storage.storage_type === '115open' &&
                      storage.status === 'active',
                  )
                  .map((storage) => ({
                    label: storage.storage_name,
                    value: storage.id,
                  }))}
                placeholder={
                  isOpenAPI
                    ? '选择已授权的 115 OpenAPI 账号'
                    : '选择带 Cookie 的 115 账号'
                }
              />
            </Form.Item>
            <ActionFields
              cloudStorageId={cloudStorageID}
              directoryAccessMethod={isOpenAPI ? 'openapi' : 'cookie'}
              directoryPath={directoryPath}
              fieldReferences={fieldReferences}
              onDirectoryPathChange={(path) =>
                form.setFieldValue('directory_path', path)
              }
              show115
            />
          </>
        );
      }
      case 'wait115':
        return (
          <>
            <Alert
              className={styles.nodeConfigFull}
              description="直接连接在 115 Cookie/OpenAPI 离线节点的“成功”出口。任务提交后会持久化查询进度，服务重启也会继续等待。"
              title="只有 115 云下载真正完成后，才会走成功出口。"
              showIcon
              type="info"
            />
            <Form.Item
              label="检查间隔（秒）"
              name="poll_interval_seconds"
              rules={[{ required: true }]}
            >
              <InputNumber max={300} min={5} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label="最长等待（分钟）"
              name="max_wait_minutes"
              rules={[{ required: true }]}
              extra="默认 10080 分钟，即 7 天；超时后走失败出口。"
            >
              <InputNumber max={43200} min={1} style={{ width: '100%' }} />
            </Form.Item>
          </>
        );
      case 'rename115_openapi':
        return (
          <>
            <Alert
              className={styles.nodeConfigFull}
              description="通常连接在“等待 115 下载完成”的成功出口，并把该节点的 file_id 插入下方。样本预览只展示将要使用的 ID 和名称，不会调用真实 115 接口。"
              title="通过 115 OpenAPI 重命名文件或文件夹"
              showIcon
              type="info"
            />
            <Form.Item
              className={styles.nodeConfigFull}
              label="115 OpenAPI 账号"
              name="cloud_storage_id"
              rules={[{ required: true }]}
            >
              <Select
                options={cloudStorages
                  .filter(
                    (storage) =>
                      storage.storage_type === '115open' &&
                      storage.status === 'active',
                  )
                  .map((storage) => ({
                    label: storage.storage_name,
                    value: storage.id,
                  }))}
                placeholder="选择执行重命名的 115 OpenAPI 账号"
              />
            </Form.Item>
            <Form.Item
              className={styles.nodeConfigFull}
              extra={
                protocolFieldExtra(inputProtocol('file_id')) ||
                '推荐插入“等待 115 下载完成 · 首个完成文件 ID”。'
              }
              label="文件或文件夹 ID"
              name="file_id"
              rules={[{ required: true }]}
            >
              <TemplateVariableInput
                ariaLabel="115 重命名对象 ID"
                placeholder="点击“插入变量”选择等待节点的 file_id"
                references={fieldReferences}
              />
            </Form.Item>
            <Form.Item
              className={styles.nodeConfigFull}
              extra={
                protocolFieldExtra(inputProtocol('new_name')) ||
                '最大 255 字节；重命名文件时请在模板中保留 .mkv 等扩展名。'
              }
              label="新名称"
              name="new_name"
              rules={[{ required: true }]}
            >
              <TemplateVariableInput
                ariaLabel="115 重命名新名称"
                placeholder="例如：{{item.title}}.mkv"
                references={fieldReferences}
              />
            </Form.Item>
          </>
        );
      case 'filmfusion_recognize':
        return (
          <>
            <Text className={styles.nodeConfigHint} type="secondary">
              {recognitionMode === 'file'
                ? '直接连接“等待 115 下载完成”的成功出口，递归读取其中的视频文件；不会修改云端文件名，也不会调用 MP2。'
                : '读取 RSS 标题或任意流程变量，应用“识别词管理”中已保存的词表后，由 FilmFusion 本地内核解析。'}
            </Text>
            <Form.Item
              className={styles.nodeConfigFull}
              extra={protocolFieldExtra(inputProtocol('recognition_mode'))}
              label="识别对象"
              name="recognition_mode"
              rules={[{ required: true }]}
            >
              <Select
                options={[
                  { label: '发布标题', value: 'title' },
                  { label: '115 下载文件', value: 'file' },
                ]}
              />
            </Form.Item>
            {recognitionMode !== 'file' && (
              <Form.Item
                className={styles.nodeConfigFull}
                extra={
                  protocolFieldExtra(inputProtocol('input')) ||
                  '通常选择 $item.title，也可以选择上游生成的标题变量。'
                }
                label="待识别标题"
                name="input"
                rules={[{ required: true }]}
              >
                <TemplateVariableInput
                  ariaLabel="FilmFusion 本地识别标题"
                  placeholder="点击“插入变量”选择 RSS 标题或上游变量"
                  references={fieldReferences}
                />
              </Form.Item>
            )}
            <Form.Item
              className={styles.nodeConfigFull}
              extra={
                protocolFieldExtra(inputProtocol('lookup_tmdb')) ||
                '关闭后仍会执行识别词和本地解析，只是不再向 TMDB 补全海报、评分等信息。'
              }
              label="查询 TMDB"
              name="lookup_tmdb"
              valuePropName="checked"
            >
              <Switch checkedChildren="查询" unCheckedChildren="仅本地" />
            </Form.Item>
            <Form.Item
              className={styles.nodeConfigFull}
              extra={
                protocolFieldExtra(inputProtocol('tmdb_id')) ||
                '可留空自动解析；填写后会加入 {tmdb-ID} 标记并校验结果。'
              }
              label="辅助 TMDB ID（可选）"
              name="tmdb_id"
              rules={[
                {
                  validator: (_, value) => {
                    const text = String(value || '').trim();
                    if (
                      !text ||
                      /^[1-9]\d{0,19}$/.test(text) ||
                      text.startsWith('$') ||
                      text.includes('{{')
                    ) {
                      return Promise.resolve();
                    }
                    return Promise.reject(
                      new Error('请输入正整数 TMDB ID 或流程变量'),
                    );
                  },
                },
              ]}
            >
              <TemplateVariableInput
                ariaLabel="FilmFusion 本地识别辅助 TMDB ID"
                placeholder="例如 1396，或点击“插入变量”"
                references={fieldReferences}
              />
            </Form.Item>
          </>
        );
      case 'moviepilot_recognize':
        return (
          <>
            <Alert
              className={styles.nodeConfigFull}
              description="直接连接在“等待 115 下载完成”节点的成功出口。若下载结果是文件夹，会递归识别其中的视频文件。"
              title="识别只读取文件名和文件夹上下文，不会修改 115 云端文件名。"
              showIcon
              type="info"
            />
            <Form.Item
              className={styles.nodeConfigFull}
              extra={`${protocolFieldExtra(inputProtocol('tmdb_id')) || '可留空自动识别。'} 运行时会按整理模块的规则构造 {tmdb-ID} 辅助识别名。`}
              label="辅助 TMDB ID（可选）"
              name="tmdb_id"
              rules={[
                {
                  validator: (_, value) => {
                    const text = String(value || '').trim();
                    if (
                      !text ||
                      /^[1-9]\d{0,19}$/.test(text) ||
                      text.startsWith('$') ||
                      text.includes('{{')
                    ) {
                      return Promise.resolve();
                    }
                    return Promise.reject(
                      new Error('请输入正整数 TMDB ID 或流程变量'),
                    );
                  },
                },
              ]}
            >
              <TemplateVariableInput
                ariaLabel="辅助 TMDB ID"
                placeholder="例如 1396，或点击“插入变量”"
                references={fieldReferences}
              />
            </Form.Item>
          </>
        );
      case 'moviepilot_title_recognize':
        return (
          <>
            <Alert
              className={styles.nodeConfigFull}
              description="可放在关键词或 IF 筛选后、下载节点前。节点会输出 TMDB ID、标题、年份、分类、评分和海报地址，供下载路径或通知继续使用。"
              title="使用 RSS 标题调用 MoviePilot 识别，不依赖 115 下载。"
              showIcon
              type="info"
            />
            <Form.Item
              className={styles.nodeConfigFull}
              extra={
                protocolFieldExtra(inputProtocol('input')) ||
                '通常选择 $item.title，也可以选择上游生成的标题变量。'
              }
              label="待识别标题"
              name="input"
              rules={[{ required: true }]}
            >
              <TemplateVariableInput
                ariaLabel="待识别标题"
                placeholder="点击“插入变量”选择 RSS 标题或上游变量"
                references={fieldReferences}
              />
            </Form.Item>
            <Form.Item
              className={styles.nodeConfigFull}
              extra={protocolFieldExtra(inputProtocol('tmdb_id'))}
              label="辅助 TMDB ID（可选）"
              name="tmdb_id"
              rules={[
                {
                  validator: (_, value) => {
                    const text = String(value || '').trim();
                    if (
                      !text ||
                      /^[1-9]\d{0,19}$/.test(text) ||
                      text.startsWith('$') ||
                      text.includes('{{')
                    ) {
                      return Promise.resolve();
                    }
                    return Promise.reject(
                      new Error('请输入正整数 TMDB ID 或流程变量'),
                    );
                  },
                },
              ]}
            >
              <TemplateVariableInput
                ariaLabel="标题识别辅助 TMDB ID"
                placeholder="例如 1396，或点击“插入变量”"
                references={fieldReferences}
              />
            </Form.Item>
          </>
        );
      case 'media_exists':
        return (
          <>
            <Alert
              className={styles.nodeConfigFull}
              description="按目录配置计算本地目标目录，同时用 TMDB ID 查询 Emby。已存在走“已存在”，不存在走“不存在”。"
              title="建议放在下载节点之前避免重复下载"
              showIcon
              type="info"
            />
            <Form.Item
              className={styles.nodeConfigFull}
              label="查重目录配置"
              name="cloud_directory_id"
              rules={[{ required: true, message: '请选择查重目录配置' }]}
            >
              <Select
                options={cloudDirectories.map((directory) => ({
                  label: [
                    directory.directory_name,
                    directory.save_path || '未配置本地保存路径',
                  ].join(' · '),
                  value: directory.id,
                  disabled: !directory.save_path,
                }))}
                placeholder="选择目录配置"
                showSearch
              />
            </Form.Item>
            <TemplateConfigField
              field="tmdb_id"
              label="TMDB ID"
              placeholder="点击“插入变量”选择 MP 识别结果"
              protocol={inputProtocol('tmdb_id')}
              references={fieldReferences}
              required
            />
            <TemplateConfigField
              field="title"
              label="媒体标题"
              protocol={inputProtocol('title')}
              references={fieldReferences}
            />
            <TemplateConfigField
              field="year"
              label="年份"
              protocol={inputProtocol('year')}
              references={fieldReferences}
            />
            <TemplateConfigField
              field="media_type"
              label="媒体类型"
              protocol={inputProtocol('media_type')}
              references={fieldReferences}
            />
            <TemplateConfigField
              field="category"
              label="媒体分类"
              protocol={inputProtocol('category')}
              references={fieldReferences}
            />
          </>
        );
      case 'hdhive_query':
        return (
          <>
            <Alert
              className={styles.nodeConfigFull}
              description="按 TMDB ID 查询 HDHive，可按分辨率和网盘类型筛选。找到资源走“找到资源”，否则走“没有资源”。"
              title="这里只查询资源，不会扣积分或解锁"
              showIcon
              type="info"
            />
            <TemplateConfigField
              field="tmdb_id"
              label="TMDB ID"
              protocol={inputProtocol('tmdb_id')}
              references={fieldReferences}
              required
            />
            <TemplateConfigField
              field="media_type"
              label="媒体类型"
              placeholder="movie、tv 或上游变量"
              protocol={inputProtocol('media_type')}
              references={fieldReferences}
              required
            />
            <TemplateConfigField
              field="resolution"
              label="分辨率筛选（可选）"
              placeholder="例如 2160p"
              protocol={inputProtocol('resolution')}
              references={fieldReferences}
            />
            <TemplateConfigField
              field="pan_type"
              label="网盘类型筛选（可选）"
              placeholder="例如 115"
              protocol={inputProtocol('pan_type')}
              references={fieldReferences}
            />
          </>
        );
      case 'hdhive_unlock':
        return (
          <>
            <Alert
              className={styles.nodeConfigFull}
              description="连接 HDHive 查询节点的“找到资源”出口。运行时会真实解锁资源，可能消耗 HDHive 积分。"
              title="这是实际解锁动作"
              showIcon
              type="warning"
            />
            <TemplateConfigField
              field="slug"
              label="资源 slug"
              placeholder="点击“插入变量”选择查询节点的 selected_slug"
              protocol={inputProtocol('slug')}
              references={fieldReferences}
              required
            />
          </>
        );
      case 'organize_strm':
        return (
          <>
            <Alert
              className={styles.nodeConfigFull}
              description="运行时会复用“目录配置”里的分类、过滤、保存路径和 STRM 前缀，真实重命名并移动 115 文件，然后写入本地 STRM。默认不删除源目录，也不自动重试。"
              title="这是实际整理动作"
              showIcon
              type="warning"
            />
            <Form.Item
              className={styles.nodeConfigFull}
              extra="目录配置必须与上游 115 下载节点使用同一个账号，并且需要设置保存路径和可用 Cookie。"
              label="整理目录配置"
              name="cloud_directory_id"
              rules={[{ required: true, message: '请选择整理目录配置' }]}
            >
              <Select
                aria-label="整理目录配置"
                options={cloudDirectories.map((directory) => {
                  const storageType =
                    directory.cloud_storage?.storage_type || '';
                  const disabled =
                    !directory.save_path ||
                    (storageType !== '' && storageType !== '115open');
                  return {
                    label: [
                      directory.directory_name,
                      directory.cloud_storage?.storage_name,
                      directory.save_path || '未配置 STRM 保存路径',
                    ]
                      .filter(Boolean)
                      .join(' · '),
                    value: directory.id,
                    disabled,
                  };
                })}
                placeholder="选择现有目录配置"
                showSearch={{ optionFilterProp: 'label' }}
              />
            </Form.Item>
            <Form.Item label="媒体类型" name="media_type">
              <Select
                options={[
                  { label: '自动识别', value: 'auto' },
                  { label: '电影', value: 'movie' },
                  { label: '电视剧 / 动漫', value: 'tv' },
                ]}
              />
            </Form.Item>
            <Form.Item
              extra="留空时沿用 MoviePilot 分类和目录配置的分类规则。"
              label="指定分类（可选）"
              name="category"
            >
              <Input placeholder="例如 国产剧集" />
            </Form.Item>
            <Form.Item
              label="只保留最佳版本"
              name="best_version_enabled"
              valuePropName="checked"
            >
              <Switch checkedChildren="开启" unCheckedChildren="关闭" />
            </Form.Item>
            <Form.Item
              extra="直接下载到单个文件时不会删除其整个父目录。字幕尚未下载完时会进入延迟删除。"
              label="整理成功后删除源目录"
              name="delete_source_folder"
              valuePropName="checked"
            >
              <Switch checkedChildren="删除" unCheckedChildren="保留" />
            </Form.Item>
            <Divider className={styles.nodeConfigFull} />
            <Form.Item
              label="启用文件名正则预处理"
              name="filename_regex_enabled"
              valuePropName="checked"
            >
              <Switch checkedChildren="开启" unCheckedChildren="关闭" />
            </Form.Item>
            {filenameRegexEnabled && (
              <>
                <Form.Item
                  label="文件名正则"
                  name="filename_regex_pattern"
                  rules={[{ required: true, message: '请输入文件名正则' }]}
                >
                  <Input placeholder=".* - (.*)-.*" />
                </Form.Item>
                <Form.Item label="替换内容" name="filename_regex_replacement">
                  <Input placeholder="$1" />
                </Form.Item>
              </>
            )}
          </>
        );
      case 'strm_verify':
        return (
          <>
            <Alert
              className={styles.nodeConfigFull}
              description="只读取整理节点返回的 STRM 文件，校验路径边界、文件类型、大小和非空内容，不访问 115。"
              title="只读校验，不会修改或重生成 STRM"
              showIcon
              type="info"
            />
            <Form.Item
              className={styles.nodeConfigFull}
              label="STRM 目录配置"
              name="cloud_directory_id"
              rules={[{ required: true, message: '请选择 STRM 目录配置' }]}
            >
              <Select
                options={cloudDirectories.map((directory) => ({
                  label: [
                    directory.directory_name,
                    directory.save_path || '未配置 STRM 保存路径',
                  ].join(' · '),
                  value: directory.id,
                  disabled: !directory.save_path,
                }))}
                placeholder="选择与整理节点相同的目录配置"
                showSearch
              />
            </Form.Item>
          </>
        );
      case 'strm_regenerate':
        return (
          <>
            <Alert
              className={styles.nodeConfigFull}
              description="只使用上游整理节点已返回的 STRM 路径和内容，在配置的本地根目录内原子重写；不请求 115。"
              title="只能连接 STRM 校验节点的“无效”出口"
              showIcon
              type="warning"
            />
            <Form.Item
              className={styles.nodeConfigFull}
              label="STRM 目录配置"
              name="cloud_directory_id"
              rules={[{ required: true, message: '请选择 STRM 目录配置' }]}
            >
              <Select
                options={cloudDirectories.map((directory) => ({
                  label: [
                    directory.directory_name,
                    directory.save_path || '未配置 STRM 保存路径',
                  ].join(' · '),
                  value: directory.id,
                  disabled: !directory.save_path,
                }))}
                placeholder="选择与整理 / 校验节点相同的目录配置"
                showSearch
              />
            </Form.Item>
          </>
        );
      case 'emby_refresh_wait':
        return (
          <>
            <Alert
              className={styles.nodeConfigFull}
              description="首次执行触发一次 Emby 全库刷新，然后按 TMDB ID 轮询；服务重启后会继续等待且不会重复刷新。"
              title="用于确认 STRM 已真正进入 Emby 媒体库"
              showIcon
              type="info"
            />
            <TemplateConfigField
              field="tmdb_id"
              label="TMDB ID"
              protocol={inputProtocol('tmdb_id')}
              references={fieldReferences}
              required
            />
            <TemplateConfigField
              field="media_type"
              label="媒体类型（可选）"
              placeholder="movie、tv 或上游变量"
              protocol={inputProtocol('media_type')}
              references={fieldReferences}
            />
            <Form.Item
              label="触发 Emby 媒体库刷新"
              name="refresh_library"
              valuePropName="checked"
            >
              <Switch checkedChildren="刷新" unCheckedChildren="只等待" />
            </Form.Item>
            <Form.Item
              label="检查间隔（秒）"
              name="poll_interval_seconds"
              rules={[{ required: true }]}
            >
              <InputNumber max={300} min={5} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label="最长等待（分钟）"
              name="max_wait_minutes"
              rules={[{ required: true }]}
            >
              <InputNumber max={1440} min={1} style={{ width: '100%' }} />
            </Form.Item>
          </>
        );
      case 'http_request':
        return (
          <>
            <Alert
              className={styles.nodeConfigFull}
              description="预览时不发起请求。真正运行时默认禁止访问内网地址、禁止跳转，响应最多保留 1 MiB。"
              title="通用 HTTP / Webhook 节点"
              showIcon
              type="info"
            />
            <Form.Item
              label="HTTP 方法"
              name="method"
              rules={[{ required: true }]}
            >
              <Select
                options={['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(
                  (value) => ({ label: value, value }),
                )}
              />
            </Form.Item>
            <TemplateConfigField
              field="url"
              insertMode="template"
              label="请求地址"
              placeholder="例如 https://hooks.example/api/media，也可插入变量"
              protocol={inputProtocol('url')}
              references={fieldReferences}
              required
            />
            <Form.Item label="Content-Type" name="content_type">
              <Input placeholder="application/json" />
            </Form.Item>
            <Form.Item
              className={styles.nodeConfigFull}
              extra={`${protocolFieldExtra(inputProtocol('headers')) || 'JSON 对象；请求头的值支持变量。'} Authorization 等敏感值会保存在流程定义中。`}
              label="请求头 JSON"
              name="headers_json"
              rules={[
                {
                  validator: (_, value) => {
                    try {
                      parseHTTPHeaders(value);
                      return Promise.resolve();
                    } catch (error: any) {
                      return Promise.reject(
                        new Error(error?.message || '请求头 JSON 无效'),
                      );
                    }
                  },
                },
              ]}
            >
              <TemplateVariableInput
                ariaLabel="HTTP 请求头 JSON"
                insertMode="template"
                multiline
                placeholder={'{\n  "X-Media-Type": "movie"\n}'}
                references={fieldReferences}
              />
            </Form.Item>
            <Form.Item
              className={styles.nodeConfigFull}
              extra={
                protocolFieldExtra(inputProtocol('body')) ||
                '最大 1 MiB；点击“插入变量”可选择 RSS 字段或上游输出。'
              }
              label="请求体（可选）"
              name="body"
            >
              <TemplateVariableInput
                ariaLabel="HTTP 请求体"
                insertMode="template"
                multiline
                placeholder={'{\n  "tmdb_id": "1396"\n}'}
                references={fieldReferences}
              />
            </Form.Item>
            <Form.Item
              extra="只有调用 NAS / 容器内部接口时才开启。"
              label="允许访问内网"
              name="allow_private_network"
              valuePropName="checked"
            >
              <Switch checkedChildren="允许" unCheckedChildren="禁止" />
            </Form.Item>
            <Form.Item
              label="跟随 HTTP 跳转"
              name="follow_redirects"
              valuePropName="checked"
            >
              <Switch checkedChildren="跟随" unCheckedChildren="禁止" />
            </Form.Item>
          </>
        );
      case 'notification':
        return (
          <>
            <Form.Item
              className={styles.nodeConfigFull}
              extra={
                protocolFieldExtra(inputProtocol('image_url')) ||
                '可留空；通常选择 MP 标题识别输出的海报地址。'
              }
              label="通知图片 / 海报（可选）"
              name="image_url"
            >
              <TemplateVariableInput
                ariaLabel="通知图片地址"
                placeholder="输入图片地址，或点击“插入变量”"
                references={fieldReferences}
              />
            </Form.Item>
            <Form.Item
              className={styles.nodeConfigFull}
              extra={protocolFieldExtra(inputProtocol('title'))}
              label="通知标题"
              name="title"
            >
              <TemplateVariableInput
                ariaLabel="通知标题"
                insertMode="template"
                placeholder="RSS 自动化命中"
                references={fieldReferences}
              />
            </Form.Item>
            <Form.Item
              className={styles.nodeConfigFull}
              label="通知内容"
              name="message"
              rules={[{ required: true }]}
              extra={
                protocolFieldExtra(inputProtocol('message')) ||
                '点击“插入变量”，选中后会放到当前光标位置。'
              }
            >
              <TemplateVariableInput
                ariaLabel="通知内容"
                insertMode="template"
                multiline
                references={fieldReferences}
              />
            </Form.Item>
          </>
        );
      default:
        return (
          <Text className={styles.nodeConfigFull} type="secondary">
            {node.type === 'trigger'
              ? '每个新 RSS 条目从这里进入流程。'
              : '该节点没有额外配置。'}
          </Text>
        );
    }
  };

  return (
    <Modal
      centered
      className={styles.nodeConfigModal}
      destroyOnHidden
      footer={
        <div className={styles.nodeConfigFooter}>
          <div>
            {node && node.type !== 'trigger' && (
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={() => onDelete(node)}
                type="text"
              >
                删除节点
              </Button>
            )}
          </div>
          <Space>
            <Button onClick={onClose}>取消</Button>
            <Button onClick={save} type="primary">
              应用配置
            </Button>
          </Space>
        </div>
      }
      mask={{ closable: false }}
      onCancel={onClose}
      open={Boolean(node)}
      title={node ? `配置 · ${NODE_LABELS[node.type]}` : '节点配置'}
      width={760}
    >
      {node && (
        <Form
          className={styles.nodeConfigForm}
          form={form}
          layout="vertical"
          preserve={false}
        >
          {preview && (
            <Alert
              className={styles.nodeConfigPreview}
              title={
                <>
                  <Text strong>{preview.label}</Text>
                  {preview.detail && (
                    <Text type="secondary"> · {preview.detail}</Text>
                  )}
                </>
              }
              showIcon
              type={
                !preview.active
                  ? 'info'
                  : preview.tone === 'success'
                    ? 'success'
                    : 'warning'
              }
            />
          )}
          {nodeProtocol && (
            <Alert
              className={styles.nodeConfigPreview}
              description={`输入 ${nodeProtocol.inputs.length} 个 · 输出 ${nodeProtocol.outputs.length} 个；变量均声明名称、类型、说明和示例值。`}
              title="节点变量协议已登记"
              showIcon
              type="info"
            />
          )}
          <Form.Item
            className={styles.nodeConfigFull}
            label="节点名称"
            name="name"
            rules={[{ required: true, message: '请输入节点名称' }]}
          >
            <Input maxLength={120} />
          </Form.Item>
          {renderConfig()}
          {![
            'trigger',
            'delay',
            'end',
            'parallel',
            'join',
            'if',
            'keyword',
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
          ].includes(node.type) && (
            <>
              <Divider className={styles.nodeConfigFull} />
              <Space className={styles.nodeConfigRetryFields} size="large">
                <Form.Item
                  label="最多尝试次数"
                  name="max_attempts"
                  style={{ marginBottom: 0 }}
                >
                  <InputNumber
                    disabled={[
                      'moviepilot_transfer',
                      'delete_qbittorrent',
                      'organize_strm',
                      'strm_regenerate',
                      'http_request',
                    ].includes(node.type)}
                    max={
                      [
                        'moviepilot_transfer',
                        'delete_qbittorrent',
                        'organize_strm',
                        'strm_regenerate',
                        'http_request',
                      ].includes(node.type)
                        ? 1
                        : 10
                    }
                    min={1}
                  />
                </Form.Item>
                {[
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
                ].includes(node.type) && (
                  <Form.Item
                    label="单次超时（秒）"
                    name="timeout_seconds"
                    style={{ marginBottom: 0 }}
                  >
                    <InputNumber max={600} min={5} />
                  </Form.Item>
                )}
              </Space>
            </>
          )}
        </Form>
      )}
    </Modal>
  );
};

const ActionFields = ({
  showQB,
  show115,
  cloudStorageId,
  directoryAccessMethod,
  directoryPath,
  fieldReferences,
  onDirectoryPathChange,
}: {
  showQB?: boolean;
  show115?: boolean;
  cloudStorageId?: number;
  directoryAccessMethod?: 'cookie' | 'openapi';
  directoryPath?: string;
  fieldReferences: NodeFieldReference[];
  onDirectoryPathChange?: (path: string) => void;
}) => (
  <>
    <Form.Item
      className={styles.nodeConfigFull}
      label="下载 URL"
      name="url"
      rules={[{ required: true }]}
      extra="选择 enclosure@url 等解析出的下载字段，通常为 download_url。"
    >
      <TemplateVariableInput
        ariaLabel="下载 URL"
        placeholder="点击“插入变量”选择 RSS 下载字段或上游变量"
        references={fieldReferences}
      />
    </Form.Item>
    {showQB && (
      <>
        <Form.Item label="保存路径" name="save_path">
          <TemplateVariableInput
            ariaLabel="qBittorrent 保存路径"
            insertMode="template"
            placeholder="例如 /downloads/电影，可在光标处插入变量"
            references={fieldReferences}
          />
        </Form.Item>
        <Form.Item label="分类" name="category">
          <TemplateVariableInput
            ariaLabel="qBittorrent 分类"
            insertMode="template"
            placeholder="例如 电影，或点击“插入变量”"
            references={fieldReferences}
          />
        </Form.Item>
        <Form.Item className={styles.nodeConfigFull} label="标签" name="tags">
          <TemplateVariableInput
            ariaLabel="qBittorrent 标签"
            insertMode="template"
            placeholder="例如 rss,电影，可在光标处插入变量"
            references={fieldReferences}
          />
        </Form.Item>
        <Space className={styles.nodeConfigFull} size="large">
          <Form.Item label="暂停添加" name="paused" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label="顺序下载" name="sequential" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Space>
      </>
    )}
    {show115 && (
      <>
        <Form.Item hidden name="directory_path">
          <Input />
        </Form.Item>
        <Form.Item
          className={styles.nodeConfigFull}
          extra="选择目录后会保存对应目录 ID；未选择时使用根目录。"
          label="保存目录"
          name="directory_id"
        >
          <DirectoryIdInput
            accessMethod={directoryAccessMethod}
            cloudStorageId={cloudStorageId}
            onSelectedPathChange={onDirectoryPathChange}
            selectedPath={directoryPath}
          />
        </Form.Item>
      </>
    )}
  </>
);

export default NodeConfigModal;
