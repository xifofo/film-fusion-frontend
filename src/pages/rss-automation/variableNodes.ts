import type { RSSAutomationNodeDefinition } from '@/services/film-fusion';

export type AutomationVariableOverwrite = 'overwrite' | 'keep' | 'error';
export type AutomationVariableValueType =
  | 'auto'
  | 'string'
  | 'integer'
  | 'number'
  | 'boolean'
  | 'datetime'
  | 'json';
export type AutomationMathOperation =
  | 'add'
  | 'subtract'
  | 'multiply'
  | 'divide'
  | 'mod'
  | 'min'
  | 'max'
  | 'abs'
  | 'round'
  | 'floor'
  | 'ceil';

export const automationVariableOverwriteOptions = [
  { label: '覆盖原值', value: 'overwrite' },
  { label: '保留原值', value: 'keep' },
  { label: '已有值时报错', value: 'error' },
];

export const automationVariableValueTypeOptions = [
  { label: '自动保留类型', value: 'auto' },
  { label: '文本 string', value: 'string' },
  { label: '整数 integer', value: 'integer' },
  { label: '小数 number', value: 'number' },
  { label: '布尔 boolean', value: 'boolean' },
  { label: '日期 datetime', value: 'datetime' },
  { label: 'JSON', value: 'json' },
];

export const automationMathOperationOptions = [
  { label: '相加 +', value: 'add' },
  { label: '相减 −', value: 'subtract' },
  { label: '相乘 ×', value: 'multiply' },
  { label: '相除 ÷', value: 'divide' },
  { label: '取余 %', value: 'mod' },
  { label: '取较小值 min', value: 'min' },
  { label: '取较大值 max', value: 'max' },
  { label: '绝对值 abs', value: 'abs' },
  { label: '四舍五入 round', value: 'round' },
  { label: '向下取整 floor', value: 'floor' },
  { label: '向上取整 ceil', value: 'ceil' },
];

export const automationUnaryMathOperations = new Set<AutomationMathOperation>([
  'abs',
  'round',
  'floor',
  'ceil',
]);

const reservedVariableNames = new Set([
  '__proto__',
  'prototype',
  'constructor',
]);
const variableNamePattern = /^[\p{L}_][\p{L}\p{N}_]{0,63}$/u;
const MAX_VARIABLE_JSON_BYTES = 1024 * 1024;
const MAX_TEMPLATE_BYTES = 64 * 1024;
const MAX_TEMPLATE_REFERENCES = 200;
const MAX_JSON_POINTER_BYTES = 4096;
const MAX_JSON_POINTER_SEGMENTS = 64;
const MAX_JSON_NESTING_DEPTH = 64;
const decimalNumberPattern =
  /^[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+)?$/;
const textBytes = (value: string) => new TextEncoder().encode(value).length;

export const automationVariableNameError = (raw: unknown) => {
  const name = String(raw ?? '').trim();
  if (!name) return '请输入变量名';
  if (reservedVariableNames.has(name.toLowerCase())) {
    return '该变量名为系统保留名称';
  }
  if (!variableNamePattern.test(name)) {
    return '变量名须以文字或下划线开头，只能包含文字、数字和下划线，最长 64 个字符';
  }
  return undefined;
};

export const normalizeAutomationVariableName = (raw: unknown) =>
  String(raw ?? '').trim();

type VariableWriteResult = {
  written: boolean;
  overwritten: boolean;
  existing: boolean;
  previousValue?: unknown;
  value: unknown;
  variables: Record<string, unknown>;
};

export type VariableNodePreviewResult = VariableWriteResult & {
  variable: string;
  output: Record<string, unknown>;
};

