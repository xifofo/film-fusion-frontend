import { Alert, Button, Card, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { type Key, useEffect, useRef, useState } from 'react';
import {
  type PlutoFishRepairItem,
  type PlutoFishRepairPreview,
  previewPlutoFishSTRMRepairs,
  repairPlutoFishSTRMs,
} from '@/services/film-fusion/plutofish';

const labels: Record<PlutoFishRepairItem['state'], [string, string]> = {
  ready: ['可修复', 'blue'],
  resume: ['可继续修复', 'orange'],
  blocked: ['需核对', 'warning'],
  current: ['无需修复', 'default'],
  repaired: ['已修复', 'success'],
  failed: ['未完成', 'error'],
};

const unwrap = <T,>(response: API.Response<T>): T => {
  if (response.code !== 0) throw new Error(response.message || '操作失败');
  return response.data;
};

const pathStyle = {
  overflowWrap: 'anywhere' as const,
  whiteSpace: 'pre-wrap' as const,
};

export default function STRMRepairPanel({
  disabled = false,
  onRepaired,
  onBusyChange,
}: {
  disabled?: boolean;
  onRepaired: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [preview, setPreview] = useState<PlutoFishRepairPreview>();
  const [after, setAfter] = useState(0);
  const [selected, setSelected] = useState<Key[]>([]);
  const [busy, setBusy] = useState<'preview' | 'apply'>();
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      request.current?.abort();
      onBusyChange(false);
    },
    [onBusyChange],
  );

  const run = async (
    mode: 'preview' | 'apply',
    action: (signal: AbortSignal) => Promise<void>,
  ) => {
    if (request.current || disabled) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(mode);
    onBusyChange(true);
    setNotice('');
    setError('');
    try {
      await action(controller.signal);
    } catch {
      if (!controller.signal.aborted) {
        setError(
          mode === 'preview'
            ? '预览失败，请检查登录状态和已保存的云路径映射后重试。'
            : '修复请求未完成。已完成的记录会保留，请重新预览后继续。',
        );
      }
    } finally {
      if (!controller.signal.aborted) {
        setBusy(undefined);
        onBusyChange(false);
        request.current = null;
      }
    }
  };

  const load = (cursor: number) =>
    run('preview', async (signal) => {
      const result = unwrap(await previewPlutoFishSTRMRepairs(cursor, signal));
      if (signal.aborted) return;
      setPreview(result);
      setAfter(cursor);
      setSelected(
        result.items
          .filter((item) => item.canRepair)
          .map((item) => item.eventID),
      );
    });

  const apply = () =>
    run('apply', async (signal) => {
      const items =
        preview?.items.filter(
          (item) => item.canRepair && selected.includes(item.eventID),
        ) || [];
      let completed = 0;
      let unfinished = 0;
      // 小批顺序提交，逐批保留结果；网络中断后依靠服务端修复记录续办。
      for (let index = 0; index < items.length; index += 10) {
        const batch = items.slice(index, index + 10);
        const result = unwrap(
          await repairPlutoFishSTRMs(
            batch.map(({ eventID, snapshot }) => ({ eventID, snapshot })),
            signal,
          ),
        );
        if (signal.aborted) return;
        completed += result.items.filter(
          (item) => item.state === 'repaired',
        ).length;
        unfinished += result.items.filter(
          (item) => item.state !== 'repaired',
        ).length;
        const updates = new Map(
          result.items.map((item) => [item.eventID, item]),
        );
        setPreview(
          (previous) =>
            previous && {
              ...previous,
              items: previous.items.map(
                (item) => updates.get(item.eventID) || item,
              ),
            },
        );
        setSelected((previous) =>
          previous.filter((id) => !batch.some((item) => item.eventID === id)),
        );
        setNotice(
          `已修复 ${completed} 条，未完成 ${unfinished} 条；已处理 ${Math.min(index + 10, items.length)} / ${items.length} 条。`,
        );
        onRepaired();
      }
    });

  const columns: ColumnsType<PlutoFishRepairItem> = [
    {
      title: '文件',
      dataIndex: 'fileName',
      width: 200,
      render: (name, row) => (
        <div style={pathStyle}>
          <div>{row.workTitle}</div>
          {name}
        </div>
      ),
    },
    {
      title: '原本地路径',
      dataIndex: 'oldPath',
      width: 300,
      render: (value) => <div style={pathStyle}>{value || '无法确定'}</div>,
    },
    {
      title: '修复后本地路径',
      dataIndex: 'newPath',
      width: 300,
      render: (value) => <div style={pathStyle}>{value || '无法确定'}</div>,
    },
    {
      title: '状态',
      dataIndex: 'state',
      width: 230,
      render: (state: PlutoFishRepairItem['state'], row) => (
        <div style={pathStyle}>
          <Tag color={labels[state]?.[1]}>{labels[state]?.[0] || state}</Tag>
          <div>{row.reason}</div>
        </div>
      ),
    },
  ];
  const selectedCount =
    preview?.items.filter(
      (item) => item.canRepair && selected.includes(item.eventID),
    ).length || 0;

  return (
    <Card title="修复历史 STRM">
      <p>
        按已保存的云路径映射重新计算本地目录和播放内容。每批预览最多 100
        个历史任务；展开记录可对比播放内容。
      </p>
      <p>
        校验新文件并同步数据库后，清理对应旧 STRM、.transfer.json
        和空哈希目录。内容冲突会保留待核对；不请求 115，也不重置通知游标。
      </p>
      <div
        style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}
      >
        <Button
          onClick={() => load(after)}
          disabled={disabled || !!busy}
          loading={busy === 'preview'}
        >
          {preview ? '重新预览本批' : '预览历史 STRM'}
        </Button>
        <Button
          type="primary"
          onClick={apply}
          loading={busy === 'apply'}
          disabled={disabled || !!busy || !selectedCount}
        >
          修复所选（{selectedCount}）
        </Button>
        {after > 0 && (
          <Button onClick={() => load(0)} disabled={disabled || !!busy}>
            返回首批
          </Button>
        )}
        {preview?.hasMore && (
          <Button
            onClick={() => load(preview.nextAfter)}
            disabled={disabled || !!busy}
          >
            下一批
          </Button>
        )}
      </div>
      {error && (
        <Alert
          type="error"
          showIcon
          title={error}
          style={{ marginBottom: 16 }}
        />
      )}
      {notice && (
        <Alert
          type="info"
          showIcon
          title={notice}
          style={{ marginBottom: 16 }}
        />
      )}
      {preview && (
        <Table<PlutoFishRepairItem>
          rowKey="eventID"
          columns={columns}
          dataSource={preview.items}
          scroll={{ x: 1080 }}
          rowSelection={{
            selectedRowKeys: selected,
            onChange: setSelected,
            getCheckboxProps: (item) => ({
              disabled: !item.canRepair || !!busy || disabled,
            }),
          }}
          expandable={{
            expandedRowRender: (item) => (
              <div style={pathStyle}>
                <strong>原播放内容</strong>
                <div>{item.oldContent || '无法确定'}</div>
                <strong>修复后播放内容</strong>
                <div>{item.content || '无法确定'}</div>
              </div>
            ),
            expandRowByClick: true,
          }}
          pagination={{
            defaultPageSize: 10,
            showSizeChanger: true,
            showTotal: (count) =>
              `本批 ${count} 个任务${preview.hasMore ? '，还有后续批次' : ''}`,
          }}
          locale={{ emptyText: '本批没有历史成功任务。' }}
        />
      )}
    </Card>
  );
}
