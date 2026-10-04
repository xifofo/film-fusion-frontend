import { Button, Radio } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { organize115Cookie } from '@/services/film-fusion';
import { canApplyUpgrade } from '@/services/film-fusion/upgrade';
import UpgradeComparison from './UpgradeComparison';

type ExecutionEngine = 'moviepilot' | 'medianame' | 'local';
export const organizeEngineLabel = (source: ExecutionEngine) =>
  source === 'medianame'
    ? 'medianame'
    : source === 'local'
      ? '旧本地引擎'
      : 'MP2';

type Plan = {
  params: API.Organize115CookieParams;
  result: API.Organize115CookieResult;
};
export type OrganizeEngineChoice = {
  source: ExecutionEngine;
  loading: boolean;
  params?: API.Organize115CookieParams;
};

function executionEngine(result: API.Organize115CookieResult): ExecutionEngine {
  const source = result.pipeline?.source || result.recognition_source;
  return source === 'medianame' || source === 'local' ? source : 'moviepilot';
}

function selectedPlanItems(plan: Plan) {
  const selected = new Set(plan.params.file_ids || []);
  const grouped = plan.result.groups?.flatMap((group) => group.items || []);
  const items = grouped?.length ? grouped : plan.result.items || [];
  return items.filter(
    (item) =>
      !selected.size ||
      selected.has(item.file_id) ||
      (item.is_subtitle && selected.has(item.matched_video_file_id || '')),
  );
}

function planError(plan: Plan): string | undefined {
  if (!plan.result.plan_id || !plan.result.pipeline || !plan.result.dry_run)
    return '缺少有效预览计划，请重新预览';
  const items = selectedPlanItems(plan);
  const found = new Set(items.map((item) => item.file_id));
  if (!items.length || plan.params.file_ids?.some((id) => !found.has(id)))
    return '所选文件未全部出现在新预览中，请重新核对选择';
  const failed = items.find((item) => item.error || !item.target_path);
  if (failed) return `${failed.file_name}：${failed.error || '未生成目标路径'}`;
  const blocked = items.find((item) => !canApplyUpgrade(item));
  if (blocked)
    return `${blocked.file_name}：${blocked.upgrade?.reason}，请重新核对选择`;
  const targets = new Set<string>();
  for (const item of items) {
    if (targets.has(item.target_path || ''))
      return '多个文件指向同一目标，请重新预览';
    targets.add(item.target_path || '');
  }
  return undefined;
}

export default function OrganizeEngineConfirmation({
  params,
  preview,
  onChange,
}: {
  params: API.Organize115CookieParams;
  preview: API.Organize115CookieResult;
  onChange: (choice: OrganizeEngineChoice) => void;
}) {
  const initial: Plan = { params, result: preview };
  const initialEngine = executionEngine(preview);
  const [source, setSource] = useState(initialEngine);
  const [plan, setPlan] = useState<Plan | undefined>(initial);
  const [error, setError] = useState(() => planError(initial));
  const [loading, setLoading] = useState(false);
  const generation = useRef(0);
  const plans = useRef(
    new Map<ExecutionEngine, Plan>([[initialEngine, initial]]),
  );

  useEffect(() => {
    const original = { params, result: preview };
    onChange({
      source: executionEngine(preview),
      loading: false,
      params: planError(original) ? undefined : params,
    });
    return () => {
      generation.current++;
    };
  }, [params, preview, onChange]);

  const chooseEngine = async (next: ExecutionEngine, refresh = false) => {
    const current = ++generation.current;
    setSource(next);
    setError(undefined);
    const cached = refresh ? undefined : plans.current.get(next);
    if (cached) {
      const failure = planError(cached);
      setPlan(cached);
      setLoading(false);
      setError(failure);
      onChange({
        source: next,
        loading: false,
        params: failure ? undefined : cached.params,
      });
      return;
    }
    setPlan(undefined);
    setLoading(true);
    onChange({ source: next, loading: true });
    try {
      // A different engine creates a fresh, server-owned plan. Nothing is executed
      // by this request, and the old plan remains available if the user switches back.
      const {
        plan_id: _planID,
        delete_source_folder: _deleteSource,
        ...input
      } = params;
      const response = await organize115Cookie({
        ...input,
        recognition_source: next,
        dry_run: true,
      });
      if (current !== generation.current) return;
      if (response.code !== 0 || !response.data)
        throw new Error(response.message || '生成所选引擎的预览失败');
      if (
        response.data.pipeline?.source !== next ||
        response.data.recognition_source !== next
      )
        throw new Error('预览返回的引擎不一致，请重新预览');
      const ready: Plan = {
        result: response.data,
        params: {
          ...params,
          plan_id: response.data.plan_id,
          recognition_source: response.data.recognition_source,
        },
      };
      const failure = planError(ready);
      plans.current.set(next, ready);
      setPlan(ready);
      setError(failure);
      onChange({
        source: next,
        loading: false,
        params: failure ? undefined : ready.params,
      });
    } catch (cause) {
      if (current !== generation.current) return;
      setError(cause instanceof Error ? cause.message : '生成预览失败');
      onChange({ source: next, loading: false });
    } finally {
      if (current === generation.current) setLoading(false);
    }
  };

  return (
    <section aria-label="选择整理引擎" className="space-y-3">
      <fieldset>
        <legend className="mb-2 font-semibold">
          {params.dry_run ? '本次预览引擎' : '本次实际整理引擎'}
        </legend>
        <Radio.Group
          name="confirm-organize-engine"
          value={source}
          options={[
            { label: 'MP2', value: 'moviepilot' },
            { label: 'medianame', value: 'medianame' },
            ...(initialEngine === 'local'
              ? [{ label: '旧本地引擎（兼容）', value: 'local' }]
              : []),
          ]}
          onChange={(event) => void chooseEngine(event.target.value)}
        />
      </fieldset>
      <p className="text-sm text-neutral-500">
        切换引擎会重新生成已选文件的预览。请核对下方路径后确认，仅影响本次整理。
      </p>
      {loading && (
        <output className="block">
          正在生成 {organizeEngineLabel(source)} 预览…
        </output>
      )}
      {error && (
        <div>
          <p role="alert" className="text-red-600">
            {error}
          </p>
          <Button size="small" onClick={() => void chooseEngine(source, true)}>
            重新生成预览
          </Button>
        </div>
      )}
      {plan && (
        <div className="max-h-64 overflow-auto rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
          <p className="mb-2 font-semibold">
            {organizeEngineLabel(source)} 的目标路径
          </p>
          <ul className="space-y-3 text-sm">
            {selectedPlanItems(plan).map((item) => (
              <li key={item.file_id} className="break-all">
                <div className="text-neutral-500">{item.file_name}</div>
                <div>{item.error || item.target_path || '未生成路径'}</div>
                {item.upgrade && <UpgradeComparison decision={item.upgrade} />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
