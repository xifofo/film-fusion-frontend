import { App, Button, Input, Segmented, Switch, Tag } from 'antd';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Clipboard,
  FileCode2,
  FlaskConical,
  GitCompareArrows,
  RefreshCw,
  RotateCcw,
  Save,
  TriangleAlert,
} from 'lucide-react';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { cn } from '@/lib/utils';
import {
  compareMediaRecognition,
  getMediaRecognitionCategoryConfig,
  getMediaRecognitionWords,
  type MediaRecognitionCandidate,
  type MediaRecognitionCategoryConfigResult,
  type MediaRecognitionCategoryRule,
  type MediaRecognitionRule,
  type MediaRecognitionRuleType,
  type MediaRecognitionShadowSnapshot,
  type MediaRecognitionShadowTestResult,
  type MediaRecognitionTestResult,
  saveMediaRecognitionCategoryConfig,
  saveMediaRecognitionWords,
  validateMediaRecognitionCategoryConfig,
} from '@/services/film-fusion';
import RenameConfigSection from './RenameConfigSection';
import {
  inspectRecognitionWords,
  splitRecognitionWords,
  tmdbImageURL,
} from './rules';
import YamlEditor from './YamlEditor';
import { getYAMLDiagnostics } from './yamlDiagnostics';

const FILE_EXAMPLE =
  '/downloads/百花杀 (2026)/百花杀.S01E03.2160p.WEB-DL.H265.10bit.DDP5.1.mkv';
const TITLE_EXAMPLE = 'Dune.2021.2160p.BluRay.x265.TrueHD.Atmos';

const ruleStyles: Record<MediaRecognitionRuleType, string> = {
  block: 'bg-neutral-100 text-neutral-600 dark:bg-white/8 dark:text-white/65',
  replace: 'bg-blue-50 text-blue-700 dark:bg-blue-400/12 dark:text-blue-200',
  episode_offset:
    'bg-violet-50 text-violet-700 dark:bg-violet-400/12 dark:text-violet-200',
  replace_and_offset:
    'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-400/12 dark:text-fuchsia-200',
  comment: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-400/12 dark:text-cyan-200',
};

const tmdbStatuses: Record<string, { label: string; className: string }> = {
  skipped: {
    label: '未查询 TMDB',
    className:
      'bg-neutral-100 text-neutral-600 dark:bg-white/8 dark:text-white/65',
  },
  not_configured: {
    label: 'TMDB 未配置',
    className:
      'bg-amber-50 text-amber-700 dark:bg-amber-400/12 dark:text-amber-200',
  },
  matched: {
    label: 'TMDB 已匹配',
    className:
      'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/12 dark:text-emerald-200',
  },
  matched_by_id: {
    label: 'TMDB ID 精确匹配',
    className:
      'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/12 dark:text-emerald-200',
  },
  not_found: {
    label: 'TMDB 未找到',
    className:
      'bg-amber-50 text-amber-700 dark:bg-amber-400/12 dark:text-amber-200',
  },
  ambiguous: {
    label: 'TMDB 候选有歧义',
    className:
      'bg-amber-50 text-amber-700 dark:bg-amber-400/12 dark:text-amber-200',
  },
  error: {
    label: 'TMDB 查询失败',
    className: 'bg-red-50 text-red-700 dark:bg-red-400/12 dark:text-red-200',
  },
};

const shadowStatuses: Record<string, { label: string; className: string }> = {
  matched: {
    label: '关键字段一致',
    className:
      'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/12 dark:text-emerald-200',
  },
  different: {
    label: '发现识别差异',
    className:
      'bg-amber-50 text-amber-700 dark:bg-amber-400/12 dark:text-amber-200',
  },
  moviepilot_error: {
    label: 'MP2 识别失败',
    className: 'bg-red-50 text-red-700 dark:bg-red-400/12 dark:text-red-200',
  },
  local_error: {
    label: '本地影子失败',
    className: 'bg-red-50 text-red-700 dark:bg-red-400/12 dark:text-red-200',
  },
  local_unavailable: {
    label: '本地影子未启用',
    className:
      'bg-neutral-100 text-neutral-600 dark:bg-white/8 dark:text-white/65',
  },
};

type RequestError = {
  message?: string;
  response?: {
    data?: {
      message?: string;
    };
  };
};

const errorText = (error: unknown) => {
  const candidate = error as RequestError | undefined;
  return candidate?.response?.data?.message || candidate?.message || '请求失败';
};

const mediaTypeText = (type?: string) => {
  if (type === 'movie') return '电影';
  if (type === 'tv') return '电视剧';
  return '未确定';
};

const optionalText = (value?: string | number) =>
  value === undefined || value === null || value === '' ? '-' : value;

const pillClass =
  'inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium';

