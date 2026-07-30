import dayjs from 'dayjs';
import {
  ChartNoAxesColumnIncreasing,
  Clapperboard,
  LoaderCircle,
  RotateCcw,
} from 'lucide-react';
import { useState } from 'react';
import { embyWatchImageUrl } from '@/services/film-fusion';
import styles from './statistics-view.module.less';

type StatisticsViewProps = {
  annualReport?: API.EmbyWatchAnnualReport;
  data?: API.EmbyWatchSummary;
  error: string;
  habitError: string;
  habitLoading: boolean;
  loading: boolean;
  onRetry: () => void;
  userName: string;
};

type MonthlyPoint = {
  month: string;
  total: number;
};

const countFormatter = new Intl.NumberFormat('zh-CN');
const CHART_WIDTH = 320;
const CHART_HEIGHT = 96;
const CHART_PADDING_X = 4;
const CHART_PADDING_Y = 8;
const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

function HeroSeriesBackdrop({ id, title }: { id: string; title: string }) {
  const [source, setSource] = useState<'backdrop' | 'primary' | 'failed'>(
    'backdrop',
  );
  const imageURL =
    source === 'failed'
      ? ''
      : embyWatchImageUrl(
          id,
          source === 'backdrop' ? 1280 : 640,
          source === 'backdrop' ? 'Backdrop' : 'Primary',
        );

  return (
    <span className={styles.seriesPoster}>
      {imageURL ? (
        <img
          alt=""
          loading="eager"
          onError={() =>
            setSource((current) =>
              current === 'backdrop' ? 'primary' : 'failed',
            )
          }
          src={imageURL}
        />
      ) : (
        <Clapperboard aria-hidden="true" />
      )}
      <span className={styles.visuallyHidden}>{title}</span>
    </span>
  );
}

function durationParts(totalMinutes: number) {
  if (totalMinutes < 60) {
    return {
      detail: '累计观影',
      unit: '分钟',
      value: countFormatter.format(totalMinutes),
    };
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return {
    detail: minutes > 0 ? `另 ${minutes} 分钟` : '累计观影',
    unit: '小时',
    value: countFormatter.format(hours),
  };
}

function compactDuration(totalMinutes: number) {
  if (totalMinutes < 60) {
    return `${totalMinutes} 分钟`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours} 小时 ${minutes} 分` : `${hours} 小时`;
}

function hourPeriod(hour: number) {
  if (hour < 6) return '深夜';
  if (hour < 12) return '上午';
  if (hour < 18) return '下午';
  return '晚上';
}

function continuousRecentMonths(source: MonthlyPoint[]): MonthlyPoint[] {
  const totals = new Map(source.map((item) => [item.month, item.total]));
  const end = dayjs().startOf('month');

  return Array.from({ length: 12 }, (_, index) => {
    const month = end.subtract(11 - index, 'month').format('YYYY-MM');
    return { month, total: totals.get(month) || 0 };
  });
}

function chartGeometry(monthly: MonthlyPoint[]) {
  const max = Math.max(1, ...monthly.map((item) => item.total));
  const drawableWidth = CHART_WIDTH - CHART_PADDING_X * 2;
  const drawableHeight = CHART_HEIGHT - CHART_PADDING_Y * 2;
  const points = monthly.map((item, index) => {
    const x =
      CHART_PADDING_X +
      (index / Math.max(1, monthly.length - 1)) * drawableWidth;
    const y =
      CHART_PADDING_Y + drawableHeight - (item.total / max) * drawableHeight;
    return { x, y };
  });
  const line = points
    .map(({ x, y }, index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`)
    .join(' ');
  const area = `${line} L ${CHART_WIDTH - CHART_PADDING_X} ${
    CHART_HEIGHT - CHART_PADDING_Y
  } L ${CHART_PADDING_X} ${CHART_HEIGHT - CHART_PADDING_Y} Z`;

  return { area, line, points };
}

