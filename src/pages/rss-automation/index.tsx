import '@xyflow/react/dist/style.css';

import { ArrowLeftOutlined } from '@ant-design/icons';
import { Button, message, Tabs } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import ConsolePage from '@/components/ConsolePage';
import type { RSSAutomationDashboard } from '@/services/film-fusion';
import {
  deleteRSSAutomation,
  getCloudDirectoryList,
  getCloudStorageList,
  getRSSAutomationDashboard,
  setRSSAutomationEnabled,
} from '@/services/film-fusion';
import AutomationOverview from './AutomationOverview';
import AutomationWizard from './AutomationWizard';
import EntryHistoryPanel from './EntryHistoryPanel';
import ManualRunModal from './ManualRunModal';
import RunPanel from './RunPanel';
import SourcePanel from './SourcePanel';
import WorkflowPanel from './WorkflowPanel';

const RSSAutomationPage = () => {
  const [view, setView] = useState<'overview' | 'wizard' | 'editor' | 'logs'>(
    'overview',
  );
  const [editingWorkflowId, setEditingWorkflowId] = useState<number>();
  const [logWorkflowId, setLogWorkflowId] = useState<number>();
  const [manualWorkflowId, setManualWorkflowId] = useState<number>();
  const [overviewTab, setOverviewTab] = useState<'automations' | 'entries'>(
    'automations',
  );
  const [dashboard, setDashboard] = useState<RSSAutomationDashboard>();
  const [cloudStorages, setCloudStorages] = useState<API.CloudStorage[]>([]);
  const [cloudDirectories, setCloudDirectories] = useState<
    API.CloudDirectory[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [togglingSourceId, setTogglingSourceId] = useState<number>();
  const [messageApi, contextHolder] = message.useMessage();

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [dashboardResponse, storageResponse, directoryResponse] =
          await Promise.all([
            getRSSAutomationDashboard(),
            getCloudStorageList({ current: 1, pageSize: 500 }),
            getCloudDirectoryList({ current: 1, pageSize: 500 }),
          ]);
        if (dashboardResponse.code !== 0 || !dashboardResponse.data) {
          throw new Error(
            dashboardResponse.message || '获取 RSS 自动化信息失败',
          );
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
            error?.data || error?.message || '获取 RSS 自动化信息失败',
          );
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [messageApi],
  );

  const toggleAutomation = useCallback(
    async (sourceId: number, enabled: boolean) => {
      setTogglingSourceId(sourceId);
      try {
        const response = await setRSSAutomationEnabled(sourceId, enabled);
        if (response.code !== 0 || !response.data) {
          throw new Error(response.message || '更新 RSS 自动化状态失败');
        }
        const updated = response.data;
        setDashboard((current) =>
          current
            ? {
                ...current,
                sources: current.sources.map((source) =>
                  source.id === updated.source.id ? updated.source : source,
                ),
                workflows: current.workflows.map((workflow) =>
                  workflow.id === updated.workflow.id
                    ? updated.workflow
                    : workflow,
                ),
              }
            : current,
        );
        messageApi.success(enabled ? 'RSS 自动化已启动' : 'RSS 自动化已停用');
        await load(true);
      } catch (error: any) {
        messageApi.error(
          error?.data || error?.message || '更新 RSS 自动化状态失败',
        );
      } finally {
        setTogglingSourceId(undefined);
      }
    },
    [load, messageApi],
  );

  const removeAutomation = useCallback(
    async (sourceId: number) => {
      try {
        const response = await deleteRSSAutomation(sourceId);
        if (response.code !== 0) {
          throw new Error(response.message || '删除 RSS 自动化失败');
        }
        messageApi.success('RSS 自动化已删除');
        await load(true);
      } catch (error: any) {
        messageApi.error(
          error?.data || error?.message || '删除 RSS 自动化失败',
        );
        throw error;
      }
    },
    [load, messageApi],
  );

  useEffect(() => {
    load();
    const timer = window.setInterval(() => load(true), 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const data: RSSAutomationDashboard = dashboard || {
    sources: [],
    workflows: [],
    targets: [],
    recent_runs: [],
    total_entries: 0,
    pending_nodes: 0,
    running_nodes: 0,
    failed_runs: 0,
    source_running: false,
    node_protocols: [],
  };
  const editingWorkflow = data.workflows.find(
    (workflow) => workflow.id === editingWorkflowId,
  );
  const editingSource = data.sources.find(
    (source) => source.id === editingWorkflow?.source_id,
  );
  const logWorkflow = data.workflows.find(
    (workflow) => workflow.id === logWorkflowId,
  );
  const manualWorkflow = data.workflows.find(
    (workflow) => workflow.id === manualWorkflowId,
  );
  const returnToOverview = () => {
    setEditingWorkflowId(undefined);
    setLogWorkflowId(undefined);
    setView('overview');
  };

  return (
    <ConsolePage
      actions={
        view !== 'overview' ? (
          <Button icon={<ArrowLeftOutlined />} onClick={returnToOverview}>
            返回自动化列表
          </Button>
        ) : undefined
      }
      eyebrow="Automation"
      title="RSS 自动化"
    >
      {contextHolder}
      {view === 'overview' && (
        <Tabs
          activeKey={overviewTab}
          items={[
            {
              key: 'automations',
              label: '自动化',
              children: (
                <AutomationOverview
                  data={data}
                  loading={loading}
                  onCreate={() => setView('wizard')}
                  onDelete={removeAutomation}
                  onEdit={(workflowId) => {
                    setEditingWorkflowId(workflowId);
                    setView('editor');
                  }}
                  onManualRun={setManualWorkflowId}
                  onToggle={toggleAutomation}
                  onViewLogs={(workflowId) => {
                    setLogWorkflowId(workflowId);
                    setView('logs');
                  }}
                  togglingSourceId={togglingSourceId}
                />
              ),
            },
            {
              key: 'entries',
              label: 'RSS 条目',
              children: <EntryHistoryPanel sources={data.sources} />,
            },
          ]}
          onChange={(key) => setOverviewTab(key as 'automations' | 'entries')}
        />
      )}

      {view === 'wizard' && (
        <AutomationWizard
          cloudDirectories={cloudDirectories}
          cloudStorages={cloudStorages}
          nodeProtocols={data.node_protocols || []}
          onCancel={returnToOverview}
          onCreated={async () => {
            await load(true);
            returnToOverview();
          }}
          targets={data.targets}
        />
      )}

      {view === 'editor' && editingWorkflow && editingSource && (
        <Tabs
          destroyOnHidden={false}
          items={[
            {
              key: 'workflow',
              label: '流程设计',
              children: (
                <WorkflowPanel
                  cloudDirectories={cloudDirectories}
                  cloudStorages={cloudStorages}
                  loading={loading}
                  nodeProtocols={data.node_protocols || []}
                  onChanged={() => load(true)}
                  showWorkflowList={false}
                  sources={[editingSource]}
                  targets={data.targets}
                  workflows={[editingWorkflow]}
                />
              ),
            },
            {
              key: 'source',
              label: 'RSS 设置',
              children: (
                <SourcePanel
                  loading={loading}
                  onChanged={() => load(true)}
                  sources={[editingSource]}
                />
              ),
            },
            {
              key: 'entries',
              label: 'RSS 条目',
              children: (
                <EntryHistoryPanel
                  fixedSourceId={editingSource.id}
                  sources={[editingSource]}
                />
              ),
            },
            {
              key: 'runs',
              label: '运行情况',
              children: (
                <RunPanel
                  workflowId={editingWorkflow.id}
                  workflowName={editingWorkflow.name}
                />
              ),
            },
          ]}
        />
      )}

      {view === 'logs' && logWorkflow && (
        <RunPanel workflowId={logWorkflow.id} workflowName={logWorkflow.name} />
      )}

      <ManualRunModal
        onClose={() => setManualWorkflowId(undefined)}
        onQueued={() => load(true)}
        open={Boolean(manualWorkflow)}
        workflow={manualWorkflow}
      />
    </ConsolePage>
  );
};

export default RSSAutomationPage;
