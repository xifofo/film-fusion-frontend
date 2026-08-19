import { Alert, Modal, message, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { type Key, useCallback, useEffect, useState } from 'react';
import type {
  RSSAutomationManualCandidate,
  RSSAutomationManualRunResult,
  RSSAutomationWorkflow,
} from '@/services/film-fusion';
import {
  createRSSAutomationManualRuns,
  listRSSAutomationManualCandidates,
} from '@/services/film-fusion';

const { Link, Paragraph, Text } = Typography;

type ManualRunModalProps = {
  open: boolean;
  workflow?: RSSAutomationWorkflow;
  onClose: () => void;
  onQueued: (result: RSSAutomationManualRunResult) => Promise<void> | void;
};

const ManualRunModal = ({
  open,
  workflow,
  onClose,
  onQueued,
}: ManualRunModalProps) => {
  const [items, setItems] = useState<RSSAutomationManualCandidate[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Key[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [scannedEntries, setScannedEntries] = useState(0);
  const [messageApi, contextHolder] = message.useMessage();
  const workflowId = workflow?.id;

  const load = useCallback(async () => {
    if (!workflowId) return;
    setLoading(true);
    try {
      const response = await listRSSAutomationManualCandidates(workflowId, 100);
      if (response.code !== 0 || !response.data) {
        throw new Error(response.message || '获取匹配条目失败');
      }
      setItems(response.data.items);
      setHasMore(response.data.has_more);
      setScannedEntries(response.data.scanned_entries);
    } catch (error: any) {
      messageApi.error(error?.data || error?.message || '获取匹配条目失败');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [messageApi, workflowId]);

  useEffect(() => {
    if (!open) return;
    setSelectedKeys([]);
    setItems([]);
    setHasMore(false);
    setScannedEntries(0);
    void load();
  }, [load, open]);

  const submit = async () => {
    if (!workflow || selectedKeys.length === 0) return;
    setSubmitting(true);
    try {
      const response = await createRSSAutomationManualRuns(
        workflow.id,
        selectedKeys.map(Number),
      );
      if (response.code !== 0 || !response.data) {
        throw new Error(response.message || '创建手动运行失败');
      }
      const result = response.data;
      if (result.created > 0) {
        messageApi.success(`已将 ${result.created} 条加入运行队列`);
      }
      if (result.skipped.length > 0) {
        messageApi.warning(
          `${result.skipped.length} 条因不再匹配或已运行而跳过`,
        );
      }
      await onQueued(result);
      onClose();
    } catch (error: any) {
      messageApi.error(error?.data || error?.message || '创建手动运行失败');
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnsType<RSSAutomationManualCandidate> = [
    {
      title: 'RSS 条目',
      render: (_, item, index) => (
        <Space orientation="vertical" size={2}>
          <Space size={6}>
            {index === 0 && <Tag color="blue">最新匹配</Tag>}
            {item.detail_url ? (
              <Link href={item.detail_url} rel="noreferrer" target="_blank">
                {item.title || `条目 #${item.entry_id}`}
              </Link>
            ) : (
              <Text strong>{item.title || `条目 #${item.entry_id}`}</Text>
            )}
          </Space>
          <Text type="secondary">条目 #{item.entry_id}</Text>
        </Space>
      ),
    },
    {
      title: '发布时间',
      dataIndex: 'published_at',
      width: 180,
      render: (value?: string) =>
        value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
    {
      title: '将执行动作',
      dataIndex: 'action_names',
      width: 220,
      render: (names: string[]) => (
        <Space size={[4, 4]} wrap>
          {names.map((name) => (
            <Tag color="processing" key={name}>
              {name}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '下载地址',
      dataIndex: 'download_url',
      width: 280,
      render: (value?: string) => (
        <Paragraph
          copyable={Boolean(value)}
          ellipsis={{ rows: 2, tooltip: value }}
          style={{ marginBottom: 0 }}
        >
          {value || '-'}
        </Paragraph>
      ),
    },
  ];

  return (
    <>
      {contextHolder}
      <Modal
        cancelText="取消"
        destroyOnHidden
        mask={{ closable: !submitting }}
        okButtonProps={{ disabled: selectedKeys.length === 0 }}
        okText={
          selectedKeys.length > 0
            ? `确认运行 ${selectedKeys.length} 条`
            : '请先选择条目'
        }
        onCancel={onClose}
        onOk={submit}
        open={open}
        title={`手动运行已有匹配条目${workflow ? ` · ${workflow.name}` : ''}`}
        width="min(1120px, 94vw)"
        confirmLoading={submitting}
      >
        <Space orientation="vertical" size={14} style={{ width: '100%' }}>
          <Alert
            description="这里只展示按当前流程预演后能够到达动作节点、且该流程从未运行过的已有条目。勾选不会执行，点击确认后才会加入真实运行队列。"
            title="默认不选择任何条目，请确认标题和下载地址后再运行。"
            showIcon
            type="info"
          />
          {hasMore && (
            <Alert
              title={`已检查最近 ${scannedEntries} 条记录，当前只展示前 100 个匹配结果。`}
              showIcon
              type="warning"
            />
          )}
          <Table
            columns={columns}
            dataSource={items}
            loading={loading}
            locale={{ emptyText: '没有尚未运行且符合当前流程的已有条目' }}
            pagination={false}
            rowKey="entry_id"
            rowSelection={{
              onChange: setSelectedKeys,
              selectedRowKeys: selectedKeys,
              type: 'checkbox',
            }}
            scroll={{ x: 980, y: 460 }}
            size="middle"
          />
        </Space>
      </Modal>
    </>
  );
};

export default ManualRunModal;
