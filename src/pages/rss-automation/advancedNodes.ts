import type { RSSAutomationNodeDefinition } from '@/services/film-fusion';
import {
  convertAutomationPreviewValue,
  executeAutomationMathPreview,
  renderAutomationPreviewTemplateResult,
  resolveAutomationJSONPointer,
  resolveAutomationPreviewValue,
  stableAutomationJSONStringify,
  writeAutomationPreviewVariable,
} from './variableNodes';

export const automationDatetimeOperationOptions = [
  { label: '解析日期', value: 'parse' },
  { label: '格式化日期', value: 'format' },
  { label: '增减时间', value: 'add' },
  { label: '计算时间差', value: 'diff' },
  { label: '取周期开始', value: 'start_of' },
];

export const automationDatetimeInputFormatOptions = [
  { label: '自动识别', value: 'auto' },
  { label: 'RFC 3339', value: 'rfc3339' },
  { label: 'RFC 1123', value: 'rfc1123' },
  { label: '日期 YYYY-MM-DD', value: 'date' },
  { label: '日期时间 YYYY-MM-DD HH:mm:ss', value: 'datetime' },
  { label: 'Unix 秒', value: 'unix_seconds' },
  { label: 'Unix 毫秒', value: 'unix_milliseconds' },
];

export const automationDatetimeOutputFormatOptions = [
  { label: 'RFC 3339', value: 'rfc3339' },
  { label: 'RFC 1123', value: 'rfc1123' },
  { label: '日期 YYYY-MM-DD', value: 'date' },
  { label: '日期时间 YYYY-MM-DD HH:mm:ss', value: 'datetime' },
  { label: 'Unix 秒', value: 'unix_seconds' },
  { label: 'Unix 毫秒', value: 'unix_milliseconds' },
];

export const automationDatetimeDurationUnitOptions = [
  { label: '毫秒', value: 'millisecond' },
  { label: '秒', value: 'second' },
  { label: '分钟', value: 'minute' },
  { label: '小时', value: 'hour' },
  { label: '天（日历天）', value: 'day' },
  { label: '周（日历周）', value: 'week' },
  { label: '月（日历月）', value: 'month' },
  { label: '年（日历年）', value: 'year' },
];

export const automationDatetimeDifferenceUnitOptions =
  automationDatetimeDurationUnitOptions.filter(
    (option) => !['month', 'year'].includes(option.value),
  );

export const automationDatetimeStartUnitOptions = [
  { label: '当天开始', value: 'day' },
  { label: '本周开始（周一）', value: 'week' },
  { label: '本月开始', value: 'month' },
  { label: '本年开始', value: 'year' },
];

export const automationListOperationOptions = [
  { label: '拆分文本', value: 'split' },
  { label: '连接文本', value: 'join' },
  { label: '列表去重', value: 'unique' },
  { label: '排序', value: 'sort' },
  { label: '反转', value: 'reverse' },
  { label: '截取', value: 'slice' },
  { label: '提取字段', value: 'pluck' },
  { label: '计算长度', value: 'length' },
];

export const automationCompareAsOptions = [
  { label: '自动识别', value: 'auto' },
  { label: '文本', value: 'string' },
  { label: '数字', value: 'number' },
  { label: '布尔值', value: 'boolean' },
  { label: '日期时间', value: 'datetime' },
];

export const automationSwitchOperatorOptions = [
  { label: '等于', value: 'eq' },
  { label: '不等于', value: 'neq' },
  { label: '大于', value: 'gt' },
  { label: '大于等于', value: 'gte' },
  { label: '小于', value: 'lt' },
  { label: '小于等于', value: 'lte' },
  { label: '包含', value: 'contains' },
  { label: '不包含', value: 'not_contains' },
  { label: '开头是', value: 'starts_with' },
  { label: '结尾是', value: 'ends_with' },
  { label: '正则匹配', value: 'regex' },
  { label: '属于列表', value: 'in' },
  { label: '存在', value: 'exists' },
  { label: '不存在', value: 'not_exists' },
];

export const automationGuardScopeOptions = [
  { label: '当前来源', value: 'source' },
  { label: '当前流程', value: 'workflow' },
  { label: '全部流程共享', value: 'global' },
];

export const automationGuardNormalizeOptions = [
  { label: '保持原值', value: 'none' },
  { label: '去除首尾空白', value: 'trim' },
  { label: '去除空白并转小写', value: 'trim_lower' },
];

export const automationForeachTransformOptions = [
  { label: '文本模板', value: 'template' },
  { label: 'JSON 取值', value: 'json_extract' },
  { label: '数学运算', value: 'math' },
  { label: '候选值合并', value: 'coalesce' },
  { label: '日期时间运算', value: 'datetime_operation' },
];

type AdvancedPreviewExecution = {
  label: string;
  detail?: string;
  selectedPorts: string[];
  output: Record<string, unknown>;
  tone?: 'success' | 'warning' | 'neutral';
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const finiteNumber = (value: unknown, label: string) => {
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(numeric)) throw new Error(`${label}不是有效数字`);
  return numeric;
};

const pad = (value: number, width = 2) => String(value).padStart(width, '0');

const validateTimezone = (timezone: string) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(0);
  } catch {
    throw new Error(`时区 ${timezone} 无效`);
  }
};

