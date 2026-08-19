import { PageContainer } from '@ant-design/pro-components';
import { Alert } from 'antd';
import {
  Clapperboard,
  Clock3,
  Film,
  Layers,
  Library,
  type LucideIcon,
  Music,
  RefreshCw,
  Tv,
  Video,
} from 'lucide-react';
import React, { type CSSProperties, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useApiRequest } from '@/hooks/useApiRequest';
import { embyStatsLibraryImageUrl, getEmbyStats } from '@/services/film-fusion';
import styles from './index.module.less';

type LibraryKind =
  | 'movies'
  | 'tvshows'
  | 'mixed'
  | 'boxsets'
  | 'music'
  | 'homevideos'
  | 'other';

type CollectionMeta = {
  icon: LucideIcon;
  kind: LibraryKind;
  label: string;
  unit: string;
};

const COLLECTION_META: Record<LibraryKind, CollectionMeta> = {
  movies: { icon: Film, kind: 'movies', label: '电影', unit: '部电影' },
  tvshows: { icon: Tv, kind: 'tvshows', label: '剧集', unit: '部剧集' },
  mixed: { icon: Layers, kind: 'mixed', label: '混合', unit: '项影视内容' },
  boxsets: { icon: Layers, kind: 'boxsets', label: '合集', unit: '个合集' },
  music: { icon: Music, kind: 'music', label: '音乐', unit: '项音乐内容' },
  homevideos: {
    icon: Video,
    kind: 'homevideos',
    label: '家庭视频',
    unit: '段视频',
  },
  other: { icon: Library, kind: 'other', label: '其他', unit: '项内容' },
};

const collectionMeta = (collectionType: string): CollectionMeta => {
  const normalized = collectionType.trim().toLowerCase() as LibraryKind;
  return COLLECTION_META[normalized] || COLLECTION_META.other;
};

const formatCount = (value: number) => value.toLocaleString('zh-CN');
const SKELETON_CARDS = [
  'skeleton-a',
  'skeleton-b',
  'skeleton-c',
  'skeleton-d',
  'skeleton-e',
  'skeleton-f',
];

const libraryContentCount = (stat: API.EmbyLibraryStat) => {
  if (Number.isFinite(stat.content_count)) return stat.content_count;
  return (stat.movie_count || 0) + (stat.series_count || 0);
};

const libraryPrimaryMetric = (stat: API.EmbyLibraryStat) => {
  const meta = collectionMeta(stat.collection_type);
  if (meta.kind === 'movies') return stat.movie_count || 0;
  if (meta.kind === 'tvshows') return stat.series_count || 0;
  return libraryContentCount(stat);
};

const LibraryCover: React.FC<{
  eager: boolean;
  meta: CollectionMeta;
  stat: API.EmbyLibraryStat;
}> = ({ eager, meta, stat }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const imageURL = embyStatsLibraryImageUrl(stat);
  const Icon = meta.icon;

  useEffect(() => setImageFailed(false), [imageURL]);

  return (
    <div className={styles.coverFrame}>
      {imageURL && !imageFailed ? (
        <img
          alt={`${stat.emby_name} 媒体库封面`}
          className={styles.coverImage}
          decoding="async"
          loading={eager ? 'eager' : 'lazy'}
          onError={() => setImageFailed(true)}
          src={imageURL}
        />
      ) : (
        <div className={styles.coverFallback}>
          <Icon aria-hidden="true" />
        </div>
      )}
      <div aria-hidden="true" className={styles.coverScrim} />
    </div>
  );
};

