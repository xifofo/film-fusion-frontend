/** 核对并执行服务器保存的整理计划；重新预览只更新计划，不执行文件操作。 */

import { Button } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { organize115Cookie } from '@/services/film-fusion';
import { canApplyUpgrade } from '@/services/film-fusion/upgrade';
import MedianameCandidatePicker, {
  medianameCandidates,
} from './MedianameCandidatePicker';
import UpgradeComparison from './UpgradeComparison';

type ExecutionEngine = 'medianame';

type Plan = {
  params: API.Organize115CookieParams;
  result: API.Organize115CookieResult;
};
export type OrganizePlanChoice = {
  source: ExecutionEngine;
  loading: boolean;
  params?: API.Organize115CookieParams;
};

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
  if (
    !plan.result.plan_id ||
    !plan.result.pipeline ||
    !plan.result.dry_run ||
    plan.result.pipeline.source !== 'medianame' ||
    plan.result.recognition_source !== 'medianame'
  )
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

export default function OrganizePlanConfirmation({
  params,
  preview,
  onChange,
}: {
  params: API.Organize115CookieParams;
  preview: API.Organize115CookieResult;
  onChange: (choice: OrganizePlanChoice) => void;
}) {
  const initial: Plan = { params, result: preview };
  const source = 'medianame';
  const [plan, setPlan] = useState<Plan | undefined>(initial);
  const [error, setError] = useState(() => planError(initial));
  const [loading, setLoading] = useState(false);
  const [candidateItem, setCandidateItem] =
    useState<API.Organize115ItemResult>();
  const [candidateLoading, setCandidateLoading] = useState(false);
  const generation = useRef(0);
  const currentPlan = useRef(initial);

  useEffect(() => {
    const original = { params, result: preview };
    onChange({
      source: 'medianame',
      loading: false,
      params: planError(original) ? undefined : params,
    });
    return () => {
      generation.current++;
    };
  }, [params, preview, onChange]);

  const regenerate = async () => {
    const next = source;
    const current = ++generation.current;
    setError(undefined);
    setPlan(undefined);
    setLoading(true);
    onChange({ source: next, loading: true });
    try {
      // 历史引擎计划统一重新生成 medianame 预览，不执行文件操作。
      const {
        plan_id: _planID,
        delete_source_folder: _deleteSource,
        ...input
      } = params;
      const response = await organize115Cookie({
        ...input,
        candidate_plan_id:
          currentPlan.current.result.recognition_source === 'medianame'
            ? currentPlan.current.result.plan_id
            : undefined,
        recognition_source: next,
        dry_run: true,
      });
      if (current !== generation.current) return;
      if (response.code !== 0 || !response.data)
        throw new Error(response.message || '生成预览失败');
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
      currentPlan.current = ready;
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
    <section aria-label="核对整理计划" className="space-y-3">
      <p className="text-sm text-neutral-500">
        请核对下方目标路径，确认后按此预览计划执行整理。
      </p>
      {loading && <output className="block">正在重新生成预览…</output>}
      {error && (
        <div>
          <p role="alert" className="text-red-600">
            {error}
          </p>
          <Button
            size="small"
            disabled={candidateLoading}
            onClick={() => void regenerate()}
          >
            重新生成预览
          </Button>
        </div>
      )}
      {plan && (
        <div className="max-h-64 overflow-auto rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
          <p className="mb-2 font-semibold">目标路径</p>
          <ul className="space-y-3 text-sm">
            {selectedPlanItems(plan).map((item) => (
              <li key={item.file_id} className="break-all">
                <div className="text-neutral-500">{item.file_name}</div>
                <div>{item.error || item.target_path || '未生成路径'}</div>
                {source === 'medianame' &&
                  medianameCandidates(item).length > 0 && (
                    <Button
                      size="small"
                      disabled={candidateLoading}
                      onClick={() => setCandidateItem(item)}
                    >
                      选择候选（{medianameCandidates(item).length}）
                    </Button>
                  )}
                {item.upgrade && <UpgradeComparison decision={item.upgrade} />}
              </li>
            ))}
          </ul>
        </div>
      )}
      {candidateItem && plan && (
        <MedianameCandidatePicker
          key={`${plan.result.plan_id}:${candidateItem.file_id}`}
          item={candidateItem}
          preview={plan.result}
          onClose={() => setCandidateItem(undefined)}
          onBusyChange={(busy) => {
            setCandidateLoading(busy);
            if (busy) onChange({ source, loading: true });
            else {
              const current = currentPlan.current;
              onChange({
                source,
                loading: false,
                params:
                  current && !planError(current) ? current.params : undefined,
              });
            }
          }}
          onSelected={(result) => {
            const ready: Plan = {
              result,
              params: {
                ...plan.params,
                plan_id: result.plan_id,
                recognition_source: 'medianame',
              },
            };
            currentPlan.current = ready;
            setPlan(ready);
            const failure = planError(ready);
            setError(failure);
            setCandidateItem(undefined);
            onChange({
              source: 'medianame',
              loading: false,
              params: failure ? undefined : ready.params,
            });
          }}
        />
      )}
    </section>
  );
}
