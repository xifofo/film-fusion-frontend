import { CopyOutlined, SearchOutlined } from '@ant-design/icons';
import { Alert, App, Button, Input, Tag } from 'antd';
import { useEffect, useRef, useState } from 'react';
import ConsolePage from '@/components/ConsolePage';
import {
  checkEmbyLibrary,
  type EmbyLibraryCheckItem,
  type EmbyLibraryCheckResult,
  type EmbyLibraryCheckStatus,
} from '@/services/film-fusion/embyLibraryCheck';
import FolderMoveModal from './FolderMoveModal';

const MAX_NAMES = 200;
const statuses: EmbyLibraryCheckStatus[] = [
  'found',
  'possible',
  'missing',
  'error',
];
const statusMeta = {
  found: { label: '已入库', color: 'success', description: '名称精确匹配' },
  possible: {
    label: '疑似匹配',
    color: 'warning',
    description: '请核对候选内容',
  },
  missing: { label: '未找到', color: 'default', description: '未找到匹配内容' },
  error: {
    label: '查询失败',
    color: 'error',
    description: '暂时无法确认入库状态',
  },
} as const;

const inputNames = (input: string) =>
  input
    .split(/\r\n|\n|\r/)
    .map((name) => name.trim())
    .filter(Boolean);

function getErrorMessage(error: unknown) {
  const detail = error as {
    response?: { data?: { message?: string } };
    message?: string;
  };
  return detail?.response?.data?.message || detail?.message || '请稍后重试';
}

