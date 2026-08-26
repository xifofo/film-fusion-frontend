import '@xyflow/react/dist/style.css';

import {
  ArrowLeftOutlined,
  DeleteOutlined,
  EditOutlined,
  FolderOpenOutlined,
  PlusOutlined,
  ReloadOutlined,
  ScanOutlined,
} from '@ant-design/icons';
import type { TableProps } from 'antd';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  message,
  Popconfirm,
  Row,
  Space,
  Statistic,
  Switch,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import ConsolePage from '@/components/ConsolePage';
import RSSAutomationWizard from '@/pages/rss-automation/AutomationWizard';
import RSSSourcePanel from '@/pages/rss-automation/SourcePanel';
import RSSWorkflowPanel from '@/pages/rss-automation/WorkflowPanel';
import type {
  AutomationCreateInput,
  AutomationDashboard,
  AutomationSource,
  AutomationTriggerType,
  RSSAutomationSource,
} from '@/services/film-fusion';
import {
  createAutomation,
  deleteAutomation,
  getAutomationDashboard,
  getCloudDirectoryList,
  getCloudStorageList,
  scanAutomation,
  setAutomationEnabled,
  updateAutomation,
} from '@/services/film-fusion';
import AutomationEditorModal from './AutomationEditorModal';
import AutomationHistory from './AutomationHistory';
import TriggerSelectorModal from './TriggerSelectorModal';
import { readAutomationActions } from './workflow';

const { Link, Text } = Typography;

type PageView = 'overview' | 'rss-create' | 'rss-edit';

const emptyDashboard = (): AutomationDashboard => ({
  sources: [],
  workflows: [],
  targets: [],
  recent_runs: [],
  total_entries: 0,
  pending_nodes: 0,
  running_nodes: 0,
  failed_runs: 0,
  scanning_count: 0,
  node_protocols: [],
});

const formatTime = (value?: string) =>
  value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '--';

const workflowNodeTypes = (definitionJSON?: string) => {
  try {
    const definition = JSON.parse(definitionJSON || '') as {
      nodes?: Array<{ type?: string }>;
    };
    return new Set(
      (definition.nodes || []).map((node) => node.type).filter(Boolean),
    );
  } catch {
    return new Set<string>();
  }
};

