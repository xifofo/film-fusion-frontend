import { json, jsonParseLinter } from '@codemirror/lang-json';
import { linter, lintGutter } from '@codemirror/lint';
import { oneDark } from '@codemirror/theme-one-dark';
import CodeMirror, { EditorView } from '@uiw/react-codemirror';
import { Button, theme } from 'antd';
import React, { useEffect, useState } from 'react';

/** 强制编辑器铺满容器宽度，避免内容宽度导致收缩或顶宽 modal */
const fullWidthTheme = EditorView.theme({
  '&': { width: '100%', maxWidth: '100%' },
  '.cm-scroller': { width: '100%' },
});

interface JsonEditorProps {
  /** 受控值（JSON 字符串），由 Form.Item 注入 */
  value?: string;
  /** 变更回调，由 Form.Item 注入 */
  onChange?: (value: string) => void;
  height?: string;
}

/** 跟随系统明暗 */
const usePrefersDark = (): boolean => {
  const [isDark, setIsDark] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return;
    }
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isDark;
};

/**
 * 受控 JSON 编辑器：CodeMirror（JSON 高亮 / 括号匹配 / 折叠 / 行内红波线校验）
 * + 一键格式化，主题跟随系统明暗。
 */
const JsonEditor: React.FC<JsonEditorProps> = ({
  value,
  onChange,
  height = '320px',
}) => {
  const { token } = theme.useToken();
  const isDark = usePrefersDark();

  const handleFormat = () => {
    if (!value || !value.trim()) return;
    try {
      onChange?.(JSON.stringify(JSON.parse(value), null, 2));
    } catch {
      // 非法 JSON 不做格式化，交由行内校验/表单校验提示
    }
  };

  return (
    <div
      style={{
        border: `1px solid ${token.colorBorder}`,
        borderRadius: token.borderRadius,
        overflow: 'hidden',
        width: '100%',
        minWidth: 0,
        maxWidth: '100%',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          padding: '2px 8px',
          background: token.colorFillQuaternary,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Button size="small" type="link" onClick={handleFormat}>
          格式化
        </Button>
      </div>
      <CodeMirror
        value={value || ''}
        height={height}
        width="100%"
        theme={isDark ? oneDark : 'light'}
        extensions={[
          json(),
          linter(jsonParseLinter()),
          lintGutter(),
          EditorView.lineWrapping,
          fullWidthTheme,
        ]}
        onChange={(val) => onChange?.(val)}
        basicSetup={{
          lineNumbers: true,
          bracketMatching: true,
          closeBrackets: true,
          highlightActiveLine: true,
          foldGutter: true,
        }}
      />
    </div>
  );
};

export default JsonEditor;
