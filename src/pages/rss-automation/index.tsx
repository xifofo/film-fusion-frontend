import '@xyflow/react/dist/style.css';

import { PageContainer } from '@ant-design/pro-components';
import { Button, message } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import type { RSSAutomationDashboard } from '@/services/film-fusion';
import {
  getCloudStorageList,
  getRSSAutomationDashboard,
} from '@/services/film-fusion';
import AutomationOverview from './AutomationOverview';
import AutomationWizard from './AutomationWizard';

const RSSAutomationPage = () => {
  const [view, setView] = useState<'overview' | 'wizard'>('overview');
  const [dashboard, setDashboard] = useState<RSSAutomationDashboard>();
  const [cloudStorages, setCloudStorages] = useState<API.CloudStorage[]>([]);
  const [loading, setLoading] = useState(true);
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
