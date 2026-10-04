import {
  ApartmentOutlined,
  ArrowRightOutlined,
  BellOutlined,
  BranchesOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  FolderOpenOutlined,
  HistoryOutlined,
  MoreOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  RadarChartOutlined,
  ScanOutlined,
  SearchOutlined,
  ThunderboltOutlined,
  WifiOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Checkbox,
  Dropdown,
  Empty,
  Input,
  Popconfirm,
  Segmented,
  Select,
  Skeleton,
  Switch,
  Tag,
  Tooltip,
} from 'antd';
import { useMemo, useState } from 'react';
import type {
  AutomationBatchInput,
  AutomationDashboard,
  AutomationRunStatus,
  AutomationSource,
} from '@/services/film-fusion';
import styles from './AutomationOverview.module.less';
import managementStyles from './Management.module.less';
import {
  automationNeedsAttention,
  automationNodeLabel,
  automationStatus,
  formatAutomationTime,
  runStatusMeta,
  workflowPreview,
} from './presentation';

export type HistorySelection = {
  sourceID?: number;
  runID?: number;
  status?: AutomationRunStatus;
};

type AutomationOverviewProps = {
  dashboard: AutomationDashboard;
  cloudStorages: API.CloudStorage[];
  loading: boolean;
  scanningID?: number;
  togglingID?: number;
  copyingID?: number;
  batchBusy: boolean;
  onBatch: (input: AutomationBatchInput) => Promise<void>;
  onManage: (
    source: AutomationSource,
    action: 'parameters' | 'template' | 'versions' | 'settings',
  ) => void;
  onCreate: () => void;
  onCopy: (source: AutomationSource) => void;
  onEdit: (source: AutomationSource) => void;
  onScan: (source: AutomationSource) => void;
  onToggle: (source: AutomationSource, enabled: boolean) => void;
  onRemove: (source: AutomationSource) => Promise<void>;
  onHistory: (selection?: HistorySelection) => void;
};

