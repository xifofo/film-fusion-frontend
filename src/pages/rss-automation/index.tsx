import '@xyflow/react/dist/style.css';

import { ArrowLeftOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { Alert, Button, message, Popconfirm, Tabs } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import type { RSSAutomationDashboard } from '@/services/film-fusion';
import {
  getCloudDirectoryList,
  getCloudStorageList,
  getRSSAutomationDashboard,
  migrateLegacyRSSMonitor,
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
  const [migratingLegacy, setMigratingLegacy] = useState(false);
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

  const migrateLegacy = useCallback(async () => {
    setMigratingLegacy(true);
    try {
      const response = await migrateLegacyRSSMonitor();
      if (response.code !== 0 || !response.data) {
        throw new Error(response.message || '迁移旧版 RSS 监控失败');
      }
      messageApi.success(
        `已迁移 ${response.data.sources_migrated} 个源、${response.data.entries_migrated} 条历史，并停用旧版监控源`,
      );
      await load(true);
    } catch (error: any) {
      messageApi.error(
        error?.data || error?.message || '迁移旧版 RSS 监控失败',
      );
    } finally {
      setMigratingLegacy(false);
    }
  }, [load, messageApi]);

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
    legacy_migration: {
      available: false,
      complete: false,
      source_count: 0,
      enabled_source_count: 0,
      migrated_source_count: 0,
      pending_source_count: 0,
      rule_count: 0,
      enabled_rule_count: 0,
      disabled_rule_count: 0,
      item_count: 0,
    },
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
  const legacyMigration = data.legacy_migration || {
    available: false,
    complete: false,
    source_count: 0,
    enabled_source_count: 0,
    migrated_source_count: 0,
    pending_source_count: 0,
    rule_count: 0,
    enabled_rule_count: 0,
    disabled_rule_count: 0,
    item_count: 0,
  };

  const returnToOverview = () => {
    setEditingWorkflowId(undefined);
    setLogWorkflowId(undefined);
    setView('overview');
  };

  return (
    <PageContainer
      extra={
        view !== 'overview'
          ? [
              <Button
                icon={<ArrowLeftOutlined />}
                key="return-overview"
                onClick={returnToOverview}
              >
                返回自动化列表
              </Button>,
            ]
          : undefined
      }
      title="RSS 自动化"
    >
      {contextHolder}
      {view === 'overview' && (
        <>
          {legacyMigration.available && (
            <Alert
              action={
                <Popconfirm
                  cancelText="取消"
                  description={`将创建 ${legacyMigration.pending_source_count} 个自动化，复制 ${legacyMigration.item_count} 条历史；成功后停用旧源。旧表和数据不会删除。`}
                  okText="开始迁移"
                  onConfirm={migrateLegacy}
                  title="迁移旧版 RSS 监控？"
                >
                  <Button loading={migratingLegacy} type="primary">
                    迁移到 RSS 自动化
                  </Button>
                </Popconfirm>
              }
              description={`检测到 ${legacyMigration.pending_source_count} 个待迁移源、${legacyMigration.enabled_rule_count} 条已启用规则和 ${legacyMigration.item_count} 条历史。已停用的 ${legacyMigration.disabled_rule_count} 条规则保留在旧表中，不会启用。`}
              message="可以用 RSS 自动化接管旧版 RSS 监控"
              showIcon
              style={{ marginBottom: 16 }}
              type="info"
            />
          )}
          {legacyMigration.complete && (
            <Alert
              closable
              description="旧版源已停用，旧配置和历史表仍保留；当前由 RSS 自动化负责后续检查。"
              message="旧版 RSS 监控已完成迁移"
              showIcon
              style={{ marginBottom: 16 }}
              type="success"
            />
          )}
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
        </>
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
    </PageContainer>
  );
};

export default RSSAutomationPage;