const LibraryCard: React.FC<{
  index: number;
  stat: API.EmbyLibraryStat;
  totalMovies: number;
  totalSeries: number;
}> = ({ index, stat, totalMovies, totalSeries }) => {
  const meta = collectionMeta(stat.collection_type);
  const primaryCount = libraryPrimaryMetric(stat);
  const relevantTotal =
    meta.kind === 'movies'
      ? totalMovies
      : meta.kind === 'tvshows'
        ? totalSeries
        : meta.kind === 'mixed'
          ? totalMovies + totalSeries
          : 0;
  const share = relevantTotal > 0 ? (primaryCount / relevantTotal) * 100 : 0;
  const typeClass =
    styles[`type${meta.kind[0].toUpperCase()}${meta.kind.slice(1)}`];
  const Icon = meta.icon;

  return (
    <article
      className={`${styles.libraryCard} ${typeClass}`}
      style={{ '--library-index': index } as CSSProperties}
    >
      <LibraryCover eager={index < 4} meta={meta} stat={stat} />

      <div className={styles.cardOverlay}>
        <div className={styles.cardTopline}>
          <span className={styles.typeBadge}>
            <Icon aria-hidden="true" />
            {meta.label}
          </span>
          <span className={styles.rankBadge} title={`排序第 ${index + 1} 位`}>
            {String(index + 1).padStart(2, '0')}
          </span>
        </div>

        <div className={styles.cardBody}>
          <div className={styles.cardHeading}>
            <h3 title={stat.emby_name}>{stat.emby_name}</h3>
          </div>

          <div className={styles.primaryMetric}>
            <strong>{formatCount(primaryCount)}</strong>
            <span>{meta.unit}</span>
          </div>

          {meta.kind === 'mixed' ? (
            <div className={styles.splitMetrics}>
              <span>
                <Film aria-hidden="true" />
                电影 <strong>{formatCount(stat.movie_count || 0)}</strong>
              </span>
              <span>
                <Tv aria-hidden="true" />
                剧集 <strong>{formatCount(stat.series_count || 0)}</strong>
              </span>
            </div>
          ) : relevantTotal > 0 ? (
            <div className={styles.shareBlock}>
              <div className={styles.shareLabel}>
                <span>占全部{meta.label}</span>
                <strong>{share.toFixed(1)}%</strong>
              </div>
              <div aria-hidden="true" className={styles.shareTrack}>
                <span style={{ width: `${Math.min(100, share)}%` }} />
              </div>
            </div>
          ) : (
            <p className={styles.directCount}>
              {meta.kind === 'boxsets'
                ? '按 Emby 合集条目统计'
                : 'Emby 原始统计'}
            </p>
          )}
        </div>
      </div>
    </article>
  );
};

const StatsSkeleton = () => (
  <div aria-live="polite">
    <span className={styles.srOnly}>正在加载媒体库</span>
    <div className={`${styles.hero} ${styles.heroSkeleton}`} />
    <div className={styles.skeletonHeading} />
    <div className={styles.libraryGrid}>
      {SKELETON_CARDS.map((key) => (
        <div className={styles.cardSkeleton} key={key} />
      ))}
    </div>
  </div>
);