const contextVariables = (context: Record<string, unknown>) => {
  const existing = context.vars;
  if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
    return existing as Record<string, unknown>;
  }
  const variables: Record<string, unknown> = {};
  context.vars = variables;
  return variables;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const resolveReference = (
  context: Record<string, unknown>,
  reference: string,
): { exists: boolean; value?: unknown } => {
  const path = reference.trim().replace(/^\$/, '').split('.').filter(Boolean);
  let current: unknown = context;
  for (const key of path) {
    if (Array.isArray(current)) {
      if (!/^(0|[1-9]\d*)$/.test(key)) return { exists: false };
      const index = Number(key);
      if (index >= current.length) return { exists: false };
      current = current[index];
      continue;
    }
    if (!isRecord(current) || !Object.hasOwn(current, key)) {
      return { exists: false };
    }
    current = current[key];
  }
  return { exists: true, value: current };
};

const exactReferencePattern = /^\$(?:item|vars|nodes|each)(?:\..+)?$/;
const templatePattern = /\{\{\s*([^{}]+?)\s*\}\}/g;

const templateValueText = (value: unknown) => {
  if (value == null) return '';
  if (typeof value === 'object') return stableAutomationJSONStringify(value);
  return String(value);
};

const stableJSONValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableJSONValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableJSONValue(value[key])]),
  );
};

export const stableAutomationJSONStringify = (value: unknown) =>
  JSON.stringify(stableJSONValue(value));

const assertAutomationPreviewJSONSafe = (
  value: unknown,
  depth = 0,
  ancestors = new WeakSet<object>(),
) => {
  if (depth > MAX_JSON_NESTING_DEPTH) {
    throw new Error(`变量 JSON 嵌套不能超过 ${MAX_JSON_NESTING_DEPTH} 层`);
  }
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('变量数字不能是 NaN 或 Infinity');
    }
    if (Math.abs(value) > Number.MAX_SAFE_INTEGER) {
      throw new Error(
        `变量数字必须在 ${-Number.MAX_SAFE_INTEGER} 到 ${Number.MAX_SAFE_INTEGER} 之间`,
      );
    }
    return;
  }
  if (typeof value !== 'object') {
    throw new Error('变量值不是可持久化的 JSON');
  }
  if (ancestors.has(value)) {
    throw new Error('变量 JSON 不能包含循环引用');
  }
  if (!Array.isArray(value)) {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error('变量值只能包含普通 JSON 对象');
    }
  }
  ancestors.add(value);
  const entries = Array.isArray(value)
    ? value
    : Object.values(value as Record<string, unknown>);
  for (const entry of entries) {
    assertAutomationPreviewJSONSafe(entry, depth + 1, ancestors);
  }
  ancestors.delete(value);
};

