import { App, Button, Input, Segmented, Select, Tag } from 'antd';
import type { TextAreaRef } from 'antd/es/input/TextArea';
import {
  Braces,
  CheckCircle2,
  ListRestart,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Save,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { cn } from '@/lib/utils';
import {
  getMediaRecognitionRenameConfig,
  type MediaRecognitionRenameConfigResult,
  type MediaRecognitionRenamePreviewResult,
  type MediaRecognitionRenameType,
  type MediaRecognitionRenameValidationResult,
  previewMediaRecognitionRenameTemplate,
  saveMediaRecognitionRenameConfig,
  validateMediaRecognitionRenameTemplate,
} from '@/services/film-fusion';
import {
  buildRenameSampleJSON,
  getRenameVariables,
  parseRenameSampleJSON,
  renameTypeLabel,
} from './renameTemplates';

type RequestError<T = unknown> = {
  message?: string;
  response?: {
    data?: {
      data?: T;
      message?: string;
    };
  };
};

type RenameSaveErrorData = {
  media_type?: MediaRecognitionRenameType;
  validation?: MediaRecognitionRenameValidationResult;
};

const requestErrorText = (error: unknown) => {
  const candidate = error as RequestError | undefined;
  return candidate?.response?.data?.message || candidate?.message || '请求失败';
};

const emptyFormats: Record<MediaRecognitionRenameType, string> = {
  movie: '',
  tv: '',
};

const livePreviewDelay = 350;

const displayValue = (value: unknown) => {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const normalizeValidationResult = (
  result: MediaRecognitionRenameValidationResult,
): MediaRecognitionRenameValidationResult => ({
  ...result,
  errors: Array.isArray(result.errors) ? result.errors : [],
  warnings: Array.isArray(result.warnings) ? result.warnings : [],
  variables: Array.isArray(result.variables) ? result.variables : [],
});

const normalizePreviewResult = (
  result: MediaRecognitionRenamePreviewResult,
): MediaRecognitionRenamePreviewResult => ({
  ...result,
  warnings: Array.isArray(result.warnings) ? result.warnings : [],
  variables:
    result.variables && typeof result.variables === 'object'
      ? result.variables
      : {},
});

const RenameConfigSection = () => {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [config, setConfig] = useState<MediaRecognitionRenameConfigResult>();
  const [formats, setFormats] =
    useState<Record<MediaRecognitionRenameType, string>>(emptyFormats);
  const [savedFormats, setSavedFormats] =
    useState<Record<MediaRecognitionRenameType, string>>(emptyFormats);
  const [sampleDrafts, setSampleDrafts] =
    useState<Record<MediaRecognitionRenameType, string>>(emptyFormats);
  const [mediaType, setMediaType] =
    useState<MediaRecognitionRenameType>('movie');
  const [validation, setValidation] =
    useState<MediaRecognitionRenameValidationResult>();
  const [preview, setPreview] = useState<MediaRecognitionRenamePreviewResult>();
  const [previewError, setPreviewError] = useState<string>();
  const validationRequestRef = useRef(0);
  const previewRequestRef = useRef(0);
  const previewTimerRef = useRef<number | undefined>(undefined);
  const templateEditorRef = useRef<TextAreaRef>(null);
  const templateSelectionRef = useRef({ start: 0, end: 0 });

  const loadConfig = useCallback(
    async (showFeedback = false) => {
      validationRequestRef.current += 1;
      previewRequestRef.current += 1;
      setValidating(false);
      setPreviewing(false);
      setLoading(true);
      try {
        const response = await getMediaRecognitionRenameConfig();
        if (response.code !== 0 || !response.data) {
          throw new Error(response.message || '读取重命名配置失败');
        }
        const nextFormats = {
          movie: response.data.movie_format,
          tv: response.data.tv_format,
        };
        setConfig(response.data);
        setFormats(nextFormats);
        setSavedFormats(nextFormats);
        setValidation(undefined);
        setPreview(undefined);
        setPreviewError(undefined);
        if (showFeedback) void message.success('重命名模板已重新载入');
      } catch (error) {
        void message.error(requestErrorText(error));
      } finally {
        setLoading(false);
      }
    },
    [message],
  );

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const dirty =
    formats.movie !== savedFormats.movie || formats.tv !== savedFormats.tv;
  const currentDirty = formats[mediaType] !== savedFormats[mediaType];
  const currentVariables = useMemo(
    () =>
      getRenameVariables(
        config?.common_variables || [],
        config?.tv_variables || [],
        mediaType,
      ),
    [config, mediaType],
  );
  const variableSelectOptions = useMemo(
    () =>
      [
        {
          label: '通用变量',
          options: (config?.common_variables || []).map((variable) => ({
            label: `${variable.label} · {{${variable.name}}}`,
            value: variable.name,
          })),
        },
        ...(mediaType === 'tv'
          ? [
              {
                label: '电视剧额外变量',
                options: (config?.tv_variables || []).map((variable) => ({
                  label: `${variable.label} · {{${variable.name}}}`,
                  value: variable.name,
                })),
              },
            ]
          : []),
      ].filter((group) => group.options.length > 0),
    [config, mediaType],
  );

  const setCurrentFormat = (value: string) => {
    validationRequestRef.current += 1;
    previewRequestRef.current += 1;
    setValidating(false);
    setPreviewing(false);
    setFormats((current) => ({ ...current, [mediaType]: value }));
    setValidation(undefined);
    setPreview(undefined);
    setPreviewError(undefined);
  };

  const changeMediaType = (nextType: MediaRecognitionRenameType) => {
    validationRequestRef.current += 1;
    previewRequestRef.current += 1;
    setValidating(false);
    setPreviewing(false);
    setMediaType(nextType);
    setValidation(undefined);
    setPreview(undefined);
    setPreviewError(undefined);
    const nextLength = formats[nextType].length;
    templateSelectionRef.current = { start: nextLength, end: nextLength };
  };

  const rememberTemplateSelection = (element: HTMLTextAreaElement) => {
    templateSelectionRef.current = {
      start: element.selectionStart ?? element.value.length,
      end: element.selectionEnd ?? element.value.length,
    };
  };

  const insertVariable = (variableName: string) => {
    const value = formats[mediaType];
    const element = templateEditorRef.current?.resizableTextArea?.textArea;
    const start = Math.min(
      element?.selectionStart ?? templateSelectionRef.current.start,
      value.length,
    );
    const end = Math.min(
      element?.selectionEnd ?? templateSelectionRef.current.end,
      value.length,
    );
    const token = `{{${variableName}}}`;
    const nextValue = `${value.slice(0, start)}${token}${value.slice(Math.max(start, end))}`;
    const nextCursor = start + token.length;

    setCurrentFormat(nextValue);
    templateSelectionRef.current = { start: nextCursor, end: nextCursor };
    window.requestAnimationFrame(() => {
      const nextElement =
        templateEditorRef.current?.resizableTextArea?.textArea;
      nextElement?.focus();
      nextElement?.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const validateTemplate = async () => {
    const requestID = ++validationRequestRef.current;
    setValidating(true);
    setValidation(undefined);
    try {
      const response = await validateMediaRecognitionRenameTemplate({
        media_type: mediaType,
        template: formats[mediaType],
      });
      if (response.code !== 0 || !response.data) {
        throw new Error(response.message || '重命名模板校验失败');
      }
      if (requestID !== validationRequestRef.current) return;
      const result = normalizeValidationResult(response.data);
      setValidation(result);
      if (!result.valid) {
        void message.error(
          `模板校验失败${result.errors.length > 0 ? `：${result.errors[0]}` : ''}`,
        );
      } else if (result.warnings.length > 0) {
        void message.warning(`模板可用，但有 ${result.warnings.length} 条提醒`);
      } else {
        void message.success(
          `${renameTypeLabel[mediaType]}模板校验通过，引用 ${result.variables.length} 个变量`,
        );
      }
    } catch (error) {
      if (requestID !== validationRequestRef.current) return;
      const errorResult = (
        error as RequestError<MediaRecognitionRenameValidationResult>
      ).response?.data?.data;
      if (errorResult) setValidation(normalizeValidationResult(errorResult));
      void message.error(requestErrorText(error));
    } finally {
      if (requestID === validationRequestRef.current) setValidating(false);
    }
  };

  const saveConfig = async () => {
    validationRequestRef.current += 1;
    previewRequestRef.current += 1;
    setValidating(false);
    setPreviewing(false);
    setValidation(undefined);
    setPreview(undefined);
    setPreviewError(undefined);
    setSaving(true);
    try {
      const response = await saveMediaRecognitionRenameConfig({
        movie_format: formats.movie,
        tv_format: formats.tv,
      });
      if (response.code !== 0 || !response.data) {
        throw new Error(response.message || '保存重命名模板失败');
      }
      const nextFormats = {
        movie: response.data.movie_format,
        tv: response.data.tv_format,
      };
      setConfig(response.data);
      setFormats(nextFormats);
      setSavedFormats(nextFormats);
      setValidation(undefined);
      setPreview(undefined);
      setPreviewError(undefined);
      void message.success('电影与电视剧重命名模板已保存并立即生效');
    } catch (error) {
      const errorData = (error as RequestError<RenameSaveErrorData>).response
        ?.data?.data;
      if (
        errorData?.validation &&
        (errorData.media_type === 'movie' || errorData.media_type === 'tv')
      ) {
        validationRequestRef.current += 1;
        previewRequestRef.current += 1;
        setMediaType(errorData.media_type);
        setValidation(normalizeValidationResult(errorData.validation));
        setPreview(undefined);
      }
      void message.error(requestErrorText(error));
    } finally {
      setSaving(false);
    }
  };

  const restoreDefault = () => {
    if (!config) return;
    setCurrentFormat(
      mediaType === 'movie'
        ? config.default_movie_format
        : config.default_tv_format,
    );
    void message.info(
      `已恢复${renameTypeLabel[mediaType]}默认模板草稿，保存后才会生效`,
    );
  };

  const undoCurrent = () => {
    setCurrentFormat(savedFormats[mediaType]);
  };

  const fillSample = () => {
    if (!config) return;
    previewRequestRef.current += 1;
    setPreviewing(false);
    setSampleDrafts((current) => ({
      ...current,
      [mediaType]: buildRenameSampleJSON(
        config.common_variables,
        config.tv_variables,
        mediaType,
      ),
    }));
    setPreview(undefined);
    setPreviewError(undefined);
  };

  const previewTemplate = useCallback(
    async (showFeedback = false) => {
      let sample: Record<string, unknown> | undefined;
      try {
        sample = parseRenameSampleJSON(sampleDrafts[mediaType]);
      } catch (error) {
        const errorText =
          error instanceof Error ? error.message : '示例 JSON 格式不正确';
        previewRequestRef.current += 1;
        setPreview(undefined);
        setPreviewError(errorText);
        setPreviewing(false);
        if (showFeedback) void message.warning(errorText);
        return;
      }

      const requestID = ++previewRequestRef.current;
      setPreviewing(true);
      setPreviewError(undefined);
      try {
        const response = await previewMediaRecognitionRenameTemplate({
          media_type: mediaType,
          template: formats[mediaType],
          ...(sample ? { sample } : {}),
        });
        if (response.code !== 0 || !response.data) {
          throw new Error(response.message || '生成重命名预览失败');
        }
        if (requestID !== previewRequestRef.current) return;
        const result = normalizePreviewResult(response.data);
        setPreview(result);
        if (showFeedback && result.warnings.length > 0) {
          void message.warning(
            `预览已生成，但有 ${result.warnings.length} 条提醒`,
          );
        } else if (showFeedback) {
          void message.success('已使用页面中的未保存模板生成预览');
        }
      } catch (error) {
        if (requestID !== previewRequestRef.current) return;
        const errorText = requestErrorText(error);
        setPreview(undefined);
        setPreviewError(errorText);
        if (showFeedback) void message.error(errorText);
      } finally {
        if (requestID === previewRequestRef.current) setPreviewing(false);
      }
    },
    [formats, mediaType, message, sampleDrafts],
  );

  const refreshPreviewNow = () => {
    if (previewTimerRef.current !== undefined) {
      window.clearTimeout(previewTimerRef.current);
      previewTimerRef.current = undefined;
    }
    void previewTemplate(true);
  };

  useEffect(() => {
    if (!config || loading || saving) return;
    if (!formats[mediaType].trim()) {
      setPreview(undefined);
      setPreviewError('请输入重命名模板');
      setPreviewing(false);
      return;
    }

    previewTimerRef.current = window.setTimeout(() => {
      previewTimerRef.current = undefined;
      void previewTemplate();
    }, livePreviewDelay);

    return () => {
      if (previewTimerRef.current !== undefined) {
        window.clearTimeout(previewTimerRef.current);
        previewTimerRef.current = undefined;
      }
      previewRequestRef.current += 1;
    };
  }, [config, formats, loading, mediaType, previewTemplate, saving]);

  return (
    <section className="overflow-hidden rounded-2xl bg-white/82 shadow-[0_18px_55px_rgba(0,0,0,0.045)] backdrop-blur-xl dark:bg-white/[0.055]">
      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-400/12 dark:text-blue-200">
            <Braces aria-hidden="true" className="size-4" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="m-0 text-sm font-semibold text-neutral-900 dark:text-white">
                自定义重命名
              </h2>
              <Tag
                className={cn(
                  '!m-0 !rounded-full !px-2.5 !text-xs !font-medium',
                  config?.active
                    ? '!bg-emerald-50 !text-emerald-700 dark:!bg-emerald-400/12 dark:!text-emerald-200'
                    : '!bg-neutral-100 !text-neutral-500 dark:!bg-white/8 dark:!text-white/50',
                )}
                variant="filled"
              >
                {config?.active
                  ? '自定义模板已接管'
                  : config?.configured
                    ? '自定义模板未接管'
                    : '尚未保存 · 沿用兼容命名'}
              </Tag>
              {dirty && (
                <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                  有未保存修改
                </span>
              )}
            </div>
            <p className="mt-1.5 mb-0 text-xs text-neutral-400 dark:text-white/35">
              MoviePilot Jinja2 兼容安全子集；首次保存后由自定义模板接管整理命名
            </p>
          </div>
        </div>

        <Button
          className="!h-9 !rounded-xl !border-0 !bg-black/[0.035] !px-3.5 !text-neutral-600 hover:!bg-black/[0.065] dark:!bg-white/8 dark:!text-white/65 dark:hover:!bg-white/12"
          icon={<RefreshCw aria-hidden="true" className="size-4" />}
          disabled={saving}
          loading={loading}
          onClick={() => void loadConfig(true)}
          type="text"
        >
          重新载入模板
        </Button>
      </div>

      <div className="p-5">
        <div className="mb-5 rounded-xl bg-blue-50/70 px-4 py-3 text-xs leading-5 text-blue-800 dark:bg-blue-400/10 dark:text-blue-200">
          模板生成分类目录内的相对路径；电影/电视剧类型与分类目录由整理配置在模板外拼接，不需要写进模板。以{' '}
          <code>/</code> 分隔多级目录，使用可空变量前建议先加{' '}
          <code>{'{% if variable %}'}</code> 判断。默认模板不附加 TMDB
          标记，需要时可显式加入 <code>{'{{tmdbid}}'}</code>。
          支持变量、条件和常用过滤器；为避免阻塞整理或读取外部模板，不开放循环、宏及模板引用。
        </div>

        {(config?.load_errors?.length || 0) > 0 && (
          <div className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-xs leading-5 text-red-800 dark:bg-red-400/10 dark:text-red-200">
            <p className="m-0 flex items-center gap-2 font-semibold">
              <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
              已保存模板暂未接管，修正并重新保存后恢复
            </p>
            {config?.load_errors.map((error) => (
              <p className="mt-1.5 mb-0" key={error}>
                {error}
              </p>
            ))}
          </div>
        )}

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Segmented<MediaRecognitionRenameType>
            aria-label="重命名模板类型"
            className="!rounded-xl !bg-neutral-100/80 !p-1 [&_.ant-segmented-thumb]:!rounded-lg [&_.ant-segmented-thumb]:!bg-neutral-950 [&_.ant-segmented-thumb]:!shadow-none dark:!bg-white/8 dark:[&_.ant-segmented-thumb]:!bg-white"
            classNames={{
              item: '!rounded-lg !text-neutral-500 hover:!bg-transparent hover:!text-neutral-900 [&.ant-segmented-item-selected]:!bg-neutral-950 [&.ant-segmented-item-selected]:!text-white [&.ant-segmented-item-selected]:!shadow-none dark:!text-white/50 dark:hover:!text-white dark:[&.ant-segmented-item-selected]:!bg-white dark:[&.ant-segmented-item-selected]:!text-neutral-950',
              label: '!px-3 !font-medium',
            }}
            disabled={saving}
            onChange={changeMediaType}
            options={(
              [
                { label: '电影模板', value: 'movie' },
                { label: '电视剧模板', value: 'tv' },
              ] satisfies { label: string; value: MediaRecognitionRenameType }[]
            ).map((option) => ({
              ...option,
              label: `${option.label}${formats[option.value] !== savedFormats[option.value] ? ' · 已修改' : ''}`,
            }))}
            value={mediaType}
          />
          <span className="text-xs text-neutral-400 dark:text-white/35">
            全局设置 · {currentVariables.length} 个可用变量
          </span>
        </div>

        <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(400px,0.92fr)]">
          <div className="flex min-h-[410px] min-w-0 flex-col overflow-hidden rounded-2xl bg-neutral-950 text-neutral-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] dark:bg-black/35">
            <div className="flex min-h-16 flex-col gap-3 border-white/8 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <label
                  className="block text-sm font-semibold"
                  htmlFor="media-recognition-rename-template"
                >
                  {renameTypeLabel[mediaType]}重命名格式
                </label>
                <p className="mt-1 mb-0 text-[11px] text-white/40">
                  {currentDirty
                    ? '当前草稿未保存 · 修改后自动预览'
                    : config?.configured
                      ? '与已保存版本一致 · 修改后自动预览'
                      : 'MoviePilot 默认草稿 · 修改后自动预览'}
                </p>
              </div>
              <Select<string>
                aria-label="选择要插入的模板变量"
                className="w-full shrink-0 sm:w-64 [&_.ant-select-selection-placeholder]:!text-white/40 [&_.ant-select-selector]:!border-0 [&_.ant-select-selector]:!bg-white/8 [&_.ant-select-selector]:!text-white"
                disabled={
                  !config || loading || saving || !currentVariables.length
                }
                notFoundContent="没有匹配的变量"
                onSelect={insertVariable}
                options={variableSelectOptions}
                placeholder="选择变量并插入"
                popupMatchSelectWidth={320}
                showSearch={{ optionFilterProp: ['label', 'value'] }}
                value={null}
              />
            </div>

            <div className="min-h-64 flex-1 p-1.5 transition-shadow focus-within:ring-3 focus-within:ring-white/8">
              <Input.TextArea
                className="!h-full !min-h-64 !resize-none !bg-transparent !px-3 !py-3 !font-mono !text-[13px] !leading-6 !text-neutral-100 placeholder:!text-white/25"
                disabled={saving}
                id="media-recognition-rename-template"
                onBlur={(event) =>
                  rememberTemplateSelection(event.currentTarget)
                }
                onChange={(event) => {
                  rememberTemplateSelection(event.currentTarget);
                  setCurrentFormat(event.target.value);
                }}
                onClick={(event) =>
                  rememberTemplateSelection(event.currentTarget)
                }
                onKeyUp={(event) =>
                  rememberTemplateSelection(event.currentTarget)
                }
                onSelect={(event) =>
                  rememberTemplateSelection(event.currentTarget)
                }
                placeholder="输入 Jinja2 重命名模板"
                ref={templateEditorRef}
                spellCheck={false}
                value={formats[mediaType]}
                variant="borderless"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 border-white/8 border-t p-3">
              <Button
                className="!h-9 !rounded-xl !border-0 !bg-white/8 !px-4 !text-white/70 hover:!bg-white/12 hover:!text-white"
                disabled={!config || loading || saving}
                icon={<CheckCircle2 aria-hidden="true" className="size-4" />}
                loading={validating}
                onClick={() => void validateTemplate()}
                type="text"
              >
                校验当前模板
              </Button>
              <Button
                className="!h-9 !rounded-xl !border-0 !bg-white/8 !px-4 !text-white/70 hover:!bg-white/12 hover:!text-white"
                disabled={!config || saving}
                icon={<ListRestart aria-hidden="true" className="size-4" />}
                onClick={restoreDefault}
                type="text"
              >
                恢复默认草稿
              </Button>
              <Button
                className="!h-9 !rounded-xl !border-0 !bg-white/8 !px-4 !text-white/70 hover:!bg-white/12 hover:!text-white"
                disabled={!currentDirty || saving}
                icon={<RotateCcw aria-hidden="true" className="size-4" />}
                onClick={undoCurrent}
                type="text"
              >
                撤销当前修改
              </Button>
              <Button
                className="!h-9 !rounded-xl !border-0 !px-4 !shadow-none"
                disabled={!config || loading || saving}
                icon={<Save aria-hidden="true" className="size-4" />}
                loading={saving}
                onClick={() => void saveConfig()}
                type="primary"
              >
                保存并立即生效
              </Button>
            </div>
          </div>

          <RenamePreview
            error={previewError}
            loading={previewing}
            onRefresh={refreshPreviewNow}
            result={preview}
          />
        </div>

        {validation && (
          <div className="mt-5">
            <ValidationResult result={validation} />
          </div>
        )}

        <div className="mt-5">
          <div className="flex h-[420px] min-w-0 flex-col overflow-hidden rounded-2xl bg-black/[0.018] dark:bg-white/[0.025]">
            <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-black/5 border-b px-4 py-3 dark:border-white/8">
              <div>
                <h3 className="m-0 text-sm font-semibold text-neutral-900 dark:text-white">
                  预览示例变量
                </h3>
                <p className="mt-1 mb-0 text-[11px] text-neutral-400 dark:text-white/35">
                  JSON 修改后自动预览；留空时使用后端内置示例
                </p>
              </div>
              <Button
                className="!h-8 !rounded-lg !border-0 !bg-white !px-3 !text-xs !shadow-sm hover:!bg-neutral-50 dark:!bg-white/8 dark:!text-white/65 dark:!shadow-none dark:hover:!bg-white/12"
                disabled={!config || saving}
                icon={<Sparkles aria-hidden="true" className="size-3.5" />}
                onClick={fillSample}
                type="text"
              >
                填入示例
              </Button>
            </div>
            <div className="min-h-0 flex-1 p-3">
              <Input.TextArea
                aria-label={`${renameTypeLabel[mediaType]}预览示例变量 JSON`}
                className="!h-full !resize-none !rounded-xl !border-0 !bg-white !px-3 !py-2.5 !font-mono !text-xs !leading-5 !text-neutral-700 !shadow-none dark:!bg-black/20 dark:!text-white/65"
                disabled={saving}
                onChange={(event) => {
                  previewRequestRef.current += 1;
                  setPreviewing(false);
                  setSampleDrafts((current) => ({
                    ...current,
                    [mediaType]: event.target.value,
                  }));
                  setPreview(undefined);
                  setPreviewError(undefined);
                }}
                placeholder='{"title": "流浪地球", "year": 2019}'
                spellCheck={false}
                value={sampleDrafts[mediaType]}
                variant="borderless"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const ValidationResult = ({
  result,
}: {
  result: MediaRecognitionRenameValidationResult;
}) => (
  <div
    className={cn(
      'rounded-xl px-4 py-3 text-xs leading-5',
      result.valid
        ? result.warnings.length > 0
          ? 'bg-amber-50 text-amber-800 dark:bg-amber-400/10 dark:text-amber-200'
          : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200'
        : 'bg-red-50 text-red-800 dark:bg-red-400/10 dark:text-red-200',
    )}
  >
    <p className="m-0 flex items-center gap-2 font-medium">
      {result.valid ? (
        <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
      ) : (
        <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
      )}
      {result.valid ? '模板校验通过' : '模板校验失败'}
    </p>
    {[...result.errors, ...result.warnings].map((item) => (
      <p className="mt-1.5 mb-0" key={item}>
        {item}
      </p>
    ))}
    {result.variables.length > 0 && (
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {result.variables.map((variable) => (
          <code
            className="rounded-md bg-white/65 px-2 py-0.5 text-[11px] dark:bg-black/15"
            key={variable}
          >
            {variable}
          </code>
        ))}
      </div>
    )}
  </div>
);

const RenamePreview = ({
  error,
  loading,
  onRefresh,
  result,
}: {
  error?: string;
  loading: boolean;
  onRefresh: () => void;
  result?: MediaRecognitionRenamePreviewResult;
}) => (
  <div className="flex h-full min-h-[410px] min-w-0 flex-col overflow-hidden rounded-2xl bg-neutral-950 text-neutral-100 dark:bg-black/35">
    <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-white/8 border-b px-4 py-3">
      <div>
        <h3 className="m-0 text-sm font-semibold">实时路径预览</h3>
        <p className="mt-1 mb-0 text-[11px] text-white/40">
          使用当前草稿和示例变量 · 不写入媒体库
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'flex items-center gap-1.5 text-[11px]',
            error
              ? 'text-red-300'
              : result
                ? 'text-emerald-300'
                : 'text-white/35',
          )}
        >
          {loading ? (
            <LoaderCircle
              aria-hidden="true"
              className="size-3.5 animate-spin"
            />
          ) : (
            <span
              aria-hidden="true"
              className={cn(
                'size-1.5 rounded-full',
                error
                  ? 'bg-red-300'
                  : result
                    ? 'bg-emerald-300'
                    : 'bg-white/25',
              )}
            />
          )}
          {loading
            ? '正在实时更新'
            : error
              ? '预览失败'
              : result
                ? '已实时更新'
                : '等待预览'}
        </span>
        <Button
          aria-label="立即刷新实时预览"
          className="!size-8 !rounded-lg !border-0 !bg-white/8 !p-0 !text-white/60 hover:!bg-white/12 hover:!text-white"
          disabled={loading}
          icon={<RefreshCw aria-hidden="true" className="size-3.5" />}
          onClick={onRefresh}
          type="text"
        />
      </div>
    </div>
    {error ? (
      <div className="flex flex-1 items-center justify-center p-6 text-center">
        <div className="max-w-md rounded-xl bg-red-400/10 px-4 py-3 text-xs leading-5 text-red-200">
          <TriangleAlert aria-hidden="true" className="mx-auto mb-2 size-5" />
          {error}
        </div>
      </div>
    ) : result ? (
      <div className="min-h-0 flex-1 p-4">
        <code className="block break-all rounded-xl bg-white/6 px-3.5 py-3 text-sm leading-6 text-emerald-200">
          {result.path}
        </code>
        {result.warnings.length > 0 && (
          <div className="mt-3 space-y-1.5 text-xs leading-5 text-amber-200">
            {result.warnings.map((warning) => (
              <p className="m-0 flex items-start gap-2" key={warning}>
                <TriangleAlert
                  aria-hidden="true"
                  className="mt-0.5 size-3.5 shrink-0"
                />
                {warning}
              </p>
            ))}
          </div>
        )}
        <div className="mt-4 max-h-52 overflow-y-auto rounded-xl bg-white/4 p-3">
          <p className="mt-0 mb-2 text-[11px] font-semibold tracking-[0.1em] text-white/35 uppercase">
            本次变量
          </p>
          <dl className="m-0 grid gap-x-4 gap-y-2 sm:grid-cols-2">
            {Object.entries(result.variables).map(([name, value]) => (
              <div className="min-w-0" key={name}>
                <dt className="font-mono text-[10px] text-white/35">{name}</dt>
                <dd
                  className="mt-0.5 mb-0 truncate text-xs text-white/70"
                  title={displayValue(value)}
                >
                  {displayValue(value)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    ) : (
      <div className="flex flex-1 items-center justify-center px-5 py-14 text-center text-xs leading-5 text-white/35">
        <span>
          {loading
            ? '正在使用当前草稿生成预览…'
            : '输入停止约 0.35 秒后会自动生成预览'}
        </span>
      </div>
    )}
  </div>
);

export default RenameConfigSection;
