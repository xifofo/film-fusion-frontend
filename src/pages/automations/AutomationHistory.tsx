import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  PlayCircleOutlined,
  RedoOutlined,
  ReloadOutlined,
  StopOutlined,
} from '@ant-design/icons';
import type { TableProps } from 'antd';
import {
  Alert,
  Button,
  Collapse,
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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  repeatAutomationRun,
  retryAutomationRun,
  runAutomationEntry,
} from '@/services/film-fusion';
import styles from './History.module.less';
import {
  automationNodeLabel,
  formatAutomationTime as formatTime,
  runStatusMeta,
} from './presentation';

const { Text } = Typography;

const formatJSON = (value: string) => {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
};

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
  initialSourceID?: number;
  initialRunID?: number;
  initialStatus?: AutomationRunStatus;
  initialTab?: 'events' | 'runs';
  active?: boolean;
};

const AutomationHistory = ({
  sources,
  workflows,
  refreshToken,
  initialSourceID,
  initialRunID,
  initialStatus,
  initialTab = 'events',
  active = true,
}: AutomationHistoryProps) => {
  const [sourceID, setSourceID] = useState<number | undefined>(initialSourceID);
  const [status, setStatus] = useState<AutomationRunStatus | undefined>(
    initialStatus,
  );
  const [tab, setTab] = useState(initialTab);
  const [entryPage, setEntryPage] = useState(1);
  const [runPage, setRunPage] = useState(1);
  const [loadError, setLoadError] = useState('');
  const [detailID, setDetailID] = useState<number | undefined>(initialRunID);
  const [detailError, setDetailError] = useState('');
  const [detailRefresh, setDetailRefresh] = useState(0);
  const [busyRunID, setBusyRunID] = useState<number>();
  const loadSequence = useRef(0);
  const loadInFlight = useRef(false);
  const detailSequence = useRef(0);
  const [entries, setEntries] = useState<AutomationEntryHistoryItem[]>([]);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [entryTotal, setEntryTotal] = useState(0);
  const [runTotal, setRunTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<AutomationRunDetail>();
  const [detailLoading, setDetailLoading] = useState(false);
  const [repeatingRunID, setRepeatingRunID] = useState<number>();
  const [runningEntryID, setRunningEntryID] = useState<number>();
  const [messageApi, contextHolder] = message.useMessage();

  const workflowID = useMemo(
    () => workflows.find((workflow) => workflow.source_id === sourceID)?.id,
    [sourceID, workflows],
  );

  const load = useCallback(
    async (silent = false) => {
      if (silent && loadInFlight.current) return;
      const requestID = ++loadSequence.current;
      loadInFlight.current = true;
      if (!silent) setLoading(true);
      try {
        const [entryResponse, runResponse] = await Promise.all([
          listAutomationEntries({
            sourceId: sourceID,
            limit: 20,
            offset: (entryPage - 1) * 20,
          }),
          sourceID && !workflowID
            ? Promise.resolve({
                code: 0,
                message: '',
                data: { items: [], total: 0 },
              })
            : listAutomationRuns({
                workflowId: workflowID,
                status,
                limit: 20,
                offset: (runPage - 1) * 20,
              }),
        ]);
        if (entryResponse.code !== 0 || !entryResponse.data) {
          throw new Error(entryResponse.message || '获取条目记录失败');
        }
        if (runResponse.code !== 0 || !runResponse.data) {
          throw new Error(runResponse.message || '获取运行记录失败');
        }
        if (requestID !== loadSequence.current) return;
        setLoadError('');
        setEntries(entryResponse.data.items || []);
        setEntryTotal(entryResponse.data.total || 0);
        setRuns(runResponse.data.items || []);
        setRunTotal(runResponse.data.total || 0);
      } catch (error: any) {
        if (requestID === loadSequence.current)
          setLoadError(error?.data || error?.message || '获取自动化历史失败');
      } finally {
        if (requestID === loadSequence.current) {
          setLoading(false);
          loadInFlight.current = false;
        }
      }
    },
    [sourceID, workflowID, status, entryPage, runPage],
  );

  useEffect(() => {
    if (!active) return;
    setEntries([]);
    setRuns([]);
    setEntryTotal(0);
    setRunTotal(0);
    void load();
    const timer = window.setInterval(() => void load(true), 15_000);
    return () => {
      window.clearInterval(timer);
      loadSequence.current += 1;
    };
  }, [active, load, refreshToken]);

  useEffect(() => {
    if (!detailID || !active) return;
    let disposed = false;
    let inFlight = false;
    const fetchDetail = async (silent = false) => {
      if (inFlight) return;
      inFlight = true;
      const requestID = ++detailSequence.current;
      if (!silent) {
        setDetail(undefined);
        setDetailLoading(true);
      }
      try {
        const response = await getAutomationRun(detailID);
        if (response.code !== 0 || !response.data)
          throw new Error(response.message || '获取运行详情失败');
        if (disposed || requestID !== detailSequence.current) return;
        setDetail(response.data);
        setDetailError('');
      } catch (error: any) {
        if (!disposed && requestID === detailSequence.current)
          setDetailError(error?.data || error?.message || '获取运行详情失败');
      } finally {
        inFlight = false;
        if (!disposed && requestID === detailSequence.current)
          setDetailLoading(false);
      }
    };
    setDetailError('');
    void fetchDetail();
    const timer = window.setInterval(() => void fetchDetail(true), 15_000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [active, detailID, detailRefresh]);

  const openRun = (runID: number) => setDetailID(runID);

  const changeRun = async (runID: number, action: 'retry' | 'cancel') => {
    setBusyRunID(runID);
    try {
      const response = await (action === 'retry'
        ? retryAutomationRun(runID)
        : cancelAutomationRun(runID));
      if (response.code !== 0)
        throw new Error(response.message || '更新运行失败');
      messageApi.success(
        action === 'retry' ? '流程已进入重试队列' : '流程已取消',
      );
      await load(true);
      if (detailID === runID) setDetailRefresh((value) => value + 1);
    } catch (error: any) {
      messageApi.error(error?.data || error?.message || '更新运行失败');
    } finally {
      setBusyRunID(undefined);
    }
  };

  const repeatRun = async (run: AutomationRun) => {
    setRepeatingRunID(run.id);
    try {
      const response = await repeatAutomationRun(run.id);
      if (response.code !== 0 || !response.data) {
        throw new Error(response.message || '重新运行失败');
      }
      messageApi.success(`已创建新的运行 #${response.data.id}`);
      await load();
    } catch (error: any) {
      messageApi.error(error?.data || error?.message || '重新运行失败');
    } finally {
      setRepeatingRunID(undefined);
    }
  };

  const runBaselineEntry = async (item: AutomationEntryHistoryItem) => {
    setRunningEntryID(item.entry.id);
    try {
      const response = await runAutomationEntry(item.entry.id);
      if (response.code !== 0 || !response.data) {
        throw new Error(response.message || '手动执行失败');
      }
      messageApi.success(`已创建手动运行 #${response.data.id}`);
      await load();
    } catch (error: any) {
      messageApi.error(error?.data || error?.message || '手动执行失败');
    } finally {
      setRunningEntryID(undefined);
    }
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
            {item.entry.baseline && <Tag color="gold">存量基线</Tag>}
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
      width: 170,
      render: (_, item) => {
        if (!item.latest_run) {
          if (!item.entry.baseline) {
            return <Text type="secondary">未创建</Text>;
          }
          const workflow = workflows.find(
            (candidate) => candidate.source_id === item.entry.source_id,
          );
          if (!workflow) {
            return <Text type="secondary">无可用流程</Text>;
          }
          return (
            <Space orientation="vertical" size={2}>
              <Text type="secondary">未运行</Text>
              <Popconfirm
                cancelText="取消"
                description={
                  <>
                    将使用当前流程“{workflow.name}”v{workflow.version}
                    和该条目的原始数据，从头执行所有节点。
                    <br />
                    下载、通知等动作可能发生。
                    {!workflow.enabled && (
                      <>
                        <br />
                        自动化当前已停用，但本次手动执行仍会运行。
                      </>
                    )}
                  </>
                }
                okButtonProps={{
                  loading: runningEntryID === item.entry.id,
                }}
                okText="手动执行"
                onConfirm={() => runBaselineEntry(item)}
                title="执行这条存量基线？"
              >
                <Button
                  icon={<PlayCircleOutlined />}
                  loading={runningEntryID === item.entry.id}
                  size="small"
                  type="primary"
                >
                  手动执行
                </Button>
              </Popconfirm>
            </Space>
          );
        }
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
    {
      title: '流程',
      dataIndex: 'workflow_name',
      render: (name: string, run) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{name}</Text>
          <Text type="secondary">运行 #{run.id}</Text>
        </Space>
      ),
    },
    {
      title: '版本',
      dataIndex: 'workflow_version',
      width: 120,
      render: (version: number, run) => (
        <Space orientation="vertical" size={0}>
          <Text>v{version}</Text>
          {(run.execution_no || 1) > 1 && (
            <Text type="secondary">第 {run.execution_no} 次</Text>
          )}
        </Space>
      ),
    },
    {
      title: '触发',
      dataIndex: 'trigger_mode',
      width: 110,
      render: (mode: AutomationRun['trigger_mode'], run) =>
        mode === 'manual' ? (
          <Tag color="blue">
            {run.repeated_from_run_id ? '手动重跑' : '手动执行'}
          </Tag>
        ) : (
          <Text type="secondary">自动触发</Text>
        ),
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
      width: 330,
      render: (_, run) => (
        <Space>
          <Button
            icon={<EyeOutlined />}
            loading={detailLoading && detailID === run.id}
            onClick={() => openRun(run.id)}
            size="small"
          >
            详情
          </Button>
          {(run.status === 'failed' || run.status === 'partial') && (
            <Button
              icon={<ReloadOutlined />}
              loading={busyRunID === run.id}
              onClick={() => changeRun(run.id, 'retry')}
              size="small"
            >
              重试
            </Button>
          )}
          {['succeeded', 'partial', 'failed', 'cancelled'].includes(
            run.status,
          ) && (
            <Popconfirm
              cancelText="取消"
              description={
                <>
                  将使用运行 #{run.id} 保存的流程 v{run.workflow_version}{' '}
                  和事件数据，从头执行所有节点。
                  <br />
                  下载、通知等动作可能再次发生；流程内配置的去重和频率限制仍然有效。
                </>
              }
              okButtonProps={{ loading: repeatingRunID === run.id }}
              okText="重新运行"
              onConfirm={() => repeatRun(run)}
              title="重新运行这条记录？"
            >
              <Button
                icon={<RedoOutlined />}
                loading={repeatingRunID === run.id}
                size="small"
              >
                重新运行
              </Button>
            </Popconfirm>
          )}
          {(run.status === 'pending' || run.status === 'running') && (
            <Popconfirm
              onConfirm={() => changeRun(run.id, 'cancel')}
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
      <div className={styles.history}>
        <div className={styles.heading}>
          <div>
            <h2>执行记录</h2>
            <p>从发现条目到执行结束，查看每一次自动化的处理结果。</p>
          </div>
          <Button
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={() => load()}
          >
            刷新记录
          </Button>
        </div>
        {loadError && (
          <Alert
            showIcon
            title="记录刷新失败"
            description={loadError}
            type="error"
          />
        )}
        <div className={styles.filters}>
          <Select
            allowClear
            aria-label="筛选自动化"
            onChange={(value) => {
              setSourceID(value);
              setRunPage(1);
              setEntryPage(1);
            }}
            options={sources.map((source) => ({
              label: source.name,
              value: source.id,
            }))}
            placeholder="全部自动化"
            showSearch={{ optionFilterProp: 'label' }}
            style={{ width: 240, maxWidth: '100%' }}
            value={sourceID}
          />
          {tab === 'runs' && (
            <Select
              allowClear
              aria-label="筛选运行状态"
              onChange={(value) => {
                setStatus(value);
                setRunPage(1);
              }}
              options={Object.entries(runStatusMeta).map(([value, meta]) => ({
                value,
                label: meta.label,
              }))}
              placeholder="全部运行状态"
              style={{ width: 160 }}
              value={status}
            />
          )}
          <span className={styles.refreshNote}>每 15 秒更新</span>
        </div>
        <Tabs
          activeKey={tab}
          onChange={(value) => setTab(value as 'events' | 'runs')}
          items={[
            {
              key: 'events',
              label: `条目记录 ${entryTotal}`,
              children: (
                <Table<AutomationEntryHistoryItem>
                  columns={entryColumns}
                  dataSource={entries}
                  loading={loading}
                  locale={{ emptyText: <Empty description="暂无条目记录" /> }}
                  pagination={{
                    current: entryPage,
                    pageSize: 20,
                    total: entryTotal,
                    onChange: setEntryPage,
                    showSizeChanger: false,
                    hideOnSinglePage: true,
                  }}
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
                  pagination={{
                    current: runPage,
                    pageSize: 20,
                    total: runTotal,
                    onChange: setRunPage,
                    showSizeChanger: false,
                    hideOnSinglePage: true,
                  }}
                  rowKey="id"
                  scroll={{ x: 1100 }}
                />
              ),
            },
          ]}
        />
        {tab === 'events' && (
          <p className={styles.baselineNote}>
            首次检查发现的存量条目只作基线记录。需要处理某一条时，可手动执行。
          </p>
        )}
      </div>

      <Drawer
        destroyOnHidden
        extra={
          detail &&
          (detail.run.status === 'failed' ||
            detail.run.status === 'partial') ? (
            <Button
              icon={<ReloadOutlined />}
              loading={busyRunID === detail.run.id}
              onClick={() => changeRun(detail.run.id, 'retry')}
              type="primary"
            >
              重试运行
            </Button>
          ) : undefined
        }
        onClose={() => {
          setDetailID(undefined);
          setDetail(undefined);
        }}
        loading={detailLoading}
        open={Boolean(detailID)}
        size="large"
        title={`运行 #${detailID || ''}`}
      >
        {detailError && (
          <Alert
            showIcon
            title="无法更新运行详情"
            description={detailError}
            type="error"
          />
        )}
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
                  key: 'trigger',
                  label: '触发方式',
                  children:
                    detail.run.trigger_mode === 'manual' ? (
                      <Space>
                        <Tag color="blue">
                          {detail.run.repeated_from_run_id
                            ? '手动重跑'
                            : '手动执行'}
                        </Tag>
                        {detail.run.repeated_from_run_id && (
                          <Text type="secondary">
                            来源运行 #{detail.run.repeated_from_run_id}
                          </Text>
                        )}
                      </Space>
                    ) : (
                      '自动触发'
                    ),
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
                  key: 'execution',
                  label: '执行次数',
                  children: `第 ${detail.run.execution_no || 1} 次`,
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
            <section className={styles.nodeSection} aria-label="节点执行过程">
              <h3>
                节点执行过程{' '}
                <span>
                  {
                    detail.node_runs.filter(
                      (node) => node.status === 'succeeded',
                    ).length
                  }{' '}
                  / {detail.node_runs.length} 已完成
                </span>
              </h3>
              {detail.node_runs.length === 0 && (
                <Empty description="流程等待调度，尚无节点记录" />
              )}
              <ol className={styles.nodes}>
                {detail.node_runs.map((node) => {
                  const meta = runStatusMeta[
                    node.status as AutomationRunStatus
                  ] || {
                    color: 'default',
                    label:
                      (
                        {
                          skipped: '已跳过',
                          waiting: '等待中',
                          retrying: '等待重试',
                        } as Record<string, string>
                      )[node.status] || node.status,
                  };
                  return (
                    <li className={styles.node} key={node.id}>
                      <span
                        className={styles.nodeIcon}
                        data-status={node.status}
                      >
                        {node.status === 'succeeded' ? (
                          <CheckCircleOutlined />
                        ) : node.status === 'failed' ? (
                          <ExclamationCircleOutlined />
                        ) : (
                          <ClockCircleOutlined />
                        )}
                      </span>
                      <div className={styles.nodeContent}>
                        <div className={styles.nodeHeading}>
                          <strong>
                            {node.node_name ||
                              automationNodeLabel({
                                id: node.node_id,
                                type: node.node_type,
                                position: { x: 0, y: 0 },
                              })}
                          </strong>
                          <Tag color={meta.color}>{meta.label}</Tag>
                        </div>
                        <p className={styles.nodeMeta}>
                          尝试 {node.attempt} / {node.max_attempts}
                          {node.started_at
                            ? ` · ${formatTime(node.started_at)}`
                            : ''}
                        </p>
                        {node.next_attempt_at && (
                          <p className={styles.nodeMeta}>
                            计划继续：{formatTime(node.next_attempt_at)}
                          </p>
                        )}
                        {node.error_message && (
                          <Alert
                            showIcon
                            title={node.error_message}
                            type="error"
                          />
                        )}
                        {(node.input_json || node.output_json) && (
                          <Collapse
                            ghost
                            items={[
                              {
                                key: 'data',
                                label: '查看输入与输出',
                                children: (
                                  <div className={styles.nodeData}>
                                    {node.input_json && (
                                      <>
                                        <h4>输入</h4>
                                        <pre>{formatJSON(node.input_json)}</pre>
                                      </>
                                    )}
                                    {node.output_json && (
                                      <>
                                        <h4>输出</h4>
                                        <pre>
                                          {formatJSON(node.output_json)}
                                        </pre>
                                      </>
                                    )}
                                  </div>
                                ),
                              },
                            ]}
                            size="small"
                          />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          </Space>
        )}
      </Drawer>
    </>
  );
};

export default AutomationHistory;
