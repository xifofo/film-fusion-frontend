import {
  CloseCircleOutlined,
  EyeOutlined,
  ReloadOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Drawer,
  message,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  RSSAutomationNodeRun,
  RSSAutomationRun,
  RSSAutomationRunDetail,
  RSSAutomationRunStatus,
} from '@/services/film-fusion';
import {
  cancelRSSAutomationRun,
  getRSSAutomationRun,
  listRSSAutomationRuns,
  retryRSSAutomationRun,
} from '@/services/film-fusion';
import FlowNode from './FlowNode';
import { definitionToFlow, parseWorkflowDefinition } from './flow';
import styles from './index.module.less';

const { Paragraph, Text } = Typography;
const nodeTypes = { rssAutomationNode: FlowNode };

const statusMeta: Record<
  RSSAutomationRunStatus,
  { label: string; color: string }
> = {
  pending: { label: '排队中', color: 'default' },
  running: { label: '执行中', color: 'processing' },
  succeeded: { label: '成功', color: 'success' },
  partial: { label: '部分成功', color: 'warning' },
  failed: { label: '失败', color: 'error' },
  cancelled: { label: '已取消', color: 'default' },
};

const nodeStatusMeta: Record<string, { label: string; color: string }> = {
  pending: { label: '等待', color: 'default' },
  running: { label: '执行中', color: 'processing' },
  succeeded: { label: '成功', color: 'success' },
  failed: { label: '失败', color: 'error' },
  skipped: { label: '未进入', color: 'default' },
  cancelled: { label: '已取消', color: 'default' },
};

const formatTime = (value?: string) =>
  value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-';

const prettyJSON = (raw?: string) => {
  if (!raw) return '-';
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
};

