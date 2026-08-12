import '@xyflow/react/dist/style.css';

import { PageContainer } from '@ant-design/pro-components';
import { Button, message } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import type { RSSAutomationDashboard } from '@/services/film-fusion';
import {
  getCloudStorageList,
  getRSSAutomationDashboard,
  setRSSAutomationEnabled,
} from '@/services/film-fusion';
import AutomationOverview from './AutomationOverview';
import AutomationWizard from './AutomationWizard';

const RSSAutomationPage = () => {
  const [view, setView] = useState<'overview' | 'wizard'>('overview');
  const [dashboard, setDashboard] = useState<RSSAutomationDashboard>();
  const [cloudStorages, setCloudStorages] = useState<API.CloudStorage[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingSourceId, setTogglingSourceId] = useState<number>();
  const [messageApi, contextHolder] = message.useMessage();

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [dashboardResponse, storageResponse] = await Promise.all([
          getRSSAutomationDashboard(),
          getCloudStorageList({ current: 1, pageSize: 500 }),
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
  };

  return (
    <PageContainer
      extra={
        view === 'wizard'
          ? [
              <Button key="exit-wizard" onClick={() => setView('overview')}>
                退出向导
              </Button>,
            ]
          : undefined
      }
      title="RSS 自动化"
    >
      {contextHolder}
      {view === 'overview' && (
        <AutomationOverview
          data={data}
          loading={loading}
          onCreate={() => setView('wizard')}
          onToggle={toggleAutomation}
          togglingSourceId={togglingSourceId}
        />
      )}

      {view === 'wizard' && (
        <AutomationWizard
          cloudStorages={cloudStorages}
          onCancel={() => setView('overview')}
          onCreated={async () => {
            await load(true);
            setView('overview');
          }}
          targets={data.targets}
        />
      )}
    </PageContainer>
  );
};

export default RSSAutomationPage;