type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const zonedParts = (date: Date, timezone: string): DateParts => {
  validateTimezone(timezone);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
};

const timezoneOffsetMilliseconds = (date: Date, timezone: string) => {
  const parts = zonedParts(date, timezone);
  return (
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    ) -
    Math.floor(date.getTime() / 1000) * 1000
  );
};

const dateFromZonedParts = (parts: DateParts, timezone: string) => {
  const utcGuess = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  let result =
    utcGuess - timezoneOffsetMilliseconds(new Date(utcGuess), timezone);
  result = utcGuess - timezoneOffsetMilliseconds(new Date(result), timezone);
  const date = new Date(result);
  const roundTrip = zonedParts(date, timezone);
  if (
    roundTrip.year !== parts.year ||
    roundTrip.month !== parts.month ||
    roundTrip.day !== parts.day ||
    roundTrip.hour !== parts.hour ||
    roundTrip.minute !== parts.minute ||
    roundTrip.second !== parts.second
  ) {
    throw new Error('日期时间落在时区不存在或重复的本地时间');
  }
  return date;
};

const parseLocalDatetime = (raw: string, format: 'date' | 'datetime') => {
  const pattern =
    format === 'date'
      ? /^(\d{4})-(\d{2})-(\d{2})$/
      : /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/;
  const matched = raw.match(pattern);
  if (!matched) throw new Error(`日期不符合 ${format} 格式`);
  return {
    year: Number(matched[1]),
    month: Number(matched[2]),
    day: Number(matched[3]),
    hour: Number(matched[4] || 0),
    minute: Number(matched[5] || 0),
    second: Number(matched[6] || 0),
  };
};

const validDate = (date: Date, label = '日期') => {
  if (!Number.isFinite(date.getTime())) throw new Error(`${label}无效`);
  return date;
};

const parseDatetime = (
  rawValue: unknown,
  rawFormat: unknown,
  timezone: string,
) => {
  const raw = String(rawValue ?? '').trim();
  if (!raw) throw new Error('日期输入不能为空');
  const format = String(rawFormat || 'auto');
  const unixDate = (milliseconds: number) =>
    validDate(new Date(milliseconds), 'Unix 时间');
  if (format === 'unix_seconds')
    return unixDate(finiteNumber(raw, 'Unix 秒') * 1000);
  if (format === 'unix_milliseconds')
    return unixDate(finiteNumber(raw, 'Unix 毫秒'));
  if (format === 'date' || format === 'datetime') {
    return dateFromZonedParts(parseLocalDatetime(raw, format), timezone);
  }
  if (format === 'rfc3339') {
    if (
      !/^\d{4}-\d{2}-\d{2}T/.test(raw) ||
      !/(?:Z|[+-]\d{2}:\d{2})$/.test(raw)
    ) {
      throw new Error('日期不符合 RFC 3339 格式');
    }
    return validDate(new Date(raw));
  }
  if (format === 'rfc1123') return validDate(new Date(raw), 'RFC 1123 日期');
  if (format !== 'auto') throw new Error('日期输入格式无效');
  if (/^\d+$/.test(raw)) {
    return unixDate(Number(raw) * (raw.length <= 10 ? 1000 : 1));
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return dateFromZonedParts(parseLocalDatetime(raw, 'date'), timezone);
  }
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(raw)) {
    return dateFromZonedParts(parseLocalDatetime(raw, 'datetime'), timezone);
  }
  return validDate(new Date(raw));
};

