import { ReloadOutlined, SettingOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { Alert, Button, Card, Empty, message, Select, Space, Tabs } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getEmbyWatchUsers } from '@/services/film-fusion';
import AnnualReportTab from './components/AnnualReportTab';
import CalendarTab from './components/CalendarTab';
import GalleryTab from './components/GalleryTab';
import OverviewTab from './components/OverviewTab';
import RecordsTab from './components/RecordsTab';
import UserSettingsModal from './components/UserSettingsModal';

const EmbyWatchPage: React.FC = () => {
  const [users, setUsers] = useState<API.EmbyWatchUserView[]>([]);
  const [loading, setLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeUser, setActiveUser] = useState<string>();
  const [activeTab, setActiveTab] = useState('overview');
  const [seriesFilter, setSeriesFilter] = useState<{
    id: string;
    name?: string;
  }>();
  const [messageApi, contextHolder] = message.useMessage();

  const trackedUsers = useMemo(() => users.filter((u) => u.tracked), [users]);

  const goRecordsBySeries = useCallback(
    (seriesId: string, seriesName?: string) => {
      if (!seriesId) return;
      setSeriesFilter({ id: seriesId, name: seriesName });
      setActiveTab('records');
    },
    [],
  );

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getEmbyWatchUsers();
      if (res.code === 0) {
        const list = res.data || [];
        setUsers(list);
        setActiveUser((prev) => {
          const tracked = list.filter((u) => u.tracked);
          if (prev && tracked.some((u) => u.emby_user_id === prev)) return prev;
          return tracked[0]?.emby_user_id;
        });
      } else {
        messageApi.error(res.message || '获取用户失败');
      }
    } catch (error: any) {
      messageApi.error(error?.message || '获取用户失败');
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const userOptions = trackedUsers.map((u) => ({
    label: `${u.emby_user_name || u.emby_user_id}（${u.record_count} 条）`,
    value: u.emby_user_id,
  }));

  return (
    <PageContainer header={{ title: '观看记录' }}>
      {contextHolder}
      <Alert
        style={{ marginBottom: 16 }}
        type="info"
        showIcon
        message="按 Emby 用户隔离统计观看数据：历史数据可从 Emby「已观看」一键回填，新增观看由 Emby 播放 webhook 实时记录。先在「统计设置」勾选要统计的用户。"
      />

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <span>统计用户：</span>
          <Select
            style={{ minWidth: 240 }}
            placeholder="请选择 Emby 用户"
            value={activeUser}
            onChange={(v) => {
              setActiveUser(v);
              setSeriesFilter(undefined);
            }}
            options={userOptions}
            notFoundContent="暂无被统计用户，请先在统计设置中勾选"
            showSearch
            optionFilterProp="label"
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={loadUsers}
            loading={loading}
          >
            刷新
          </Button>
          <Button
            type="primary"
            icon={<SettingOutlined />}
            onClick={() => setSettingsOpen(true)}
          >
            统计设置
          </Button>
        </Space>
      </Card>

      {activeUser ? (
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          destroyInactiveTabPane
          items={[
            {
              key: 'overview',
              label: '总览',
              children: (
                <OverviewTab
                  embyUserId={activeUser}
                  onSeriesClick={goRecordsBySeries}
                />
              ),
            },
            {
              key: 'gallery',
              label: '画廊',
              children: <GalleryTab embyUserId={activeUser} />,
            },
            {
              key: 'calendar',
              label: '日历',
              children: <CalendarTab embyUserId={activeUser} />,
            },
            {
              key: 'records',
              label: '记录',
              children: (
                <RecordsTab
                  embyUserId={activeUser}
                  seriesFilter={seriesFilter}
                  onClearSeriesFilter={() => setSeriesFilter(undefined)}
                />
              ),
            },
            {
              key: 'annual',
              label: '年度报告',
              children: (
                <AnnualReportTab
                  embyUserId={activeUser}
                  onSeriesClick={goRecordsBySeries}
                />
              ),
            },
          ]}
        />
      ) : (
        <Card>
          <Empty description="还没有被统计的用户，请点击「统计设置」勾选 Emby 用户后再查看">
            <Button type="primary" onClick={() => setSettingsOpen(true)}>
              去配置
            </Button>
          </Empty>
        </Card>
      )}

      <UserSettingsModal
        open={settingsOpen}
        users={users}
        onClose={() => setSettingsOpen(false)}
        onChanged={loadUsers}
      />
    </PageContainer>
  );
};

export default EmbyWatchPage;
