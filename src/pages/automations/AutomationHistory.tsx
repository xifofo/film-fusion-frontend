import { EyeOutlined, ReloadOutlined, StopOutlined } from '@ant-design/icons';
import type { TableProps } from 'antd';
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Empty,
  message,
  Popconfirm,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AutomationEntryHistoryItem,
  AutomationRun,
  AutomationRunDetail,
  AutomationRunStatus,
  AutomationSource,
  AutomationWorkflow,
} from '@/services/film-fusion';
import {
  cancelAutomationRun,
  getAutomationRun,
  listAutomationEntries,
  listAutomationRuns,
  retryAutomationRun,
} from '@/services/film-fusion';

const { Text } = Typography;

const runStatusMeta: Record<
  AutomationRunStatus,
  { color: string; label: string }
> = {
  pending: { color: 'default', label: '等待执行' },
  running: { color: 'processing', label: '执行中' },
  succeeded: { color: 'success', label: '成功' },
  partial: { color: 'warning', label: '部分成功' },
  failed: { color: 'error', label: '失败' },
  cancelled: { color: 'default', label: '已取消' },
};

const formatTime = (value?: string) =>
  value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '--';

const formatBytes = (value: number) => {
  if (!value) return '--';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1,
  );
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

type AutomationHistoryProps = {
  sources: AutomationSource[];
  workflows: AutomationWorkflow[];
  refreshToken: number;
};