const formatDatetime = (date: Date, rawFormat: unknown, timezone: string) => {
  const format = String(rawFormat || 'rfc3339');
  if (format === 'unix_seconds') return Math.floor(date.getTime() / 1000);
  if (format === 'unix_milliseconds') return date.getTime();
  const parts = zonedParts(date, timezone);
  if (format === 'date') {
    return `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}`;
  }
  if (format === 'datetime') {
    return `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)} ${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
  }
  if (format === 'rfc1123') {
    const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][
      new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()
    ];
    const month = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ][parts.month - 1];
    const zoneName =
      new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        timeZoneName: 'short',
      })
        .formatToParts(date)
        .find((part) => part.type === 'timeZoneName')?.value || timezone;
    return `${weekday}, ${pad(parts.day)} ${month} ${pad(parts.year, 4)} ${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)} ${zoneName}`;
  }
  if (format !== 'rfc3339') throw new Error('日期输出格式无效');
  const offsetMinutes = Math.round(
    timezoneOffsetMilliseconds(date, timezone) / 60_000,
  );
  const sign = offsetMinutes < 0 ? '-' : '+';
  const absoluteOffset = Math.abs(offsetMinutes);
  const offset =
    offsetMinutes === 0
      ? 'Z'
      : `${sign}${pad(Math.floor(absoluteOffset / 60))}:${pad(absoluteOffset % 60)}`;
  const milliseconds = date.getUTCMilliseconds();
  const fraction = milliseconds === 0 ? '' : `.${pad(milliseconds, 3)}`;
  return `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}${fraction}${offset}`;
};

const goRound = (value: number) =>
  value < 0 ? -Math.round(Math.abs(value)) : Math.round(value);

const roundPrecision = (value: number, precision: number) => {
  const factor = 10 ** precision;
  return goRound(value * factor) / factor;
};

const executeDatetime = (
  context: Record<string, unknown>,
  config: Record<string, unknown>,
) => {
  const operation = String(config.operation || 'parse');
  const timezone = String(config.timezone || 'Asia/Shanghai');
  validateTimezone(timezone);
  const input = resolveAutomationPreviewValue(context, config.input);
  const parsed = parseDatetime(input, config.input_format, timezone);
  if (operation === 'diff') {
    const right = parseDatetime(
      resolveAutomationPreviewValue(context, config.right),
      config.input_format,
      timezone,
    );
    const units: Record<string, number> = {
      millisecond: 1,
      second: 1000,
      minute: 60_000,
      hour: 3_600_000,
      day: 86_400_000,
      week: 604_800_000,
    };
    const divisor = units[String(config.unit || 'second')];
    if (!divisor) throw new Error('时间差单位无效');
    const precision = Number(config.precision ?? 0);
    if (!Number.isInteger(precision) || precision < 0 || precision > 6) {
      throw new Error('时间差精度必须是 0 到 6 的整数');
    }
    return roundPrecision(
      (parsed.getTime() - right.getTime()) / divisor,
      precision,
    );
  }
  let result = parsed;
  if (operation === 'add') {
    const units: Record<string, number> = {
      millisecond: 1,
      second: 1000,
      minute: 60_000,
      hour: 3_600_000,
      day: 86_400_000,
      week: 604_800_000,
    };
    const unit = String(config.unit || 'second');
    const amount = finiteNumber(
      resolveAutomationPreviewValue(context, config.amount),
      '增减数量',
    );
    if (['day', 'week', 'month', 'year'].includes(unit)) {
      if (!Number.isInteger(amount))
        throw new Error('日历天、周、月和年的增减数量必须是整数');
      const parts = zonedParts(parsed, timezone);
      const normalized = (() => {
        if (unit === 'day' || unit === 'week') {
          return new Date(
            Date.UTC(
              parts.year,
              parts.month - 1,
              parts.day + amount * (unit === 'week' ? 7 : 1),
              parts.hour,
              parts.minute,
              parts.second,
            ),
          );
        }
        const targetFirst = new Date(
          Date.UTC(
            parts.year + (unit === 'year' ? amount : 0),
            parts.month - 1 + (unit === 'month' ? amount : 0),
            1,
            parts.hour,
            parts.minute,
            parts.second,
          ),
        );
        const lastDay = new Date(
          Date.UTC(
            targetFirst.getUTCFullYear(),
            targetFirst.getUTCMonth() + 1,
            0,
          ),
        ).getUTCDate();
        targetFirst.setUTCDate(Math.min(parts.day, lastDay));
        return targetFirst;
      })();
      result = dateFromZonedParts(
        {
          year: normalized.getUTCFullYear(),
          month: normalized.getUTCMonth() + 1,
          day: normalized.getUTCDate(),
          hour: normalized.getUTCHours(),
          minute: normalized.getUTCMinutes(),
          second: normalized.getUTCSeconds(),
        },
        timezone,
      );
    } else {
      const multiplier = units[unit];
      if (!multiplier) throw new Error('增减时间单位无效');
      result = new Date(parsed.getTime() + amount * multiplier);
    }
  } else if (operation === 'start_of') {
    const unit = String(config.unit || 'day');
    const parts = zonedParts(parsed, timezone);
    parts.hour = 0;
    parts.minute = 0;
    parts.second = 0;
    if (unit === 'week') {
      const weekday = new Date(
        Date.UTC(parts.year, parts.month - 1, parts.day),
      ).getUTCDay();
      const mondayOffset = weekday === 0 ? 6 : weekday - 1;
      const start = new Date(
        Date.UTC(parts.year, parts.month - 1, parts.day - mondayOffset),
      );
      parts.year = start.getUTCFullYear();
      parts.month = start.getUTCMonth() + 1;
      parts.day = start.getUTCDate();
    } else if (unit === 'month') {
      parts.day = 1;
    } else if (unit === 'year') {
      parts.month = 1;
      parts.day = 1;
    } else if (unit !== 'day') {
      throw new Error('周期单位无效');
    }
    result = dateFromZonedParts(parts, timezone);
  } else if (!['parse', 'format'].includes(operation)) {
    throw new Error('日期时间运算无效');
  }
  return formatDatetime(result, config.output_format, timezone);
};

const pointerValue = (
  item: unknown,
  pointer: unknown,
  missing: string,
): { include: boolean; value: unknown } => {
  const resolved = resolveAutomationJSONPointer(item, pointer);
  if (resolved.exists) return { include: true, value: resolved.value };
  if (missing === 'skip') return { include: false, value: undefined };
  if (missing === 'null') return { include: true, value: null };
  throw new Error(`JSON Pointer ${String(pointer || '(根)')} 不存在`);
};

const comparisonValue = (value: unknown, compareAs: string) => {
  if (value == null) return null;
  if (compareAs === 'number') return finiteNumber(value, '比较值');
  if (compareAs === 'boolean') {
    if (typeof value === 'boolean') return value ? 1 : 0;
    const normalized = String(value).trim().toLocaleLowerCase();
    if (['true', '1'].includes(normalized)) return 1;
    if (['false', '0'].includes(normalized)) return 0;
    throw new Error('比较值不是布尔值');
  }
  if (compareAs === 'datetime')
    return validDate(new Date(String(value))).getTime();
  if (compareAs === 'string') {
    return typeof value === 'object'
      ? stableAutomationJSONStringify(value)
      : String(value);
  }
  return value;
};

const comparableNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return undefined;
};

const compareComparable = (left: unknown, right: unknown) => {
  const leftNumber = comparableNumber(left);
  const rightNumber = comparableNumber(right);
  if (leftNumber !== undefined && rightNumber !== undefined) {
    return leftNumber === rightNumber ? 0 : leftNumber < rightNumber ? -1 : 1;
  }
  const leftDate =
    typeof left === 'string' ? parseDatetimeComparable(left) : undefined;
  const rightDate =
    typeof right === 'string' ? parseDatetimeComparable(right) : undefined;
  if (leftDate !== undefined && rightDate !== undefined) {
    return leftDate === rightDate ? 0 : leftDate < rightDate ? -1 : 1;
  }
  const leftText =
    typeof left === 'object' && left !== null
      ? stableAutomationJSONStringify(left)
      : String(left ?? '');
  const rightText =
    typeof right === 'object' && right !== null
      ? stableAutomationJSONStringify(right)
      : String(right ?? '');
  return leftText === rightText ? 0 : leftText < rightText ? -1 : 1;
};

const parseDatetimeComparable = (value: string) => {
  const trimmed = value.trim();
  if (
    !/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2}|T.*(?:Z|[+-]\d{2}:\d{2}))?$/.test(
      trimmed,
    ) &&
    !/^[A-Za-z]{3}, \d{2} [A-Za-z]{3} \d{4} /.test(trimmed)
  ) {
    return undefined;
  }
  const timestamp = Date.parse(trimmed);
  return Number.isFinite(timestamp) ? timestamp : undefined;
};

const automationPreviewJSONByteLength = (value: unknown, label: string) => {
  let serialized: string | undefined;
  try {
    serialized = stableAutomationJSONStringify(value);
  } catch {
    throw new Error(`${label}不是有效 JSON`);
  }
  if (serialized === undefined) throw new Error(`${label}不是有效 JSON`);
  return new TextEncoder().encode(serialized).byteLength;
};

const validateAutomationPreviewValueSize = (
  value: unknown,
  label: string,
  maximum = 1024 * 1024,
) => {
  if (automationPreviewJSONByteLength(value, label) > maximum) {
    throw new Error(`${label} JSON 不能超过 ${maximum} 字节`);
  }
};

const executeList = (
  context: Record<string, unknown>,
  config: Record<string, unknown>,
) => {
  const operation = String(config.operation || 'unique');
  const input = resolveAutomationPreviewValue(context, config.input);
  validateAutomationPreviewValueSize(input, '列表输入');
  if (operation === 'split') {
    const separator = String(config.separator ?? ',');
    if (typeof input !== 'string') throw new Error('split 输入必须是文本');
    let values = separator === '' ? Array.from(input) : input.split(separator);
    const inputCount = values.length;
    if (inputCount > 10000) throw new Error('列表输入不能超过 10000 项');
    if (config.trim_items !== false) values = values.map((item) => item.trim());
    if (config.omit_empty !== false) values = values.filter(Boolean);
    return { result: values, inputCount, outputCount: values.length };
  }
  const listInput = (() => {
    if (Array.isArray(input)) {
      if (input.length > 10000) throw new Error('列表输入不能超过 10000 项');
      return input;
    }
    if (typeof input === 'string') {
      let parsed: unknown;
      try {
        parsed = JSON.parse(input);
      } catch {
        // Fall through to the user-facing array error below.
      }
      if (Array.isArray(parsed)) {
        if (parsed.length > 10000) throw new Error('列表输入不能超过 10000 项');
        return parsed;
      }
    }
    throw new Error('列表输入必须是数组');
  })();
  if (operation === 'join') {
    let parts = listInput.map((item) =>
      typeof item === 'object' && item !== null
        ? stableAutomationJSONStringify(item)
        : String(item ?? ''),
    );
    if (config.trim_items !== false) parts = parts.map((item) => item.trim());
    if (config.omit_empty !== false) parts = parts.filter(Boolean);
    const result = parts.join(String(config.separator ?? ','));
    return {
      result,
      inputCount: listInput.length,
      outputCount: result ? 1 : 0,
    };
  }
  if (operation === 'reverse') {
    return {
      result: [...listInput].reverse(),
      inputCount: listInput.length,
      outputCount: listInput.length,
    };
  }
  if (operation === 'slice') {
    const offset = Number(config.offset ?? 0);
    const limit = Number(config.limit ?? 100);
    if (!Number.isInteger(offset) || offset < -10000 || offset > 10000)
      throw new Error('起始位置必须是 -10000 到 10000 的整数');
    if (!Number.isInteger(limit) || limit < 0 || limit > 10000)
      throw new Error('截取数量必须是 0 到 10000 的整数');
    const start = Math.max(
      0,
      Math.min(
        listInput.length,
        offset < 0 ? listInput.length + offset : offset,
      ),
    );
    const result = listInput.slice(start, start + limit);
    return {
      result,
      inputCount: listInput.length,
      outputCount: result.length,
    };
  }
  if (operation === 'length') {
    return {
      result: listInput.length,
      inputCount: listInput.length,
      outputCount: listInput.length > 0 ? 1 : 0,
    };
  }
  const missing = String(config.missing || 'failure');
  const selected = listInput
    .map((item, index) => ({
      item,
      index,
      selected: pointerValue(item, config.pointer, missing),
    }))
    .filter((entry) => entry.selected.include);
  if (operation === 'pluck') {
    const result = selected.map((entry) => entry.selected.value);
    return {
      result,
      inputCount: listInput.length,
      outputCount: result.length,
    };
  }
  if (operation === 'unique') {
    const seen = new Set<string>();
    const result: unknown[] = [];
    for (const entry of selected) {
      const comparable = comparisonValue(
        entry.selected.value,
        String(config.compare_as || 'auto'),
      );
      const key = `${typeof comparable}:${stableAutomationJSONStringify(comparable)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(entry.item);
    }
    return {
      result,
      inputCount: listInput.length,
      outputCount: result.length,
    };
  }
  if (operation === 'sort') {
    const direction = String(config.direction || 'asc') === 'desc' ? -1 : 1;
    const compareAs = String(config.compare_as || 'auto');
    const result = [...selected]
      .sort((left, right) => {
        const leftValue = left.selected.value;
        const rightValue = right.selected.value;
        if (leftValue == null && rightValue == null)
          return left.index - right.index;
        if (leftValue == null) return 1;
        if (rightValue == null) return -1;
        const a = comparisonValue(leftValue, compareAs);
        const b = comparisonValue(rightValue, compareAs);
        const comparison = compareComparable(a, b);
        return comparison === 0
          ? left.index - right.index
          : comparison * direction;
      })
      .map((entry) => entry.item);
    return {
      result,
      inputCount: listInput.length,
      outputCount: result.length,
    };
  }
  throw new Error('列表运算无效');
};

