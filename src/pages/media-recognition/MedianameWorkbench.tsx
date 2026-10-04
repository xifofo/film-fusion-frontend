import { App, Button, Input, Segmented, Switch } from 'antd';
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

export type MedianameConfig = {
  category_yaml: string;
  movie_template: string;
  tv_template: string;
  version: string;
};
type ConfigView = {
  config: MedianameConfig;
  package_version: string;
  movie_variables: Record<string, unknown>;
  tv_variables: Record<string, unknown>;
};
type PipelineResult = {
  pipeline: API.MediaPipelineSnapshot;
  item: API.Organize115ItemResult;
};
export const medianameStatusLabels: Record<string, string> = {
  compatible: '可采用',
  review: '需要复核',
  ambiguous: '候选有歧义',
  not_identified: '未识别',
  request_error: '请求错误',
};
export function PipelineDiagnostics({
  item,
}: {
  item: API.Organize115ItemResult;
}) {
  const other = item.shadow_comparison?.medianame;
  const preferred = other || item;
  const evidence = preferred.medianame;
  const rows: Array<[string, string, string]> = [
    ['媒体类型', preferred.media_type || '', item.media_type || ''],
    ['TMDB ID', preferred.tmdb_id || '', item.tmdb_id || ''],
    ['标题', preferred.title || '', item.title || ''],
    ['年份', preferred.year || '', item.year || ''],
    ['季集', preferred.season_episode || '', item.season_episode || ''],
    ['分类', preferred.category || '', item.category || ''],
    ['目标文件名', preferred.rename_to || '', item.rename_to || ''],
    ['完整目标路径', preferred.target_path || '', item.target_path || ''],
    ['失败原因', preferred.error || '', item.error || ''],
  ];
  return (
    <div className="space-y-3">
      {evidence?.result?.status && (
        <output className="block">
          medianame：
          {medianameStatusLabels[evidence.result.status] ||
            evidence.result.status}{' '}
          ({evidence.result.status})
        </output>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th className="p-2">字段</th>
              <th>
                {other || evidence || item.engine === 'medianame'
                  ? 'medianame'
                  : item.engine === 'local'
                    ? '旧本地'
                    : 'MP2'}
              </th>
              {other && <th>MP2 / 对照</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, a, b]) => (
              <tr
                key={label}
                className="border-t border-neutral-200 dark:border-neutral-700"
              >
                <th scope="row" className="p-2 align-top font-normal">
                  {label}
                </th>
                <td className="break-all p-2 align-top">{a || '—'}</td>
                {other && (
                  <td className="break-all p-2 align-top">{b || '—'}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details>
        <summary>解析、完整候选、冲突、选择依据与命名变量</summary>
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all text-xs">
          {JSON.stringify(
            {
              medianame: evidence,
              variables: preferred.rename_context,
              mp2: item.recognition_raw,
            },
            null,
            2,
          )}
        </pre>
      </details>
    </div>
  );
}
export default function MedianameWorkbench() {
  const { message } = App.useApp();
  const [view, setView] = useState<ConfigView>();
  const [draft, setDraft] = useState<MedianameConfig>();
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState('medianame');
  const [mode, setMode] = useState('file');
  const [input, setInput] = useState(
    '/downloads/Example (2024) [tmdb=123]/Season 0/01.mkv',
  );
  const [root, setRoot] = useState('影视');
  const [category, setCategory] = useState('');
  const [classify, setClassify] = useState(true);
  const [result, setResult] = useState<PipelineResult>();
  const [preview, setPreview] = useState<unknown>();
  useEffect(() => {
    let active = true;
    apiClient
      .get<API.Response<ConfigView>>('/api/media-recognition/medianame-config')
      .then((response) => {
        if (!active) return;
        if (response.code !== 0 || !response.data)
          throw new Error(response.message || '加载 medianame 配置失败');
        setView(response.data);
        setDraft(response.data.config);
      })
      .catch((error: Error) => {
        if (active) void message.error(error.message);
      });
    return () => {
      active = false;
    };
  }, [message]);
  const run = async (action: 'save' | 'validate' | 'test') => {
    if (!draft) return;
    setBusy(true);
    try {
      if (action === 'test') {
        const response = await apiClient.post<API.Response<PipelineResult>>(
          '/api/media-recognition/pipeline-test',
          {
            input,
            mode,
            source,
            root,
            category,
            classify,
            medianame_config: draft,
          },
        );
        if (response.code !== 0 || !response.data)
          throw new Error(response.message || '流程预览失败');
        setResult(response.data);
      } else if (action === 'save') {
        const response = await apiClient.put<API.Response<MedianameConfig>>(
          '/api/media-recognition/medianame-config',
          draft,
        );
        if (response.code !== 0 || !response.data)
          throw new Error(response.message || '保存失败');
        setDraft(response.data);
        void message.success('已保存 medianame 独立配置');
      } else {
        const response = await apiClient.post<API.Response<unknown>>(
          '/api/media-recognition/medianame-config/validate',
          draft,
        );
        if (response.code !== 0)
          throw new Error(response.message || '校验失败');
        setPreview(response.data);
        void message.success('分类与 Go 模板校验通过');
      }
    } catch (error) {
      void message.error(error instanceof Error ? error.message : '请求失败');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      className="space-y-4 rounded-2xl bg-white/80 p-5 dark:bg-white/5"
      aria-label="medianame 完整流程"
    >
      <h2 className="text-lg font-semibold">
        medianame {view?.package_version} · 独立配置与完整流程对比
      </h2>
      <p>
        MP2 使用下方原有分类和 Jinja 模板。medianame 使用这里的分类与 Go
        text/template，保存不会切换默认引擎。
      </p>
      <p>
        最终路径：媒体库根目录 / 分类目录（按开关） /
        模板输出。模板负责媒体目录和季目录，不能引用 category。
      </p>
      {draft && (
        <>
          <label className="block" htmlFor="mn-category">
            medianame 分类规则（YAML）
            <Input.TextArea
              id="mn-category"
              aria-label="medianame 分类规则"
              value={draft.category_yaml}
              onChange={(e) =>
                setDraft({ ...draft, category_yaml: e.target.value })
              }
              autoSize={{ minRows: 5, maxRows: 15 }}
            />
          </label>
          <label className="block" htmlFor="mn-movie">
            medianame 电影模板（Go）
            <Input.TextArea
              id="mn-movie"
              aria-label="medianame 电影模板"
              value={draft.movie_template}
              onChange={(e) =>
                setDraft({ ...draft, movie_template: e.target.value })
              }
              autoSize={{ minRows: 2, maxRows: 6 }}
            />
          </label>
          <label className="block" htmlFor="mn-tv">
            medianame 剧集模板（Go）
            <Input.TextArea
              id="mn-tv"
              aria-label="medianame 剧集模板"
              value={draft.tv_template}
              onChange={(e) =>
                setDraft({ ...draft, tv_template: e.target.value })
              }
              autoSize={{ minRows: 2, maxRows: 6 }}
            />
          </label>
          <details>
            <summary>Go 模板变量说明与示例</summary>
            <p>
              使用 {'{{.title}}'}、{'{{if .season_fmt}}…{{end}}'}。season 可以是
              0；season_episode 保留特殊季、多集及范围。episode_title /
              episode_date 按需查询 TMDB；total_episodes / season_year
              来自所选季。
            </p>
            <pre className="max-h-80 overflow-auto text-xs">
              {JSON.stringify(
                { movie: view?.movie_variables, tv: view?.tv_variables },
                null,
                2,
              )}
            </pre>
          </details>
          <div className="flex gap-3">
            <Button loading={busy} onClick={() => void run('validate')}>
              校验并预览 medianame 模板
            </Button>
            <Button
              type="primary"
              loading={busy}
              onClick={() => void run('save')}
            >
              保存 medianame 配置
            </Button>
          </div>
          {preview != null && (
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all text-xs">
              {JSON.stringify(preview, null, 2)}
            </pre>
          )}
        </>
      )}
      <h3 className="font-semibold">识别 → 分类 → 命名 → 完整目标路径</h3>
      <Segmented
        value={source}
        onChange={setSource}
        options={[
          { label: 'medianame', value: 'medianame' },
          { label: '影子对比', value: 'shadow' },
          { label: 'MP2', value: 'moviepilot' },
          { label: '系统默认', value: '' },
        ]}
      />
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { label: '文件路径', value: 'file' },
          { label: '发布标题', value: 'title' },
        ]}
      />
      <Input.TextArea
        aria-label="完整流程识别输入"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        autoSize={{ minRows: 2, maxRows: 5 }}
      />
      <div className="flex flex-wrap gap-3">
        <label htmlFor="mn-root">
          媒体库根目录
          <Input
            id="mn-root"
            value={root}
            onChange={(e) => setRoot(e.target.value)}
          />
        </label>
        <label htmlFor="mn-override-category">
          手动分类（可留空）
          <Input
            id="mn-override-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2" htmlFor="mn-classify">
          按分类建目录
          <Switch id="mn-classify" checked={classify} onChange={setClassify} />
        </label>
      </div>
      <Button type="primary" loading={busy} onClick={() => void run('test')}>
        预览完整流程
      </Button>
      <p className="text-sm text-neutral-500">
        使用已保存的识别词、MP2 配置及上方 medianame 草稿。优先展示 medianame
        结果；实际整理引擎在整理页确认时选择。
      </p>
      {result && (
        <>
          <p>
            固定模式：{result.pipeline.source} ·{' '}
            {result.pipeline.package_version} · 配置{' '}
            {result.pipeline.config_version.slice(0, 12)}
          </p>
          <PipelineDiagnostics item={result.item} />
        </>
      )}
    </section>
  );
}
