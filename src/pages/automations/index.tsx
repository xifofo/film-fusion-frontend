import '@xyflow/react/dist/style.css';

import {
  AppstoreOutlined,
  ArrowLeftOutlined,
  HistoryOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { Alert, Button, Empty, message, Space, Tabs } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import ConsolePage from '@/components/ConsolePage';
import RSSAutomationWizard from '@/pages/rss-automation/AutomationWizard';
import RSSSourcePanel from '@/pages/rss-automation/SourcePanel';
import RSSWorkflowPanel from '@/pages/rss-automation/WorkflowPanel';
import type {
  AutomationBatchInput,
  AutomationCreateInput,
  AutomationDashboard,
  AutomationSource,
  AutomationTriggerType,
  RSSAutomationSource,
} from '@/services/film-fusion';
import {
  batchAutomations,
  createAutomation,
  deleteAutomation,
  getAutomationDashboard,
  getCloudDirectoryList,
  getCloudStorageList,
  saveAutomationSettings,
  scanAutomation,
  setAutomationEnabled,
  updateAutomation,
} from '@/services/film-fusion';
import AutomationCopyModal from './AutomationCopyModal';
import AutomationEditorModal from './AutomationEditorModal';
import AutomationHistory from './AutomationHistory';
import AutomationOverview, {
  type HistorySelection,
} from './AutomationOverview';
import AutomationParametersModal from './AutomationParametersModal';
import AutomationSettingsModal from './AutomationSettingsModal';
import AutomationTemplates, {
  SaveAutomationTemplateModal,
} from './AutomationTemplates';
import AutomationVersionsModal from './AutomationVersionsModal';
import {
  buildAutomationCopy,
  copyName,
  readAutomationConfiguration,
} from './copyAutomation';
import styles from './index.module.less';
import { defaultAutomationSettings } from './management';
import TriggerSelectorModal from './TriggerSelectorModal';

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

const AutomationPage = () => {
  const [dashboard, setDashboard] =
    useState<AutomationDashboard>(emptyDashboard);
  const [cloudStorages, setCloudStorages] = useState<API.CloudStorage[]>([]);
  const [cloudDirectories, setCloudDirectories] = useState<
    API.CloudDirectory[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [hasLoaded, setHasLoaded] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>();
  const [overviewTab, setOverviewTab] = useState('automations');
  const [historySelection, setHistorySelection] = useState<HistorySelection>(
    {},
  );
  const [historyVisit, setHistoryVisit] = useState(0);
  const [view, setView] = useState<PageView>('overview');
  const [triggerSelectorOpen, setTriggerSelectorOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingSourceID, setEditingSourceID] = useState<number>();
  const [scanningID, setScanningID] = useState<number>();
  const [togglingID, setTogglingID] = useState<number>();
  const [copyingID, setCopyingID] = useState<number>();
  const [copyInput, setCopyInput] = useState<AutomationCreateInput>();
  const [copyTitle, setCopyTitle] = useState('复制自动化');
  const [management, setManagement] = useState<{
    sourceID: number;
    action: 'parameters' | 'template' | 'versions' | 'settings';
    input: AutomationCreateInput;
  }>();
  const [batchBusy, setBatchBusy] = useState(false);
  const [templateRefreshKey, setTemplateRefreshKey] = useState(0);
  const [historyRefreshToken, setHistoryRefreshToken] = useState(0);
  const [messageApi, contextHolder] = message.useMessage();

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [dashboardResponse, storageResponse, directoryResponse] =
          await Promise.all([
            getAutomationDashboard(),
            silent
              ? undefined
              : getCloudStorageList({ current: 1, pageSize: 500 }),
            silent
              ? undefined
              : getCloudDirectoryList({ current: 1, pageSize: 500 }),
          ]);
        if (dashboardResponse.code !== 0 || !dashboardResponse.data) {
          throw new Error(dashboardResponse.message || '获取自动化信息失败');
        }
        setDashboard(dashboardResponse.data);
        setLoadError('');
        setHasLoaded(true);
        setLastRefreshed(new Date());
        if (storageResponse?.code === 0 && storageResponse.data) {
          setCloudStorages(storageResponse.data.list || []);
        }
        if (directoryResponse?.code === 0 && directoryResponse.data) {
          setCloudDirectories(directoryResponse.data.list || []);
        }
      } catch (error: any) {
        setLoadError(error?.data || error?.message || '获取自动化信息失败');
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
    if (
      view !== 'overview' ||
      editorOpen ||
      triggerSelectorOpen ||
      copyInput ||
      management ||
      copyingID !== undefined
    )
      return;
    const timer = window.setInterval(() => void load(true), 15_000);
    return () => window.clearInterval(timer);
  }, [
    copyingID,
    copyInput,
    management,
    editorOpen,
    load,
    triggerSelectorOpen,
    view,
  ]);

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

  const openHistory = (selection: HistorySelection = {}) => {
    setHistorySelection(selection);
    setHistoryVisit((value) => value + 1);
    setOverviewTab('history');
  };

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

  const openCopy = (source: AutomationSource) => {
    try {
      const input = buildAutomationCopy(
        source,
        workflowBySourceID.get(source.id),
        [...dashboard.sources, ...dashboard.workflows].map((item) => item.name),
      );
      setCopyTitle('复制自动化');
      setCopyInput(input);
    } catch (error: any) {
      messageApi.error(error?.message || '流程无法复制');
    }
  };

  const copyAutomation = async (input: AutomationCreateInput) => {
    if (copyingID !== undefined) return;
    setCopyingID(0);
    try {
      const response = await createAutomation(input);
      if (response.code !== 0 || !response.data) {
        throw new Error(response.message || '复制自动化失败');
      }
      const created = response.data;
      await load(true);
      // Keep the returned copy editable even if the dashboard refresh fails.
      setDashboard((current) => ({
        ...current,
        sources: [
          ...current.sources.filter((item) => item.id !== created.source.id),
          created.source,
        ],
        workflows: [
          ...current.workflows.filter(
            (item) => item.id !== created.workflow.id,
          ),
          created.workflow,
        ],
      }));
      openEdit(created.source);
      setCopyInput(undefined);
      messageApi.success('副本已创建并保持停用，修改后可启用');
    } finally {
      setCopyingID(undefined);
    }
  };

  const openManagement = (
    source: AutomationSource,
    action: NonNullable<typeof management>['action'],
  ) => {
    try {
      const workflow = workflowBySourceID.get(source.id);
      if (!workflow) throw new Error('流程数据缺失');
      setManagement({
        sourceID: source.id,
        action,
        input: readAutomationConfiguration(source, workflow),
      });
    } catch (error: any) {
      messageApi.error(error?.message || '无法读取流程');
    }
  };

  const applyBatch = async (input: AutomationBatchInput) => {
    setBatchBusy(true);
    try {
      const response = await batchAutomations(input);
      if (response.code !== 0)
        throw new Error(response.message || '批量操作失败');
      await load(true);
      messageApi.success('批量操作完成');
    } catch (error: any) {
      messageApi.error(error?.data || error?.message || '批量操作失败');
      throw error;
    } finally {
      setBatchBusy(false);
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
        if (result.cache_stale) {
          messageApi.warning(
            `已读取上次缓存：${result.cache_warning || '原站暂未更新'}；新增 ${result.new_entries || 0} 条`,
          );
        } else if (result.baseline) {
          messageApi.success(
            `RSS 基线建立完成：读取 ${result.fetched || 0} 条，未触发历史下载`,
          );
        } else if (result.not_modified) {
          messageApi.success('RSS 内容没有变化');
        } else {
          messageApi.success(
            `RSS ${result.cache_hit ? '缓存检查' : '刷新'}完成：新增 ${result.new_entries || 0} 条，创建 ${result.created_runs} 次运行`,
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

  const pageActions =
    view === 'overview' ? (
      <Space>
        <Button
          icon={<ReloadOutlined />}
          loading={loading}
          onClick={() => load()}
        >
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
    <ConsolePage
      actions={pageActions}
      eyebrow={view === 'overview' ? 'Automation' : 'Automation / Editor'}
      title={
        view === 'rss-create'
          ? '新建 RSS 自动化'
          : view === 'rss-edit'
            ? editingSource?.name || '编辑自动化'
            : '自动化中心'
      }
    >
      {view === 'overview' && (
        <p className={styles.pageDescription}>
          连接内容来源与处理流程，让媒体管理自动运转。
        </p>
      )}

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
                  initialSourceID={editingRSSSource.id}
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
        <div className={styles.centerShell}>
          {loadError && (
            <Alert
              action={
                <Button onClick={() => load()} size="small">
                  重试
                </Button>
              }
              description={loadError}
              showIcon
              title={
                hasLoaded
                  ? '刷新失败，当前显示上次获取的数据'
                  : '暂时无法加载自动化'
              }
              type="error"
            />
          )}
          {(hasLoaded || loading) && (
            <Tabs
              activeKey={overviewTab}
              className={styles.centerTabs}
              onChange={setOverviewTab}
              tabBarExtraContent={
                <span className={styles.refreshStatus}>
                  {lastRefreshed
                    ? `更新于 ${lastRefreshed.toLocaleTimeString('zh-CN', { hour12: false })} · 每 15 秒刷新`
                    : '正在获取运行状态'}
                </span>
              }
              items={[
                {
                  key: 'automations',
                  label: (
                    <span>
                      <AppstoreOutlined /> 自动化
                    </span>
                  ),
                  children: (
                    <AutomationOverview
                      cloudStorages={cloudStorages}
                      copyingID={copyingID}
                      batchBusy={batchBusy}
                      dashboard={dashboard}
                      loading={loading}
                      onCopy={openCopy}
                      onManage={openManagement}
                      onBatch={applyBatch}
                      onCreate={openCreate}
                      onEdit={openEdit}
                      onHistory={openHistory}
                      onRemove={removeAutomation}
                      onScan={runScan}
                      onToggle={toggleAutomation}
                      scanningID={scanningID}
                      togglingID={togglingID}
                    />
                  ),
                },
                {
                  key: 'templates',
                  label: '流程模板',
                  children: (
                    <AutomationTemplates
                      refreshKey={templateRefreshKey}
                      onUse={(input, name) => {
                        const next = structuredClone(input);
                        next.source.name = copyName(
                          name,
                          dashboard.sources.map((item) => item.name),
                        );
                        next.workflow.name = next.source.name;
                        setCopyTitle('从模板创建自动化');
                        setCopyInput(next);
                      }}
                    />
                  ),
                },
                {
                  key: 'history',
                  label: (
                    <span>
                      <HistoryOutlined /> 事件与运行
                    </span>
                  ),
                  children: (
                    <AutomationHistory
                      active={overviewTab === 'history'}
                      initialRunID={historySelection.runID}
                      initialSourceID={historySelection.sourceID}
                      initialStatus={historySelection.status}
                      initialTab="runs"
                      key={historyVisit}
                      refreshToken={historyRefreshToken}
                      sources={dashboard.sources}
                      workflows={dashboard.workflows}
                    />
                  ),
                },
              ]}
            />
          )}
        </div>
      )}

      <TriggerSelectorModal
        onCancel={() => setTriggerSelectorOpen(false)}
        onSelect={selectTrigger}
        open={triggerSelectorOpen}
      />

      {copyInput && (
        <AutomationCopyModal
          input={copyInput}
          title={copyTitle}
          cloudStorages={cloudStorages}
          cloudDirectories={cloudDirectories}
          targets={dashboard.targets}
          onCancel={() => setCopyInput(undefined)}
          onSubmit={copyAutomation}
        />
      )}
      {management?.action === 'parameters' && (
        <AutomationParametersModal
          definition={management.input.workflow.definition}
          onCancel={() => setManagement(undefined)}
          onSave={async (definition) => {
            const response = await updateAutomation(management.sourceID, {
              ...management.input,
              expected_version: workflowBySourceID.get(management.sourceID)
                ?.version,
              workflow: { ...management.input.workflow, definition },
            });
            if (response.code !== 0 || !response.data)
              throw new Error(response.message || '保存参数失败');
            setManagement(undefined);
            await load(true);
            messageApi.success('流程参数已保存');
          }}
        />
      )}
      {management?.action === 'template' && (
        <SaveAutomationTemplateModal
          input={management.input}
          onCancel={() => setManagement(undefined)}
          onSaved={() => {
            setManagement(undefined);
            setTemplateRefreshKey((value) => value + 1);
            messageApi.success('模板已保存');
          }}
        />
      )}
      {management?.action === 'settings' && (
        <AutomationSettingsModal
          settings={
            dashboard.settings?.find(
              (item) => item.source_id === management.sourceID,
            ) || defaultAutomationSettings(management.sourceID)
          }
          groups={[
            ...new Set(
              dashboard.settings
                ?.map((item) => item.group_name)
                .filter(Boolean),
            ),
          ]}
          onCancel={() => setManagement(undefined)}
          onSave={async (settings) => {
            const response = await saveAutomationSettings(
              management.sourceID,
              settings,
            );
            if (response.code !== 0 || !response.data)
              throw new Error(response.message || '保存设置失败');
            setManagement(undefined);
            await load(true);
            messageApi.success('分组与提醒设置已保存');
          }}
        />
      )}
      {management?.action === 'versions' && (
        <AutomationVersionsModal
          sourceID={management.sourceID}
          current={management.input}
          onCancel={() => setManagement(undefined)}
          onRestored={async () => {
            setManagement(undefined);
            await load(true);
            messageApi.success('已恢复为新版本并停用，请检查后启用');
          }}
        />
      )}

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