const optionalConfiguredValue = (
  context: Record<string, unknown>,
  configured: unknown,
) => {
  try {
    return {
      exists: true,
      value: resolveAutomationPreviewValue(context, configured),
    };
  } catch (error: any) {
    if (String(error?.message || '').includes('不存在')) {
      return { exists: false, value: undefined };
    }
    throw error;
  }
};

const switchEqual = (
  left: unknown,
  right: unknown,
  compareAs: string,
  caseSensitive: boolean,
) => {
  const a = comparisonValue(left, compareAs);
  const b = comparisonValue(right, compareAs);
  if (typeof a === 'string' && typeof b === 'string') {
    return caseSensitive
      ? a === b
      : a.toLocaleLowerCase() === b.toLocaleLowerCase();
  }
  return compareComparable(a, b) === 0;
};

const compareSwitch = (
  leftExists: boolean,
  left: unknown,
  operator: string,
  right: unknown,
  compareAs: string,
  caseSensitive: boolean,
) => {
  const present =
    leftExists &&
    left !== null &&
    !(typeof left === 'string' && left.trim() === '');
  if (operator === 'exists') return present;
  if (operator === 'not_exists') return !present;
  if (!leftExists) return false;
  const text = (value: unknown) => {
    const result = String(value ?? '');
    return caseSensitive ? result : result.toLocaleLowerCase();
  };
  if (operator === 'contains') return text(left).includes(text(right));
  if (operator === 'not_contains') return !text(left).includes(text(right));
  if (operator === 'starts_with') return text(left).startsWith(text(right));
  if (operator === 'ends_with') return text(left).endsWith(text(right));
  if (operator === 'regex') {
    return new RegExp(String(right ?? ''), caseSensitive ? '' : 'i').test(
      String(left ?? ''),
    );
  }
  if (operator === 'in') {
    if (!Array.isArray(right)) throw new Error('in 的比较值必须是数组');
    return right.some((value) =>
      switchEqual(left, value, compareAs, caseSensitive),
    );
  }
  const a = comparisonValue(left, compareAs);
  const b = comparisonValue(right, compareAs);
  if (operator === 'eq')
    return switchEqual(left, right, compareAs, caseSensitive);
  if (operator === 'neq')
    return !switchEqual(left, right, compareAs, caseSensitive);
  if (a == null || b == null) return false;
  const comparison = compareComparable(a, b);
  if (operator === 'gt') return comparison > 0;
  if (operator === 'gte') return comparison >= 0;
  if (operator === 'lt') return comparison < 0;
  if (operator === 'lte') return comparison <= 0;
  throw new Error('多路分支比较符无效');
};

