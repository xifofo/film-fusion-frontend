import { yaml } from '@codemirror/lang-yaml';
import { linter, lintGutter } from '@codemirror/lint';
import CodeMirror, { EditorView } from '@uiw/react-codemirror';
import { useMemo } from 'react';

import { getYAMLDiagnostics } from './yamlDiagnostics';

const editorTheme = EditorView.theme({
  '&': {
    backgroundColor: 'transparent',
    fontSize: '13px',
    height: '540px',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgba(255, 255, 255, 0.045)',
    color: 'rgba(255, 255, 255, 0.72)',
  },
  '.cm-content': {
    caretColor: '#f5f5f5',
    padding: '10px 0',
  },
  '.cm-foldGutter .cm-gutterElement': {
    color: 'rgba(255, 255, 255, 0.35)',
  },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.3)',
  },
  '.cm-line': {
    padding: '0 12px 0 6px',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 7px 0 10px',
  },
  '.cm-placeholder': {
    color: 'rgba(255, 255, 255, 0.25)',
  },
  '.cm-scroller': {
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
    lineHeight: '24px',
  },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'rgba(59, 130, 246, 0.32) !important',
  },
});

const yamlLinter = linter(
  (view) => getYAMLDiagnostics(view.state.doc.toString()),
  { delay: 300 },
);

interface YamlEditorProps {
  describedBy: string;
  id: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}

const YamlEditor = ({
  describedBy,
  id,
  onChange,
  placeholder,
  value,
}: YamlEditorProps) => {
  const extensions = useMemo(
    () => [
      yaml(),
      yamlLinter,
      lintGutter(),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({
        'aria-describedby': describedBy,
        'aria-label': '媒体分类 YAML 编辑器',
        spellcheck: 'false',
      }),
      editorTheme,
    ],
    [describedBy],
  );

  return (
    <CodeMirror
      basicSetup={{
        bracketMatching: true,
        closeBrackets: true,
        foldGutter: true,
        highlightActiveLine: true,
        highlightActiveLineGutter: true,
        lineNumbers: true,
      }}
      className="overflow-hidden rounded-[14px]"
      extensions={extensions}
      height="540px"
      id={id}
      onChange={onChange}
      placeholder={placeholder}
      theme="dark"
      value={value}
      width="100%"
    />
  );
};

export default YamlEditor;
