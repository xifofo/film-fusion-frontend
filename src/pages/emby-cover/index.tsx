import {
  DownOutlined,
  EditOutlined,
  EyeOutlined,
  MoreOutlined,
  ReloadOutlined,
  SortAscendingOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import {
  App,
  Button,
  Card,
  Dropdown,
  Popconfirm,
  Popover,
  Spin,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useApiRequest } from '@/hooks/useApiRequest';
import {
  backfillEmbySortName,
  batchGenerateEmbyCovers,
  embyWatchImageUrl,
  getEmbySortNameStatus,
  listEmbyCoverLibraries,
  listEmbyCoverTemplates,
} from '@/services/film-fusion';
import EditConfigForm from './components/EditConfigForm';
import PreviewModal from './components/PreviewModal';
import styles from './index.module.less';

const { Text } = Typography;

const formatDateTime = (value?: string | null) => {
  if (!value) return '尚未生成';
  const date = dayjs(value);
  return date.isValid() ? date.format('YYYY-MM-DD HH:mm') : value;
};

const collectionTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    movies: '电影',
    tvshows: '剧集',
    boxsets: '合集',
    music: '音乐',
    homevideos: '家庭视频',
    mixed: '混合',
  };
  return labels[type] || type || '未知类型';
};

const LibraryBackdrop: React.FC<{
  libraryId: string;
  libraryName: string;
}> = ({ libraryId, libraryName }) => {
  const [source, setSource] = useState<'backdrop' | 'primary' | 'failed'>(
    'backdrop',
  );

  useEffect(() => setSource('backdrop'), [libraryId]);

  const imageUrl =
    source === 'failed'
      ? ''
      : embyWatchImageUrl(
          libraryId,
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
          <span>{Array.from(libraryName.trim())[0] || '库'}</span>
        </div>
      )}
      <div className={styles.backdropScrim} />
    </div>
  );
};

const SortNameJobStatus: React.FC<{ job: API.EmbySortNameJob }> = ({ job }) => {
  const seconds = Math.round((job.duration_ms || 0) / 1000);
  const baseScope =
    job.library_ids && job.library_ids.length > 0
      ? `指定 ${job.library_ids.length} 个库`
      : '全部媒体库';
  const scope = job.force ? `${baseScope} · 强制覆盖` : baseScope;
  const tone = job.running
    ? 'processing'
    : job.error_msg
      ? 'error'
      : job.errors > 0
        ? 'warning'
        : 'success';
  const title = job.running
    ? 'SortName 拼音回填进行中'
    : job.error_msg
      ? 'SortName 拼音回填已终止'
      : 'SortName 拼音回填已完成';

  return (
    <output
      aria-live="polite"
      className={`${styles.jobStatus} ${styles[`jobStatus-${tone}`]}`}
    >
      <span className={styles.jobStatusDot} />
      <div>
        <div className={styles.jobStatusTitle}>
          <strong>{title}</strong>
          <span>{scope}</span>
        </div>
        <p>
          已处理 {job.total}，更新 {job.updated}，跳过 {job.skipped}，错误{' '}
          {job.errors}，耗时 {seconds}s
          {job.error_msg ? ` · ${job.error_msg}` : ''}
        </p>
      </div>
    </output>
  );
};

type LibraryCardProps = {
  record: API.EmbyCoverLibraryView;
  templateName: string;
  templates: API.EmbyCoverTemplate[];
  sortNameRunning: boolean;
  sortNameStarting: string | null;
  onPreview: (record: API.EmbyCoverLibraryView) => void;
  onReload: () => void;
  onStartSortName: (
    libraryIds: string[] | undefined,
    actionKey: string,
    force?: boolean,
  ) => Promise<void>;
};