const AutomationOverview = ({
  dashboard,
  cloudStorages,
  loading,
  scanningID,
  togglingID,
  copyingID,
  batchBusy,
  onBatch,
  onManage,
  onCreate,
  onCopy,
  onEdit,
  onScan,
  onToggle,
  onRemove,
  onHistory,
}: AutomationOverviewProps) => {
  const [query, setQuery] = useState('');
  const [trigger, setTrigger] = useState('all');
  const [filter, setFilter] = useState('all');
  const [group, setGroup] = useState('all');
  const [selectedIDs, setSelectedIDs] = useState<number[]>([]);
  const [batchGroup, setBatchGroup] = useState('');
  const settings = new Map(
    dashboard.settings?.map((item) => [item.source_id, item]),
  );
  const groups = [
    ...new Set(
      dashboard.settings?.map((item) => item.group_name).filter(Boolean),
    ),
  ].sort();
  const selected = selectedIDs.filter((id) =>
    dashboard.sources.some((source) => source.id === id),
  );
  const batch = async (action: AutomationBatchInput['action']) => {
    try {
      await onBatch({ action, source_ids: selected, group_name: batchGroup });
      setSelectedIDs([]);
    } catch {
      /* The page displays the failure; retain the selection for retry. */
    }
  };
  const workflows = useMemo(
    () =>
      new Map(
        dashboard.workflows.map((workflow) => [workflow.source_id, workflow]),
      ),
    [dashboard.workflows],
  );
  const latestRuns = useMemo(() => {
    const result = new Map<number, (typeof dashboard.recent_runs)[number]>();
    for (const run of [...dashboard.recent_runs].sort((a, b) => b.id - a.id)) {
      if (!result.has(run.workflow_id)) result.set(run.workflow_id, run);
    }
    return result;
  }, [dashboard.recent_runs]);
  const runForSource = (source: AutomationSource) =>
    latestRuns.get(workflows.get(source.id)?.id || 0);
  const attentionCount = dashboard.sources.filter((source) =>
    automationNeedsAttention(
      source,
      workflows.get(source.id),
      runForSource(source),
    ),
  ).length;
  const enabledCount = dashboard.sources.filter(
    (source) => source.enabled,
  ).length;
  const visibleSources = dashboard.sources.filter((source) => {
    const text =
      `${source.name} ${source.description} ${source.directory_path || ''} ${source.feed_url || ''}`.toLowerCase();
    return (
      text.includes(query.trim().toLowerCase()) &&
      (group === 'all' ||
        `group:${settings.get(source.id)?.group_name || ''}` === group) &&
      (trigger === 'all' || source.trigger_type === trigger) &&
      (filter === 'all' ||
        (filter === 'enabled' && source.enabled) ||
        (filter === 'paused' && !source.enabled) ||
        (filter === 'attention' &&
          automationNeedsAttention(
            source,
            workflows.get(source.id),
            runForSource(source),
          )))
    );
  });
  const recentRuns = [...dashboard.recent_runs]
    .sort((a, b) => b.id - a.id)
    .slice(0, 6);

  if (loading)
    return (
      <div className={styles.loading}>
        <Skeleton active paragraph={{ rows: 3 }} />
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    );

  return (
    <div className={styles.overview}>
      {(dashboard.alerts?.length || 0) > 0 && (
        <div className={managementStyles.stack} style={{ marginBottom: 20 }}>
          {dashboard.alerts?.map((alert) => (
            <Alert
              key={alert.id}
              type="warning"
              showIcon
              title={`${dashboard.sources.find((source) => source.id === alert.source_id)?.name || '自动化'} · 异常提醒`}
              description={`${alert.message}${alert.last_error ? `；通知未完整送达：${alert.last_error}` : ''}`}
              action={
                <Button
                  size="small"
                  onClick={() => onHistory({ sourceID: alert.source_id })}
                >
                  查看运行
                </Button>
              }
            />
          ))}
        </div>
      )}
      {dashboard.sources.length > 0 && (
        <section className={styles.metrics} aria-label="自动化运行概况">
          <div className={styles.metric}>
            <span className={styles.metricLabel}>
              <RadarChartOutlined /> 已启用
            </span>
            <strong>
              {enabledCount}
              <span> / {dashboard.sources.length}</span>
            </strong>
            <span className={styles.metricHint}>条自动化持续监控新内容</span>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>
              <ThunderboltOutlined /> 执行中
            </span>
            <strong>
              {dashboard.running_nodes}
              <span> 个节点</span>
            </strong>
            <span className={styles.metricHint}>
              {dashboard.scanning_count} 个触发器正在检查
            </span>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>
              <ClockCircleOutlined /> 等待执行
            </span>
            <strong>
              {dashboard.pending_nodes}
              <span> 个节点</span>
            </strong>
            <span className={styles.metricHint}>等待调度、延迟或重试</span>
          </div>
          <button
            className={`${styles.metric} ${styles.metricButton}`}
            onClick={() => onHistory()}
            type="button"
          >
            <span className={styles.metricLabel}>
              <ExclamationCircleOutlined /> 异常运行 <ArrowRightOutlined />
            </span>
            <strong data-tone={dashboard.failed_runs ? 'error' : undefined}>
              {dashboard.failed_runs}
              <span> 次</span>
            </strong>
            <span className={styles.metricHint}>失败及部分成功 · 全部历史</span>
          </button>
        </section>
      )}

      <div className={styles.workspace}>
        <section className={styles.main} aria-label="自动化列表">
          <div className={styles.sectionHeading}>
            <div>
              <h2>
                我的自动化 <span>{dashboard.sources.length}</span>
              </h2>
              <p>从发现新内容，到完成每一步处理。</p>
            </div>
            {attentionCount > 0 && (
              <button
                className={styles.attentionLink}
                onClick={() => setFilter('attention')}
                type="button"
              >
                <ExclamationCircleOutlined /> {attentionCount} 条需要关注
              </button>
            )}
          </div>
          {dashboard.sources.length > 0 && (
            <div className={styles.toolbar}>
              <Segmented
                aria-label="触发器类型"
                onChange={setTrigger}
                options={[
                  { label: '全部', value: 'all' },
                  { label: 'RSS', value: 'rss' },
                  { label: '115 目录', value: '115_directory' },
                ]}
                value={trigger}
              />
              <div className={styles.searchControls}>
                <Input
                  allowClear
                  aria-label="搜索自动化"
                  className={styles.search}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索名称或来源"
                  prefix={<SearchOutlined />}
                  value={query}
                />
                <Select
                  aria-label="自动化分组"
                  style={{ minWidth: 130 }}
                  value={group}
                  onChange={setGroup}
                  options={[
                    { value: 'all', label: '全部分组' },
                    { value: 'group:', label: '未分组' },
                    ...groups.map((name) => ({
                      value: `group:${name}`,
                      label: name,
                    })),
                  ]}
                />
                <Select
                  aria-label="自动化状态"
                  className={styles.statusFilter}
                  onChange={setFilter}
                  options={[
                    { value: 'all', label: '全部状态' },
                    { value: 'enabled', label: '已启用' },
                    { value: 'paused', label: '已停用' },
                    { value: 'attention', label: '需关注' },
                  ]}
                  value={filter}
                />
              </div>
            </div>
          )}

          {visibleSources.length > 0 && (
            <div className={managementStyles.batch}>
              <Checkbox
                aria-label="选择当前列表"
                checked={visibleSources.every((source) =>
                  selected.includes(source.id),
                )}
                indeterminate={
                  visibleSources.some((source) =>
                    selected.includes(source.id),
                  ) &&
                  !visibleSources.every((source) =>
                    selected.includes(source.id),
                  )
                }
                onChange={(event) =>
                  setSelectedIDs(
                    event.target.checked
                      ? [
                          ...new Set([
                            ...selected,
                            ...visibleSources.map((source) => source.id),
                          ]),
                        ]
                      : selected.filter(
                          (id) =>
                            !visibleSources.some((source) => source.id === id),
                        ),
                  )
                }
              />
              <span>已选 {selected.length} 条</span>
              {selected.length > 0 && (
                <>
                  <Button
                    size="small"
                    disabled={batchBusy}
                    onClick={() => void batch('enable')}
                  >
                    批量启用
                  </Button>
                  <Button
                    size="small"
                    disabled={batchBusy}
                    onClick={() => void batch('disable')}
                  >
                    批量停用
                  </Button>
                  <Input
                    aria-label="批量分组名称"
                    style={{ width: 190 }}
                    size="small"
                    maxLength={80}
                    value={batchGroup}
                    onChange={(event) => setBatchGroup(event.target.value)}
                    placeholder="分组名，留空取消分组"
                  />
                  <Button
                    size="small"
                    loading={batchBusy}
                    onClick={() => void batch('group')}
                  >
                    设置分组
                  </Button>
                  <Button
                    size="small"
                    type="text"
                    onClick={() => setSelectedIDs([])}
                    disabled={batchBusy}
                  >
                    取消选择
                  </Button>
                </>
              )}
            </div>
          )}

          {dashboard.sources.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyFlow}>
                <WifiOutlined />
                <span />
                <ApartmentOutlined />
                <span />
                <CheckCircleOutlined />
              </div>
              <h3>让重复的工作，自动完成</h3>
              <p>
                订阅更新后自动下载，或在 115 目录出现新媒体时识别、整理并通知。
              </p>
              <Button
                icon={<PlusOutlined />}
                onClick={onCreate}
                size="large"
                type="primary"
              >
                创建第一条自动化
              </Button>
              <span className={styles.emptyNote}>
                从一个触发器开始，逐步配置处理流程
              </span>
            </div>
          ) : visibleSources.length === 0 ? (
            <div className={styles.emptyState}>
              <Empty description="没有符合条件的自动化">
                <Button
                  onClick={() => {
                    setQuery('');
                    setTrigger('all');
                    setFilter('all');
                    setGroup('all');
                  }}
                >
                  清除筛选
                </Button>
              </Empty>
            </div>
          ) : (
            <div className={styles.cards}>
              {visibleSources.map((source) => {
                const workflow = workflows.get(source.id);
                const latestRun = runForSource(source);
                const status = automationStatus(source, workflow, latestRun);
                const preview = workflowPreview(workflow?.definition_json);
                const isRSS = source.trigger_type === 'rss';
                const storageName = cloudStorages.find(
                  (storage) => storage.id === source.cloud_storage_id,
                )?.storage_name;
                const origin = isRSS
                  ? source.feed_url
                  : source.directory_path || '/';
                const error =
                  source.last_error ||
                  (latestRun?.status === 'failed' ||
                  latestRun?.status === 'partial'
                    ? latestRun.error_message ||
                      '最近一次运行未全部完成，查看运行详情'
                    : undefined);
                return (
                  <article
                    className={styles.automationCard}
                    data-paused={!source.enabled || undefined}
                    key={source.id}
                  >
                    <div className={styles.cardHeading}>
                      <Checkbox
                        aria-label={`选择${source.name}`}
                        checked={selected.includes(source.id)}
                        disabled={batchBusy}
                        onChange={(event) =>
                          setSelectedIDs(
                            event.target.checked
                              ? [...selected, source.id]
                              : selected.filter((id) => id !== source.id),
                          )
                        }
                      />
                      <span
                        className={styles.sourceIcon}
                        data-kind={source.trigger_type}
                      >
                        {isRSS ? <WifiOutlined /> : <FolderOpenOutlined />}
                      </span>
                      <div className={styles.cardTitle}>
                        <span className={styles.typeLabel}>
                          {isRSS ? 'RSS / ATOM' : '115 目录'}
                          {workflow && <span>v{workflow.version}</span>}
                        </span>
                        <h3>{source.name}</h3>
                        {settings.get(source.id)?.group_name && (
                          <Tag>{settings.get(source.id)?.group_name}</Tag>
                        )}
                      </div>
                      <Tooltip
                        title={
                          source.enabled
                            ? '停用后不再检查新内容'
                            : '启用后继续检查新内容'
                        }
                      >
                        <Switch
                          aria-label={`${source.name}启用状态`}
                          checked={source.enabled}
                          disabled={
                            togglingID !== undefined && togglingID !== source.id
                          }
                          loading={togglingID === source.id}
                          onChange={(enabled) => onToggle(source, enabled)}
                          size="small"
                        />
                      </Tooltip>
                    </div>
                    <p className={styles.description}>
                      {source.description ||
                        (isRSS
                          ? '发现订阅更新，自动处理新增条目'
                          : '等待新媒体稳定后，自动进入处理流程')}
                    </p>
                    <div className={styles.origin}>
                      <span>
                        {isRSS ? <WifiOutlined /> : <FolderOpenOutlined />}
                      </span>
                      <Tooltip title={origin}>
                        <span className={styles.originText}>{origin}</span>
                      </Tooltip>
                      {!isRSS && storageName && (
                        <span
                          className={styles.storageName}
                          title={storageName}
                        >
                          {storageName}
                        </span>
                      )}
                    </div>
                    <div className={styles.flowPreview}>
                      <div className={styles.flowCaption}>
                        <span>
                          <BranchesOutlined />{' '}
                          {preview.linear ? '处理流程' : '节点概览'}
                        </span>
                        <span>
                          {preview.nodes.length} 个处理节点
                          {!preview.linear && preview.nodes.length > 0
                            ? ' · 查看编辑器了解连接'
                            : ''}
                        </span>
                      </div>
                      <div className={styles.flowSteps}>
                        <span className={styles.triggerStep}>
                          {isRSS ? '订阅更新' : '新增媒体'}
                        </span>
                        {preview.invalid ? (
                          <span className={styles.unavailableFlow}>
                            流程配置无法读取
                          </span>
                        ) : preview.nodes.length === 0 ? (
                          <>
                            <ArrowRightOutlined />
                            <span className={styles.flowStep}>记录事件</span>
                          </>
                        ) : (
                          preview.nodes.slice(0, 3).map((node, index) => (
                            <span
                              className={styles.flowStepGroup}
                              key={node.id || `${node.type}-${index}`}
                            >
                              <span className={styles.flowConnector}>
                                {preview.linear ? <ArrowRightOutlined /> : '·'}
                              </span>
                              <Tooltip title={automationNodeLabel(node)}>
                                <span className={styles.flowStep}>
                                  {automationNodeLabel(node)}
                                </span>
                              </Tooltip>
                            </span>
                          ))
                        )}
                        {preview.nodes.length > 3 && (
                          <Tooltip
                            title={preview.nodes
                              .slice(3)
                              .map(automationNodeLabel)
                              .join('、')}
                          >
                            <span className={styles.moreSteps}>
                              +{preview.nodes.length - 3}
                            </span>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                    <div className={styles.cardStatus}>
                      <span className={styles.status} data-tone={status.tone}>
                        <i />
                        {status.label}
                      </span>
                      <span>
                        {isRSS
                          ? `每 ${source.interval_minutes || 5} 分钟检查`
                          : `每 ${source.interval_seconds || 300} 秒检查`}
                      </span>
                    </div>
                    <div className={styles.lastCheck}>
                      {!source.enabled ? (
                        <>
                          <PauseCircleOutlined /> 已停用，不再检查
                          {isRSS ? ' RSS 源' : '目录'}
                        </>
                      ) : (
                        <>
                          <ClockCircleOutlined /> 最近检查：
                          {formatAutomationTime(source.last_checked_at)}
                        </>
                      )}
                    </div>
                    {error && (
                      <button
                        className={styles.cardError}
                        onClick={() =>
                          source.last_error
                            ? onEdit(source)
                            : onHistory({
                                sourceID: source.id,
                                runID: latestRun?.id,
                              })
                        }
                        title={error}
                        type="button"
                      >
                        <ExclamationCircleOutlined />
                        <span>{error}</span>
                        <ArrowRightOutlined />
                      </button>
                    )}
                    <div className={styles.cardFooter}>
                      <div className={styles.cardActions}>
                        <Button
                          icon={<ScanOutlined />}
                          disabled={
                            scanningID !== undefined && scanningID !== source.id
                          }
                          loading={scanningID === source.id}
                          onClick={() => onScan(source)}
                          size="small"
                        >
                          立即检查
                        </Button>
                        <Button
                          icon={<HistoryOutlined />}
                          onClick={() => onHistory({ sourceID: source.id })}
                          size="small"
                          type="text"
                        >
                          运行
                        </Button>
                      </div>
                      <div className={styles.cardActions}>
                        <Tooltip title="复制配置并进入编辑，副本默认停用">
                          <Button
                            aria-label={`复制${source.name}`}
                            disabled={
                              !workflow ||
                              (copyingID !== undefined &&
                                copyingID !== source.id)
                            }
                            icon={<CopyOutlined />}
                            loading={copyingID === source.id}
                            onClick={() => onCopy(source)}
                            size="small"
                            type="text"
                          >
                            复制
                          </Button>
                        </Tooltip>
                        <Button
                          icon={<EditOutlined />}
                          onClick={() => onEdit(source)}
                          size="small"
                          type="text"
                        >
                          编辑
                        </Button>
                        <Popconfirm
                          description="触发器状态、流程、事件和运行历史都会一起删除。"
                          onConfirm={() => onRemove(source)}
                          title="彻底删除这条自动化？"
                        >
                          <Button
                            aria-label={`删除${source.name}`}
                            danger
                            icon={<DeleteOutlined />}
                            size="small"
                            type="text"
                          />
                        </Popconfirm>
                        <Dropdown
                          trigger={['click']}
                          menu={{
                            items: [
                              { key: 'parameters', label: '流程参数' },
                              { key: 'template', label: '保存为模板' },
                              { key: 'versions', label: '版本历史' },
                              { key: 'settings', label: '分组与异常提醒' },
                            ],
                            onClick: ({ key }) =>
                              onManage(
                                source,
                                key as
                                  | 'parameters'
                                  | 'template'
                                  | 'versions'
                                  | 'settings',
                              ),
                          }}
                        >
                          <Button
                            aria-label={`${source.name}更多操作`}
                            icon={<MoreOutlined />}
                            size="small"
                            type="text"
                          />
                        </Dropdown>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <aside className={styles.activity} aria-label="最近运行">
          <div className={styles.activityHeading}>
            <h2>
              <HistoryOutlined /> 最近运行
            </h2>
            <Button onClick={() => onHistory()} size="small" type="text">
              全部 <ArrowRightOutlined />
            </Button>
          </div>
          <p className={styles.activitySubtitle}>跟踪执行结果，及时处理异常</p>
          {recentRuns.length === 0 ? (
            <div className={styles.activityEmpty}>
              <PlayCircleOutlined />
              <strong>等待第一次运行</strong>
              <p>
                新内容触发流程后，执行进度会出现在这里。首次检查仅建立存量基线。
              </p>
            </div>
          ) : (
            <div className={styles.activityList}>
              {recentRuns.map((run) => {
                const meta = runStatusMeta[run.status];
                return (
                  <button
                    className={styles.activityItem}
                    key={run.id}
                    onClick={() => onHistory({ runID: run.id })}
                    type="button"
                  >
                    <span
                      className={styles.activityDot}
                      data-status={run.status}
                    >
                      {run.status === 'succeeded' ? (
                        <CheckCircleOutlined />
                      ) : run.status === 'failed' ||
                        run.status === 'partial' ? (
                        <ExclamationCircleOutlined />
                      ) : (
                        <ClockCircleOutlined />
                      )}
                    </span>
                    <span className={styles.activityContent}>
                      <span className={styles.activityTitle}>
                        {run.workflow_name}
                      </span>
                      <span className={styles.activityMeta}>
                        <Tag color={meta.color}>{meta.label}</Tag>
                        <span>#{run.id}</span>
                      </span>
                      <span className={styles.activityTime}>
                        {formatAutomationTime(run.started_at || run.created_at)}
                      </span>
                      {run.error_message && (
                        <span
                          className={styles.activityError}
                          title={run.error_message}
                        >
                          {run.error_message}
                        </span>
                      )}
                    </span>
                    <ArrowRightOutlined className={styles.activityArrow} />
                  </button>
                );
              })}
            </div>
          )}
          <div className={styles.activityFootnote}>
            <BellOutlined />
            <span>
              累计发现 <strong>{dashboard.total_entries}</strong> 条内容
              <br />
              运行记录保留每个节点的执行结果
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default AutomationOverview;
