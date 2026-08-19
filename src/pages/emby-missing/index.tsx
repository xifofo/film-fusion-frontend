import {
  DownOutlined,
  EnvironmentOutlined,
  MoreOutlined,
  ReloadOutlined,
  ScanOutlined,
  SettingOutlined,
  StopOutlined,
  SyncOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import {
  ModalForm,
  ProFormDigit,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
} from '@ant-design/pro-components';
import type { MenuProps } from 'antd';
import {
  Button,
  Card,
  Col,
  Dropdown,
  Modal,
  message,
  Pagination,
  Popconfirm,
  Popover,
  Progress,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import HDHiveResourcesButton from '@/components/HDHiveResourcesButton';
import {
  addEmbyMissingBlacklist,
  embyWatchImageUrl,
  getEmbyMissing,
  getEmbyMissingBlacklist,
  getEmbyMissingLibraries,
  removeEmbyMissingBlacklist,
  rescanEmbyMissingSeries,
  resolveEmbyMissingCloudPath,
  scanEmbyMissing,
  updateEmbyMissingSetting,
} from '@/services/film-fusion';
import ExternalLinksButton from './components/ExternalLinksButton';
import RegenerateStrmModal from './components/RegenerateStrmModal';
import styles from './index.module.less';

const { Text } = Typography;

const POLL_MS = 3000;

type MissingSortMode = 'name' | 'missing_desc' | 'missing_asc';

const SORT_OPTIONS: { label: string; value: MissingSortMode }[] = [
  { label: '按剧名', value: 'name' },
  { label: '缺集从多到少', value: 'missing_desc' },
  { label: '缺集从少到多', value: 'missing_asc' },
];

const fmtEp = (s: number, e: number) =>
  `S${String(s).padStart(2, '0')}E${String(e).padStart(2, '0')}`;

const fmtDate = (v?: string) => {
  if (!v) return '-';
  const d = dayjs(v);
  return d.isValid() ? d.format('YYYY-MM-DD') : v;
};

const fmtDateTime = (v?: string | null) => {
  if (!v) return '-';
  const d = dayjs(v);
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm:ss') : v;
};

const describeProgress = (p?: API.EmbyMissingScanProgress): string => {
  if (!p) return '准备中…';
  switch (p.phase) {
    case 'preparing':
      return '准备中（枚举剧集）…';
    case 'scanning': {
      const totalPart = p.series_total > 0 ? `/${p.series_total}` : '';
      return `已处理 ${p.series_done}${totalPart} 部剧（查询 ${p.series_scanned}，跳过 ${p.series_skipped}）· 已收集 ${p.collected_count} 条`;
    }
    case 'saving':
      return '写入数据库…';
    case 'done':
      return '扫描完成';
    case 'failed':
      return '扫描失败';
    default:
      return '扫描中';
  }
};

const SeriesBackdrop: React.FC<{
  seriesId: string;
  seriesName: string;
}> = ({ seriesId, seriesName }) => {
  const [source, setSource] = useState<'backdrop' | 'primary' | 'failed'>(
    'backdrop',
  );

  useEffect(() => setSource('backdrop'), [seriesId]);

  const imageUrl =
    source === 'failed'
      ? ''
      : embyWatchImageUrl(
          seriesId,
          source === 'backdrop' ? 1200 : 720,
          source === 'backdrop' ? 'Backdrop' : 'Primary',
        );

  return (
    <div aria-hidden="true" className={styles.backdropFrame}>
      {imageUrl ? (
        <img
          alt=""
          className={styles.backdropImage}
          decoding="async"
          loading="lazy"
          onError={() =>
            setSource((current) =>
              current === 'backdrop' ? 'primary' : 'failed',
            )
          }
          src={imageUrl}
        />
      ) : (
        <div className={styles.backdropFallback}>
          <span>{Array.from(seriesName.trim())[0] || '剧'}</span>
        </div>
      )}
      <div className={styles.backdropScrim} />
    </div>
  );
};

const SeriesPoster: React.FC<{
  seriesId: string;
  seriesName: string;
}> = ({ seriesId, seriesName }) => {
  const [failed, setFailed] = useState(false);
  const imageUrl = embyWatchImageUrl(seriesId, 360, 'Primary');

  useEffect(() => setFailed(false), [seriesId]);

  return (
    <div className={styles.posterFrame}>
      {imageUrl && !failed ? (
        <img
          alt={`${seriesName} 海报`}
          className={styles.posterImage}
          decoding="async"
          loading="lazy"
          onError={() => setFailed(true)}
          src={imageUrl}
        />
      ) : (
        <div className={styles.posterFallback}>
          <span>{Array.from(seriesName.trim())[0] || '剧'}</span>
          <small>EMBY</small>
        </div>
      )}
    </div>
  );
};

type MissingSeriesCardProps = {
  record: API.EmbyMissingSeriesGroup;
  scanning: boolean;
  rescanningSeriesId: string;
  onAddBlacklist: (record: API.EmbyMissingSeriesGroup) => Promise<void>;
  onRescan: (record: API.EmbyMissingSeriesGroup) => Promise<void>;
  onViewPath: (record: API.EmbyMissingSeriesGroup) => Promise<void>;
};

const MissingSeriesCard: React.FC<MissingSeriesCardProps> = ({
  record,
  scanning,
  rescanningSeriesId,
  onAddBlacklist,
  onRescan,
  onViewPath,
}) => {
  const episodes = record.episodes || [];
  const previewEpisodes = episodes.slice(0, 6);
  const remainingCount = Math.max(episodes.length - previewEpisodes.length, 0);
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <Card className={styles.seriesCard} variant="borderless">
      <div className={styles.cardVisual}>
        <SeriesBackdrop
          seriesId={record.series_id}
          seriesName={record.series_name}
        />

        <div className={styles.cardTopline}>
          <span className={styles.libraryBadge}>
            {record.library_name || 'Emby 媒体库'}
          </span>
          <span className={styles.missingBadge}>
            <strong>{record.missing_count}</strong>
            <span>集缺失</span>
          </span>
        </div>

        <div className={styles.cardMain}>
          <SeriesPoster
            seriesId={record.series_id}
            seriesName={record.series_name}
          />
          <div className={styles.seriesCopy}>
            <p>EMBY MISSING</p>
            <h2 title={record.series_name}>{record.series_name || '-'}</h2>
            <div className={styles.episodePreview}>
              {previewEpisodes.map((episode) => {
                const code = fmtEp(
                  episode.season_number,
                  episode.episode_number,
                );
                return <span key={code}>{code}</span>;
              })}
              {remainingCount > 0 && <span>+{remainingCount}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.cardFooter}>
        <details className={styles.episodeDetails}>
          <summary>
            <span>查看缺失明细</span>
            <span>{episodes.length} 集</span>
          </summary>
          <div className={styles.episodeList}>
            {episodes.map((episode) => {
              const code = fmtEp(episode.season_number, episode.episode_number);
              return (
                <div className={styles.episodeRow} key={code}>
                  <strong>{code}</strong>
                  <span title={episode.episode_name || ''}>
                    {episode.episode_name || '未命名剧集'}
                  </span>
                  <time>{fmtDate(episode.premiere_date)}</time>
                </div>
              );
            })}
          </div>
        </details>

        <div className={styles.actionRow}>
          <Popconfirm
            title="只重新检查这部剧？"
            description="请先确保 Emby 已完成媒体库扫描并识别新补齐的剧集。"
            okText="开始重扫"
            cancelText="取消"
            disabled={scanning || !!rescanningSeriesId}
            onConfirm={() => onRescan(record)}
          >
            <Button
              type="link"
              size="small"
              icon={<SyncOutlined />}
              loading={rescanningSeriesId === record.series_id}
              disabled={
                scanning ||
                (!!rescanningSeriesId &&
                  rescanningSeriesId !== record.series_id)
              }
            >
              重扫此剧
            </Button>
          </Popconfirm>
          <Popover
            arrow={false}
            content={
              <div className={styles.cardActionMenu}>
                <Button
                  icon={<EnvironmentOutlined />}
                  onClick={() => {
                    setMoreOpen(false);
                    void onViewPath(record);
                  }}
                  size="small"
                  type="text"
                >
                  查看位置
                </Button>
                <ExternalLinksButton seriesId={record.series_id} />
                <div
                  className={styles.cardActionMenuItem}
                  onClick={() => setMoreOpen(false)}
                >
                  <HDHiveResourcesButton seriesId={record.series_id} />
                </div>
                <div
                  className={styles.cardActionMenuItem}
                  onClick={() => setMoreOpen(false)}
                >
                  <RegenerateStrmModal record={record} />
                </div>
                <div className={styles.cardActionMenuDivider} />
                <Popconfirm
                  title="加入黑名单后将跳过该剧的缺集检查"
                  onConfirm={() => {
                    setMoreOpen(false);
                    return onAddBlacklist(record);
                  }}
                >
                  <Button
                    danger
                    icon={<StopOutlined />}
                    size="small"
                    type="text"
                  >
                    加入黑名单
                  </Button>
                </Popconfirm>
              </div>
            }
            onOpenChange={setMoreOpen}
            open={moreOpen}
            placement="bottomRight"
            styles={{ content: { padding: 6 } }}
            trigger="click"
          >
            <Button
              aria-label={`${record.series_name} 更多操作`}
              icon={<MoreOutlined />}
              size="small"
              type="link"
            >
              更多操作 <DownOutlined className="text-[9px]" />
            </Button>
          </Popover>
        </div>
      </div>
    </Card>
  );
};

const EmbyMissingPage: React.FC = () => {
  const [data, setData] = useState<API.EmbyMissingListResult>();
  const [loading, setLoading] = useState(false);
  const [blacklistOpen, setBlacklistOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [blacklist, setBlacklist] = useState<API.EmbyMissingBlacklist[]>([]);
  const [rescanningSeriesId, setRescanningSeriesId] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [sortMode, setSortMode] = useState<MissingSortMode>('name');
  const [pathModal, setPathModal] = useState<{
    open: boolean;
    loading: boolean;
    seriesName: string;
    embyPath: string;
    matched: boolean;
    cloudDir: string;
    storageName: string;
    localDir: string;
    strmFile: string;
    strmContent: string;
  }>({
    open: false,
    loading: false,
    seriesName: '',
    embyPath: '',
    matched: false,
    cloudDir: '',
    storageName: '',
    localDir: '',
    strmFile: '',
    strmContent: '',
  });
  const [messageApi, contextHolder] = message.useMessage();
  const [modalApi, modalContextHolder] = Modal.useModal();
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getEmbyMissing();
      if (res.code === 0) {
        setData(res.data);
      }
    } catch (error: any) {
      messageApi.error(error?.message || '获取缺集列表失败');
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  useEffect(() => {
    load();
  }, [load]);

  // 扫描进行中时轮询刷新
  useEffect(() => {
    if (data?.setting?.scanning) {
      timerRef.current = setTimeout(load, POLL_MS);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [data?.setting?.scanning, load]);

  const groupCount = data?.groups?.length ?? 0;

  useEffect(() => {
    const lastPage = Math.max(1, Math.ceil(groupCount / pageSize));
    setCurrentPage((page) => Math.min(page, lastPage));
  }, [groupCount, pageSize]);

  const handleScan = async (forceFull = false) => {
    try {
      const res = await scanEmbyMissing(forceFull ? { force_full: true } : {});
      if (res.code === 0) {
        messageApi.success(forceFull ? '强制全量扫描已开始' : '扫描已开始');
        load();
      } else {
        messageApi.error(res.message || '触发扫描失败');
      }
    } catch (error: any) {
      messageApi.error(error?.message || '触发扫描失败');
    }
  };

  const handleAddBlacklist = async (record: API.EmbyMissingSeriesGroup) => {
    try {
      const res = await addEmbyMissingBlacklist({
        series_id: record.series_id,
        series_name: record.series_name,
      });
      if (res.code === 0) {
        messageApi.success('已加入黑名单并从列表移除');
        load();
      } else {
        messageApi.error(res.message || '加入黑名单失败');
      }
    } catch (error: any) {
      messageApi.error(error?.message || '加入黑名单失败');
    }
  };

  const handleRescanSeries = async (record: API.EmbyMissingSeriesGroup) => {
    setRescanningSeriesId(record.series_id);
    try {
      const res = await rescanEmbyMissingSeries(record.series_id);
      if (res.code === 0 && res.data) {
        if (res.data.resolved) {
          messageApi.success('Emby 已确认补齐，已从缺集列表移除');
        } else {
          messageApi.success(`重扫完成，当前仍缺 ${res.data.missing_count} 集`);
        }
        await load();
      } else {
        messageApi.error(res.message || '单剧重扫失败');
      }
    } catch (error: any) {
      messageApi.error(error?.message || '单剧重扫失败');
    } finally {
      setRescanningSeriesId('');
    }
  };

  const handleViewPath = async (record: API.EmbyMissingSeriesGroup) => {
    setPathModal({
      open: true,
      loading: true,
      seriesName: record.series_name,
      embyPath: '',
      matched: false,
      cloudDir: '',
      storageName: '',
      localDir: '',
      strmFile: '',
      strmContent: '',
    });
    try {
      const res = await resolveEmbyMissingCloudPath({
        series_id: record.series_id,
      });
      if (res.code === 0 && res.data) {
        const data = res.data;
        const matchedOpt = (data.options || []).find(
          (o) => o.id === data.cloud_path_id,
        );
        setPathModal((s) => ({
          ...s,
          loading: false,
          embyPath: data.emby_path || '',
          matched: !!data.matched,
          cloudDir: data.cloud_dir || '',
          storageName:
            matchedOpt?.storage_name ||
            (matchedOpt ? `存储#${matchedOpt.cloud_storage_id}` : ''),
          localDir: data.local_dir || '',
          strmFile: data.strm_file || '',
          strmContent: data.strm_content || '',
        }));
      } else {
        messageApi.error(res.message || '获取位置失败');
        setPathModal((s) => ({ ...s, loading: false }));
      }
    } catch (error: any) {
      messageApi.error(error?.message || '获取位置失败');
      setPathModal((s) => ({ ...s, loading: false }));
    }
  };

  const openBlacklist = async () => {
    setBlacklistOpen(true);
    try {
      const res = await getEmbyMissingBlacklist();
      if (res.code === 0) setBlacklist(res.data || []);
    } catch (error: any) {
      messageApi.error(error?.message || '获取黑名单失败');
    }
  };

  const handleRemoveBlacklist = async (id: number) => {
    try {
      const res = await removeEmbyMissingBlacklist(id);
      if (res.code === 0) {
        messageApi.success('已移除，下次扫描重新纳入');
        const list = await getEmbyMissingBlacklist();
        if (list.code === 0) setBlacklist(list.data || []);
      } else {
        messageApi.error(res.message || '移除失败');
      }
    } catch (error: any) {
      messageApi.error(error?.message || '移除失败');
    }
  };

  const setting = data?.setting;
  const scanning = !!setting?.scanning;
  const groups = data?.groups || [];
  const sortedGroups =
    sortMode === 'name'
      ? groups
      : [...groups].sort((left, right) => {
          const countDiff = left.missing_count - right.missing_count;
          if (countDiff !== 0) {
            return sortMode === 'missing_desc' ? -countDiff : countDiff;
          }
          return left.series_name.localeCompare(right.series_name, 'zh-CN');
        });
  const visibleGroups = sortedGroups.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const moreActionItems: MenuProps['items'] = [
    {
      key: 'force-full',
      icon: <ThunderboltOutlined />,
      label: '强制全扫',
      disabled: scanning,
    },
    { type: 'divider' },
    {
      key: 'schedule',
      icon: <SettingOutlined />,
      label: '定时设置',
    },
    {
      key: 'blacklist',
      icon: <StopOutlined />,
      label: '黑名单管理',
    },
  ];

  const handleMoreAction: MenuProps['onClick'] = ({ key }) => {
    if (key === 'force-full') {
      modalApi.confirm({
        title: '强制全量扫描',
        content:
          '将逐剧重新检查全部剧集，忽略「近期已扫」窗口，耗时较长。确定继续？',
        okText: '开始全扫',
        cancelText: '取消',
        onOk: () => handleScan(true),
      });
      return;
    }
    if (key === 'schedule') {
      setScheduleOpen(true);
      return;
    }
    if (key === 'blacklist') {
      void openBlacklist();
    }
  };

  return (
    <div className="mx-auto box-border w-full max-w-[1680px] px-4 py-5 sm:px-6 sm:py-7 xl:px-8">
      {contextHolder}
      {modalContextHolder}
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="m-0 text-[11px] font-semibold tracking-[0.18em] text-neutral-400 uppercase dark:text-white/35">
            Emby tools
          </p>
          <h1 className="mt-2 mb-0 text-2xl font-semibold tracking-[-0.035em] text-neutral-950 sm:text-[30px] dark:text-white">
            缺集扫描
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Button
            className="!h-9 !rounded-xl !border-0 !bg-black/[0.035] !px-3.5 !text-neutral-600 hover:!bg-black/[0.065] dark:!bg-white/8 dark:!text-white/65 dark:hover:!bg-white/12"
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={load}
            type="text"
          >
            刷新
          </Button>
          <Button
            className="!h-9 !rounded-xl !px-4"
            icon={<ScanOutlined />}
            loading={scanning}
            onClick={() => handleScan(false)}
            type="primary"
          >
            {scanning ? '扫描中…' : '增量扫描'}
          </Button>
          <Dropdown
            menu={{ items: moreActionItems, onClick: handleMoreAction }}
            placement="bottomRight"
            trigger={['click']}
          >
            <Button
              className="!h-9 !rounded-xl !border-0 !bg-black/[0.035] !px-3.5 !text-neutral-600 hover:!bg-black/[0.065] dark:!bg-white/8 dark:!text-white/65 dark:hover:!bg-white/12"
              type="text"
            >
              更多 <DownOutlined className="text-[10px]" />
            </Button>
          </Dropdown>
        </div>
      </header>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col xs={12} sm={6}>
            <Statistic
              title="缺集剧数"
              value={setting?.last_series_count ?? 0}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title="缺集总数"
              value={setting?.last_missing_count ?? 0}
            />
          </Col>
          <Col xs={24} sm={6}>
            <div className="ant-statistic">
              <div className="ant-statistic-title">最近扫描</div>
              <div style={{ fontSize: 16 }}>
                {fmtDateTime(setting?.last_scan_at)}
              </div>
            </div>
            {setting?.last_status === 'failed' && (
              <Text type="danger" style={{ fontSize: 12 }}>
                失败：{setting?.last_error}
              </Text>
            )}
          </Col>
          <Col xs={24} sm={6}>
            <Space orientation="vertical" style={{ width: '100%' }}>
              <Space wrap>
                <Tag color={setting?.schedule_enabled ? 'green' : 'default'}>
                  定时
                  {setting?.schedule_enabled ? `开启 ${setting?.cron}` : '关闭'}
                </Tag>
                {scanning && <Tag color="processing">扫描中…</Tag>}
              </Space>
            </Space>
          </Col>
        </Row>
        {scanning && (
          <div style={{ marginTop: 16 }}>
            <Progress percent={data?.progress?.percent ?? 0} status="active" />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {describeProgress(data?.progress)}
            </Text>
          </div>
        )}
      </Card>

      <Spin spinning={loading}>
        <section
          aria-busy={loading}
          aria-label="缺集剧集"
          className={styles.seriesList}
        >
          <header className={styles.resultToolbar}>
            <div>
              <strong>缺集剧集</strong>
              <span>共 {groups.length} 部</span>
            </div>
            <Select
              aria-label="缺集剧集排序"
              onChange={(value) => {
                setSortMode(value);
                setCurrentPage(1);
              }}
              options={SORT_OPTIONS}
              size="small"
              value={sortMode}
              variant="filled"
            />
          </header>

          {groups.length > 0 ? (
            <div className={styles.seriesGrid}>
              {visibleGroups.map((record) => (
                <MissingSeriesCard
                  key={record.series_id}
                  record={record}
                  scanning={scanning}
                  rescanningSeriesId={rescanningSeriesId}
                  onAddBlacklist={handleAddBlacklist}
                  onRescan={handleRescanSeries}
                  onViewPath={handleViewPath}
                />
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>暂无缺集记录</div>
          )}

          {groups.length > 0 && (
            <Pagination
              align="center"
              className={styles.pagination}
              current={currentPage}
              onChange={(nextPage, nextPageSize) => {
                if (nextPageSize !== pageSize) {
                  setPageSize(nextPageSize);
                  setCurrentPage(1);
                  return;
                }
                setCurrentPage(nextPage);
              }}
              pageSize={pageSize}
              pageSizeOptions={[8, 16, 24]}
              responsive
              showSizeChanger
              total={groups.length}
            />
          )}
        </section>
      </Spin>

      <Modal
        title={`剧集位置 - ${pathModal.seriesName || ''}`}
        open={pathModal.open}
        onCancel={() => setPathModal((s) => ({ ...s, open: false }))}
        footer={null}
        width={640}
      >
        <Spin spinning={pathModal.loading}>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Emby 本地路径（媒体服务器视角）：
            </Text>
            <div style={{ marginTop: 4, marginBottom: 16 }}>
              {pathModal.loading ? (
                <Text type="secondary">加载中…</Text>
              ) : (
                <Text
                  code
                  copyable={
                    pathModal.embyPath ? { text: pathModal.embyPath } : false
                  }
                >
                  {pathModal.embyPath || '未获取到路径（可能为虚拟/合集条目）'}
                </Text>
              )}
            </div>

            <Text type="secondary" style={{ fontSize: 12 }}>
              反推云端目录
              {pathModal.storageName ? `（${pathModal.storageName}）` : ''}：
            </Text>
            <div style={{ marginTop: 4, marginBottom: 16 }}>
              {pathModal.loading ? (
                <Text type="secondary">加载中…</Text>
              ) : pathModal.matched && pathModal.cloudDir ? (
                <Text code copyable={{ text: pathModal.cloudDir }}>
                  {pathModal.cloudDir}
                </Text>
              ) : (
                <Text type="warning">
                  未匹配到云路径映射（无法反推云端目录）
                </Text>
              )}
            </div>

            <Text type="secondary" style={{ fontSize: 12 }}>
              本地剧集目录（定位结果）：
            </Text>
            <div style={{ marginTop: 4, marginBottom: 16 }}>
              {pathModal.loading ? (
                <Text type="secondary">加载中…</Text>
              ) : pathModal.localDir ? (
                <Text code copyable={{ text: pathModal.localDir }}>
                  {pathModal.localDir}
                </Text>
              ) : (
                <Text type="warning">
                  未定位到本地目录（若已由 Emby 前缀反推出云端目录，可忽略此项）
                </Text>
              )}
            </div>

            <Text type="secondary" style={{ fontSize: 12 }}>
              STRM 文件：
            </Text>
            <div style={{ marginTop: 4, marginBottom: 16 }}>
              {pathModal.loading ? (
                <Text type="secondary">加载中…</Text>
              ) : pathModal.strmFile ? (
                <Text code copyable={{ text: pathModal.strmFile }}>
                  {pathModal.strmFile}
                </Text>
              ) : (
                <Text type="secondary">未找到 .strm 文件</Text>
              )}
            </div>

            <Text type="secondary" style={{ fontSize: 12 }}>
              STRM 内容（云端路径来源）：
            </Text>
            <div style={{ marginTop: 4 }}>
              {pathModal.loading ? (
                <Text type="secondary">加载中…</Text>
              ) : pathModal.strmContent ? (
                <Text
                  code
                  copyable={{ text: pathModal.strmContent }}
                  style={{ wordBreak: 'break-all' }}
                >
                  {pathModal.strmContent}
                </Text>
              ) : (
                <Text type="secondary">无内容</Text>
              )}
            </div>
          </div>
        </Spin>
      </Modal>

      <Modal
        title="缺集检查黑名单"
        open={blacklistOpen}
        onCancel={() => setBlacklistOpen(false)}
        footer={null}
        width={680}
      >
        <Table<API.EmbyMissingBlacklist>
          rowKey="id"
          size="small"
          dataSource={blacklist}
          pagination={false}
          columns={[
            {
              title: '剧名',
              dataIndex: 'series_name',
              render: (v) => v || '-',
            },
            {
              title: '剧集ID',
              dataIndex: 'series_id',
              width: 220,
              ellipsis: true,
            },
            { title: '备注', dataIndex: 'remark', render: (v) => v || '-' },
            {
              title: '操作',
              key: 'option',
              width: 90,
              render: (_, record) => (
                <Popconfirm
                  title="移除后下次扫描会重新纳入"
                  onConfirm={() => handleRemoveBlacklist(record.id)}
                >
                  <Button type="link" size="small" danger>
                    移除
                  </Button>
                </Popconfirm>
              ),
            },
          ]}
        />
      </Modal>

      <ScheduleSettingForm
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        setting={setting}
        onSaved={load}
      />
    </div>
  );
};

type ScheduleSettingFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setting?: API.EmbyMissingSetting;
  onSaved: () => void;
};

const ScheduleSettingForm: React.FC<ScheduleSettingFormProps> = ({
  open,
  onOpenChange,
  setting,
  onSaved,
}) => {
  const [messageApi, contextHolder] = message.useMessage();
  return (
    <>
      {contextHolder}
      <ModalForm
        title="定时扫描设置"
        width={520}
        open={open}
        onOpenChange={onOpenChange}
        modalProps={{ destroyOnHidden: true }}
        initialValues={{
          schedule_enabled: setting?.schedule_enabled ?? false,
          cron: setting?.cron ?? '0 4 * * *',
          library_id: setting?.library_id || '',
          include_specials: setting?.include_specials ?? false,
          include_unaired: setting?.include_unaired ?? false,
          rescan_interval_days: setting?.rescan_interval_days ?? 7,
        }}
        onFinish={async (values) => {
          try {
            const res = await updateEmbyMissingSetting({
              schedule_enabled: values.schedule_enabled,
              cron: values.cron,
              library_id: values.library_id || '',
              include_specials: values.include_specials,
              include_unaired: values.include_unaired,
              rescan_interval_days: values.rescan_interval_days,
            });
            if (res.code === 0) {
              messageApi.success('已保存');
              onSaved();
              return true;
            }
            messageApi.error(res.message || '保存失败');
            return false;
          } catch (error: any) {
            messageApi.error(error?.message || '保存失败');
            return false;
          }
        }}
      >
        <ProFormSwitch name="schedule_enabled" label="开启定时扫描" />
        <ProFormText
          name="cron"
          label="cron 表达式"
          placeholder="如 0 4 * * * 每天 4 点；支持 5/6 段"
          tooltip="开启定时后必填。例：0 4 * * * (每天4点)，0 0 */6 * * * (每6小时)"
        />
        <ProFormSelect
          name="library_id"
          label="扫描范围"
          placeholder="默认全部电视剧库"
          allowClear
          fieldProps={{ showSearch: true, optionFilterProp: 'label' }}
          request={async () => {
            const res = await getEmbyMissingLibraries();
            const list = res?.data || [];
            return [
              { label: '全部电视剧库', value: '' },
              ...list.map((l) => ({ label: l.name, value: l.id })),
            ];
          }}
        />
        <ProFormSwitch name="include_specials" label="统计特别篇(Specials)" />
        <ProFormSwitch name="include_unaired" label="统计未播出集" />
        <ProFormDigit
          name="rescan_interval_days"
          label="重复扫描间隔(天)"
          tooltip="增量扫描时，同一部剧在该天数内不再重复查询 Emby（0=每次都查）。首次扫描与「强制全扫」会忽略此项。统计口径(特别篇/未播出)变化时也会强制重查。"
          min={0}
          fieldProps={{ precision: 0 }}
          placeholder="默认 7 天"
        />
      </ModalForm>
    </>
  );
};

export default EmbyMissingPage;