const AutomationPage = () => {
  const [dashboard, setDashboard] =
    useState<AutomationDashboard>(emptyDashboard);
  const [cloudStorages, setCloudStorages] = useState<API.CloudStorage[]>([]);
  const [cloudDirectories, setCloudDirectories] = useState<
    API.CloudDirectory[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<PageView>('overview');
  const [triggerSelectorOpen, setTriggerSelectorOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingSourceID, setEditingSourceID] = useState<number>();
  const [scanningID, setScanningID] = useState<number>();
  const [togglingID, setTogglingID] = useState<number>();
  const [historyRefreshToken, setHistoryRefreshToken] = useState(0);
  const [messageApi, contextHolder] = message.useMessage();

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [dashboardResponse, storageResponse, directoryResponse] =
          await Promise.all([
            getAutomationDashboard(),
            getCloudStorageList({ current: 1, pageSize: 500 }),
            getCloudDirectoryList({ current: 1, pageSize: 500 }),
          ]);
        if (dashboardResponse.code !== 0 || !dashboardResponse.data) {
          throw new Error(dashboardResponse.message || '获取自动化信息失败');
        }
        setDashboard(dashboardResponse.data);
        if (storageResponse.code === 0 && storageResponse.data) {
          setCloudStorages(storageResponse.data.list || []);
        }
        if (directoryResponse.code === 0 && directoryResponse.data) {
          setCloudDirectories(directoryResponse.data.list || []);
        }
      } catch (error: any) {
        if (!silent) {
          messageApi.error(
            error?.data || error?.message || '获取自动化信息失败',
          );
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [messageApi],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (view !== 'overview' || editorOpen || triggerSelectorOpen) return;
    const timer = window.setInterval(() => void load(true), 15_000);
    return () => window.clearInterval(timer);
  }, [editorOpen, load, triggerSelectorOpen, view]);

  const storageByID = useMemo(
    () => new Map(cloudStorages.map((storage) => [storage.id, storage])),
    [cloudStorages],
  );
  const workflowBySourceID = useMemo(
    () =>
      new Map(
        dashboard.workflows.map((workflow) => [workflow.source_id, workflow]),
      ),
    [dashboard.workflows],
  );
  const editingSource = dashboard.sources.find(
    (source) => source.id === editingSourceID,
  );
  const editingWorkflow = editingSource
    ? workflowBySourceID.get(editingSource.id)
    : undefined;
  const editingRSSSource =
    editingSource?.trigger_type === 'rss'
      ? (editingSource as RSSAutomationSource)
      : undefined;

  const rssCount = dashboard.sources.filter(
    (source) => source.trigger_type === 'rss',
  ).length;
  const directoryCount = dashboard.sources.length - rssCount;

  const returnToOverview = () => {
    setView('overview');
    setEditorOpen(false);
    setEditingSourceID(undefined);
  };

  const openCreate = () => {
    setEditingSourceID(undefined);
    setTriggerSelectorOpen(true);
  };

  const selectTrigger = (trigger: AutomationTriggerType) => {
    setTriggerSelectorOpen(false);
    if (trigger === 'rss') {
      setView('rss-create');
      return;
    }
    setEditorOpen(true);
  };

  const openEdit = (source: AutomationSource) => {
    setEditingSourceID(source.id);
    if (source.trigger_type === 'rss') {
      setView('rss-edit');
      return;
    }
    setEditorOpen(true);
  };

  const saveAutomation = async (input: AutomationCreateInput) => {
    try {
      const response = editingSource
        ? await updateAutomation(editingSource.id, input)
        : await createAutomation(input);
      if (response.code !== 0 || !response.data) {
        throw new Error(response.message || '保存自动化失败');
      }
      messageApi.success(editingSource ? '自动化已更新' : '自动化已创建');
      setEditorOpen(false);
      setEditingSourceID(undefined);
      await load(true);
      setHistoryRefreshToken((value) => value + 1);
    } catch (error: any) {
      messageApi.error(error?.data || error?.message || '保存自动化失败');
      throw error;
    }
  };

  const toggleAutomation = async (
    source: AutomationSource,
    enabled: boolean,
  ) => {
    setTogglingID(source.id);
    try {
      const response = await setAutomationEnabled(source.id, enabled);
      if (response.code !== 0) {
        throw new Error(response.message || '更新启用状态失败');
      }
      messageApi.success(enabled ? '自动化已启用' : '自动化已停用');
      await load(true);
    } catch (error: any) {
      messageApi.error(error?.data || error?.message || '更新启用状态失败');
    } finally {
      setTogglingID(undefined);
    }
  };

  const runScan = async (source: AutomationSource) => {
    setScanningID(source.id);
    try {
      const response = await scanAutomation(source.id);
      if (response.code !== 0 || !response.data) {
        throw new Error(response.message || '增量检查失败');
      }
      const result = response.data;
      if (source.trigger_type === 'rss') {
        if (result.baseline) {
          messageApi.success(
            `RSS 基线建立完成：读取 ${result.fetched || 0} 条，未触发历史下载`,
          );
        } else if (result.not_modified) {
          messageApi.success('RSS 内容没有变化');
        } else {
          messageApi.success(
            `RSS 刷新完成：新增 ${result.new_entries || 0} 条，创建 ${result.created_runs} 次运行`,
          );
        }
      } else if (result.baseline) {
        messageApi.success(
          `115 基线建立完成：扫描 ${result.scanned_items} 个对象，未触发存量内容`,
        );
      } else {
        messageApi.success(
          `扫描 ${result.scanned_items} 个对象，创建 ${result.created_runs} 次运行，${result.pending_stable} 个对象等待稳定`,
        );
      }
      await load(true);
      setHistoryRefreshToken((value) => value + 1);
    } catch (error: any) {
      messageApi.error(error?.data || error?.message || '增量检查失败');
    } finally {
      setScanningID(undefined);
    }
  };

  const removeAutomation = async (source: AutomationSource) => {
    try {
      const response = await deleteAutomation(source.id);
      if (response.code !== 0) {
        throw new Error(response.message || '删除自动化失败');
      }
      messageApi.success('自动化、触发器状态和运行历史已删除');
      await load(true);
      setHistoryRefreshToken((value) => value + 1);
    } catch (error: any) {
      messageApi.error(error?.data || error?.message || '删除自动化失败');
    }
  };

  const columns: TableProps<AutomationSource>['columns'] = [
    {
      title: '自动化',
      width: 220,
      render: (_, source) => (
        <Space orientation="vertical" size={2}>
          <Text strong>{source.name}</Text>
          <Tag color={source.trigger_type === 'rss' ? 'orange' : 'blue'}>
            {source.trigger_type === 'rss' ? 'RSS / Atom' : '115 目录'}
          </Tag>
          {source.description && (
            <Text ellipsis={{ tooltip: source.description }} type="secondary">
              {source.description}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: '触发器配置',
      render: (_, source) =>
        source.trigger_type === 'rss' ? (
          <Space orientation="vertical" size={2}>
            <Tooltip title={source.feed_url}>
              <Link
                ellipsis
                href={source.feed_url}
                rel="noreferrer"
                style={{ maxWidth: 340 }}
                target="_blank"
              >
                {source.feed_url}
              </Link>
            </Tooltip>
            <Text type="secondary">
              每 {source.interval_minutes || 5} 分钟增量刷新
            </Text>
          </Space>
        ) : (
          <Space orientation="vertical" size={2}>
            <Space>
              <Tag color="blue">
                {storageByID.get(source.cloud_storage_id || 0)?.storage_name ||
                  `账号 #${source.cloud_storage_id}`}
              </Tag>
              {source.recursive && <Tag>包含子目录</Tag>}
            </Space>
            <Tooltip title={source.directory_path}>
              <Text ellipsis style={{ maxWidth: 300 }}>
                <FolderOpenOutlined /> {source.directory_path}
              </Text>
            </Tooltip>
            <Text type="secondary">
              每 {source.interval_seconds} 秒检查 · 静默期{' '}
              {source.quiet_seconds} 秒
            </Text>
          </Space>
        ),
    },
    {
      title: '后续操作',
      width: 290,
      render: (_, source) => {
        const workflow = workflowBySourceID.get(source.id);
        const actions = readAutomationActions(workflow);
        const nodeTypes = workflowNodeTypes(workflow?.definition_json);
        return (
          <Space wrap>
            {nodeTypes.has('qbittorrent') && (
              <Tag color="green">qBittorrent 下载</Tag>
            )}
            {(nodeTypes.has('offline115') ||
              nodeTypes.has('offline115_openapi')) && (
              <Tag color="blue">115 离线下载</Tag>
            )}
            {actions.recognition === 'local' && (
              <Tag color="purple">本地识别</Tag>
            )}
            {actions.recognition === 'moviepilot' && (
              <Tag color="blue">仅 MP2</Tag>
            )}
            {actions.recognition === 'shadow' && (
              <Tag color="purple">影子模式</Tag>
            )}
            {actions.organize_enabled && <Tag color="cyan">整理 + STRM</Tag>}
            {actions.notification_enabled && <Tag color="gold">发送通知</Tag>}
            {nodeTypes.size <= 2 && <Tag>仅记录事件</Tag>}
          </Space>
        );
      },
    },
    {
      title: '触发状态',
      width: 220,
      render: (_, source) => {
        const status = !source.enabled
          ? { color: 'default', label: '已停用' }
          : source.last_error
            ? { color: 'error', label: '检查失败' }
            : source.initialized
              ? { color: 'success', label: '增量监听中' }
              : { color: 'processing', label: '等待首次基线' };
        return (
          <Space orientation="vertical" size={2}>
            <Tag color={status.color}>{status.label}</Tag>
            <Text type="secondary">
              最近成功：{formatTime(source.last_success_at)}
            </Text>
            {source.last_error && (
              <Text ellipsis={{ tooltip: source.last_error }} type="danger">
                {source.last_error}
              </Text>
            )}
          </Space>
        );
      },
    },
    {
      title: '启用',
      width: 80,
      render: (_, source) => (
        <Switch
          checked={source.enabled}
          loading={togglingID === source.id}
          onChange={(enabled) => toggleAutomation(source, enabled)}
          size="small"
        />
      ),
    },
    {
      title: '操作',
      fixed: 'right',
      width: 250,
      render: (_, source) => (
        <Space>
          <Button
            icon={<ScanOutlined />}
            loading={scanningID === source.id}
            onClick={() => runScan(source)}
            size="small"
          >
            立即检查
          </Button>
          <Button
            icon={<EditOutlined />}
            onClick={() => openEdit(source)}
            size="small"
          >
            编辑
          </Button>
          <Popconfirm
            description="触发器状态、流程、事件和运行历史都会一起删除。"
            onConfirm={() => removeAutomation(source)}
            title="彻底删除这条自动化？"
          >
            <Button danger icon={<DeleteOutlined />} size="small" />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const pageActions =
    view === 'overview' ? (
      <Space>
        <Button icon={<ReloadOutlined />} onClick={() => load()}>
          刷新
        </Button>
        <Button icon={<PlusOutlined />} onClick={openCreate} type="primary">
          新建自动化
        </Button>
      </Space>
    ) : (
      <Button icon={<ArrowLeftOutlined />} onClick={returnToOverview}>
        返回自动化列表
      </Button>
    );

  return (
    <ConsolePage actions={pageActions} eyebrow="Automation" title="自动化中心">
      {contextHolder}

      {view === 'rss-create' && (
        <RSSAutomationWizard
          cloudDirectories={cloudDirectories}
          cloudStorages={cloudStorages}
          nodeProtocols={dashboard.node_protocols || []}
          onCancel={returnToOverview}
          onCreated={async () => {
            await load(true);
            setHistoryRefreshToken((value) => value + 1);
            returnToOverview();
          }}
          targets={dashboard.targets}
        />
      )}

      {view === 'rss-edit' && editingRSSSource && editingWorkflow && (
        <Tabs
          items={[
            {
              key: 'workflow',
              label: '流程设计',
              children: (
                <RSSWorkflowPanel
                  cloudDirectories={cloudDirectories}
                  cloudStorages={cloudStorages}
                  loading={loading}
                  nodeProtocols={dashboard.node_protocols || []}
                  onChanged={() => load(true)}
                  showWorkflowList={false}
                  sources={[editingRSSSource]}
                  targets={dashboard.targets}
                  workflows={[editingWorkflow]}
                />
              ),
            },
            {
              key: 'source',
              label: 'RSS 设置',
              children: (
                <RSSSourcePanel
                  loading={loading}
                  onChanged={() => load(true)}
                  sources={[editingRSSSource]}
                />
              ),
            },
            {
              key: 'history',
              label: '事件与运行',
              children: (
                <AutomationHistory
                  refreshToken={historyRefreshToken}
                  sources={[editingRSSSource]}
                  workflows={[editingWorkflow]}
                />
              ),
            },
          ]}
        />
      )}

      {view === 'rss-edit' && (!editingRSSSource || !editingWorkflow) && (
        <Empty description="RSS 自动化不存在或数据尚未加载">
          <Button onClick={returnToOverview}>返回自动化列表</Button>
        </Empty>
      )}

      {view === 'overview' && (
        <Space orientation="vertical" size={20} style={{ width: '100%' }}>
          <Alert
            description="RSS 负责发现新的下载条目，115 目录负责发现新增且已稳定的媒体；二者共用同一套流程执行、事件记录和运行历史。"
            showIcon
            title="一个自动化选择一个触发器"
            type="info"
          />
          <Row gutter={[16, 16]}>
            <Col xs={12} lg={6}>
              <Card>
                <Statistic title="自动化" value={dashboard.sources.length} />
              </Card>
            </Col>
            <Col xs={12} lg={6}>
              <Card>
                <Statistic title="RSS 触发器" value={rssCount} />
              </Card>
            </Col>
            <Col xs={12} lg={6}>
              <Card>
                <Statistic title="115 触发器" value={directoryCount} />
              </Card>
            </Col>
            <Col xs={12} lg={6}>
              <Card>
                <Statistic
                  styles={
                    dashboard.failed_runs
                      ? { content: { color: '#cf1322' } }
                      : {}
                  }
                  title="失败运行"
                  value={dashboard.failed_runs}
                />
              </Card>
            </Col>
          </Row>

          <Tabs
            items={[
              {
                key: 'automations',
                label: '自动化',
                children: (
                  <Table<AutomationSource>
                    columns={columns}
                    dataSource={dashboard.sources}
                    loading={loading}
                    locale={{
                      emptyText: (
                        <Empty description="还没有自动化">
                          <Button onClick={openCreate} type="primary">
                            创建第一条自动化
                          </Button>
                        </Empty>
                      ),
                    }}
                    pagination={false}
                    rowKey="id"
                    scroll={{ x: 1450 }}
                  />
                ),
              },
              {
                key: 'history',
                label: '事件与运行',
                children: (
                  <AutomationHistory
                    refreshToken={historyRefreshToken}
                    sources={dashboard.sources}
                    workflows={dashboard.workflows}
                  />
                ),
              },
            ]}
          />
        </Space>
      )}

      <TriggerSelectorModal
        onCancel={() => setTriggerSelectorOpen(false)}
        onSelect={selectTrigger}
        open={triggerSelectorOpen}
      />

      <AutomationEditorModal
        cloudDirectories={cloudDirectories}
        cloudStorages={cloudStorages}
        onCancel={() => {
          setEditorOpen(false);
          setEditingSourceID(undefined);
        }}
        onSubmit={saveAutomation}
        open={editorOpen}
        source={
          editingSource?.trigger_type === '115_directory'
            ? editingSource
            : undefined
        }
        workflow={
          editingSource?.trigger_type === '115_directory'
            ? editingWorkflow
            : undefined
        }
      />
    </ConsolePage>
  );
};

export default AutomationPage;