const EmbyStatsPage: React.FC = () => {
  const { data, loading, refresh, error } = useApiRequest(getEmbyStats, {
    formatResult: (res) => res?.data,
  });
  const stats = data as API.EmbyStats | undefined;

  const generatedText = useMemo(() => {
    if (!stats?.generated_at) return '';
    try {
      return new Date(stats.generated_at).toLocaleString('zh-CN', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    } catch {
      return stats.generated_at;
    }
  }, [stats?.generated_at]);

  const librarySummary = useMemo(() => {
    const summary = {
      movies: 0,
      tvshows: 0,
      mixed: 0,
      other: 0,
    };
    for (const library of stats?.libraries || []) {
      const kind = collectionMeta(library.collection_type).kind;
      if (kind === 'movies' || kind === 'tvshows' || kind === 'mixed') {
        summary[kind] += 1;
      } else {
        summary.other += 1;
      }
    }
    return summary;
  }, [stats?.libraries]);

  const totalContent = (stats?.total_movies || 0) + (stats?.total_series || 0);
  const heroLibrary = stats?.libraries?.find(
    (library) => library.image_type && library.image_tag,
  );
  const heroImageSmall = heroLibrary
    ? embyStatsLibraryImageUrl(heroLibrary, 720)
    : '';
  const heroImageLarge = heroLibrary
    ? embyStatsLibraryImageUrl(heroLibrary, 1440)
    : '';

  return (
    <PageContainer
      className={styles.pageContainer}
      header={{
        title: 'Emby 媒体统计',
        extra: [
          <div className={styles.headerMeta} key="stats-actions">
            {generatedText && (
              <span className={styles.generatedTime} title="服务器实时统计时间">
                <Clock3 aria-hidden="true" />
                {generatedText}
              </span>
            )}
            <Button
              className={styles.refreshButton}
              disabled={loading}
              onClick={refresh}
              type="button"
              variant="outline"
            >
              <RefreshCw
                aria-hidden="true"
                className={loading ? styles.refreshing : undefined}
              />
              刷新数据
            </Button>
          </div>,
        ],
      }}
    >
      <div className={styles.page}>
        {error && (
          <Alert
            className={styles.notice}
            description={(error as Error)?.message || '请检查 Emby 服务连通性'}
            title="媒体库数据读取失败"
            showIcon
            type="error"
          />
        )}

        {stats?.partial_errors && stats.partial_errors.length > 0 && (
          <Alert
            className={styles.notice}
            closable
            description={stats.partial_errors.join('；')}
            title={`有 ${stats.partial_errors.length} 个统计请求未完成，其余数据仍可正常查看`}
            showIcon
            type="warning"
          />
        )}

        {loading && !stats ? (
          <StatsSkeleton />
        ) : stats ? (
          <>
            <section className={styles.hero}>
              {heroImageLarge && (
                <img
                  alt=""
                  aria-hidden="true"
                  className={styles.heroBackdrop}
                  decoding="async"
                  key={heroImageLarge}
                  loading="eager"
                  onError={(event) => {
                    event.currentTarget.hidden = true;
                  }}
                  sizes="(max-width: 640px) 100vw, calc(100vw - 320px)"
                  src={heroImageLarge}
                  srcSet={`${heroImageSmall} 720w, ${heroImageLarge} 1440w`}
                />
              )}
              <div aria-hidden="true" className={styles.heroScrim} />
              <Clapperboard aria-hidden="true" className={styles.heroMark} />
              <div className={styles.heroCopy}>
                <p className={styles.eyebrow}>
                  <span aria-hidden="true" />
                  MEDIA OVERVIEW
                </p>
                <h2>
                  <strong>{formatCount(stats.total_libraries || 0)}</strong>
                  <span>个媒体库</span>
                </h2>
                <ul aria-label="媒体库类型构成" className={styles.typeSummary}>
                  {librarySummary.movies > 0 && (
                    <li>
                      <strong>{librarySummary.movies}</strong> 电影库
                    </li>
                  )}
                  {librarySummary.tvshows > 0 && (
                    <li>
                      <strong>{librarySummary.tvshows}</strong> 剧集库
                    </li>
                  )}
                  {librarySummary.mixed > 0 && (
                    <li>
                      <strong>{librarySummary.mixed}</strong> 混合库
                    </li>
                  )}
                  {librarySummary.other > 0 && (
                    <li>
                      <strong>{librarySummary.other}</strong> 其他
                    </li>
                  )}
                </ul>
              </div>

              <dl className={styles.heroMetrics}>
                <div className={styles.totalMetric}>
                  <dt>影视总量</dt>
                  <dd>{formatCount(totalContent)}</dd>
                </div>
                <div>
                  <dt>
                    <Film aria-hidden="true" /> 电影
                  </dt>
                  <dd>{formatCount(stats.total_movies || 0)}</dd>
                </div>
                <div>
                  <dt>
                    <Tv aria-hidden="true" /> 剧集
                  </dt>
                  <dd>{formatCount(stats.total_series || 0)}</dd>
                </div>
              </dl>
            </section>

            <section className={styles.librariesSection}>
              <header className={styles.sectionHeader}>
                <div>
                  <p>LIBRARIES</p>
                  <h2>媒体库</h2>
                  <span>按内容量排序</span>
                </div>
                <strong>{stats.libraries?.length || 0} 个</strong>
              </header>

              {!stats.libraries || stats.libraries.length === 0 ? (
                <div className={styles.emptyState}>
                  <Library aria-hidden="true" />
                  <h3>还没有可展示的媒体库</h3>
                  <p>确认 Emby 已创建媒体库并允许当前 API Key 访问。</p>
                </div>
              ) : (
                <div className={styles.libraryGrid}>
                  {stats.libraries.map((library, index) => (
                    <LibraryCard
                      index={index}
                      key={library.emby_library_id}
                      stat={library}
                      totalMovies={stats.total_movies || 0}
                      totalSeries={stats.total_series || 0}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        ) : (
          <div className={styles.emptyState}>
            <Library aria-hidden="true" />
            <h3>暂时无法读取媒体库</h3>
            <p>刷新页面重试，或检查 Emby 服务配置。</p>
          </div>
        )}
      </div>
    </PageContainer>
  );
};

export default EmbyStatsPage;