const MediaRecognitionPage = () => {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categorySaving, setCategorySaving] = useState(false);
  const [categoryValidating, setCategoryValidating] = useState(false);
  const [testing, setTesting] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [categoryConfigured, setCategoryConfigured] = useState(false);
  const [tmdbConfigured, setTMDBConfigured] = useState(false);
  const [wordsText, setWordsText] = useState('');
  const [savedWordsText, setSavedWordsText] = useState('');
  const [categoryYAML, setCategoryYAML] = useState('');
  const [savedCategoryYAML, setSavedCategoryYAML] = useState('');
  const [categoryPreview, setCategoryPreview] =
    useState<MediaRecognitionCategoryConfigResult>();
  const [mode, setMode] = useState<'file' | 'title'>('file');
  const [lookupTMDB, setLookupTMDB] = useState(true);
  const [input, setInput] = useState(FILE_EXAMPLE);
  const [result, setResult] = useState<MediaRecognitionShadowTestResult>();
  const [testPanelOpen, setTestPanelOpen] = useState(false);

  const loadConfig = useCallback(
    async (showFeedback = false) => {
      setLoading(true);
      try {
        const [wordsResponse, categoryResponse] = await Promise.all([
          getMediaRecognitionWords(),
          getMediaRecognitionCategoryConfig(),
        ]);
        if (wordsResponse.code !== 0 || !wordsResponse.data) {
          throw new Error(wordsResponse.message || '读取识别词失败');
        }
        if (categoryResponse.code !== 0 || !categoryResponse.data) {
          throw new Error(categoryResponse.message || '读取分类配置失败');
        }
        const text = wordsResponse.data.words.join('\n');
        setConfigured(wordsResponse.data.configured);
        setTMDBConfigured(wordsResponse.data.tmdb_configured);
        setWordsText(text);
        setSavedWordsText(text);
        setCategoryConfigured(categoryResponse.data.configured);
        setCategoryYAML(categoryResponse.data.yaml);
        setSavedCategoryYAML(categoryResponse.data.yaml);
        setCategoryPreview(categoryResponse.data);
        if (showFeedback) void message.success('本地识别配置已重新载入');
      } catch (error) {
        void message.error(errorText(error));
      } finally {
        setLoading(false);
      }
    },
    [message],
  );

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const rules = useMemo(() => inspectRecognitionWords(wordsText), [wordsText]);
  const dirty = wordsText !== savedWordsText;
  const categoryDirty = categoryYAML !== savedCategoryYAML;
  const categorySyntaxDiagnostics = useMemo(
    () => getYAMLDiagnostics(categoryYAML),
    [categoryYAML],
  );
  const categorySyntaxErrors = categorySyntaxDiagnostics.filter(
    (diagnostic) => diagnostic.severity === 'error',
  );
  const categorySyntaxWarnings = categorySyntaxDiagnostics.filter(
    (diagnostic) => diagnostic.severity === 'warning',
  );

  const saveWords = async () => {
    setSaving(true);
    try {
      const response = await saveMediaRecognitionWords(
        splitRecognitionWords(wordsText),
      );
      if (response.code !== 0 || !response.data) {
        throw new Error(response.message || '保存识别词失败');
      }
      const text = response.data.words.join('\n');
      setWordsText(text);
      setSavedWordsText(text);
      setConfigured(true);
      setTMDBConfigured(response.data.tmdb_configured);
      void message.success(`已保存 ${response.data.words.length} 条识别词`);
    } catch (error) {
      void message.error(errorText(error));
    } finally {
      setSaving(false);
    }
  };

  const validateCategory = async () => {
    if (categorySyntaxErrors.length > 0) {
      void message.warning('请先修正媒体分类配置中的 YAML 语法错误');
      return;
    }
    setCategoryValidating(true);
    try {
      const response =
        await validateMediaRecognitionCategoryConfig(categoryYAML);
      if (response.code !== 0 || !response.data) {
        throw new Error(response.message || '分类配置校验失败');
      }
      setCategoryYAML(response.data.yaml);
      setCategoryPreview(response.data);
      const count = response.data.movie.length + response.data.tv.length;
      if (response.data.warnings.length > 0) {
        void message.warning(
          `配置可用，但有 ${response.data.warnings.length} 条顺序提醒`,
        );
      } else {
        void message.success(`配置校验通过，共 ${count} 个分类`);
      }
    } catch (error) {
      setCategoryPreview(undefined);
      void message.error(errorText(error));
    } finally {
      setCategoryValidating(false);
    }
  };

  const saveCategory = async () => {
    if (categorySyntaxErrors.length > 0) {
      void message.warning('请先修正媒体分类配置中的 YAML 语法错误');
      return;
    }
    setCategorySaving(true);
    try {
      const response = await saveMediaRecognitionCategoryConfig(categoryYAML);
      if (response.code !== 0 || !response.data) {
        throw new Error(response.message || '保存分类配置失败');
      }
      setCategoryConfigured(true);
      setCategoryYAML(response.data.yaml);
      setSavedCategoryYAML(response.data.yaml);
      setCategoryPreview(response.data);
      void message.success(
        `分类配置已生效：${response.data.movie.length} 个电影分类，${response.data.tv.length} 个剧集分类`,
      );
    } catch (error) {
      void message.error(errorText(error));
    } finally {
      setCategorySaving(false);
    }
  };

  const runTest = async () => {
    if (!input.trim()) {
      void message.warning('请输入媒体标题或文件路径');
      return;
    }
    if (categorySyntaxErrors.length > 0) {
      void message.warning('请先修正媒体分类配置中的 YAML 语法错误');
      return;
    }
    setTesting(true);
    try {
      const response = await compareMediaRecognition({
        input: input.trim(),
        mode,
        words: splitRecognitionWords(wordsText),
        category_yaml: categoryYAML,
        lookup_tmdb: lookupTMDB,
      });
      if (response.code !== 0 || !response.data) {
        throw new Error(response.message || '影子对比失败');
      }
      setResult(response.data);
      if (response.data.comparison.status === 'matched') {
        void message.success('影子对比完成：关键字段一致');
      } else if (response.data.comparison.status === 'different') {
        void message.warning(
          `影子对比完成：发现 ${response.data.comparison.differences.length} 项差异`,
        );
      } else {
        void message.warning('影子对比完成，但有一侧识别失败');
      }
    } catch (error) {
      void message.error(errorText(error));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="mx-auto box-border w-full max-w-[1680px] px-4 py-5 sm:px-6 sm:py-7 xl:px-8">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="m-0 text-[11px] font-semibold tracking-[0.18em] text-neutral-400 uppercase dark:text-white/35">
            Media tools
          </p>
          <h1 className="mt-2 mb-0 text-2xl font-semibold tracking-[-0.035em] text-neutral-950 sm:text-[30px] dark:text-white">
            媒体识别
          </h1>
        </div>

        <Button
          className="!h-9 !rounded-xl !border-0 !bg-black/[0.035] !px-3.5 !text-neutral-600 hover:!bg-black/[0.065] dark:!bg-white/8 dark:!text-white/65 dark:hover:!bg-white/12"
          icon={<RefreshCw aria-hidden="true" className="size-4" />}
          loading={loading}
          onClick={() => void loadConfig(true)}
          type="text"
        >
          重新载入
        </Button>
      </header>

      <div className="space-y-5">
        <section className="overflow-hidden rounded-2xl bg-white/82 shadow-[0_18px_55px_rgba(0,0,0,0.045)] backdrop-blur-xl dark:bg-white/[0.055]">
          <Button
            aria-controls="media-recognition-test-panel"
            aria-expanded={testPanelOpen}
            aria-label={testPanelOpen ? '收起影子对比测试' : '展开影子对比测试'}
            block
            className="!flex !h-auto !items-center !justify-between !gap-3 !rounded-none !border-0 !px-5 !py-4 !text-left !shadow-none hover:!bg-black/[0.025] focus-visible:!outline-none focus-visible:!ring-2 focus-visible:!ring-inset focus-visible:!ring-black/10 dark:hover:!bg-white/[0.035] dark:focus-visible:!ring-white/20"
            htmlType="button"
            onClick={() => setTestPanelOpen((open) => !open)}
            type="text"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-xl bg-neutral-950 text-white dark:bg-white dark:text-neutral-950">
                <FlaskConical aria-hidden="true" className="size-4" />
              </span>
              <div>
                <h2 className="m-0 text-sm font-semibold text-neutral-900 dark:text-white">
                  MP2 / FilmFusion 影子对比
                </h2>
                <p className="mt-0.5 mb-0 text-xs text-neutral-400 dark:text-white/35">
                  MP2 主结果 → FilmFusion 本地影子 → 字段差异
                </p>
              </div>
            </div>
            <ChevronDown
              aria-hidden="true"
              className={cn(
                'size-4 shrink-0 text-neutral-400 transition-transform duration-200 dark:text-white/35',
                testPanelOpen && 'rotate-180',
              )}
            />
          </Button>

          {testPanelOpen && (
            <div className="p-5" id="media-recognition-test-panel">
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Segmented
                    aria-label="识别输入类型"
                    className="!rounded-xl !bg-neutral-100/80 !p-1 [&_.ant-segmented-thumb]:!rounded-lg [&_.ant-segmented-thumb]:!bg-neutral-950 [&_.ant-segmented-thumb]:!shadow-none dark:!bg-white/8 dark:[&_.ant-segmented-thumb]:!bg-white"
                    classNames={{
                      item: '!rounded-lg !text-neutral-500 hover:!bg-transparent hover:!text-neutral-900 [&.ant-segmented-item-selected]:!bg-neutral-950 [&.ant-segmented-item-selected]:!text-white [&.ant-segmented-item-selected]:!shadow-none dark:!text-white/50 dark:hover:!text-white dark:[&.ant-segmented-item-selected]:!bg-white dark:[&.ant-segmented-item-selected]:!text-neutral-950',
                      label: '!px-3 !font-medium',
                    }}
                    onChange={(value) => {
                      const nextMode = value as 'file' | 'title';
                      setMode(nextMode);
                      setInput(
                        nextMode === 'file' ? FILE_EXAMPLE : TITLE_EXAMPLE,
                      );
                    }}
                    options={[
                      { label: '文件路径', value: 'file' },
                      { label: '发布标题', value: 'title' },
                    ]}
                    size="small"
                    value={mode}
                  />

                  <div className="flex items-center gap-2 text-xs font-medium text-neutral-600 dark:text-white/60">
                    <Switch
                      aria-label="本地影子查询 TMDB"
                      checked={lookupTMDB}
                      onChange={setLookupTMDB}
                      size="small"
                    />
                    本地查询 TMDB
                  </div>
                  <Tag
                    variant="filled"
                    className={cn(
                      '!m-0 !rounded-full !px-2.5 !text-xs !font-medium',
                      tmdbConfigured
                        ? '!bg-blue-50 !text-blue-700 dark:!bg-blue-400/12 dark:!text-blue-200'
                        : '!bg-amber-50 !text-amber-700 dark:!bg-amber-400/12 dark:!text-amber-200',
                    )}
                  >
                    {tmdbConfigured ? '已配置' : '未配置'}
                  </Tag>
                </div>

                <label className="sr-only" htmlFor="media-recognition-input">
                  媒体识别输入
                </label>
                <div className="rounded-2xl bg-neutral-100/80 p-1.5 transition-shadow focus-within:ring-3 focus-within:ring-black/[0.05] dark:bg-black/20 dark:focus-within:ring-white/8">
                  <Input.TextArea
                    className="!min-h-24 !resize-y !bg-transparent !px-3 !py-2.5 !font-mono !text-sm !leading-6 !text-neutral-900 placeholder:!text-neutral-400 dark:!text-white dark:placeholder:!text-white/30"
                    id="media-recognition-input"
                    onChange={(event) => setInput(event.target.value)}
                    placeholder={
                      mode === 'file'
                        ? '输入完整文件路径或文件名'
                        : '输入种子/发布标题'
                    }
                    rows={3}
                    spellCheck={false}
                    value={input}
                    variant="borderless"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <Button
                    className="!h-9 !rounded-xl !border-0 !px-4 !shadow-none"
                    disabled={testing || loading}
                    icon={
                      <FlaskConical aria-hidden="true" className="size-4" />
                    }
                    loading={testing}
                    onClick={() => void runTest()}
                    type="primary"
                  >
                    开始影子对比
                  </Button>
                  <Button
                    className="!h-9 !rounded-xl !border-0 !bg-black/[0.035] !px-4 hover:!bg-black/[0.065] dark:!bg-white/8 dark:!text-white/65 dark:hover:!bg-white/12"
                    onClick={() =>
                      setInput(mode === 'file' ? FILE_EXAMPLE : TITLE_EXAMPLE)
                    }
                    type="text"
                  >
                    填入示例
                  </Button>
                  <span className="text-xs text-neutral-400 dark:text-white/35">
                    两边使用同一份页面草稿；结果始终以 MP2 为基准
                  </span>
                </div>
              </div>

              {result && (
                <div className="mt-6 pt-2">
                  <ShadowComparisonResult result={result} />
                </div>
              )}
            </div>
          )}
        </section>

        <RenameConfigSection />

        <section className="overflow-hidden rounded-2xl bg-white/82 shadow-[0_18px_55px_rgba(0,0,0,0.045)] backdrop-blur-xl dark:bg-white/[0.055]">
          <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="m-0 text-sm font-semibold text-neutral-900 dark:text-white">
                  识别词管理
                </h2>
                <Tag
                  variant="filled"
                  className={cn(
                    '!m-0 !rounded-full !px-2.5 !text-xs !font-medium',
                    configured
                      ? '!bg-emerald-50 !text-emerald-700 dark:!bg-emerald-400/12 dark:!text-emerald-200'
                      : '!bg-neutral-100 !text-neutral-500 dark:!bg-white/8 dark:!text-white/50',
                  )}
                >
                  {configured ? 'FilmFusion 已接管' : '尚未保存'}
                </Tag>
                {dirty && (
                  <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                    有未保存修改
                  </span>
                )}
              </div>
              <p className="mt-1.5 mb-0 text-xs text-neutral-400 dark:text-white/35">
                格式与 MoviePilot 识别词一致，每行一条，按顺序执行
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                className="!h-9 !rounded-xl !border-0 !bg-black/[0.035] !px-4 hover:!bg-black/[0.065] dark:!bg-white/8 dark:!text-white/65 dark:hover:!bg-white/12"
                disabled={!dirty}
                icon={<RotateCcw aria-hidden="true" className="size-4" />}
                onClick={() => setWordsText(savedWordsText)}
                type="text"
              >
                撤销修改
              </Button>
              <Button
                className="!h-9 !rounded-xl !border-0 !px-4 !shadow-none"
                disabled={saving || loading}
                icon={<Save aria-hidden="true" className="size-4" />}
                loading={saving}
                onClick={() => void saveWords()}
                type="primary"
              >
                保存并生效
              </Button>
            </div>
          </div>

          <div className="p-5">
            <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {[
                '屏蔽词',
                '被替换词 => 替换词',
                '前定位词 <> 后定位词 >> EP+集偏移量',
                '被替换词 => 替换词 && 前定位词 <> 后定位词 >> EP+集偏移量',
              ].map((format) => (
                <code
                  className="rounded-lg bg-neutral-100 px-3 py-2 text-[11px] leading-5 text-neutral-600 dark:bg-black/20 dark:text-white/60"
                  key={format}
                >
                  {format}
                </code>
              ))}
            </div>
            <p className="mt-0 mb-3 text-xs text-neutral-400 dark:text-white/35">
              运算符两侧保留空格；内容按正则表达式处理，以 # 开头的行为注释。
            </p>

            <label className="sr-only" htmlFor="media-recognition-words">
              识别词编辑器
            </label>
            <div className="rounded-2xl bg-neutral-950 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-shadow focus-within:ring-3 focus-within:ring-black/[0.08] dark:bg-black/35 dark:focus-within:ring-white/8">
              <Input.TextArea
                className="!min-h-80 !resize-y !bg-transparent !px-3 !py-2.5 !font-mono !text-[13px] !leading-6 !text-neutral-100 placeholder:!text-white/25"
                id="media-recognition-words"
                onChange={(event) => setWordsText(event.target.value)}
                placeholder={
                  '# 示例\nREPACK\\.?\n旧名 => 新名\n第 <> 集 >> EP+1'
                }
                rows={14}
                spellCheck={false}
                value={wordsText}
                variant="borderless"
              />
            </div>

            <div className="mt-5 flex items-center justify-between">
              <h3 className="m-0 text-sm font-semibold text-neutral-900 dark:text-white">
                当前词表预览
              </h3>
              <span className="text-xs text-neutral-400 dark:text-white/35">
                {rules.length} 条
              </span>
            </div>
            <RuleTable rules={rules} />
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl bg-white/82 shadow-[0_18px_55px_rgba(0,0,0,0.045)] backdrop-blur-xl dark:bg-white/[0.055]">
          <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600 dark:bg-white/8 dark:text-white/60">
                <FileCode2 aria-hidden="true" className="size-4" />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="m-0 text-sm font-semibold text-neutral-900 dark:text-white">
                    媒体分类配置
                  </h2>
                  <span className="text-xs text-neutral-400 dark:text-white/35">
                    {categoryConfigured
                      ? '本地配置已生效'
                      : '当前使用内置默认值'}
                  </span>
                  {categoryDirty && (
                    <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                      有未保存修改
                    </span>
                  )}
                </div>
                <p className="mt-1.5 mb-0 text-xs text-neutral-400 dark:text-white/35">
                  兼容 MoviePilot category.yaml；分类名同时也是整理目录名
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                className="!h-9 !rounded-xl !border-0 !bg-black/[0.035] !px-4 hover:!bg-black/[0.065] dark:!bg-white/8 dark:!text-white/65 dark:hover:!bg-white/12"
                disabled={categorySyntaxErrors.length > 0}
                icon={<CheckCircle2 aria-hidden="true" className="size-4" />}
                loading={categoryValidating}
                onClick={() => void validateCategory()}
                type="text"
              >
                校验并预览
              </Button>
              <Button
                className="!h-9 !rounded-xl !border-0 !bg-black/[0.035] !px-4 hover:!bg-black/[0.065] dark:!bg-white/8 dark:!text-white/65 dark:hover:!bg-white/12"
                disabled={!categoryDirty}
                icon={<RotateCcw aria-hidden="true" className="size-4" />}
                onClick={() => setCategoryYAML(savedCategoryYAML)}
                type="text"
              >
                撤销修改
              </Button>
              <Button
                className="!h-9 !rounded-xl !border-0 !px-4 !shadow-none"
                disabled={
                  categorySaving || loading || categorySyntaxErrors.length > 0
                }
                icon={<Save aria-hidden="true" className="size-4" />}
                loading={categorySaving}
                onClick={() => void saveCategory()}
                type="primary"
              >
                保存并生效
              </Button>
            </div>
          </div>

          <div className="p-5">
            <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ['original_language', '语种'],
                ['genre_ids', '内容类型'],
                ['origin_country / production_countries', '国家或地区'],
                ['release_year', '年份或年份范围'],
              ].map(([field, label]) => (
                <div
                  className="rounded-xl bg-neutral-100 px-3 py-2.5 dark:bg-black/20"
                  key={field}
                >
                  <code className="block text-[11px] text-neutral-700 dark:text-white/65">
                    {field}
                  </code>
                  <span className="mt-1 block text-[11px] text-neutral-400 dark:text-white/35">
                    {label}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-0 mb-4 text-xs leading-5 text-neutral-400 dark:text-white/35">
              电影、电视剧为 MP2 一级键；旧版 movie、tv
              会自动兼容。由上到下匹配，逗号表示任一值，!值表示排除，空规则是兜底并应放在最后。
            </p>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
              <div className="min-w-0">
                <div className="rounded-2xl bg-neutral-950 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-shadow focus-within:ring-3 focus-within:ring-black/[0.08] dark:bg-black/35 dark:focus-within:ring-white/8">
                  <YamlEditor
                    describedBy="media-recognition-category-yaml-status"
                    id="media-recognition-category-yaml"
                    onChange={setCategoryYAML}
                    placeholder={
                      "movie:\n  动画电影:\n    genre_ids: '16'\n  其它电影:\n\ntv:\n  电视剧:"
                    }
                    value={categoryYAML}
                  />
                </div>
                <div
                  aria-live="polite"
                  className={cn(
                    'mt-2 flex min-h-5 items-start gap-1.5 px-1 text-[11px] leading-5',
                    categorySyntaxErrors.length > 0
                      ? 'text-red-600 dark:text-red-300'
                      : categorySyntaxWarnings.length > 0
                        ? 'text-amber-700 dark:text-amber-300'
                        : 'text-emerald-700 dark:text-emerald-300',
                  )}
                  id="media-recognition-category-yaml-status"
                >
                  {categorySyntaxErrors.length > 0 ? (
                    <TriangleAlert
                      aria-hidden="true"
                      className="mt-0.5 size-3.5 shrink-0"
                    />
                  ) : (
                    <Check
                      aria-hidden="true"
                      className="mt-0.5 size-3.5 shrink-0"
                    />
                  )}
                  <span>
                    {!categoryYAML.trim()
                      ? '等待输入 YAML；保存时还会校验分类结构。'
                      : categorySyntaxErrors.length > 0
                        ? `发现 ${categorySyntaxErrors.length} 处语法错误：${categorySyntaxErrors[0]?.message}`
                        : categorySyntaxWarnings.length > 0
                          ? `YAML 可解析，但有 ${categorySyntaxWarnings.length} 条语法提醒：${categorySyntaxWarnings[0]?.message}`
                          : 'YAML 语法正确；保存时还会校验分类结构与匹配顺序。'}
                  </span>
                </div>
              </div>

              <div className="min-w-0 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="m-0 text-sm font-semibold text-neutral-900 dark:text-white">
                    规则顺序预览
                  </h3>
                  <span className="text-xs text-neutral-400 dark:text-white/35">
                    {categoryDirty ? '上次校验结果' : '当前配置'}
                  </span>
                </div>

                {categoryPreview ? (
                  <>
                    <CategoryRulePreview
                      rules={categoryPreview.movie}
                      title="电影 · movie"
                    />
                    <CategoryRulePreview
                      rules={categoryPreview.tv}
                      title="电视剧 · tv"
                    />
                    {categoryPreview.warnings.length > 0 && (
                      <div className="rounded-xl bg-amber-50 px-3.5 py-3 text-xs leading-5 text-amber-800 dark:bg-amber-400/10 dark:text-amber-200">
                        {categoryPreview.warnings.map((warning) => (
                          <p
                            className="m-0 flex items-start gap-2 [&+p]:mt-1.5"
                            key={warning}
                          >
                            <TriangleAlert
                              aria-hidden="true"
                              className="mt-0.5 size-3.5 shrink-0"
                            />
                            {warning}
                          </p>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="rounded-xl bg-neutral-100 px-4 py-10 text-center text-xs text-neutral-400 dark:bg-black/20 dark:text-white/35">
                    点击“校验并预览”查看当前 YAML 的命中顺序
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

const CategoryRulePreview = ({
  title,
  rules,
}: {
  title: string;
  rules: MediaRecognitionCategoryRule[];
}) => (
  <div className="overflow-hidden rounded-xl bg-black/[0.018] dark:bg-white/[0.025]">
    <div className="flex items-center justify-between bg-black/[0.02] px-3.5 py-2.5 dark:bg-white/[0.025]">
      <span className="text-xs font-semibold text-neutral-700 dark:text-white/65">
        {title}
      </span>
      <span className="text-[11px] text-neutral-400 dark:text-white/35">
        {rules.length} 个分类
      </span>
    </div>
    <ol className="m-0 list-none p-2">
      {rules.map((rule, index) => (
        <li
          className="flex items-start gap-3 rounded-lg px-2 py-2.5 [&+li]:mt-0.5"
          key={`${index}-${rule.name}`}
        >
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-semibold text-neutral-400 shadow-sm dark:bg-white/8 dark:text-white/40 dark:shadow-none">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-neutral-800 dark:text-white/75">
                {rule.name}
              </span>
              {rule.fallback && (
                <span className="rounded-full bg-neutral-200/70 px-2 py-0.5 text-[10px] font-medium text-neutral-500 dark:bg-white/8 dark:text-white/45">
                  兜底
                </span>
              )}
            </div>
            {!rule.fallback && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {rule.conditions.map((condition) => (
                  <code
                    className="max-w-full truncate rounded-md bg-white px-2 py-1 text-[10px] text-neutral-500 shadow-sm dark:bg-black/20 dark:text-white/50 dark:shadow-none"
                    key={`${condition.field}-${condition.value}`}
                    title={`${condition.field}: ${condition.value}`}
                  >
                    {condition.field}: {condition.value}
                  </code>
                ))}
              </div>
            )}
          </div>
        </li>
      ))}
      {rules.length === 0 && (
        <li className="px-3 py-8 text-center text-xs text-neutral-400 dark:text-white/35">
          暂无分类
        </li>
      )}
    </ol>
  </div>
);

const shadowSnapshotFields: Array<{
  key: keyof MediaRecognitionShadowSnapshot;
  label: string;
}> = [
  { key: 'title', label: '媒体标题' },
  { key: 'original_title', label: '原始标题' },
  { key: 'year', label: '年份' },
  { key: 'media_type', label: '媒体类型' },
  { key: 'category', label: '媒体分类' },
  { key: 'tmdb_id', label: 'TMDB ID' },
  { key: 'season_episode', label: '季集' },
  { key: 'resource_type', label: '资源类型' },
  { key: 'resource_pix', label: '分辨率' },
  { key: 'video_encode', label: '视频编码' },
];

const ShadowEngineCard = ({
  title,
  subtitle,
  snapshot,
  error,
  primary = false,
}: {
  title: string;
  subtitle: string;
  snapshot?: MediaRecognitionShadowSnapshot;
  error?: string;
  primary?: boolean;
}) => (
  <section
    className={cn(
      'rounded-2xl p-4',
      primary
        ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
        : 'bg-neutral-100/80 text-neutral-900 dark:bg-white/[0.055] dark:text-white',
    )}
  >
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h3 className="m-0 text-sm font-semibold">{title}</h3>
        <p
          className={cn(
            'mt-1 mb-0 text-[11px]',
            primary
              ? 'text-white/50 dark:text-neutral-500'
              : 'text-neutral-400 dark:text-white/35',
          )}
        >
          {subtitle}
        </p>
      </div>
      <span
        className={cn(
          'inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-[11px] font-medium',
          primary
            ? 'bg-white/12 text-white dark:bg-neutral-950/8 dark:text-neutral-700'
            : 'bg-violet-50 text-violet-700 dark:bg-violet-400/12 dark:text-violet-200',
        )}
      >
        {primary ? '主结果' : '影子结果'}
      </span>
    </div>

    {snapshot ? (
      <dl className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
        {shadowSnapshotFields.map((field) => (
          <div key={field.key}>
            <dt
              className={cn(
                'text-[10px] font-semibold tracking-[0.08em] uppercase',
                primary
                  ? 'text-white/40 dark:text-neutral-400'
                  : 'text-neutral-400 dark:text-white/35',
              )}
            >
              {field.label}
            </dt>
            <dd className="mt-1 mb-0 break-words text-xs font-medium">
              {field.key === 'media_type'
                ? mediaTypeText(String(snapshot[field.key] || ''))
                : optionalText(snapshot[field.key] as string | number)}
            </dd>
          </div>
        ))}
      </dl>
    ) : (
      <p
        className={cn(
          'm-0 rounded-xl px-3.5 py-3 text-xs leading-5',
          primary
            ? 'bg-white/8 text-red-200 dark:bg-red-500/10 dark:text-red-700'
            : 'bg-red-50 text-red-700 dark:bg-red-400/10 dark:text-red-200',
        )}
      >
        {error || '没有可比较的识别结果'}
      </p>
    )}
  </section>
);

const ShadowComparisonResult = ({
  result,
}: {
  result: MediaRecognitionShadowTestResult;
}) => {
  const comparison = result.comparison;
  const status =
    shadowStatuses[comparison.status] || shadowStatuses.local_error;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-neutral-950 px-2.5 text-xs font-medium text-white dark:bg-white dark:text-neutral-950">
          <GitCompareArrows aria-hidden="true" className="size-3.5" />
          MP2 优先影子对比
        </span>
        <span className={cn(pillClass, status.className)}>{status.label}</span>
        {comparison.status === 'different' && (
          <span className={cn(pillClass, ruleStyles.block)}>
            {comparison.differences.length} 项差异
          </span>
        )}
      </div>

      <p className="mt-0 mb-5 text-xs leading-5 text-neutral-500 dark:text-white/45">
        MP2 先执行并作为对照基准；FilmFusion
        随后使用相同输入与页面草稿运行，影子结果不会替换 MP2。
      </p>

      <div className="grid gap-4 xl:grid-cols-2">
        <ShadowEngineCard
          error={comparison.moviepilot_error}
          primary
          snapshot={comparison.moviepilot}
          subtitle="MoviePilot / MP2 · 权威基准"
          title="MP2 识别"
        />
        <ShadowEngineCard
          error={comparison.local_error}
          snapshot={comparison.local}
          subtitle="FilmFusion · 不影响主结果"
          title="本地识别"
        />
      </div>

      <div className="mt-4 overflow-hidden rounded-xl bg-black/[0.015] dark:bg-white/[0.025]">
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="m-0 text-xs font-semibold text-neutral-800 dark:text-white/75">
            字段差异
          </h3>
          <span className="text-[11px] text-neutral-400 dark:text-white/35">
            {comparison.differences.length} 项
          </span>
        </div>
        {comparison.differences.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[660px] border-collapse text-left text-xs">
              <thead>
                <tr className="text-neutral-400 dark:text-white/35">
                  <th className="w-36 px-4 py-2.5 font-medium">字段</th>
                  <th className="px-4 py-2.5 font-medium">MP2</th>
                  <th className="px-4 py-2.5 font-medium">FilmFusion 本地</th>
                </tr>
              </thead>
              <tbody>
                {comparison.differences.map((difference) => (
                  <tr key={difference.field}>
                    <td className="px-4 py-3 font-medium text-neutral-700 dark:text-white/65">
                      {difference.label}
                    </td>
                    <td className="px-4 py-3 break-all text-neutral-600 dark:text-white/55">
                      {optionalText(difference.moviepilot)}
                    </td>
                    <td className="px-4 py-3 break-all text-neutral-600 dark:text-white/55">
                      {optionalText(difference.local)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="m-0 px-4 pb-4 text-xs text-emerald-700 dark:text-emerald-300">
            {comparison.matched
              ? '已比较的关键字段全部一致。'
              : '当前没有可计算的字段差异，请查看两侧错误信息。'}
          </p>
        )}
      </div>

      <div className="mt-4 space-y-2">
        {result.local && (
          <ResultDisclosure title="FilmFusion 本地识别执行详情">
            <RecognitionResult result={result.local} />
          </ResultDisclosure>
        )}
        {result.moviepilot_raw && (
          <ResultDisclosure title="MP2 原始识别结果">
            <pre className="m-0 max-h-[420px] overflow-auto rounded-lg bg-neutral-950 p-4 text-xs leading-5 whitespace-pre-wrap text-neutral-200 dark:bg-black/35">
              {JSON.stringify(result.moviepilot_raw, null, 2)}
            </pre>
          </ResultDisclosure>
        )}
      </div>
    </div>
  );
};

const RecognitionResult = ({
  result,
}: {
  result: MediaRecognitionTestResult;
}) => {
  const media = result.media_info;
  const meta = result.meta_info;
  const status = tmdbStatuses[result.tmdb_status] || tmdbStatuses.error;
  const artwork = tmdbImageURL(media.poster_path);
  const [copied, setCopied] = useState(false);

  const copyProcessedInput = async () => {
    try {
      await navigator.clipboard.writeText(result.word_result.processed);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 text-xs font-medium text-emerald-700 dark:bg-emerald-400/12 dark:text-emerald-200">
          <CheckCircle2 aria-hidden="true" className="size-3.5" />
          FilmFusion 本地内核
        </span>
        <span className={cn(pillClass, status.className)}>{status.label}</span>
        <span className={cn(pillClass, ruleStyles.block)}>
          {mediaTypeText(media.media_type)}
        </span>
        {media.category && (
          <span className="inline-flex h-6 items-center rounded-full bg-violet-50 px-2.5 text-xs font-medium text-violet-700 dark:bg-violet-400/12 dark:text-violet-200">
            {media.category}
          </span>
        )}
        {media.tmdb_id && (
          <span className="inline-flex h-6 items-center rounded-full bg-blue-50 px-2.5 text-xs font-medium text-blue-700 dark:bg-blue-400/12 dark:text-blue-200">
            TMDB {media.tmdb_id}
          </span>
        )}
      </div>

      {result.warning && (
        <p className="mb-5 flex items-start gap-2 text-xs leading-5 text-amber-700 dark:text-amber-200">
          <TriangleAlert
            aria-hidden="true"
            className="mt-0.5 size-3.5 shrink-0"
          />
          {result.warning}
        </p>
      )}

      <div
        className={cn(
          'grid gap-5',
          artwork && 'sm:grid-cols-[140px_minmax(0,1fr)]',
        )}
      >
        {artwork && (
          <img
            alt={`${media.title} 海报`}
            className="w-[140px] rounded-xl bg-neutral-100 object-cover shadow-sm dark:bg-white/8"
            loading="lazy"
            onError={(event) => {
              event.currentTarget.hidden = true;
            }}
            src={artwork}
          />
        )}

        <div className="min-w-0">
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
            <ResultField label="媒体标题">{media.title}</ResultField>
            <ResultField label="原始标题">
              {optionalText(media.original_title)}
            </ResultField>
            <ResultField label="年份">
              {optionalText(media.year || meta.year)}
            </ResultField>
            <ResultField label="媒体分类">
              {optionalText(media.category_path || media.category)}
            </ResultField>
            <ResultField label="季集">
              {optionalText(meta.season_episode)}
            </ResultField>
            <ResultField label="分辨率">
              {optionalText(meta.resource_pix)}
            </ResultField>
            <ResultField label="资源类型">
              {optionalText(meta.resource_type)}
            </ResultField>
            <ResultField label="流媒体平台">
              {optionalText(meta.web_source)}
            </ResultField>
            <ResultField label="视频编码">
              {[meta.video_encode, meta.video_bit].filter(Boolean).join(' ') ||
                '-'}
            </ResultField>
            <ResultField label="音频编码">
              {optionalText(meta.audio_encode)}
            </ResultField>
            <ResultField label="制作组">
              {optionalText(meta.resource_team)}
            </ResultField>
          </dl>

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            <div>
              <p className="mt-0 mb-2 text-[11px] font-semibold tracking-[0.1em] text-neutral-400 uppercase dark:text-white/35">
                命中识别词
              </p>
              <div className="flex min-h-7 flex-wrap items-center gap-1.5">
                {meta.applied_words.length > 0 ? (
                  meta.applied_words.map((word) => (
                    <code
                      className="rounded-md bg-violet-50 px-2 py-1 text-[11px] text-violet-700 dark:bg-violet-400/12 dark:text-violet-200"
                      key={word}
                    >
                      {word}
                    </code>
                  ))
                ) : (
                  <span className="text-sm text-neutral-400 dark:text-white/35">
                    -
                  </span>
                )}
              </div>
            </div>

            <div>
              <p className="mt-0 mb-2 text-[11px] font-semibold tracking-[0.1em] text-neutral-400 uppercase dark:text-white/35">
                处理后输入
              </p>
              <div className="flex items-start gap-2 rounded-lg bg-neutral-100 px-3 py-2 dark:bg-black/20">
                <code className="min-w-0 flex-1 break-all text-xs leading-5 text-neutral-700 dark:text-white/65">
                  {result.word_result.processed}
                </code>
                <button
                  aria-label="复制处理后输入"
                  className="flex size-6 shrink-0 items-center justify-center rounded-md border-0 bg-transparent text-neutral-400 hover:bg-black/5 hover:text-neutral-800 dark:hover:bg-white/8 dark:hover:text-white"
                  onClick={() => void copyProcessedInput()}
                  type="button"
                >
                  {copied ? (
                    <Check aria-hidden="true" className="size-3.5" />
                  ) : (
                    <Clipboard aria-hidden="true" className="size-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {media.overview && (
            <p className="mt-5 mb-0 text-sm leading-6 text-neutral-500 dark:text-white/45">
              {media.overview}
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 space-y-2">
        <ResultDisclosure
          title={`识别词执行轨迹（${result.word_result.steps.length}）`}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-xs">
              <thead>
                <tr className="text-neutral-400 dark:text-white/35">
                  <th className="w-16 px-3 py-2.5 font-medium">行</th>
                  <th className="px-3 py-2.5 font-medium">规则</th>
                  <th className="w-24 px-3 py-2.5 font-medium">结果</th>
                  <th className="px-3 py-2.5 font-medium">处理后</th>
                </tr>
              </thead>
              <tbody>
                {result.word_result.steps.map((step) => (
                  <tr key={`${step.line}-${step.rule}`}>
                    <td className="px-3 py-3 text-neutral-400 dark:text-white/35">
                      {step.line}
                    </td>
                    <td className="px-3 py-3">
                      <code className="text-neutral-700 dark:text-white/65">
                        {step.rule}
                      </code>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          pillClass,
                          step.error
                            ? 'bg-red-50 text-red-700 dark:bg-red-400/12 dark:text-red-200'
                            : step.applied
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/12 dark:text-emerald-200'
                              : 'bg-neutral-100 text-neutral-500 dark:bg-white/8 dark:text-white/50',
                        )}
                      >
                        {step.error
                          ? '失败'
                          : step.applied
                            ? '已应用'
                            : '未命中'}
                      </span>
                    </td>
                    <td className="max-w-[520px] truncate px-3 py-3 font-mono text-neutral-500 dark:text-white/45">
                      {step.after}
                    </td>
                  </tr>
                ))}
                {result.word_result.steps.length === 0 && (
                  <tr>
                    <td
                      className="px-3 py-8 text-center text-neutral-400 dark:text-white/35"
                      colSpan={4}
                    >
                      没有执行识别词
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </ResultDisclosure>

        <ResultDisclosure title={`TMDB 候选（${result.candidates.length}）`}>
          <CandidateTable candidates={result.candidates} />
        </ResultDisclosure>

        <ResultDisclosure title="兼容原始结果">
          <pre className="m-0 max-h-[420px] overflow-auto rounded-lg bg-neutral-950 p-4 text-xs leading-5 whitespace-pre-wrap text-neutral-200 dark:bg-black/35">
            {JSON.stringify(result.raw, null, 2)}
          </pre>
        </ResultDisclosure>
      </div>
    </div>
  );
};

const ResultField = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <div>
    <dt className="text-[11px] font-semibold tracking-[0.1em] text-neutral-400 uppercase dark:text-white/35">
      {label}
    </dt>
    <dd className="mt-1 mb-0 text-sm font-medium text-neutral-800 dark:text-white/75">
      {children}
    </dd>
  </div>
);

const ResultDisclosure = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => (
  <details className="group rounded-xl bg-black/[0.015] open:bg-transparent dark:bg-white/[0.025]">
    <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-xs font-medium text-neutral-700 outline-none select-none focus-visible:ring-2 focus-visible:ring-black/10 [&::-webkit-details-marker]:hidden dark:text-white/65 dark:focus-visible:ring-white/20">
      {title}
      <ChevronDown
        aria-hidden="true"
        className="size-4 text-neutral-400 transition-transform group-open:rotate-180 dark:text-white/35"
      />
    </summary>
    <div className="p-3">{children}</div>
  </details>
);

const RuleTable = ({ rules }: { rules: MediaRecognitionRule[] }) => (
  <div className="mt-3 overflow-x-auto rounded-xl bg-black/[0.012] dark:bg-white/[0.018]">
    <table className="w-full min-w-[720px] border-collapse text-left text-xs">
      <thead>
        <tr className="bg-black/[0.018] text-neutral-400 dark:bg-white/[0.025] dark:text-white/35">
          <th className="w-16 px-3 py-2.5 font-medium">行</th>
          <th className="w-36 px-3 py-2.5 font-medium">类型</th>
          <th className="px-3 py-2.5 font-medium">规则</th>
        </tr>
      </thead>
      <tbody>
        {rules.map((rule) => (
          <tr key={`${rule.line}-${rule.raw}`}>
            <td className="px-3 py-3 text-neutral-400 dark:text-white/35">
              {rule.line}
            </td>
            <td className="px-3 py-3">
              <span
                className={cn(
                  pillClass,
                  rule.valid
                    ? ruleStyles[rule.type]
                    : 'bg-red-50 text-red-700 dark:bg-red-400/12 dark:text-red-200',
                )}
              >
                {rule.type_label}
              </span>
            </td>
            <td className="px-3 py-3">
              <code className="break-all text-neutral-700 dark:text-white/65">
                {rule.raw}
              </code>
              {!rule.valid && (
                <p className="mt-1 mb-0 text-[11px] text-red-600 dark:text-red-300">
                  {rule.error}
                </p>
              )}
            </td>
          </tr>
        ))}
        {rules.length === 0 && (
          <tr>
            <td
              className="px-3 py-10 text-center text-neutral-400 dark:text-white/35"
              colSpan={3}
            >
              暂无识别词
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);

const CandidateTable = ({
  candidates,
}: {
  candidates: MediaRecognitionCandidate[];
}) => (
  <div className="overflow-x-auto">
    <table className="w-full min-w-[720px] border-collapse text-left text-xs">
      <thead>
        <tr className="text-neutral-400 dark:text-white/35">
          <th className="px-3 py-2.5 font-medium">标题</th>
          <th className="w-20 px-3 py-2.5 font-medium">年份</th>
          <th className="w-24 px-3 py-2.5 font-medium">类型</th>
          <th className="w-28 px-3 py-2.5 font-medium">分类</th>
          <th className="w-24 px-3 py-2.5 font-medium">TMDB</th>
          <th className="w-24 px-3 py-2.5 font-medium">匹配分</th>
        </tr>
      </thead>
      <tbody>
        {candidates.map((candidate) => (
          <tr key={`${candidate.media_type}-${candidate.tmdb_id}`}>
            <td className="px-3 py-3 font-medium text-neutral-800 dark:text-white/75">
              {candidate.title}
            </td>
            <td className="px-3 py-3 text-neutral-500 dark:text-white/45">
              {optionalText(candidate.year)}
            </td>
            <td className="px-3 py-3 text-neutral-500 dark:text-white/45">
              {mediaTypeText(candidate.media_type)}
            </td>
            <td className="px-3 py-3 text-neutral-500 dark:text-white/45">
              {optionalText(candidate.category)}
            </td>
            <td className="px-3 py-3 font-mono text-neutral-500 dark:text-white/45">
              {optionalText(candidate.tmdb_id)}
            </td>
            <td className="px-3 py-3">
              <span
                className={cn(
                  pillClass,
                  candidate.score >= 90
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/12 dark:text-emerald-200'
                    : 'bg-neutral-100 text-neutral-500 dark:bg-white/8 dark:text-white/50',
                )}
              >
                {candidate.score}
              </span>
            </td>
          </tr>
        ))}
        {candidates.length === 0 && (
          <tr>
            <td
              className="px-3 py-8 text-center text-neutral-400 dark:text-white/35"
              colSpan={6}
            >
              没有候选结果
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);

export default MediaRecognitionPage;