function safeEmbyUrl(value?: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

function ResultItem({
  item,
  stale,
  movedPath,
  onMove,
}: {
  item: EmbyLibraryCheckItem;
  stale: boolean;
  movedPath?: string;
  onMove: () => void;
}) {
  const status = statusMeta[item.status];
  return (
    <li className="grid min-w-0 gap-3 border-t border-neutral-100 px-4 py-4 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] sm:gap-6 sm:px-5 dark:border-white/10">
      <div className="min-w-0">
        <div className="mb-1.5 flex flex-wrap items-start gap-2">
          <span className="min-w-0 font-medium break-words text-neutral-950 dark:text-white">
            {item.name || item.original_name}
          </span>
          <Tag color={status.color} className="shrink-0">
            {status.label}
          </Tag>
        </div>
        {item.original_name !== item.name && (
          <p className="m-0 text-xs break-all text-neutral-500 dark:text-white/45">
            原始名称：{item.original_name}
          </p>
        )}
        {item.status === 'missing' && (
          <div className="mt-3 space-y-2">
            <Button size="small" disabled={stale} onClick={onMove}>
              {movedPath ? '继续移入文件' : '创建文件夹并移入'}
            </Button>
            {movedPath && (
              <p className="m-0 text-xs break-all text-emerald-700 dark:text-emerald-400">
                文件已移入：{movedPath}。Emby 入库状态需重新查询。
              </p>
            )}
          </div>
        )}
      </div>
      <div className="min-w-0">
        {item.status === 'error' ? (
          <p className="m-0 text-sm break-words text-red-600 dark:text-red-400">
            {item.error || status.description}
          </p>
        ) : item.matches.length > 0 ? (
          <div className="space-y-3">
            {item.matches.map((match) => (
              <div key={match.id} className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
                  <span className="font-medium break-words text-neutral-800 dark:text-white/90">
                    {match.name}
                  </span>
                  <span className="text-xs text-neutral-500 dark:text-white/45">
                    {match.type === 'Movie'
                      ? '电影'
                      : match.type === 'Series'
                        ? '剧集'
                        : match.type}
                    {match.year ? ` · ${match.year}` : ''}
                  </span>
                  {safeEmbyUrl(match.emby_url) &&
                    (stale ? (
                      <span className="text-xs text-neutral-400 dark:text-white/30">
                        在 Emby 打开
                      </span>
                    ) : (
                      <a
                        href={safeEmbyUrl(match.emby_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`在 Emby 打开：${match.name}`}
                        className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                      >
                        在 Emby 打开
                      </a>
                    ))}
                </div>
                {match.path && (
                  <p className="mt-1 mb-0 text-xs break-all text-neutral-500 dark:text-white/45">
                    {match.path}
                  </p>
                )}
              </div>
            ))}
            {item.status === 'possible' && (
              <p className="m-0 text-xs text-amber-700 dark:text-amber-400">
                {item.truncated
                  ? '候选过多，请缩小名称范围。'
                  : '名称未精确匹配，请核对上方候选内容。'}
              </p>
            )}
          </div>
        ) : (
          <p className="m-0 text-sm text-neutral-500 dark:text-white/45">
            {item.status === 'possible' && item.truncated
              ? '候选过多，请缩小名称范围。'
              : status.description}
          </p>
        )}
      </div>
    </li>
  );
}

export default function EmbyLibraryCheckPage() {
  const { message } = App.useApp();
  const [input, setInput] = useState('');
  const [result, setResult] = useState<EmbyLibraryCheckResult | null>(null);
  const [submittedInput, setSubmittedInput] = useState('');
  const [filter, setFilter] = useState<EmbyLibraryCheckStatus | 'all'>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [moveItem, setMoveItem] = useState<EmbyLibraryCheckItem | null>(null);
  const [movedPaths, setMovedPaths] = useState<Record<string, string>>({});
  const request = useRef<AbortController | null>(null);
  const names = inputNames(input);
  const inputKey = JSON.stringify(names);
  const stale = result !== null && submittedInput !== inputKey;
  const overLimit = names.length > MAX_NAMES;
  const counts = { found: 0, possible: 0, missing: 0, error: 0 };
  for (const item of result?.results || []) counts[item.status]++;
  const visibleResults = result?.results.filter(
    (item) => filter === 'all' || item.status === filter,
  );

  useEffect(() => () => request.current?.abort(), []);

  const check = async () => {
    if (loading || names.length === 0 || overLimit) return;
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError('');
    setResult(null);
    setMovedPaths({});
    setSubmittedInput(inputKey);
    setFilter('all');
    try {
      const response = await checkEmbyLibrary(names, controller.signal);
      if (controller.signal.aborted) return;
      if (response.code !== 0 || !response.data) {
        setError(response.message || '没有收到有效的查询结果');
        return;
      }
      setResult(response.data);
    } catch (failure) {
      if (!controller.signal.aborted) setError(getErrorMessage(failure));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  const clear = () => {
    setInput('');
    setResult(null);
    setError('');
    setFilter('all');
    setMovedPaths({});
  };

  const copyMissing = async () => {
    if (!result || stale || counts.missing === 0) return;
    const text = result.results
      .filter((item) => item.status === 'missing')
      .map((item) => item.name)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      void message.success(`已复制 ${counts.missing} 个未找到的名称`);
    } catch {
      void message.error(
        '复制失败，请检查浏览器剪贴板权限，或从结果中手动复制',
      );
    }
  };

  return (
    <ConsolePage eyebrow="Emby tools" title="批量查入库">
      <div className="mb-5 rounded-xl border border-neutral-200/80 bg-white p-4 sm:p-5 dark:border-white/10 dark:bg-white/3">
        <label
          htmlFor="emby-library-names"
          className="mb-2 block text-sm font-medium text-neutral-900 dark:text-white/90"
        >
          粘贴媒体名称
        </label>
        <p
          id="emby-library-hint"
          className="mt-0 mb-4 text-sm leading-6 text-neutral-500 dark:text-white/50"
        >
          每行一个名称，最多 {MAX_NAMES} 行。自动移除 .mkv、.mp4、.strm
          等常见文件后缀并去重，查询当前配置的 Emby 服务器中的电影和剧集。
        </p>
        <Input.TextArea
          id="emby-library-names"
          aria-describedby="emby-library-hint emby-library-count"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={'星际穿越.mkv\n流浪地球 2.mp4\n漫长的季节'}
          rows={7}
          status={overLimit ? 'error' : undefined}
          style={{ resize: 'vertical', minHeight: 150 }}
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <span
            id="emby-library-count"
            className={`text-xs ${overLimit ? 'text-red-600 dark:text-red-400' : 'text-neutral-500 dark:text-white/45'}`}
          >
            {names.length} / {MAX_NAMES} 行
            {overLimit ? '，请减少名称后再查询' : '（忽略空行）'}
          </span>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={loading || (!input && !result && !error)}
              onClick={clear}
            >
              清空
            </Button>
            <Button
              type="primary"
              icon={<SearchOutlined aria-hidden="true" />}
              loading={loading}
              disabled={names.length === 0 || overLimit}
              onClick={check}
            >
              {loading ? '正在查询' : '开始查询'}
            </Button>
          </div>
        </div>
      </div>

      {loading && (
        <Alert
          className="mb-5"
          showIcon
          type="info"
          title="正在查询 Emby 媒体库"
          description="批量查询可能需要一些时间，请保持页面打开。查询期间修改输入不会改变本次查询的名称。"
        />
      )}
      {error && (
        <Alert
          className="mb-5"
          showIcon
          type="error"
          title="批量查询失败"
          description={error}
        />
      )}
      {stale && (
        <Alert
          className="mb-5"
          showIcon
          type="warning"
          title="名称已修改，下方是上一次查询结果"
          description="请重新查询以匹配当前输入，查询完成前无法复制未找到的名称。"
        />
      )}

      {result ? (
        <section aria-label="入库查询结果" className="min-w-0">
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {statuses.map((status) => (
              <div
                key={status}
                className="rounded-xl border border-neutral-200/80 bg-white p-4 dark:border-white/10 dark:bg-white/3"
              >
                <div className="mb-2 text-xs text-neutral-500 dark:text-white/50">
                  {statusMeta[status].label}
                </div>
                <div className="text-2xl font-semibold tabular-nums text-neutral-950 dark:text-white">
                  {counts[status]}
                </div>
                <div className="mt-1 text-xs text-neutral-500 dark:text-white/40">
                  {statusMeta[status].description}
                </div>
              </div>
            ))}
          </div>
          <div className="overflow-hidden rounded-xl border border-neutral-200/80 bg-white dark:border-white/10 dark:bg-white/3">
            <div className="space-y-3 px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="m-0 text-base font-semibold text-neutral-900 dark:text-white">
                    查询结果
                  </h2>
                  <p className="mt-1 mb-0 text-xs text-neutral-500 dark:text-white/45">
                    共查询 {result.total} 个名称
                    {result.duplicates_removed > 0
                      ? `，已合并 ${result.duplicates_removed} 个重复名称`
                      : ''}
                  </p>
                </div>
                <Button
                  icon={<CopyOutlined aria-hidden="true" />}
                  disabled={stale || counts.missing === 0}
                  onClick={copyMissing}
                >
                  复制未找到的名称
                </Button>
              </div>
              <fieldset
                aria-label="按入库状态筛选"
                className="m-0 flex min-w-0 flex-wrap gap-2 border-0 p-0"
              >
                <Button
                  size="small"
                  type={filter === 'all' ? 'primary' : 'default'}
                  aria-pressed={filter === 'all'}
                  onClick={() => setFilter('all')}
                >
                  全部 {result.total}
                </Button>
                {statuses.map((status) => (
                  <Button
                    key={status}
                    size="small"
                    type={filter === status ? 'primary' : 'default'}
                    aria-pressed={filter === status}
                    onClick={() => setFilter(status)}
                  >
                    {statusMeta[status].label} {counts[status]}
                  </Button>
                ))}
              </fieldset>
            </div>
            {visibleResults?.length ? (
              <ul className="m-0 list-none border-t border-neutral-100 p-0 dark:border-white/10">
                {visibleResults.map((item, index) => (
                  <ResultItem
                    key={`${item.name}:${index}`}
                    item={item}
                    stale={stale}
                    movedPath={movedPaths[item.name]}
                    onMove={() => setMoveItem(item)}
                  />
                ))}
              </ul>
            ) : (
              <p className="m-0 border-t border-neutral-100 px-4 py-10 text-center text-sm text-neutral-500 dark:border-white/10 dark:text-white/45">
                当前筛选下没有结果
              </p>
            )}
          </div>
        </section>
      ) : !loading && !error ? (
        <div className="rounded-xl border border-dashed border-neutral-200 px-4 py-12 text-center dark:border-white/15">
          <SearchOutlined
            aria-hidden="true"
            className="mb-3 text-2xl text-neutral-400 dark:text-white/30"
          />
          <p className="m-0 text-sm text-neutral-600 dark:text-white/60">
            粘贴名称后开始查询
          </p>
          <p className="mt-2 mb-0 text-xs text-neutral-400 dark:text-white/40">
            结果会区分已入库、疑似匹配、未找到和查询失败。
          </p>
        </div>
      ) : null}
      {moveItem && (
        <FolderMoveModal
          item={moveItem}
          stale={stale || loading || !result}
          onClose={() => setMoveItem(null)}
          onMoved={(path) =>
            setMovedPaths((previous) => ({
              ...previous,
              [moveItem.name]: path,
            }))
          }
        />
      )}
    </ConsolePage>
  );
}