const AutomationHistory = ({
  sources,
  workflows,
  refreshToken,
}: AutomationHistoryProps) => {
  const [sourceID, setSourceID] = useState<number>();
  const [entries, setEntries] = useState<AutomationEntryHistoryItem[]>([]);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [entryTotal, setEntryTotal] = useState(0);
  const [runTotal, setRunTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<AutomationRunDetail>();
  const [detailLoading, setDetailLoading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const workflowID = useMemo(
    () => workflows.find((workflow) => workflow.source_id === sourceID)?.id,
    [sourceID, workflows],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [entryResponse, runResponse] = await Promise.all([
        listAutomationEntries({ sourceId: sourceID, limit: 50 }),
        listAutomationRuns({ workflowId: workflowID, limit: 50 }),
      ]);
      if (entryResponse.code !== 0 || !entryResponse.data) {
        throw new Error(entryResponse.message || '获取目录事件失败');
      }
      if (runResponse.code !== 0 || !runResponse.data) {
        throw new Error(runResponse.message || '获取运行记录失败');
      }
      setEntries(entryResponse.data.items || []);
      setEntryTotal(entryResponse.data.total || 0);
      setRuns(runResponse.data.items || []);
      setRunTotal(runResponse.data.total || 0);
    } catch (error: any) {
      messageApi.error(error?.data || error?.message || '获取自动化历史失败');
    } finally {
      setLoading(false);
    }
  }, [messageApi, sourceID, workflowID]);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  const openRun = async (runID: number) => {
    setDetailLoading(true);
    try {
      const response = await getAutomationRun(runID);
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

  const retryRun = async (runID: number) => {
    const response = await retryAutomationRun(runID);
    if (response.code !== 0) {
      messageApi.error(response.message || '重试失败');
      return;
    }
    messageApi.success('流程已进入重试队列');
    await load();
  };

  const cancelRun = async (runID: number) => {
    const response = await cancelAutomationRun(runID);
    if (response.code !== 0) {
      messageApi.error(response.message || '取消失败');
      return;
    }
    messageApi.success('流程已取消');
    await load();
  };

  const entryColumns: TableProps<AutomationEntryHistoryItem>['columns'] = [
    {
      title: '发现时间',
      width: 170,
      render: (_, item) => formatTime(item.entry.discovered_at),
    },
    { title: '自动化', dataIndex: 'source_name', width: 150 },
    {
      title: '新增对象',
      render: (_, item) => (
        <Space orientation="vertical" size={0}>
          <Space>
            <Tag color={item.entry.is_directory ? 'blue' : 'cyan'}>
              {item.entry.is_directory ? '目录' : '文件'}
            </Tag>
            <Text strong>{item.entry.title}</Text>
          </Space>
          <Text ellipsis={{ tooltip: item.entry.path }} type="secondary">
            {item.entry.path}
          </Text>
        </Space>
      ),
    },
    {
      title: '大小',
      width: 90,
      render: (_, item) => formatBytes(item.entry.size),
    },
    {
      title: '识别结果',
      width: 180,
      render: (_, item) =>
        item.media_title ? (
          <Space orientation="vertical" size={0}>
            <Text>{item.media_title}</Text>
            <Text type="secondary">
              {[item.media_type, item.media_year, item.season_episode]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </Space>
        ) : item.recognition_error ? (
          <Text type="danger">{item.recognition_error}</Text>
        ) : (
          <Text type="secondary">--</Text>
        ),
    },
    {
      title: '流程',
      width: 120,
      render: (_, item) => {
        if (!item.latest_run) return <Text type="secondary">未创建</Text>;
        const meta = runStatusMeta[item.latest_run.status];
        const runID = item.latest_run.id;
        return (
          <Button type="link" onClick={() => openRun(runID)}>
            <Tag color={meta.color}>{meta.label}</Tag>
          </Button>
        );
      },
    },
  ];

  const runColumns: TableProps<AutomationRun>['columns'] = [
    {
      title: '开始时间',
      width: 180,
      render: (_, run) => formatTime(run.started_at || run.created_at),
    },
    { title: '流程', dataIndex: 'workflow_name' },
    {
      title: '版本',
      dataIndex: 'workflow_version',
      width: 80,
      render: (version: number) => `v${version}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (status: AutomationRunStatus) => {
        const meta = runStatusMeta[status];
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: '错误',
      dataIndex: 'error_message',
      ellipsis: true,
      render: (error?: string) => error || '--',
    },
    {
      title: '操作',
      width: 220,
      render: (_, run) => (
        <Space>
          <Button
            icon={<EyeOutlined />}
            loading={detailLoading}
            onClick={() => openRun(run.id)}
            size="small"
          >
            详情
          </Button>
          {(run.status === 'failed' || run.status === 'partial') && (
            <Button
              icon={<ReloadOutlined />}
              onClick={() => retryRun(run.id)}
              size="small"
            >
              重试
            </Button>
          )}
          {(run.status === 'pending' || run.status === 'running') && (
            <Popconfirm
              onConfirm={() => cancelRun(run.id)}
              title="取消这次运行？"
            >
              <Button danger icon={<StopOutlined />} size="small">
                取消
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      {contextHolder}
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          description="事件只在新增对象完成上传并持续稳定后产生。同一个 115 对象只会创建一次事件和一次初始运行。"
          showIcon
          title="这里不包含首次扫描建立的存量基线"
          type="info"
        />
        <Select
          allowClear
          aria-label="筛选自动化"
          onChange={setSourceID}
          options={sources.map((source) => ({
            label: source.name,
            value: source.id,
          }))}
          placeholder="全部自动化"
          style={{ width: 240 }}
          value={sourceID}
        />
        <Tabs
          items={[
            {
              key: 'events',
              label: `目录事件 ${entryTotal}`,
              children: (
                <Table<AutomationEntryHistoryItem>
                  columns={entryColumns}
                  dataSource={entries}
                  loading={loading}
                  locale={{ emptyText: <Empty description="暂无新增事件" /> }}
                  pagination={false}
                  rowKey={(item) => item.entry.id}
                  scroll={{ x: 1000 }}
                />
              ),
            },
            {
              key: 'runs',
              label: `运行记录 ${runTotal}`,
              children: (
                <Table<AutomationRun>
                  columns={runColumns}
                  dataSource={runs}
                  loading={loading}
                  locale={{ emptyText: <Empty description="暂无运行记录" /> }}
                  pagination={false}
                  rowKey="id"
                  scroll={{ x: 900 }}
                />
              ),
            },
          ]}
        />
      </Space>

      <Drawer
        destroyOnHidden
        onClose={() => setDetail(undefined)}
        open={Boolean(detail)}
        size="large"
        title={detail ? `运行 #${detail.run.id}` : '运行详情'}
      >
        {detail && (
          <Space orientation="vertical" size={20} style={{ width: '100%' }}>
            <Descriptions
              bordered
              column={2}
              items={[
                {
                  key: 'workflow',
                  label: '流程',
                  children: `${detail.run.workflow_name} · v${detail.run.workflow_version}`,
                },
                {
                  key: 'status',
                  label: '状态',
                  children: (
                    <Tag color={runStatusMeta[detail.run.status].color}>
                      {runStatusMeta[detail.run.status].label}
                    </Tag>
                  ),
                },
                {
                  key: 'item',
                  label: '新增对象',
                  children: detail.entry.path,
                  span: 2,
                },
                {
                  key: 'started',
                  label: '开始',
                  children: formatTime(detail.run.started_at),
                },
                {
                  key: 'completed',
                  label: '完成',
                  children: formatTime(detail.run.completed_at),
                },
                ...(detail.run.error_message
                  ? [
                      {
                        key: 'error',
                        label: '错误',
                        children: detail.run.error_message,
                        span: 2,
                      },
                    ]
                  : []),
              ]}
            />
            <Table
              columns={[
                { title: '节点', dataIndex: 'node_name' },
                { title: '类型', dataIndex: 'node_type' },
                { title: '状态', dataIndex: 'status' },
                {
                  title: '尝试',
                  render: (_, node) => `${node.attempt}/${node.max_attempts}`,
                },
                {
                  title: '计划继续',
                  dataIndex: 'next_attempt_at',
                  render: formatTime,
                },
                { title: '错误', dataIndex: 'error_message', ellipsis: true },
              ]}
              dataSource={detail.node_runs}
              pagination={false}
              rowKey="id"
              size="small"
            />
          </Space>
        )}
      </Drawer>
    </>
  );
};

export default AutomationHistory;
