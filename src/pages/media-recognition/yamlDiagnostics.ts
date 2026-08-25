import type { Diagnostic } from '@codemirror/lint';
import { type ErrorCode, parseDocument, type YAMLError } from 'yaml';

const errorMessages: Partial<Record<ErrorCode, string>> = {
  ALIAS_PROPS: '别名属性格式不正确',
  BAD_ALIAS: '别名引用格式不正确',
  BAD_COLLECTION_TYPE: '集合类型不正确',
  BAD_DIRECTIVE: 'YAML 指令格式不正确',
  BAD_DQ_ESCAPE: '双引号字符串中包含无效转义',
  BAD_INDENT: '缩进层级不一致',
  BAD_PROP_ORDER: '节点属性顺序不正确',
  BAD_SCALAR_START: '标量值开头不正确',
  BLOCK_AS_IMPLICIT_KEY: '块内容不能作为隐式键名',
  BLOCK_IN_FLOW: '行内集合中不能使用块结构',
  DUPLICATE_KEY: '同一层级存在重复键名',
  IMPOSSIBLE: 'YAML 内容无法解析',
  KEY_OVER_1024_CHARS: '键名长度不能超过 1024 个字符',
  MISSING_CHAR: '缺少结束字符',
  MULTILINE_IMPLICIT_KEY: '隐式键名不能跨越多行',
  MULTIPLE_ANCHORS: '同一节点不能声明多个锚点',
  MULTIPLE_DOCS: '只允许一个 YAML 文档',
  MULTIPLE_TAGS: '同一节点不能声明多个标签',
  NON_STRING_KEY: '键名必须是字符串',
  TAB_AS_INDENT: '缩进不能使用 Tab，请改用空格',
  TAG_RESOLVE_FAILED: 'YAML 标签无法解析',
  UNEXPECTED_TOKEN: '存在意外字符或结构',
};

const lineAndColumn = (source: string, offset: number) => {
  const safeOffset = Math.min(Math.max(offset, 0), source.length);
  const before = source.slice(0, safeOffset);
  const lastNewline = before.lastIndexOf('\n');

  return {
    column: safeOffset - lastNewline,
    line: before.split('\n').length,
  };
};

const toDiagnostic = (source: string, error: YAMLError): Diagnostic => {
  const from = Math.min(Math.max(error.pos[0], 0), source.length);
  const rawTo = Math.min(Math.max(error.pos[1], from), source.length);
  const to = rawTo > from ? rawTo : Math.min(from + 1, source.length);
  const { column, line } = lineAndColumn(source, from);
  const summary = errorMessages[error.code] ?? 'YAML 语法不正确';

  return {
    from,
    message: `${summary}（第 ${line} 行，第 ${column} 列）`,
    severity: error.name === 'YAMLWarning' ? 'warning' : 'error',
    source: 'YAML',
    to,
  };
};

export const getYAMLDiagnostics = (source: string): Diagnostic[] => {
  if (!source.trim()) return [];

  try {
    const document = parseDocument(source, {
      prettyErrors: false,
      strict: true,
      uniqueKeys: true,
    });

    return [...document.errors, ...document.warnings].map((error) =>
      toDiagnostic(source, error),
    );
  } catch (error) {
    return [
      {
        from: 0,
        message:
          error instanceof Error
            ? `YAML 解析失败：${error.message}`
            : 'YAML 解析失败',
        severity: 'error',
        source: 'YAML',
        to: Math.min(1, source.length),
      },
    ];
  }
};