const RunPanel = () => {
  const [runs, setRuns] = useState<RSSAutomationRun[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<RSSAutomationRunDetail>();
  const [detailLoading, setDetailLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const pageSize = 30;

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const response = await listRSSAutomationRuns({
          status,
          limit: pageSize,
          offset: (page - 1) * pageSize,
        });
        if (response.code !== 0 || !response.data) {
          throw new Error(response.message || '获取运行记录失败');
        }
        setRuns(response.data.items);
        setTotal(response.data.total);
      } catch (error: any) {
        if (!silent) {
          messageApi.error(error?.data || error?.message || '获取运行记录失败');
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [messageApi, page, status],
  );

  useEffect(() => {
    load();
    const timer = window.setInterval(() => load(true), 5000);
    return () => window.clearInterval(timer);
  }, [load]);

  const openDetail = async (run: RSSAutomationRun) => {
    setDetailLoading(true);
    try {
      const response = await getRSSAutomationRun(run.id);
      if (response.code !== 0 || !response.data) {
        throw new Error(response.message || '获取运行详情失败');
      }
      setDetail(response.data);
    } catch (error: any) {
      messageApi.error(error?.data || error?.message || '获取运行详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const retry = async (runId: number) => {
    setActing(true);
    try {
      const response = await retryRSSAutomationRun(runId);
      if (response.code !== 0) throw new Error(response.message);
      messageApi.success('失败节点及其后续节点已进入重试队列');
      setDetail(undefined);
      await load(true);
    } catch (error: any) {
      messageApi.error(error?.data || error?.message || '重试失败');
    } finally {
      setActing(false);
    }
  };

  const cancel = async (runId: number) => {
    setActing(true);
    try {
      const response = await cancelRSSAutomationRun(runId);
      if (response.code !== 0) throw new Error(response.message);
      messageApi.success('流程已取消');
      setDetail(undefined);
      await load(true);
    } catch (error: any) {
      messageApi.error(error?.data || error?.message || '取消失败');
    } finally {
      setActing(false);
    }
  };

  const columns: ColumnsType<RSSAutomationRun> = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    {
      title: '流程',
      render: (_, run) => (
        <Space direction="vertical" size={0}>
          <Text strong>{run.workflow_name}</Text>
          <Text type="secondary">版本 v{run.workflow_version}</Text>
        </Space>
      ),
    },
    {
      title: '条目',
      dataIndex: 'entry_id',
      width: 110,
      render: (entryId: number) => `#${entryId}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (value: RSSAutomationRunStatus, run) => {
        const meta = statusMeta[value] || { label: value, color: 'default' };
        return run.error_message ? (
          <Tooltip title={run.error_message}>
            <Tag color={meta.color}>{meta.label}</Tag>
          </Tooltip>
        ) : (
          <Tag color={meta.color}>{meta.label}</Tag>
        );
      },
    },
    {
      title: '开始时间',
      dataIndex: 'started_at',
      width: 180,
      render: formatTime,
    },
    {
      title: '完成时间',
      dataIndex: 'completed_at',
      width: 180,
      render: formatTime,
    },
    {
      title: '操作',
      fixed: 'right',
      width: 100,
      render: (_, run) => (
        <Button
          icon={<EyeOutlined />}
          loading={detailLoading}
          onClick={() => openDetail(run)}
          size="small"
        >
          详情
        </Button>
      ),
    },
  ];

  const graph = useMemo(() => {
    if (!detail) return undefined;
    const definition = parseWorkflowDefinition(detail.run.definition_json);
    if (!definition) return undefined;
    const statuses = Object.fromEntries(
      detail.node_runs.map((nodeRun) => [nodeRun.node_id, nodeRun.status]),
    );
    return definitionToFlow(definition, statuses);
  }, [detail]);

  const nodeColumns: ColumnsType<RSSAutomationNodeRun> = [
    {
      title: '节点',
      render: (_, node) => (
        <Space direction="vertical" size={0}>
          <Text strong>{node.node_name || node.node_id}</Text>
          <Text type="secondary">{node.node_type}</Text>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value: string) => {
        const meta = nodeStatusMeta[value] || {
          label: value,
          color: 'default',
        };
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: '尝试',
      width: 90,
      render: (_, node) => `${node.attempt}/${node.max_attempts}`,
    },
    {
      title: '耗时/时间',
      width: 180,
      render: (_, node) => formatTime(node.completed_at || node.started_at),
    },
    {
      title: '输出 / 错误',
      render: (_, node) => (
        <Paragraph
          copyable={Boolean(node.output_json || node.error_message)}
          ellipsis={{ rows: 3, expandable: true }}
          style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}
        >
          {node.error_message || prettyJSON(node.output_json)}
        </Paragraph>
      ),
    },
  ];

  return (
    <>
      {contextHolder}
      <Card
        extra={
          <Space>
            <Select
              allowClear
              onChange={(value) => {
                setPage(1);
                setStatus(value);
              }}
              options={Object.entries(statusMeta).map(([value, meta]) => ({
                label: meta.label,
                value,
              }))}
              placeholder="全部状态"
              style={{ width: 140 }}
              value={status}
            />
            <Button icon={<ReloadOutlined />} onClick={() => load()}>
              刷新
            </Button>
          </Space>
        }
        title="流程运行记录"
      >
        <Table
          columns={columns}
          dataSource={runs}
          loading={loading}
          pagination={{
            current: page,
            onChange: setPage,
            pageSize,
            showSizeChanger: false,
            total,
          }}
          rowKey="id"
          scroll={{ x: 1000 }}
        />
      </Card>

      <Drawer
        destroyOnHidden
        extra={
          detail ? (
            <Space>
              {['failed', 'partial', 'cancelled'].includes(
                detail.run.status,
              ) && (
                <Popconfirm
                  description="只重跑失败/取消节点及其后续节点；已成功的上游动作不会重复。"
                  onConfirm={() => retry(detail.run.id)}
                  title="重试这个流程？"
                >
                  <Button icon={<SyncOutlined />} loading={acting}>
                    重试失败路径
                  </Button>
                </Popconfirm>
              )}
              {['pending', 'running'].includes(detail.run.status) && (
                <Popconfirm
                  description="已提交给外部服务的动作无法撤回。"
                  onConfirm={() => cancel(detail.run.id)}
                  title="取消这个流程？"
                >
                  <Button
                    danger
                    icon={<CloseCircleOutlined />}
                    loading={acting}
                  >
                    取消
                  </Button>
                </Popconfirm>
              )}
            </Space>
          ) : undefined
        }
        onClose={() => setDetail(undefined)}
        open={Boolean(detail)}
        title={
          detail
            ? `运行 #${detail.run.id} · ${detail.run.workflow_name}`
            : '运行详情'
        }
        width="min(1180px, 92vw)"
      >
        {detail && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            {detail.run.error_message && (
              <Alert message={detail.run.error_message} showIcon type="error" />
            )}
            <Descriptions bordered column={3} size="small">
              <Descriptions.Item label="状态">
                <Tag color={statusMeta[detail.run.status].color}>
                  {statusMeta[detail.run.status].label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="流程版本">
                v{detail.run.workflow_version}
              </Descriptions.Item>
              <Descriptions.Item label="条目 ID">
                #{detail.entry.id}
              </Descriptions.Item>
              <Descriptions.Item label="条目标题" span={3}>
                {detail.entry.title || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="下载 URL" span={3}>
                <Text copyable ellipsis>
                  {detail.entry.download_url || '-'}
                </Text>
              </Descriptions.Item>
            </Descriptions>
            {graph && (
              <Card size="small" title="实际执行路径">
                <div className={styles.runGraph}>
                  <ReactFlowProvider>
                    <ReactFlow
                      edges={graph.edges}
                      elementsSelectable={false}
                      fitView
                      nodes={graph.nodes}
                      nodesConnectable={false}
                      nodesDraggable={false}
                      nodeTypes={nodeTypes}
                      panOnDrag
                      proOptions={{ hideAttribution: true }}
                      zoomOnDoubleClick={false}
                    >
                      <Background gap={20} size={1} />
                      <Controls showInteractive={false} />
                    </ReactFlow>
                  </ReactFlowProvider>
                </div>
              </Card>
            )}
            <Card size="small" title="节点执行明细">
              <Table
                columns={nodeColumns}
                dataSource={detail.node_runs}
                pagination={false}
                rowKey="id"
                scroll={{ x: 900 }}
                size="small"
              />
            </Card>
            <Card size="small" title="原始字段上下文">
              <pre className={styles.jsonPreview}>
                {prettyJSON(detail.entry.fields_json)}
              </pre>
            </Card>
          </Space>
        )}
      </Drawer>
    </>
  );
};

export default RunPanel;
