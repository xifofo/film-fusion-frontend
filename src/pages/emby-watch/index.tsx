import { PageContainer } from '@ant-design/pro-components';
import { Empty, message, Select } from 'antd';
import {
  BarChart3,
  CalendarDays,
  ExternalLink,
  Images,
  ListVideo,
  RefreshCw,
  Settings2,
  Sparkles,
  UserRound,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { getEmbyWatchUsers } from '@/services/film-fusion';
import AnnualReportTab from './components/AnnualReportTab';
import CalendarTab from './components/CalendarTab';
import GalleryTab from './components/GalleryTab';
import OverviewTab from './components/OverviewTab';
import RecordsTab from './components/RecordsTab';
import UserSettingsModal from './components/UserSettingsModal';
import styles from './index.module.less';

type WatchSection = 'calendar' | 'overview' | 'gallery' | 'records' | 'annual';

const SECTIONS: Array<{
  key: WatchSection;
  label: string;
  icon: React.ComponentType<{ 'aria-hidden'?: boolean }>;
}> = [
  { key: 'calendar', label: '观影日历', icon: CalendarDays },
  { key: 'overview', label: '数据总览', icon: BarChart3 },
  { key: 'gallery', label: '观影画廊', icon: Images },
  { key: 'records', label: '记录管理', icon: ListVideo },
  { key: 'annual', label: '年度报告', icon: Sparkles },
];

const EmbyWatchPage: React.FC = () => {
  const [users, setUsers] = useState<API.EmbyWatchUserView[]>([]);
  const [loading, setLoading] = useState(true);
  const [usersError, setUsersError] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeUser, setActiveUser] = useState<string>();
  const [activeSection, setActiveSection] = useState<WatchSection>('calendar');
  const [seriesFilter, setSeriesFilter] = useState<{
    id: string;
    name?: string;
  }>();
  const [contentRevision, setContentRevision] = useState(0);
  const [messageApi, contextHolder] = message.useMessage();

  const trackedUsers = useMemo(
    () => users.filter((user) => user.tracked),
    [users],
  );
  const selectedUser = useMemo(
    () => trackedUsers.find((user) => user.emby_user_id === activeUser),
    [activeUser, trackedUsers],
  );

  const goRecordsBySeries = useCallback(
    (seriesId: string, seriesName?: string) => {
      if (!seriesId) return;
      setSeriesFilter({ id: seriesId, name: seriesName });
      setActiveSection('records');
    },
    [],
  );

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setUsersError('');
    try {
      const response = await getEmbyWatchUsers();
      if (response.code === 0) {
        const list = response.data || [];
        setUsers(list);
        setActiveUser((previous) => {
          const tracked = list.filter((user) => user.tracked);
          if (
            previous &&
            tracked.some((user) => user.emby_user_id === previous)
          ) {
            return previous;
          }
          return tracked[0]?.emby_user_id;
        });
      } else {
        const errorText = response.message || '获取用户失败';
        setUsersError(errorText);
        messageApi.error(errorText);
      }
    } catch (error) {
      const errorText =
        error instanceof Error && error.message
          ? error.message
          : '获取用户失败';
      setUsersError(errorText);
      messageApi.error(errorText);
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const refreshPage = useCallback(async () => {
    await loadUsers();
    setContentRevision((current) => current + 1);
  }, [loadUsers]);

  const userOptions = trackedUsers.map((user) => ({
    label: `${user.emby_user_name || user.emby_user_id}（${user.record_count} 条）`,
    value: user.emby_user_id,
  }));

  const sectionContent = activeUser
    ? {
        calendar: (
          <CalendarTab
            embyUserId={activeUser}
            key={`${activeUser}-${contentRevision}`}
          />
        ),
        overview: (
          <OverviewTab
            embyUserId={activeUser}
            key={`${activeUser}-${contentRevision}`}
            onSeriesClick={goRecordsBySeries}
          />
        ),
        gallery: (
          <GalleryTab
            embyUserId={activeUser}
            key={`${activeUser}-${contentRevision}`}
          />
        ),
        records: (
          <RecordsTab
            embyUserId={activeUser}
            key={`${activeUser}-${contentRevision}`}
            seriesFilter={seriesFilter}
            onClearSeriesFilter={() => setSeriesFilter(undefined)}
          />
        ),
        annual: (
          <AnnualReportTab
            embyUserId={activeUser}
            key={`${activeUser}-${contentRevision}`}
            onSeriesClick={goRecordsBySeries}
          />
        ),
      }[activeSection]
    : null;

  return (
    <PageContainer
      className={styles.pageContainer}
      header={{
        title: '观看记录',
        extra: [
          <div className={styles.headerActions} key="watch-actions">
            <a className={styles.openCalendarLink} href="/watch">
              <ExternalLink aria-hidden="true" />
              独立观影日历
            </a>
            <Button
              className={styles.headerButton}
              disabled={loading}
              onClick={() => void refreshPage()}
              type="button"
              variant="outline"
            >
              <RefreshCw
                aria-hidden="true"
                className={loading ? styles.refreshing : undefined}
              />
              刷新
            </Button>
            <Button
              className={styles.settingsButton}
              onClick={() => setSettingsOpen(true)}
              type="button"
            >
              <Settings2 aria-hidden="true" />
              统计设置
            </Button>
          </div>,
        ],
      }}
    >
      {contextHolder}
      <div className={styles.page}>
        <section className={styles.controlBar} aria-label="观看记录视图设置">
          <div className={styles.userControl}>
            <span className={styles.userIcon} aria-hidden="true">
              <UserRound />
            </span>
            <span className={styles.userCopy}>
              <small>统计用户</small>
              <Select
                aria-label="统计用户"
                className={styles.userSelect}
                notFoundContent="暂无被统计用户"
                onChange={(value) => {
                  setActiveUser(value);
                  setSeriesFilter(undefined);
                }}
                optionFilterProp="label"
                options={userOptions}
                placeholder="请选择 Emby 用户"
                popupMatchSelectWidth={false}
                showSearch
                value={activeUser}
                variant="borderless"
              />
            </span>
            {selectedUser && (
              <strong className={styles.recordCount}>
                {selectedUser.record_count.toLocaleString('zh-CN')} 条记录
              </strong>
            )}
          </div>

          <nav className={styles.sectionNav} aria-label="观看记录功能">
            {SECTIONS.map((section) => {
              const Icon = section.icon;
              const active = activeSection === section.key;
              return (
                <button
                  className={active ? styles.sectionActive : undefined}
                  aria-current={active ? 'page' : undefined}
                  key={section.key}
                  onClick={() => setActiveSection(section.key)}
                  type="button"
                >
                  <Icon aria-hidden={true} />
                  <span>{section.label}</span>
                </button>
              );
            })}
          </nav>
        </section>

        {activeUser ? (
          <div
            className={
              activeSection === 'calendar'
                ? styles.calendarContent
                : styles.managementContent
            }
          >
            {sectionContent}
          </div>
        ) : loading ? (
          <section className={styles.loadingState} aria-live="polite">
            <RefreshCw aria-hidden="true" />
            <p>正在读取观影用户</p>
          </section>
        ) : usersError ? (
          <section className={styles.errorState} role="alert">
            <CalendarDays aria-hidden="true" />
            <h2>观影用户读取失败</h2>
            <p>{usersError}</p>
            <Button
              onClick={() => void refreshPage()}
              type="button"
              variant="outline"
            >
              <RefreshCw aria-hidden="true" />
              重新加载
            </Button>
          </section>
        ) : (
          <section className={styles.emptyState}>
            <CalendarDays aria-hidden="true" />
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="还没有被统计的用户，请先选择需要记录的 Emby 用户"
            >
              <Button onClick={() => setSettingsOpen(true)} type="button">
                <Settings2 aria-hidden="true" />
                前往统计设置
              </Button>
            </Empty>
          </section>
        )}
      </div>

      <UserSettingsModal
        open={settingsOpen}
        users={users}
        onClose={() => setSettingsOpen(false)}
        onChanged={() => void refreshPage()}
      />
    </PageContainer>
  );
};

export default EmbyWatchPage;
