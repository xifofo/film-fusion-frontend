import { Checkbox, Modal, Radio } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { selectOrganizeMedianameCandidate } from '@/services/film-fusion';

export const medianameEvidence = (item: API.Organize115ItemResult) =>
  item.medianame || item.shadow_comparison?.medianame?.medianame;

export const medianameCandidates = (item: API.Organize115ItemResult) =>
  (medianameEvidence(item)?.result?.candidates || []).filter(
    (candidate) =>
      candidate.media_info?.tmdb_id &&
      candidate.media_info.title &&
      ['movie', 'tv'].includes(candidate.media_info.type),
  );

const candidateKey = (media: API.MedianameMediaInfo) =>
  `${media.type}:${media.tmdb_id}`;

const conflictLabels: Record<string, string> = {
  title: '片名',
  release_title: '发行片名',
  year: '年份',
  type: '媒体类型',
  input: '解析线索',
  tmdb_id: 'TMDB ID',
  imdb_id: 'IMDb ID',
  tvdb_id: 'TVDB ID',
};

export default function MedianameCandidatePicker({
  item,
  preview,
  previewTaskId,
  onClose,
  onSelected,
  onBusyChange,
}: {
  item: API.Organize115ItemResult;
  preview: API.Organize115CookieResult;
  previewTaskId?: number;
  onClose: () => void;
  onSelected: (result: API.Organize115CookieResult) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const candidates = medianameCandidates(item);
  const evidence = medianameEvidence(item);
  const current = evidence?.result?.media_info;
  const [selected, setSelected] = useState(
    current ? candidateKey(current) : undefined,
  );
  const [wholeFolder, setWholeFolder] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const controller = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => controller.current?.abort(), []);

  const candidate = candidates.find(
    (entry) => entry.media_info && candidateKey(entry.media_info) === selected,
  );
  const group = preview.groups?.find((entry) =>
    entry.items?.some((entryItem) => entryItem.file_id === item.file_id),
  );
  const matchingItems = (group?.items || [item]).filter(
    (entry) =>
      !entry.is_subtitle &&
      !medianameEvidence(entry)?.error &&
      medianameEvidence(entry)?.result?.status !== 'request_error' &&
      medianameCandidates(entry).some(
        (entryCandidate) =>
          entryCandidate.media_info &&
          candidateKey(entryCandidate.media_info) === selected,
      ),
  );
  const unavailable =
    !preview.dry_run ||
    !preview.plan_id ||
    !!evidence?.error ||
    evidence?.result?.status === 'request_error';

  const submit = async () => {
    const media = candidate?.media_info;
    if (!media || unavailable || loading || !preview.plan_id) return;
    const abort = new AbortController();
    controller.current = abort;
    setLoading(true);
    setError(undefined);
    onBusyChange?.(true);
    try {
      const response = await selectOrganizeMedianameCandidate(
        {
          plan_id: preview.plan_id,
          file_ids: wholeFolder
            ? matchingItems.map((entry) => entry.file_id)
            : [item.file_id],
          tmdb_id: media.tmdb_id,
          media_type: media.type,
          preview_task_id: previewTaskId,
        },
        { signal: abort.signal },
      );
      if (abort.signal.aborted) return;
      if (response.code !== 0 || !response.data?.plan_id)
        throw new Error(response.message || '生成候选预览失败');
      onSelected(response.data);
    } catch (cause) {
      if (!abort.signal.aborted)
        setError(cause instanceof Error ? cause.message : '生成候选预览失败');
    } finally {
      if (!abort.signal.aborted) setLoading(false);
      onBusyChange?.(false);
    }
  };

  return (
    <Modal
      open
      title="选择 Medianame 候选"
      width={720}
      onCancel={() => !loading && onClose()}
      onOk={() => void submit()}
      okText="采用候选并重新预览"
      cancelText="取消"
      confirmLoading={loading}
      okButtonProps={{ disabled: !candidate || unavailable }}
      cancelButtonProps={{ disabled: loading }}
      closable={!loading}
    >
      <p className="mb-2 break-all">{item.file_name}</p>
      <p className="mb-3 text-sm text-neutral-500">
        采用候选后将生成 Medianame 整理计划，请核对新的目标路径后再确认整理。
        原文件保持原名。
      </p>
      {unavailable && (
        <p role="alert">识别请求失败或预览已失效，请重新预览后选择。</p>
      )}
      {evidence?.result?.truncated && (
        <p className="mb-2 text-amber-600">
          搜索结果未完全获取，请确认所选作品。
        </p>
      )}
      <Radio.Group
        className="w-full"
        value={selected}
        disabled={loading}
        onChange={(event) => setSelected(event.target.value)}
      >
        <div className="max-h-96 space-y-2 overflow-auto">
          {candidates.map((entry) => {
            const media = entry.media_info;
            if (!media) return null;
            return (
              <div
                key={candidateKey(media)}
                className="rounded border border-neutral-200 p-3 dark:border-neutral-700"
              >
                <Radio value={candidateKey(media)}>
                  {media.title} · {media.year || '年份未知'} ·{' '}
                  {media.type === 'tv' ? '剧集' : '电影'} · TMDB {media.tmdb_id}
                </Radio>
                {media.original_title &&
                  media.original_title !== media.title && (
                    <p className="mt-1 text-sm text-neutral-500">
                      {media.original_title}
                    </p>
                  )}
                {media.overview && (
                  <p className="mt-1 text-sm">{media.overview}</p>
                )}
                {!!entry.conflicts?.length && (
                  <p className="mt-2 text-sm text-amber-600">
                    待核对：
                    {entry.conflicts
                      .map(
                        (conflict) =>
                          `${conflictLabels[conflict.field] || conflict.field}：${conflict.expected} → ${conflict.actual}`,
                      )
                      .join('；')}
                  </p>
                )}
                <a
                  className="mt-1 inline-block text-sm text-blue-600"
                  href={`https://www.themoviedb.org/${media.type}/${encodeURIComponent(media.tmdb_id)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  查看 TMDB 详情
                </a>
              </div>
            );
          })}
        </div>
      </Radio.Group>
      {matchingItems.length > 1 && (
        <Checkbox
          className="mt-3"
          checked={wholeFolder}
          disabled={loading}
          onChange={(event) => setWholeFolder(event.target.checked)}
        >
          同时应用到此目录具有相同候选的 {matchingItems.length} 个文件
        </Checkbox>
      )}
      {error && (
        <p role="alert" className="mt-3 text-red-600">
          {error}
        </p>
      )}
    </Modal>
  );
}