const isEmptyCandidate = (value: unknown, config: Record<string, unknown>) => {
  if (value === null && config.skip_null !== false) return true;
  if (typeof value === 'string' && config.skip_empty_string !== false) {
    return (config.trim_strings === true ? value.trim() : value) === '';
  }
  if (Array.isArray(value) && config.skip_empty_array === true)
    return value.length === 0;
  if (isRecord(value) && config.skip_empty_object === true) {
    return Object.keys(value).length === 0;
  }
  return false;
};

const executeCoalesce = (
  context: Record<string, unknown>,
  config: Record<string, unknown>,
) => {
  const candidates = Array.isArray(config.candidates) ? config.candidates : [];
  const missing = String(config.missing || 'skip');
  for (let index = 0; index < candidates.length; index += 1) {
    const resolved = optionalConfiguredValue(context, candidates[index]);
    if (!resolved.exists) {
      if (missing === 'failure') throw new Error(`候选值 ${index + 1} 不存在`);
      continue;
    }
    if (isEmptyCandidate(resolved.value, config)) continue;
    const value =
      config.trim_strings === true && typeof resolved.value === 'string'
        ? resolved.value.trim()
        : resolved.value;
    return {
      result: convertAutomationPreviewValue(value, config.value_type),
      selectedIndex: index,
      usedDefault: false,
    };
  }
  if (String(config.on_empty || 'failure') !== 'default') {
    throw new Error('所有候选值都为空');
  }
  const defaultValue = resolveAutomationPreviewValue(
    context,
    config.default_value,
  );
  return {
    result: convertAutomationPreviewValue(
      config.trim_strings === true && typeof defaultValue === 'string'
        ? defaultValue.trim()
        : defaultValue,
      config.value_type,
    ),
    selectedIndex: -1,
    usedDefault: true,
  };
};