const LibraryCard: React.FC<LibraryCardProps> = ({
  record,
  templateName,
  templates,
  sortNameRunning,
  sortNameStarting,
  onPreview,
  onReload,
  onStartSortName,
}) => {
  const [moreOpen, setMoreOpen] = useState(false);
  const primaryTitle = record.cn_title || record.emby_name;
  const secondaryTitle =
    record.en_subtitle ||
    (primaryTitle !== record.emby_name ? record.emby_name : '');
  const healthText = record.last_error
    ? record.last_error
    : record.last_generated_at
      ? '运行正常'
      : '等待首次生成';

  return (
    <Card className={styles.libraryCard} variant="borderless">
      <div className={styles.cardVisual}>
        <LibraryBackdrop
          libraryId={record.emby_library_id}
          libraryName={record.emby_name}
        />

        <div className={styles.cardTopline}>
          <span className={styles.collectionBadge}>
            {collectionTypeLabel(record.collection_type)}
          </span>
          <span
            className={`${styles.enabledBadge} ${record.enabled ? styles.enabledBadgeOn : styles.enabledBadgeOff}`}
          >
            {record.enabled ? '已启用' : '已停用'}
          </span>
        </div>

        <div className={styles.cardMain}>
          <div className={styles.libraryCopy}>
            <p>EMBY LIBRARY · {record.emby_library_id}</p>
            <h2 title={primaryTitle}>{primaryTitle}</h2>
            {secondaryTitle && (
              <div className={styles.librarySubtitle} title={secondaryTitle}>
                {secondaryTitle}
              </div>
            )}
            <div className={styles.cardChips}>
              <span title={templateName}>{templateName}</span>
              <span>{record.configured ? '已配置' : '默认配置'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.cardFooter}>
        <div className={styles.metadataList}>
          <div>
            <span>媒体库</span>
            <strong title={record.emby_name}>{record.emby_name}</strong>
          </div>
          <div>
            <span>上次生成</span>
            <time>{formatDateTime(record.last_generated_at)}</time>
          </div>
          <div className={record.last_error ? styles.metadataError : ''}>
            <span>最近状态</span>
            <strong title={healthText}>{healthText}</strong>
          </div>
        </div>

        <div className={styles.actionRow}>
          <Button
            icon={<EyeOutlined />}
            onClick={() => onPreview(record)}
            size="small"
            type="link"
          >
            预览封面
          </Button>
          <Popover
            arrow={false}
            content={
              <div className={styles.cardActionMenu}>
                <EditConfigForm
                  record={record}
                  templates={templates}
                  trigger={
                    <Button
                      icon={<EditOutlined />}
                      onClick={() => setMoreOpen(false)}
                      size="small"
                      type="text"
                    >
                      编辑配置
                    </Button>
                  }
                  onSuccess={onReload}
                />
                <Popconfirm
                  title={`对「${record.emby_name}」回填拼音 SortName？`}
                  description="仅扫描本库下 Movie/Series/BoxSet，已锁定的不覆盖。后端后台跑，可关闭页面。"
                  okText="启动"
                  cancelText="取消"
                  onConfirm={() => {
                    setMoreOpen(false);
                    return onStartSortName(
                      [record.emby_library_id],
                      `row-${record.emby_library_id}`,
                      false,
                    );
                  }}
                  disabled={sortNameRunning}
                >
                  <Button
                    disabled={sortNameRunning}
                    icon={<SortAscendingOutlined />}
                    loading={
                      sortNameStarting === `row-${record.emby_library_id}`
                    }
                    size="small"
                    type="text"
                  >
                    拼音回填
                  </Button>
                </Popconfirm>
                <div className={styles.cardActionMenuDivider} />
                <Popconfirm
                  title={`强制覆盖「${record.emby_name}」的 SortName？`}
                  description={
                    <div style={{ maxWidth: 320 }}>
                      <Text type="warning">忽略锁定状态</Text>
                      ，包括被其它工具锁定的条目也会被覆写。
                    </div>
                  }
                  okText="强制覆盖"
                  okButtonProps={{ danger: true }}
                  cancelText="取消"
                  onConfirm={() => {
                    setMoreOpen(false);
                    return onStartSortName(
                      [record.emby_library_id],
                      `row-force-${record.emby_library_id}`,
                      true,
                    );
                  }}
                  disabled={sortNameRunning}
                >
                  <Button
                    danger
                    disabled={sortNameRunning}
                    loading={
                      sortNameStarting === `row-force-${record.emby_library_id}`
                    }
                    size="small"
                    type="text"
                  >
                    强制覆盖 SortName
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
              aria-label={`${record.emby_name} 更多操作`}
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

const EmbyCoverPage: React.FC = () => {
  const { message: messageApi, modal } = App.useApp();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRow, setPreviewRow] = useState<API.EmbyCoverLibraryView>();
  const [sortNameJob, setSortNameJob] = useState<API.EmbySortNameJob | null>(
    null,
  );
  const [sortNameStarting, setSortNameStarting] = useState<string | null>(null);

  const { data: templates = [] } = useApiRequest(listEmbyCoverTemplates, {
    formatResult: (res) => res?.data || [],
  });
  const {
    data: libraries = [],
    loading: librariesLoading,
    refresh: refreshLibraries,
  } = useApiRequest(listEmbyCoverLibraries, {
    formatResult: (res) => res?.data || [],
    onError: (error) => {
      messageApi.error(error?.message || '获取媒体库列表失败');
    },
  });

  const reloadLibraries = useCallback(async () => {
    await refreshLibraries().catch(() => undefined);
  }, [refreshLibraries]);

  const templateMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const template of templates) {
      map[template.id] = template.name;
    }
    return map;
  }, [templates]);

  const fetchSortNameStatus = useCallback(async () => {
    try {
      const resp = await getEmbySortNameStatus();
      setSortNameJob(resp?.data?.job || null);
    } catch {
      // 状态查询失败不阻断媒体库工具页。
    }
  }, []);

  useEffect(() => {
    fetchSortNameStatus();
  }, [fetchSortNameStatus]);

  useEffect(() => {
    if (!sortNameJob?.running) return;
    const timer = setInterval(fetchSortNameStatus, 3000);
    return () => clearInterval(timer);
  }, [sortNameJob?.running, sortNameJob?.id, fetchSortNameStatus]);

  const startSortNameBackfill = async (
    libraryIds: string[] | undefined,
    actionKey: string,
    force = false,
  ) => {
    setSortNameStarting(actionKey);
    try {
      const resp = await backfillEmbySortName(libraryIds, force);
      if (resp?.data) {
        setSortNameJob(resp.data);
        messageApi.success(
          force
            ? 'SortName 强制覆盖已启动，后端后台执行'
            : 'SortName 回填已启动，后端后台执行，可关闭页面',
        );
      }
    } catch (error: any) {
      messageApi.error(error?.message || '启动 SortName 回填失败');
      fetchSortNameStatus();
    } finally {
      setSortNameStarting(null);
    }
  };

  const sortNameRunning = !!sortNameJob?.running;

  const { run: batchRun, loading: batchLoading } = useApiRequest(
    batchGenerateEmbyCovers,
    {
      manual: true,
      onSuccess: (result) => {
        if (!result) {
          messageApi.success('批量任务完成');
        } else {
          const { success, failed, errors } = result as {
            success: number;
            failed: number;
            errors: string[];
          };
          if (failed === 0) {
            messageApi.success(`批量生成完成：成功 ${success}`);
          } else {
            modal.warning({
              title: `批量生成完成（成功 ${success} / 失败 ${failed}）`,
              width: 640,
              content: (
                <div style={{ maxHeight: 320, overflow: 'auto' }}>
                  {errors?.length ? (
                    errors.map((error) => (
                      <div key={error} style={{ marginBottom: 4 }}>
                        <Text type="danger">· {error}</Text>
                      </div>
                    ))
                  ) : (
                    <Text type="secondary">无详细错误信息</Text>
                  )}
                </div>
              ),
            });
          }
        }
        void reloadLibraries();
      },
      onError: (error) => {
        messageApi.error(error?.message || '批量生成失败');
      },
    },
  );

  const openPreview = (record: API.EmbyCoverLibraryView) => {
    setPreviewRow(record);
    setPreviewOpen(true);
  };

  const moreActionItems: MenuProps['items'] = [
    {
      key: 'sortname',
      icon: <SortAscendingOutlined />,
      label: '拼音回填 SortName',
      disabled: sortNameRunning,
    },
    { type: 'divider' },
    {
      key: 'sortname-force',
      icon: <SortAscendingOutlined />,
      label: '强制覆盖 SortName',
      danger: true,
      disabled: sortNameRunning,
    },
  ];

  const handleMoreAction: MenuProps['onClick'] = ({ key }) => {
    if (key === 'sortname') {
      modal.confirm({
        title: '按拼音首字母回填所有媒体的 SortName？',
        content: (
          <div style={{ maxWidth: 360 }}>
            将扫描 Emby 所有
            Movie/Series/BoxSet，对未锁定的条目写入拼音首字母。已锁定 SortName
            的条目会被跳过。后端后台执行，可关闭页面或刷新。
          </div>
        ),
        okText: '启动',
        cancelText: '取消',
        onOk: () => startSortNameBackfill(undefined, 'all', false),
      });
      return;
    }
    if (key === 'sortname-force') {
      modal.confirm({
        title: '强制覆盖所有媒体的 SortName？',
        content: (
          <div style={{ maxWidth: 360 }}>
            <Text type="warning">忽略锁定状态</Text>，对所有 Movie/Series/BoxSet
            强制写入拼音首字母。包括被别的工具（如
            MoviePilot）锁定过的条目也会被覆写。
          </div>
        ),
        okText: '强制覆盖',
        okButtonProps: { danger: true },
        cancelText: '取消',
        onOk: () => startSortNameBackfill(undefined, 'all-force', true),
      });
    }
  };

  return (
    <div className="mx-auto box-border w-full max-w-[1680px] px-4 py-5 sm:px-6 sm:py-7 xl:px-8">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="m-0 text-[11px] font-semibold tracking-[0.18em] text-neutral-400 uppercase dark:text-white/35">
            Emby tools
          </p>
          <h1 className="mt-2 mb-0 text-2xl font-semibold tracking-[-0.035em] text-neutral-950 sm:text-[30px] dark:text-white">
            媒体库工具
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Button
            className="!h-9 !rounded-xl !border-0 !bg-black/[0.035] !px-3.5 !text-neutral-600 hover:!bg-black/[0.065] dark:!bg-white/8 dark:!text-white/65 dark:hover:!bg-white/12"
            icon={<ReloadOutlined />}
            loading={librariesLoading}
            onClick={() => void reloadLibraries()}
            type="text"
          >
            刷新
          </Button>
          <Popconfirm
            title="批量生成所有启用的媒体库封面？"
            description="将用最新海报为所有启用的库生成并上传，过程可能持续几十秒到几分钟。"
            okText="开始"
            cancelText="取消"
            onConfirm={() => batchRun()}
            okButtonProps={{ loading: batchLoading }}
          >
            <Button
              className="!h-9 !rounded-xl !px-4"
              icon={<ThunderboltOutlined />}
              loading={batchLoading}
              type="primary"
            >
              批量生成
            </Button>
          </Popconfirm>
          <Dropdown
            classNames={{
              root: '[&_.ant-dropdown-menu-item-divider]:!my-1 [&_.ant-dropdown-menu-item-divider]:!bg-black/[0.055] [&_.ant-dropdown-menu-item-danger]:!text-rose-500 [&_.ant-dropdown-menu-item-danger:hover]:!bg-rose-500/[0.07] [&_.ant-dropdown-menu-item-danger_.anticon]:!text-rose-400 dark:[&_.ant-dropdown-menu-item-divider]:!bg-white/8 dark:[&_.ant-dropdown-menu-item-danger]:!text-rose-400 dark:[&_.ant-dropdown-menu-item-danger:hover]:!bg-rose-400/10',
              item: '!min-h-10 !rounded-xl !px-3 !py-2 !text-[13px] !text-neutral-700 transition-colors [&:not(.ant-dropdown-menu-item-danger):hover]:!bg-black/[0.045] dark:!text-white/75 dark:[&:not(.ant-dropdown-menu-item-danger):hover]:!bg-white/[0.07]',
              itemContent: '!font-medium !tracking-[-0.01em]',
              itemIcon:
                '!mr-2.5 !text-[14px] !text-neutral-400 dark:!text-white/35',
            }}
            menu={{
              items: moreActionItems,
              onClick: handleMoreAction,
              className:
                '!min-w-[224px] !rounded-2xl !border-0 !bg-white/88 !p-1.5 !shadow-[0_18px_55px_rgba(0,0,0,0.14)] !backdrop-blur-2xl dark:!bg-neutral-900/88 dark:!shadow-black/35',
            }}
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

      {sortNameJob && <SortNameJobStatus job={sortNameJob} />}

      <Spin spinning={librariesLoading}>
        <section
          aria-busy={librariesLoading}
          aria-label="Emby 媒体库"
          className={styles.libraryList}
        >
          {libraries.length > 0 ? (
            <div className={styles.libraryGrid}>
              {libraries.map((record) => (
                <LibraryCard
                  key={record.emby_library_id}
                  record={record}
                  templateName={
                    templateMap[record.template_id] || record.template_id
                  }
                  templates={templates}
                  sortNameRunning={sortNameRunning}
                  sortNameStarting={sortNameStarting}
                  onPreview={openPreview}
                  onReload={() => void reloadLibraries()}
                  onStartSortName={startSortNameBackfill}
                />
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>暂无媒体库</div>
          )}
        </section>
      </Spin>

      <PreviewModal
        open={previewOpen}
        record={previewRow}
        onClose={() => setPreviewOpen(false)}
        onUploaded={() => void reloadLibraries()}
      />
    </div>
  );
};

export default EmbyCoverPage;