export default function StatisticsView({
  annualReport,
  data,
  error,
  habitError,
  habitLoading,
  loading,
  onRetry,
  userName,
}: StatisticsViewProps) {
  const totalRecords = (data?.movie_count || 0) + (data?.episode_count || 0);
  const duration = durationParts(data?.total_minutes || 0);
  const monthly = continuousRecentMonths(data?.monthly || []);
  const chart = chartGeometry(monthly);
  const peakIndex = monthly.reduce(
    (best, item, index) => (item.total > monthly[best].total ? index : best),
    0,
  );
  const peak = monthly[peakIndex];
  const topSeries = data?.top_series || [];
  const weekdayTotals = Array.from({ length: 7 }, (_, weekday) => ({
    total:
      annualReport?.weekday.find((item) => item.weekday === weekday)?.total ||
      0,
    weekday,
  }));
  const peakWeekdayIndex = weekdayTotals.reduce(
    (best, item, index) =>
      item.total > weekdayTotals[best].total ? index : best,
    0,
  );
  const maxWeekdayTotal = Math.max(
    1,
    ...weekdayTotals.map((item) => item.total),
  );
  const peakHour = (annualReport?.hourly || []).reduce(
    (best, item) => (item.total > best.total ? item : best),
    { hour: 0, total: 0 },
  );
  const years = data?.years || [];
  const firstYear = years.length > 0 ? Math.min(...years) : 0;
  const lastYear = years.length > 0 ? Math.max(...years) : 0;
  const periodLabel =
    firstYear && lastYear
      ? firstYear === lastYear
        ? `${firstYear}`
        : `${firstYear}—${lastYear}`
      : '全部历史';

  return (
    <section className={styles.surface} aria-label="全部观影统计">
      <header className={styles.header}>
        <h1>观影统计</h1>
        <p>
          <span>{userName}</span>
          <i />
          <span>{periodLabel}</span>
          <i />
          <span>共 {countFormatter.format(totalRecords)} 条</span>
        </p>
      </header>

      {loading && (
        <div className={styles.loading} aria-live="polite">
          <LoaderCircle aria-hidden="true" />
          <span>正在整理全部观影记录</span>
        </div>
      )}

      {!loading && error && (
        <div className={styles.error} role="alert">
          <span>{error}</span>
          <button onClick={onRetry} type="button">
            <RotateCcw aria-hidden="true" />
            重新统计
          </button>
        </div>
      )}

      {!loading && !error && (!data || totalRecords === 0) && (
        <div className={styles.empty}>
          <ChartNoAxesColumnIncreasing aria-hidden="true" />
          <h2>还没有可以统计的记录</h2>
          <p>完成历史回填后，这里会汇总你的全部观影数据。</p>
        </div>
      )}

      {!loading && !error && data && totalRecords > 0 && (
        <div className={styles.body}>
          <div className={styles.storyGrid}>
            <section className={styles.summaryStage} aria-label="观影统计摘要">
              {topSeries[0] && (
                <div className={styles.heroBackdrop} aria-hidden="true">
                  <HeroSeriesBackdrop
                    id={topSeries[0].series_id}
                    title={topSeries[0].series_name}
                  />
                  <span>
                    <b>NO.1</b>
                    {topSeries[0].series_name || '未命名剧集'}
                  </span>
                </div>
              )}

              <div className={styles.summaryCopy}>
                <span>累计观看</span>
                <p className={styles.duration}>
                  <strong>{duration.value}</strong>
                  <b>{duration.unit}</b>
                </p>
                <small>{duration.detail}</small>
                <div className={styles.facts}>
                  <p>
                    <strong>{countFormatter.format(data.movie_count)}</strong>{' '}
                    次电影
                    <i />
                    <strong>{countFormatter.format(data.episode_count)}</strong>{' '}
                    集剧集
                  </p>
                  <p>
                    <strong>{countFormatter.format(data.series_count)}</strong>{' '}
                    部剧目
                    <i />
                    <strong>{countFormatter.format(data.active_days)}</strong>{' '}
                    个观影日
                  </p>
                </div>
              </div>
            </section>

            <section className={styles.trend}>
              <header>
                <h2>最近 12 个月</h2>
                <p>
                  高峰 {dayjs(`${peak.month}-01`).format('M 月')}
                  <span> · </span>
                  {countFormatter.format(peak.total)} 条
                </p>
              </header>

              <figure
                className={styles.chart}
                aria-label={`最近十二个月观看趋势，最高为 ${peak.month} 的 ${peak.total} 条`}
              >
                <svg
                  aria-hidden="true"
                  preserveAspectRatio="none"
                  viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                >
                  <defs>
                    <linearGradient
                      id="watchTrendFill"
                      x1="0"
                      x2="0"
                      y1="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="currentColor"
                        stopOpacity="0.2"
                      />
                      <stop
                        offset="100%"
                        stopColor="currentColor"
                        stopOpacity="0"
                      />
                    </linearGradient>
                  </defs>
                  <path className={styles.chartArea} d={chart.area} />
                  <path className={styles.chartLine} d={chart.line} />
                  <circle
                    className={styles.chartPeak}
                    cx={chart.points[peakIndex].x}
                    cy={chart.points[peakIndex].y}
                    r="3.5"
                  />
                </svg>
                <figcaption>
                  <span>{dayjs(`${monthly[0].month}-01`).format('YY.MM')}</span>
                  <span>
                    {dayjs(`${monthly[monthly.length - 1].month}-01`).format(
                      'YY.MM',
                    )}
                  </span>
                </figcaption>
              </figure>
            </section>
          </div>

          <section className={styles.habits}>
            <header>
              <h2>观影习惯</h2>
              {annualReport && <span>{annualReport.year} 年</span>}
            </header>

            {habitLoading && (
              <div className={styles.habitLoading} aria-live="polite">
                <LoaderCircle aria-hidden="true" />
                正在整理你的观影节奏
              </div>
            )}

            {!habitLoading && habitError && (
              <p className={styles.sectionEmpty}>{habitError}</p>
            )}

            {!habitLoading && !habitError && annualReport && (
              <div className={styles.habitBody}>
                <div className={styles.habitRhythm}>
                  <div className={styles.habitLead}>
                    <span>你的黄金场次</span>
                    <p>
                      <strong>星期{WEEKDAY_LABELS[peakWeekdayIndex]}</strong>
                      <i />
                      <b>{String(peakHour.hour).padStart(2, '0')}:00</b>
                    </p>
                    <small>{hourPeriod(peakHour.hour)}更容易遇见好故事</small>
                  </div>

                  <div
                    className={styles.weekdayChart}
                    aria-label={`星期${WEEKDAY_LABELS[peakWeekdayIndex]}是最常观影的日子`}
                    role="img"
                  >
                    {weekdayTotals.map((item, index) => (
                      <div
                        className={
                          index === peakWeekdayIndex
                            ? styles.weekdayPeak
                            : undefined
                        }
                        key={item.weekday}
                      >
                        <i>
                          <b
                            style={{
                              height: `${Math.max(
                                7,
                                (item.total / maxWeekdayTotal) * 100,
                              )}%`,
                            }}
                          />
                        </i>
                        <span>{WEEKDAY_LABELS[item.weekday]}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={styles.habitFacts}>
                  <p>
                    <span>最长连续</span>
                    <strong>{annualReport.longest_streak} 天</strong>
                  </p>
                  <p>
                    <span>最忙的一天</span>
                    <strong>
                      {annualReport.busiest_day.date
                        ? dayjs(annualReport.busiest_day.date).format('M月D日')
                        : '—'}
                    </strong>
                  </p>
                  <p>
                    <span>活跃日均</span>
                    <strong>
                      {compactDuration(annualReport.avg_minutes_per_day)}
                    </strong>
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
