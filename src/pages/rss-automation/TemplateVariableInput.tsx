import { PlusOutlined } from '@ant-design/icons';
import { Button, Input, Popover, Typography } from 'antd';
import {
  type ChangeEvent,
  type KeyboardEvent,
  type SyntheticEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import styles from './index.module.less';
import type { NodeFieldReference } from './NodeConfigDrawer';

const { Text } = Typography;

type TemplateVariableInputProps = {
  id?: string;
  value?: string;
  onChange?: (value: string) => void;
  references: NodeFieldReference[];
  multiline?: boolean;
  insertMode?: 'reference' | 'template';
  placeholder?: string;
  ariaLabel: string;
};

type TemplateOption = NodeFieldReference & {
  path: string;
  referenceToken: string;
  templateToken: string;
};

type ActiveTemplate = {
  start: number;
  query: string;
};

const activeTemplateAt = (
  value: string,
  cursor: number,
): ActiveTemplate | undefined => {
  const beforeCursor = value.slice(0, cursor);
  const start = beforeCursor.lastIndexOf('{{');
  if (start < 0 || beforeCursor.lastIndexOf('}}') > start) return undefined;

  const query = beforeCursor.slice(start + 2);
  if (query.includes('\n') || /[{}]/.test(query)) return undefined;
  return { start, query: query.trimStart() };
};

const templateOption = (reference: NodeFieldReference): TemplateOption => {
  const path = reference.value.replace(/^\$/, '');
  return {
    ...reference,
    path,
    referenceToken: reference.value,
    templateToken: `{{${path}}}`,
  };
};

const rssFieldLabels: Record<string, string> = {
  category: '分类',
  detail_url: '详情链接',
  download_url: '下载地址',
  guid: '唯一标识',
  published_at: '发布时间',
  size_bytes: '文件大小',
  title: '标题',
};

const optionLabel = (option: TemplateOption) =>
  option.kind === 'item'
    ? rssFieldLabels[option.name] || option.name
    : option.name;

const TemplateVariableInput = ({
  id,
  value = '',
  onChange,
  references,
  multiline = false,
  insertMode = 'reference',
  placeholder,
  ariaLabel,
}: TemplateVariableInputProps) => {
  const listboxId = `template-variables-${useId().replaceAll(':', '')}`;
  const inputElement = useRef<
    HTMLInputElement | HTMLTextAreaElement | undefined
  >(undefined);
  const controlElement = useRef<HTMLDivElement>(null);
  const selectionRange = useRef({ start: value.length, end: value.length });
  const ignoreNextSelection = useRef(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const options = useMemo(() => references.map(templateOption), [references]);
  const filteredOptions = useMemo(() => {
    const needle = query.toLowerCase().replace(/^\$/, '');
    if (!needle) return options;
    return options.filter((option) =>
      [option.path, option.name, option.preview]
        .concat(option.dataType || '', option.description || '')
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle),
    );
  }, [options, query]);
  const groupedOptions = useMemo(
    () =>
      [
        {
          kind: 'item' as const,
          label: 'RSS 原始字段',
          options: filteredOptions.filter((option) => option.kind === 'item'),
        },
        {
          kind: 'variable' as const,
          label: '上游流程变量',
          options: filteredOptions.filter(
            (option) => option.kind === 'variable',
          ),
        },
        {
          kind: 'node' as const,
          label: '上游节点输出',
          options: filteredOptions.filter((option) => option.kind === 'node'),
        },
      ].filter((group) => group.options.length > 0),
    [filteredOptions],
  );

  useEffect(() => {
    if (!open || filteredOptions.length === 0) return;
    document
      .getElementById(`${listboxId}-${activeIndex}`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, filteredOptions.length, listboxId, open]);

  const updateSuggestions = (
    nextValue: string,
    element: HTMLInputElement | HTMLTextAreaElement,
  ) => {
    inputElement.current = element;
    selectionRange.current = {
      start: element.selectionStart ?? nextValue.length,
      end: element.selectionEnd ?? nextValue.length,
    };
    const active = activeTemplateAt(
      nextValue,
      element.selectionStart ?? nextValue.length,
    );
    setOpen(Boolean(active));
    setQuery(active?.query || '');
    setActiveIndex(0);
  };

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    onChange?.(event.target.value);
    updateSuggestions(event.target.value, event.currentTarget);
  };

  const handleSelection = (
    event: SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (ignoreNextSelection.current) return;
    updateSuggestions(value, event.currentTarget);
  };

  const insertOption = (option: TemplateOption) => {
    const element = inputElement.current;
    const cursor = Math.min(
      element?.selectionStart ?? selectionRange.current.start,
      value.length,
    );
    const selectionEnd = Math.min(
      element?.selectionEnd ?? selectionRange.current.end,
      value.length,
    );
    const active = activeTemplateAt(value, cursor);
    const start = active?.start ?? cursor;
    let end = Math.max(cursor, selectionEnd);
    if (active && value.slice(end, end + 2) === '}}') {
      end += 2;
    }
    const token = active
      ? option.templateToken
      : insertMode === 'template'
        ? option.templateToken
        : option.referenceToken;
    const nextValue = `${value.slice(0, start)}${token}${value.slice(end)}`;
    const nextCursor = start + token.length;

    onChange?.(nextValue);
    setOpen(false);
    selectionRange.current = { start: nextCursor, end: nextCursor };
    ignoreNextSelection.current = true;
    window.requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(nextCursor, nextCursor);
      window.setTimeout(() => {
        ignoreNextSelection.current = false;
      }, 0);
    });
  };

  const openVariablePicker = () => {
    const element = inputElement.current;
    if (element) {
      selectionRange.current = {
        start: element.selectionStart ?? value.length,
        end: element.selectionEnd ?? value.length,
      };
    }
    setQuery('');
    setActiveIndex(0);
    setOpen(true);
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (!open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (filteredOptions.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % filteredOptions.length);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(
        (index) =>
          (index - 1 + filteredOptions.length) % filteredOptions.length,
      );
      return;
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      insertOption(filteredOptions[activeIndex] || filteredOptions[0]);
    }
  };

  const inputProps = {
    'aria-activedescendant':
      open && filteredOptions.length > 0
        ? `${listboxId}-${activeIndex}`
        : undefined,
    'aria-autocomplete': 'list' as const,
    'aria-controls': open ? listboxId : undefined,
    'aria-expanded': open,
    'aria-label': ariaLabel,
    id,
    onBlur: () => setOpen(false),
    onChange: handleChange,
    onClick: handleSelection,
    onKeyDown: handleKeyDown,
    onSelect: handleSelection,
    placeholder,
    value,
  };

  const suggestions = open ? (
    // biome-ignore lint/a11y/useSemanticElements: This is an editable autocomplete popup, not a native select.
    <div
      aria-label="模板变量智能提示"
      className={styles.templateVariableSuggestions}
      id={listboxId}
      role="listbox"
      style={{
        width:
          inputElement.current?.getBoundingClientRect().width ||
          controlElement.current?.getBoundingClientRect().width ||
          520,
      }}
    >
      <div className={styles.templateVariableSuggestionHeader}>
        <div>
          <Text strong>选择要插入的内容</Text>
          <Text type="secondary">
            点选后会插入到当前光标处，不会改动后面的文字
          </Text>
        </div>
        <Text type="secondary">↑↓ 选择 · Enter 插入</Text>
      </div>
      {groupedOptions.length > 0 ? (
        <div className={styles.templateVariableSuggestionBody}>
          {groupedOptions.map((group) => (
            <div className={styles.templateVariableGroup} key={group.kind}>
              <Text type="secondary">{group.label}</Text>
              {group.options.map((option) => {
                const index = filteredOptions.indexOf(option);
                return (
                  // biome-ignore lint/a11y/useSemanticElements: Buttons preserve mouse interaction while exposing autocomplete option semantics.
                  <button
                    aria-selected={index === activeIndex}
                    className={styles.templateVariableOption}
                    id={`${listboxId}-${index}`}
                    key={option.value}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      insertOption(option);
                    }}
                    role="option"
                    type="button"
                  >
                    <span className={styles.templateVariableOptionIdentity}>
                      <span>
                        <strong>{optionLabel(option)}</strong>
                        {option.kind === 'item' &&
                          optionLabel(option) !== option.name && (
                            <small>{option.name}</small>
                          )}
                        {option.dataType && <small>{option.dataType}</small>}
                      </span>
                      <code>{option.value}</code>
                    </span>
                    {(option.preview || option.description) && (
                      <span
                        className={styles.templateVariableOptionPreview}
                        title={option.description || option.preview}
                      >
                        {option.preview || option.description}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        <Text className={styles.templateVariableEmpty} type="secondary">
          没有匹配的变量，可以继续手动输入
        </Text>
      )}
    </div>
  ) : null;

  return (
    <Popover
      arrow={false}
      content={suggestions}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setOpen(false);
      }}
      open={open}
      overlayClassName={styles.templateVariablePopover}
      placement={multiline ? 'topLeft' : 'bottomLeft'}
      trigger="click"
    >
      <div className={styles.templateVariableControl} ref={controlElement}>
        {multiline ? (
          <Input.TextArea
            {...inputProps}
            autoSize={{ minRows: 4, maxRows: 10 }}
          />
        ) : (
          <Input {...inputProps} />
        )}
        <Button
          aria-label={`为${ariaLabel}插入变量`}
          className={styles.templateVariableButton}
          icon={<PlusOutlined />}
          onClick={openVariablePicker}
          onMouseDown={(event) => event.preventDefault()}
          size="small"
          type="text"
        >
          插入变量
        </Button>
      </div>
    </Popover>
  );
};

export default TemplateVariableInput;