const guardInteger = (
  config: Record<string, unknown>,
  key: string,
  fallback: number,
  minimum: number,
  maximum: number,
) => {
  const configured = config[key];
  const value =
    configured === undefined ||
    configured === null ||
    (typeof configured === 'string' && !configured.trim())
      ? fallback
      : Number(configured);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${key} 必须是 ${minimum} 到 ${maximum} 的整数`);
  }
  return value;
};

const validateGuardNamespace = (namespace: string) => {
  const length = Array.from(namespace).length;
  if (length < 1 || length > 80) {
    throw new Error('命名空间长度必须在 1 到 80 个字符之间');
  }
  if (
    Array.from(namespace).some((character) => {
      const codePoint = character.codePointAt(0) || 0;
      return codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f);
    })
  ) {
    throw new Error('命名空间不能包含控制字符');
  }
};

const guardKey = (
  context: Record<string, unknown>,
  config: Record<string, unknown>,
  nodeID: string,
) => {
  const scope = String(config.scope || 'workflow')
    .trim()
    .toLowerCase();
  if (!['source', 'workflow', 'global'].includes(scope))
    throw new Error('状态范围无效');
  const configuredNamespace = String(config.namespace || '').trim();
  if (scope === 'global' && !configuredNamespace)
    throw new Error('全局范围必须填写命名空间');
  const namespace = configuredNamespace || nodeID.trim();
  validateGuardNamespace(namespace);
  if (!('key' in config)) throw new Error('必须配置状态键');
  const raw = resolveAutomationPreviewValue(context, config.key);
  if (
    raw === null ||
    !['string', 'number', 'boolean'].includes(typeof raw) ||
    (typeof raw === 'number' && !Number.isFinite(raw))
  ) {
    throw new Error('状态键必须是文本、数字或布尔值');
  }
  const normalize = String(config.normalize || 'trim')
    .trim()
    .toLowerCase();
  let key = String(raw);
  if (normalize === 'trim' || normalize === 'trim_lower') key = key.trim();
  if (normalize === 'trim_lower') key = key.toLowerCase();
  if (!['none', 'trim', 'trim_lower'].includes(normalize))
    throw new Error('键标准化方式无效');
  if (!key) throw new Error('状态键不能为空');
  if (new TextEncoder().encode(key).byteLength > 4096) {
    throw new Error('状态键不能超过 4096 字节');
  }
  let hash = 2166136261;
  for (const character of key) {
    hash ^= character.codePointAt(0) || 0;
    hash = Math.imul(hash, 16777619);
  }
  return {
    key,
    keyHash: `preview-${(hash >>> 0).toString(16).padStart(8, '0')}`,
    scope,
    namespace,
  };
};

const executeForeachTransform = (
  transformType: string,
  context: Record<string, unknown>,
  config: Record<string, unknown>,
) => {
  if (transformType === 'template') {
    const missing = String(config.missing || 'error');
    if (!['error', 'empty'].includes(missing))
      throw new Error('模板缺失策略无效');
    let result = renderAutomationPreviewTemplateResult(
      context,
      config.template,
      missing as 'error' | 'empty',
    ).value;
    if (config.trim === true) result = result.trim();
    return result;
  }
  if (transformType === 'json_extract') {
    const input = resolveAutomationPreviewValue(context, config.input);
    const extracted = resolveAutomationJSONPointer(input, config.pointer);
    let result: unknown;
    if (extracted.exists) result = extracted.value;
    else if (config.missing === 'default') {
      result = resolveAutomationPreviewValue(context, config.default_value);
    } else {
      throw new Error(
        `JSON Pointer ${String(config.pointer || '(根)')} 不存在`,
      );
    }
    return convertAutomationPreviewValue(result, config.value_type);
  }
  if (transformType === 'math')
    return executeAutomationMathPreview(context, config);
  if (transformType === 'coalesce')
    return executeCoalesce(context, config).result;
  if (transformType === 'datetime_operation')
    return executeDatetime(context, config);
  throw new Error('遍历变换类型不受支持');
};

const validateForeachItemSize = (value: unknown, label: string) => {
  validateAutomationPreviewValueSize(value, `Foreach ${label}`, 64 * 1024);
};

export const executeAutomationAdvancedPreviewNode = (
  node: RSSAutomationNodeDefinition,
  context: Record<string, unknown>,
): AdvancedPreviewExecution => {
  const config = node.config || {};
  if (node.type === 'datetime_operation') {
    const value = executeDatetime(context, config);
    const written = writeAutomationPreviewVariable(
      context,
      config.variable,
      value,
      config.overwrite,
    );
    Object.assign(written.output, {
      operation: String(config.operation || 'parse'),
      timezone: String(config.timezone || 'Asia/Shanghai'),
      result: value,
    });
    return {
      label: `结果：${String(value)}`,
      selectedPorts: ['success'],
      output: written.output,
    };
  }
  if (node.type === 'list_operation') {
    const executed = executeList(context, config);
    if (executed.outputCount > 10000) {
      throw new Error('列表结果不能超过 10000 项');
    }
    validateAutomationPreviewValueSize(executed.result, '列表结果');
    const written = writeAutomationPreviewVariable(
      context,
      config.variable,
      executed.result,
      config.overwrite,
    );
    Object.assign(written.output, {
      operation: String(config.operation || 'unique'),
      result: executed.result,
      input_count: executed.inputCount,
      output_count: executed.outputCount,
    });
    const empty = executed.outputCount === 0;
    written.output.empty = empty;
    return {
      label: empty ? '输入列表为空' : `输出 ${executed.outputCount} 项`,
      selectedPorts: [empty ? 'empty' : 'success'],
      output: written.output,
      tone: empty ? 'neutral' : 'success',
    };
  }
  if (node.type === 'switch') {
    const input = optionalConfiguredValue(context, config.input);
    const cases = Array.isArray(config.cases) ? config.cases : [];
    for (let index = 0; index < cases.length; index += 1) {
      const candidate = cases[index];
      if (!isRecord(candidate)) continue;
      const id = String(candidate.id || '').trim();
      if (!id) throw new Error('多路分支条件缺少稳定 ID');
      const operator = String(candidate.operator || 'eq');
      const right = ['exists', 'not_exists'].includes(operator)
        ? undefined
        : resolveAutomationPreviewValue(context, candidate.value);
      if (
        compareSwitch(
          input.exists,
          input.value,
          operator,
          right,
          String(config.compare_as || 'auto'),
          config.case_sensitive === true,
        )
      ) {
        const port = `case-${id.toLowerCase()}`;
        const label = String(candidate.label || id);
        return {
          label: `命中：${label}`,
          selectedPorts: [port],
          output: {
            matched: true,
            case_id: id,
            case_label: label,
            case_index: index,
            selected_port: port,
            value: input.value,
          },
        };
      }
    }
    return {
      label: '进入默认分支',
      selectedPorts: ['default'],
      output: {
        matched: false,
        case_id: '',
        case_label: '',
        case_index: -1,
        selected_port: 'default',
        value: input.value,
      },
      tone: 'neutral',
    };
  }
  if (node.type === 'coalesce') {
    const executed = executeCoalesce(context, config);
    const written = writeAutomationPreviewVariable(
      context,
      config.variable,
      executed.result,
      config.overwrite,
    );
    Object.assign(written.output, {
      result: executed.result,
      selected_index: executed.selectedIndex,
      used_default: executed.usedDefault,
    });
    return {
      label: executed.usedDefault
        ? '使用默认值'
        : `采用候选值 ${executed.selectedIndex + 1}`,
      selectedPorts: ['success'],
      output: written.output,
    };
  }
  if (node.type === 'deduplicate') {
    const key = guardKey(context, config, node.id);
    const ttlSeconds = guardInteger(
      config,
      'ttl_seconds',
      604800,
      60,
      31536000,
    );
    if (
      config.refresh_on_duplicate !== undefined &&
      typeof config.refresh_on_duplicate !== 'boolean'
    ) {
      throw new Error('重复命中刷新有效期必须是布尔值');
    }
    const assumption = String(config.preview_assumption || 'new');
    if (!['new', 'duplicate'].includes(assumption))
      throw new Error('去重预览假设无效');
    const duplicate = assumption === 'duplicate';
    return {
      label: duplicate ? '假设为重复运行' : '假设为首次运行',
      detail: '仅为样本预览假设；真实执行会查询持久去重状态，结果可能不同。',
      selectedPorts: [duplicate ? 'duplicate' : 'new'],
      output: {
        duplicate,
        key_hash: key.keyHash,
        scope: key.scope,
        namespace: key.namespace,
        ttl_seconds: ttlSeconds,
        first_seen_at: null,
        expires_at: null,
        owner_run_id: null,
        state: 'simulated',
        simulated: true,
        selected_port: duplicate ? 'duplicate' : 'new',
      },
      tone: 'warning',
    };
  }
  if (node.type === 'rate_limit') {
    const key = guardKey(context, config, node.id);
    const limit = guardInteger(config, 'limit', 1, 1, 10000);
    const windowSeconds = guardInteger(
      config,
      'window_seconds',
      60,
      1,
      2592000,
    );
    const maxWaitSeconds = guardInteger(
      config,
      'max_wait_seconds',
      windowSeconds,
      1,
      2592000,
    );
    const assumption = String(config.preview_assumption || 'allowed');
    if (!['allowed', 'throttled'].includes(assumption))
      throw new Error('限流预览假设无效');
    const throttled = assumption === 'throttled';
    const behavior = String(config.behavior || 'defer')
      .trim()
      .toLowerCase();
    if (!['defer', 'branch'].includes(behavior)) {
      throw new Error('限流行为必须是 defer 或 branch');
    }
    const selectedPorts =
      throttled && behavior === 'defer'
        ? []
        : [throttled ? 'throttled' : 'allowed'];
    return {
      label: throttled
        ? behavior === 'defer'
          ? '假设达到限额，将等待额度'
          : '假设达到限额'
        : '假设仍有可用额度',
      detail: '仅为样本预览假设；真实执行会查询持久限流状态，结果可能不同。',
      selectedPorts,
      output: {
        allowed: !throttled,
        algorithm: 'fixed_window',
        limit,
        window_seconds: windowSeconds,
        max_wait_seconds: maxWaitSeconds,
        used: throttled ? limit : 1,
        remaining: throttled ? 0 : Math.max(0, limit - 1),
        key_hash: key.keyHash,
        scope: key.scope,
        namespace: key.namespace,
        window_start: null,
        window_end: null,
        retry_at: null,
        state: 'simulated',
        simulated: true,
        selected_port: selectedPorts[0] || '',
      },
      tone: 'warning',
    };
  }
  if (node.type === 'foreach') {
    const resolvedInput = resolveAutomationPreviewValue(context, config.input);
    validateAutomationPreviewValueSize(resolvedInput, 'Foreach 输入');
    const input = (() => {
      if (Array.isArray(resolvedInput)) return resolvedInput;
      if (typeof resolvedInput === 'string') {
        try {
          const decoded = JSON.parse(resolvedInput);
          if (Array.isArray(decoded)) return decoded;
        } catch {
          // Fall through to the user-facing array error below.
        }
      }
      throw new Error('遍历输入必须是数组');
    })();
    const maxItems = Number(config.max_items ?? 100);
    if (!Number.isInteger(maxItems) || maxItems < 1 || maxItems > 1000) {
      throw new Error('最大遍历数量必须是 1 到 1000 的整数');
    }
    if (input.length > maxItems) {
      throw new Error(`列表共有 ${input.length} 项，超过上限 ${maxItems}`);
    }
    const transform = isRecord(config.transform) ? config.transform : {};
    const transformType = String(transform.type || 'template');
    const transformConfig = isRecord(transform.config) ? transform.config : {};
    if (
      !automationForeachTransformOptions.some(
        ({ value }) => value === transformType,
      )
    ) {
      throw new Error('遍历变换类型不受支持');
    }
    if ('variable' in transformConfig || 'overwrite' in transformConfig) {
      throw new Error('遍历变换不能写入流程变量');
    }
    const onError = String(config.on_error || 'fail_fast');
    if (!['fail_fast', 'collect'].includes(onError)) {
      throw new Error('遍历失败策略无效');
    }
    const results: unknown[] = Array.from({ length: input.length }, () => null);
    const errors: Array<{ index: number; reason: string }> = [];
    let succeeded = 0;
    const summaryOutput = () => ({
      results,
      count: input.length,
      succeeded_count: succeeded,
      failed_count: errors.length,
      errors,
      selected_port: 'failure',
    });
    const failure = (reason: string): AdvancedPreviewExecution => ({
      label: '遍历转换失败',
      detail: reason,
      selectedPorts: ['failure'],
      output: {
        ...summaryOutput(),
        written: false,
        variables: {},
        reason,
      },
      tone: 'warning',
    });
    for (let index = 0; index < input.length; index += 1) {
      const eachContext = {
        ...context,
        each: {
          item: input[index],
          index,
          count: input.length,
          first: index === 0,
          last: index === input.length - 1,
        },
      };
      try {
        validateForeachItemSize(input[index], '输入项');
        const result = executeForeachTransform(
          transformType,
          eachContext,
          transformConfig,
        );
        validateForeachItemSize(result, '结果项');
        results[index] = result;
        succeeded += 1;
      } catch (error: any) {
        const reason = error?.message || '变换失败';
        errors.push({ index, reason });
        if (onError === 'fail_fast') return failure(reason);
      }
    }
    if (input.length > 0 && succeeded === 0) {
      return failure('Foreach 所有项目转换失败');
    }
    const summary = summaryOutput();
    validateAutomationPreviewValueSize(summary, 'Foreach 输出');
    const written = writeAutomationPreviewVariable(
      context,
      config.variable,
      results,
      config.overwrite,
    );
    const port =
      input.length === 0 ? 'empty' : errors.length > 0 ? 'partial' : 'success';
    Object.assign(written.output, {
      result: results,
      ...summary,
      transform_type: transformType,
      selected_port: port,
      ...(errors.length > 0 ? { partial: true } : {}),
    });
    validateAutomationPreviewValueSize(written.output, 'Foreach 输出');
    return {
      label:
        port === 'empty'
          ? '输入列表为空'
          : errors.length > 0
            ? `${succeeded}/${input.length} 项成功`
            : `已映射 ${input.length} 项`,
      selectedPorts: [port],
      output: written.output,
      tone:
        errors.length > 0
          ? 'warning'
          : input.length === 0
            ? 'neutral'
            : 'success',
    };
  }
  throw new Error(`不支持的高级节点 ${node.type}`);
};