const finiteAutomationPreviewNumber = (value: unknown, label: string) => {
  if (typeof value !== 'number' && typeof value !== 'string') {
    throw new Error(`${label}不是有效数字`);
  }
  if (typeof value === 'string' && !value.trim()) {
    throw new Error(`${label}为空`);
  }
  if (typeof value === 'string' && !decimalNumberPattern.test(value.trim())) {
    throw new Error(`${label}不是有效数字`);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label}不是有效数字`);
  return parsed;
};

const automationMonthIndexes: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

const automationUTCDate = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond = 0,
) => {
  const date = new Date(0);
  date.setUTCFullYear(year, month, day);
  date.setUTCHours(hour, minute, second, millisecond);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute ||
    date.getUTCSeconds() !== second ||
    date.getUTCMilliseconds() !== millisecond
  ) {
    return undefined;
  }
  return date;
};

const automationTimezoneOffsetMinutes = (zone: string) => {
  if (zone === 'Z' || /^[A-Z]{3}$/.test(zone)) return 0;
  const match = zone.match(/^([+-])(\d{2}):?(\d{2})$/);
  if (!match) return undefined;
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  if (hours > 23 || minutes > 59) return undefined;
  const offset = hours * 60 + minutes;
  return match[1] === '-' ? -offset : offset;
};

const parseAutomationPreviewDatetime = (raw: string) => {
  const iso = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/,
  );
  if (iso) {
    const fraction = iso[7] || '';
    const local = automationUTCDate(
      Number(iso[1]),
      Number(iso[2]) - 1,
      Number(iso[3]),
      Number(iso[4]),
      Number(iso[5]),
      Number(iso[6]),
      Number(`${fraction}000`.slice(0, 3)),
    );
    const offset = automationTimezoneOffsetMinutes(iso[8]);
    if (!local || offset === undefined) return undefined;
    return new Date(local.getTime() - offset * 60_000);
  }

  const local = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}):(\d{2}))?$/,
  );
  if (local) {
    return automationUTCDate(
      Number(local[1]),
      Number(local[2]) - 1,
      Number(local[3]),
      Number(local[4] || 0),
      Number(local[5] || 0),
      Number(local[6] || 0),
    );
  }

  const rfc1123 = raw.match(
    /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), (\d{2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4}) (\d{2}):(\d{2}):(\d{2}) ([+-]\d{4}|[A-Z]{3})$/,
  );
  const rfc822 = raw.match(
    /^(\d{2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{2}) (\d{2}):(\d{2}) ([+-]\d{4}|[A-Z]{3})$/,
  );
  const matched = rfc1123 || rfc822;
  if (!matched) return undefined;
  const shortYear = !rfc1123;
  const yearValue = Number(matched[3]);
  const year = shortYear
    ? yearValue >= 69
      ? 1900 + yearValue
      : 2000 + yearValue
    : yearValue;
  const second = shortYear ? 0 : Number(matched[6]);
  const zone = matched[shortYear ? 6 : 7];
  const offset = automationTimezoneOffsetMinutes(zone);
  const date = automationUTCDate(
    year,
    automationMonthIndexes[matched[2]],
    Number(matched[1]),
    Number(matched[4]),
    Number(matched[5]),
    second,
  );
  if (!date || offset === undefined) return undefined;
  return new Date(date.getTime() - offset * 60_000);
};

export const resolveAutomationPreviewValue = (
  context: Record<string, unknown>,
  configured: unknown,
): unknown => {
  if (typeof configured !== 'string') return configured;
  const expression = configured.trim();
  if (exactReferencePattern.test(expression)) {
    const resolved = resolveReference(context, expression);
    if (!resolved.exists) throw new Error(`变量 ${expression} 不存在`);
    return resolved.value;
  }
  if (expression.includes('{{')) {
    return renderAutomationPreviewTemplate(context, configured, 'error');
  }
  return configured;
};

export const renderAutomationPreviewTemplateResult = (
  context: Record<string, unknown>,
  template: unknown,
  missing: 'error' | 'empty',
) => {
  const templateText = String(template ?? '');
  if (textBytes(templateText) > MAX_TEMPLATE_BYTES) {
    throw new Error(`模板内容不能超过 ${MAX_TEMPLATE_BYTES} 字节`);
  }
  const references = [...templateText.matchAll(templatePattern)];
  if (references.length > MAX_TEMPLATE_REFERENCES) {
    throw new Error(`模板变量不能超过 ${MAX_TEMPLATE_REFERENCES} 个`);
  }
  const missingReferences = new Set<string>();
  const result = templateText.replace(templatePattern, (_, rawPath: string) => {
    const path = rawPath.trim();
    const resolved = resolveReference(context, path);
    if (!resolved.exists) {
      missingReferences.add(path);
      return '';
    }
    return templateValueText(resolved.value);
  });
  if (missing === 'error' && missingReferences.size > 0) {
    throw new Error(`模板变量不存在：${[...missingReferences].join('、')}`);
  }
  return { value: result, missingReferences: [...missingReferences] };
};

export const renderAutomationPreviewTemplate = (
  context: Record<string, unknown>,
  template: unknown,
  missing: 'error' | 'empty',
) => renderAutomationPreviewTemplateResult(context, template, missing).value;

export const convertAutomationPreviewValue = (
  value: unknown,
  rawType: unknown,
): unknown => {
  const valueType = String(rawType || 'auto') as AutomationVariableValueType;
  if (valueType === 'auto') return value;
  if (valueType === 'json') {
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value);
    } catch {
      throw new Error('输入值不是有效的 JSON');
    }
  }
  if (valueType === 'string') {
    return typeof value === 'object' && value !== null
      ? stableAutomationJSONStringify(value)
      : String(value ?? '');
  }
  const raw = String(value ?? '').trim();
  if (valueType === 'integer') {
    const parsed = finiteAutomationPreviewNumber(value, raw || '空值');
    if (!Number.isInteger(parsed)) throw new Error(`${raw || '空值'} 不是整数`);
    if (!Number.isSafeInteger(parsed)) throw new Error('整数超出安全范围');
    return parsed;
  }
  if (valueType === 'number') {
    return finiteAutomationPreviewNumber(value, raw || '空值');
  }
  if (valueType === 'boolean') {
    if (typeof value === 'boolean') return value;
    if (['1', 't', 'T', 'true', 'TRUE', 'True'].includes(raw)) return true;
    if (['0', 'f', 'F', 'false', 'FALSE', 'False'].includes(raw)) return false;
    throw new Error(`${raw || '空值'} 不是布尔值`);
  }
  if (valueType === 'datetime') {
    const parsed = parseAutomationPreviewDatetime(raw);
    if (!parsed) throw new Error(`${raw || '空值'} 不是日期`);
    return parsed.toISOString().replace('.000Z', 'Z');
  }
  throw new Error(`不支持的变量类型 ${valueType}`);
};

export const writeAutomationPreviewVariable = (
  context: Record<string, unknown>,
  rawName: unknown,
  value: unknown,
  rawOverwrite: unknown,
): VariableNodePreviewResult => {
  const variable = normalizeAutomationVariableName(rawName);
  const nameError = automationVariableNameError(variable);
  if (nameError) throw new Error(nameError);
  const overwrite = String(
    rawOverwrite || 'overwrite',
  ) as AutomationVariableOverwrite;
  if (!['overwrite', 'keep', 'error'].includes(overwrite)) {
    throw new Error('变量冲突策略无效');
  }
  const variables = contextVariables(context);
  const previousExists = Object.hasOwn(variables, variable);
  const previousValue = variables[variable];
  assertAutomationPreviewJSONSafe(value);
  const encodedValue = JSON.stringify(value);
  if (encodedValue === undefined) throw new Error('变量值不是可持久化的 JSON');
  if (textBytes(encodedValue) > MAX_VARIABLE_JSON_BYTES) {
    throw new Error(`变量 JSON 不能超过 ${MAX_VARIABLE_JSON_BYTES} 字节`);
  }
  const valueType = (() => {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    if (typeof value === 'number')
      return Number.isInteger(value) ? 'integer' : 'number';
    return typeof value;
  })();
  if (previousExists && overwrite === 'error') {
    throw new Error(`变量 $vars.${variable} 已存在`);
  }
  if (previousExists && overwrite === 'keep') {
    const output = {
      written: false,
      overwritten: false,
      existing: true,
      variable,
      value,
      value_type: valueType,
      variables: {},
    };
    return {
      written: false,
      overwritten: false,
      existing: previousExists,
      previousValue,
      value: previousValue,
      variable,
      variables: {},
      output,
    };
  }
  variables[variable] = value;
  const produced = { [variable]: value };
  const output = {
    written: true,
    overwritten: previousExists,
    existing: previousExists,
    variable,
    value,
    value_type: valueType,
    variables: produced,
  };
  return {
    written: true,
    overwritten: previousExists,
    existing: previousExists,
    previousValue,
    value,
    variable,
    variables: produced,
    output,
  };
};

const decodeJSONPointerToken = (token: string) => {
  if (/~(?:[^01]|$)/.test(token)) throw new Error('JSON Pointer 转义无效');
  return token.replaceAll('~1', '/').replaceAll('~0', '~');
};

export const automationJSONPointerError = (rawPointer: unknown) => {
  const pointer = String(rawPointer ?? '');
  if (textBytes(pointer) > MAX_JSON_POINTER_BYTES) {
    return `JSON Pointer 不能超过 ${MAX_JSON_POINTER_BYTES} 字节`;
  }
  if (pointer && !pointer.startsWith('/')) {
    return 'JSON Pointer 必须为空或以 / 开头';
  }
  if (
    pointer &&
    pointer.slice(1).split('/').length > MAX_JSON_POINTER_SEGMENTS
  ) {
    return `JSON Pointer 不能超过 ${MAX_JSON_POINTER_SEGMENTS} 段`;
  }
  try {
    for (const rawToken of pointer ? pointer.slice(1).split('/') : []) {
      decodeJSONPointerToken(rawToken);
    }
  } catch (error: any) {
    return error?.message || 'JSON Pointer 转义无效';
  }
  return undefined;
};

export const resolveAutomationJSONPointer = (
  input: unknown,
  rawPointer: unknown,
): { exists: boolean; value?: unknown } => {
  let document = input;
  if (typeof document === 'string') {
    try {
      document = JSON.parse(document);
    } catch {
      throw new Error('输入值不是有效的 JSON');
    }
  }
  const pointer = String(rawPointer ?? '');
  const pointerError = automationJSONPointerError(pointer);
  if (pointerError) throw new Error(pointerError);
  if (pointer === '') return { exists: true, value: document };
  let current = document;
  for (const rawToken of pointer.slice(1).split('/')) {
    const token = decodeJSONPointerToken(rawToken);
    if (Array.isArray(current)) {
      if (!/^(0|[1-9]\d*)$/.test(token)) return { exists: false };
      const index = Number(token);
      if (index >= current.length) return { exists: false };
      current = current[index];
      continue;
    }
    if (!isRecord(current) || !Object.hasOwn(current, token)) {
      return { exists: false };
    }
    current = current[token];
  }
  return { exists: true, value: current };
};

const numberOperand = (
  context: Record<string, unknown>,
  configured: unknown,
  label: string,
) => {
  const raw = resolveAutomationPreviewValue(context, configured);
  return finiteAutomationPreviewNumber(raw, label);
};

const goRound = (value: number) =>
  value < 0 ? -Math.round(Math.abs(value)) : Math.round(value);

const roundToPrecision = (value: number, precision: number) => {
  if (precision === 0) return goRound(value);
  const factor = 10 ** precision;
  const scaled = value * factor;
  if (!Number.isFinite(scaled)) throw new Error('数学结果超出范围');
  return goRound(scaled) / factor;
};

export const executeAutomationMathPreview = (
  context: Record<string, unknown>,
  config: Record<string, unknown>,
) => {
  const operation = String(
    config.operation || 'add',
  ) as AutomationMathOperation;
  if (
    !automationMathOperationOptions.some((item) => item.value === operation)
  ) {
    throw new Error('数学运算类型无效');
  }
  const left = numberOperand(context, config.left, '左操作数');
  let result: number;
  if (automationUnaryMathOperations.has(operation)) {
    if (operation === 'abs') result = Math.abs(left);
    else if (operation === 'round') result = left;
    else if (operation === 'floor') result = Math.floor(left);
    else result = Math.ceil(left);
  } else {
    const right = numberOperand(context, config.right, '右操作数');
    switch (operation) {
      case 'add':
        result = left + right;
        break;
      case 'subtract':
        result = left - right;
        break;
      case 'multiply':
        result = left * right;
        break;
      case 'divide':
        if (right === 0) throw new Error('不能除以 0');
        result = left / right;
        break;
      case 'mod':
        if (right === 0) throw new Error('不能对 0 取余');
        result = left % right;
        break;
      case 'min':
        result = Math.min(left, right);
        break;
      case 'max':
        result = Math.max(left, right);
        break;
      default:
        throw new Error('数学运算类型无效');
    }
  }
  if (!Number.isFinite(result)) throw new Error('数学结果超出范围');
  const resultType = String(config.result_type || 'number');
  const precisionSet =
    config.precision !== undefined && config.precision !== null;
  const precision = precisionSet ? config.precision : 0;
  if (typeof precision !== 'number') {
    throw new Error('小数精度必须是 0 到 12 的整数');
  }
  if (!Number.isInteger(precision) || precision < 0 || precision > 12) {
    throw new Error('小数精度必须是 0 到 12 的整数');
  }
  if (operation === 'round') {
    result = roundToPrecision(result, precision);
  } else if (resultType === 'number' && precisionSet) {
    result = roundToPrecision(result, precision);
  }
  if (resultType === 'integer') {
    if (!Number.isSafeInteger(result)) {
      throw new Error('结果不是安全整数；请先使用 round、floor 或 ceil 取整');
    }
    return result;
  }
  if (resultType !== 'number') throw new Error('数学结果类型无效');
  return result;
};

export const executeAutomationVariablePreviewNode = (
  node: RSSAutomationNodeDefinition,
  context: Record<string, unknown>,
): VariableNodePreviewResult => {
  const config = node.config || {};
  if (node.type === 'set_variable') {
    const sourceKind =
      typeof config.value !== 'string'
        ? 'literal'
        : config.value.includes('{{')
          ? 'template'
          : exactReferencePattern.test(config.value.trim())
            ? 'reference'
            : 'literal';
    const value = convertAutomationPreviewValue(
      resolveAutomationPreviewValue(context, config.value),
      config.value_type,
    );
    const result = writeAutomationPreviewVariable(
      context,
      config.variable,
      value,
      config.overwrite,
    );
    if (config.value_type === 'number' || config.value_type === 'integer') {
      result.output.value_type = config.value_type;
    }
    result.output.source_kind = sourceKind;
    result.output.missing_references = [];
    return result;
  }
  if (node.type === 'template') {
    const missing = String(config.missing || 'error');
    if (!['error', 'empty'].includes(missing)) {
      throw new Error('模板缺失变量策略无效');
    }
    const rendered = renderAutomationPreviewTemplateResult(
      context,
      config.template,
      missing as 'error' | 'empty',
    );
    let value = rendered.value;
    if (config.trim === true) value = value.trim();
    const result = writeAutomationPreviewVariable(
      context,
      config.variable,
      value,
      config.overwrite,
    );
    result.output.value_type = 'string';
    result.output.result = value;
    result.output.missing_references = rendered.missingReferences;
    return result;
  }
  if (node.type === 'json_extract') {
    const input = resolveAutomationPreviewValue(context, config.input);
    const extracted = resolveAutomationJSONPointer(input, config.pointer);
    let value: unknown;
    if (extracted.exists) {
      value = extracted.value;
    } else if (config.missing === 'default') {
      value = resolveAutomationPreviewValue(context, config.default_value);
    } else {
      throw new Error(
        `JSON Pointer ${String(config.pointer || '(根)')} 不存在`,
      );
    }
    value = convertAutomationPreviewValue(value, config.value_type);
    const result = writeAutomationPreviewVariable(
      context,
      config.variable,
      value,
      config.overwrite,
    );
    if (config.value_type === 'number' || config.value_type === 'integer') {
      result.output.value_type = config.value_type;
    }
    result.output.found = extracted.exists;
    result.output.pointer = String(config.pointer ?? '');
    result.output.result = value;
    return result;
  }
  if (node.type === 'math') {
    const value = executeAutomationMathPreview(context, config);
    const result = writeAutomationPreviewVariable(
      context,
      config.variable,
      value,
      config.overwrite,
    );
    result.output.value_type = String(config.result_type || 'number');
    result.output.operation = String(config.operation || 'add');
    result.output.result = value;
    return result;
  }
  throw new Error(`不支持的变量节点 ${node.type}`);
};
