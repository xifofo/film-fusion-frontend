import dayjs, { type Dayjs } from 'dayjs';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Clock3,
  LoaderCircle,
  RotateCcw,
  X,
} from 'lucide-react';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  embyWatchImageUrl,
  getEmbyWatchCalendar,
  getEmbyWatchRecords,
} from '@/services/film-fusion';
import styles from '../index.module.less';

type CalendarTabProps = {
  embyUserId: string;
};

const WEEKDAYS = [
  ['星期一', '一'],
  ['星期二', '二'],
  ['星期三', '三'],
  ['星期四', '四'],
  ['星期五', '五'],
  ['星期六', '六'],
  ['星期日', '日'],
] as const;

const LONG_WEEKDAYS = [
  '星期日',
  '星期一',
  '星期二',
  '星期三',
  '星期四',
  '星期五',
  '星期六',
];
const MONTH_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

function monthCells(month: Dayjs) {
  const firstDay = month.startOf('month');
  const mondayOffset = (firstDay.day() + 6) % 7;
  const gridStart = firstDay.subtract(mondayOffset, 'day');
  const visibleWeeks = Math.ceil(
    (mondayOffset + month.daysInMonth()) / WEEKDAYS.length,
  );
  return Array.from({ length: visibleWeeks * WEEKDAYS.length }, (_, index) =>
    gridStart.add(index, 'day'),
  );
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function episodeCode(record: API.EmbyWatchRecord) {
  const season = String(record.season_number ?? 0).padStart(2, '0');
  const episode = String(record.episode_number ?? 0).padStart(2, '0');
  return `S${season}E${episode}`;
}

const CalendarPoster: React.FC<{ item: API.EmbyWatchCalendarItem }> = ({
  item,
}) => {
  const [failed, setFailed] = useState(false);
  const imageURL = embyWatchImageUrl(item.poster_id, 160);

  useEffect(() => setFailed(false), [imageURL]);

  return (
    <span className={styles.calendarPoster} title={item.title}>
      {!failed && imageURL ? (
        <img
          alt={item.title}
          loading="lazy"
          onError={() => setFailed(true)}
          src={imageURL}
        />
      ) : (
        <Clapperboard aria-hidden="true" />
      )}
      {item.count > 1 && (
        <span className={styles.posterCount}>{item.count}</span>
      )}
    </span>
  );
};

const RecordPoster: React.FC<{ record: API.EmbyWatchRecord }> = ({
  record,
}) => {
  const [failed, setFailed] = useState(false);
  const posterID =
    record.item_type === 'Episode'
      ? record.series_id || record.item_id
      : record.item_id;
  const imageURL = embyWatchImageUrl(posterID, 220);

  useEffect(() => setFailed(false), [imageURL]);

  return (
    <span className={styles.recordPoster}>
      {!failed && imageURL ? (
        <img
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          src={imageURL}
        />
      ) : (
        <Clapperboard aria-hidden="true" />
      )}
    </span>
  );
};

const CalendarTab: React.FC<CalendarTabProps> = ({ embyUserId }) => {
  const [panelMonth, setPanelMonth] = useState(() => dayjs().startOf('month'));
  const [days, setDays] = useState<API.EmbyWatchCalendarDay[]>([]);
  const [monthLoading, setMonthLoading] = useState(false);
  const [monthError, setMonthError] = useState('');
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => dayjs().year());
  const [selectedDate, setSelectedDate] = useState('');
  const [dayRecords, setDayRecords] = useState<API.EmbyWatchRecord[]>([]);
  const [dayLoading, setDayLoading] = useState(false);
  const [dayError, setDayError] = useState('');
  const monthRequestID = useRef(0);
  const dayRequestID = useRef(0);
  const detailPanelRef = useRef<HTMLElement>(null);

  const gridDays = useMemo(() => monthCells(panelMonth), [panelMonth]);
  const dayMap = useMemo(
    () => new Map(days.map((day) => [day.date, day])),
    [days],
  );
  const monthTotals = useMemo(
    () =>
      days.reduce(
        (totals, day) => ({
          movies: totals.movies + day.movie_count,
          episodes: totals.episodes + day.episode_count,
        }),
        { movies: 0, episodes: 0 },
      ),
    [days],
  );
  const selectedDay = selectedDate ? dayMap.get(selectedDate) : undefined;
  const todayKey = dayjs().format('YYYY-MM-DD');

  const loadMonth = useCallback(async () => {
    const requestID = ++monthRequestID.current;
    setMonthLoading(true);
    setMonthError('');
    setDays([]);
    try {
      const response = await getEmbyWatchCalendar(
        {
          emby_user_id: embyUserId,
          year: panelMonth.year(),
          month: panelMonth.month() + 1,
          include_items: true,
        },
        { skipErrorHandler: true },
      );
      if (requestID !== monthRequestID.current) return;
      if (response.code === 0) {
        setDays(response.data || []);
      } else {
        setDays([]);
        setMonthError(response.message || '这个月的记录暂时无法读取');
      }
    } catch (error) {
      if (requestID !== monthRequestID.current) return;
      setDays([]);
      setMonthError(errorMessage(error, '这个月的记录暂时无法读取'));
    } finally {
      if (requestID === monthRequestID.current) {
        setMonthLoading(false);
      }
    }
  }, [embyUserId, panelMonth]);

  useEffect(() => {
    setSelectedDate('');
    setDayRecords([]);
    setDayError('');
    void loadMonth();
    return () => {
      monthRequestID.current += 1;
      dayRequestID.current += 1;
    };
  }, [loadMonth]);

  useEffect(() => {
    if (!monthPickerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMonthPickerOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [monthPickerOpen]);

  const closeDetails = useCallback(() => {
    dayRequestID.current += 1;
    setSelectedDate('');
    setDayRecords([]);
    setDayLoading(false);
    setDayError('');
  }, []);

  useEffect(() => {
    if (!selectedDate) return;

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      const currentPaddingRight =
        Number.parseFloat(
          window.getComputedStyle(document.body).paddingRight,
        ) || 0;
      document.body.style.paddingRight = `${currentPaddingRight + scrollbarWidth}px`;
    }
    document.body.style.overflow = 'hidden';
    const focusFrame = window.requestAnimationFrame(() => {
      detailPanelRef.current?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDetails();
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [closeDetails, selectedDate]);

  const loadDay = useCallback(
    async (date: string) => {
      const requestID = ++dayRequestID.current;
      setSelectedDate(date);
      setDayRecords([]);
      setDayLoading(true);
      setDayError('');
      try {
        const response = await getEmbyWatchRecords(
          {
            emby_user_id: embyUserId,
            start_date: date,
            end_date: date,
            page: 1,
            page_size: 200,
          },
          { skipErrorHandler: true },
        );
        if (requestID !== dayRequestID.current) return;
        if (response.code === 0) {
          setDayRecords(response.data?.list || []);
        } else {
          setDayError(response.message || '当天记录暂时无法读取');
        }
      } catch (error) {
        if (requestID !== dayRequestID.current) return;
        setDayError(errorMessage(error, '当天记录暂时无法读取'));
      } finally {
        if (requestID === dayRequestID.current) {
          setDayLoading(false);
        }
      }
    },
    [embyUserId],
  );

  const changeMonth = (amount: number) => {
    setMonthPickerOpen(false);
    setPanelMonth((current) => current.add(amount, 'month').startOf('month'));
  };

  const openMonthPicker = () => {
    setPickerYear(panelMonth.year());
    setMonthPickerOpen(true);
  };

  const selectPickerMonth = (monthIndex: number) => {
    setPanelMonth(dayjs().year(pickerYear).month(monthIndex).startOf('month'));
    setMonthPickerOpen(false);
  };

  return (
    <div className={styles.calendarWorkspace}>
      <section className={styles.calendarSurface} aria-label="观影日历">
        <header className={styles.calendarHeader}>
          <div className={styles.monthHeading}>
            <p>MY WATCH DIARY</p>
            <div className={styles.monthTitle}>
              <span>{panelMonth.year()} 年</span>
              <strong>{panelMonth.month() + 1} 月</strong>
            </div>
            <p className={styles.monthSummary}>
              <span>{monthTotals.movies} 部电影</span>
              <i />
              <span>{monthTotals.episodes} 集剧集</span>
              <i />
              <span>{days.length} 个观影日</span>
            </p>
          </div>

          <div className={styles.monthControls}>
            <button
              aria-label="上个月"
              onClick={() => changeMonth(-1)}
              type="button"
            >
              <ChevronLeft aria-hidden="true" />
            </button>
            <button
              className={styles.todayButton}
              aria-expanded={monthPickerOpen}
              aria-haspopup="dialog"
              onClick={openMonthPicker}
              type="button"
            >
              {panelMonth.year()} · {panelMonth.month() + 1} 月
            </button>
            <button
              aria-label="下个月"
              onClick={() => changeMonth(1)}
              type="button"
            >
              <ChevronRight aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className={styles.weekdays} aria-hidden="true">
          {WEEKDAYS.map(([longLabel, shortLabel]) => (
            <span key={longLabel}>
              <b>{longLabel}</b>
              <i>{shortLabel}</i>
            </span>
          ))}
        </div>

        <div
          className={styles.calendarGrid}
          key={`${embyUserId}-${panelMonth.format('YYYY-MM')}`}
        >
          {gridDays.map((date) => {
            const dateKey = date.format('YYYY-MM-DD');
            const inCurrentMonth = date.isSame(panelMonth, 'month');
            const day = inCurrentMonth ? dayMap.get(dateKey) : undefined;
            const items = day?.items || [];
            const representedCount = items.reduce(
              (total, item) => total + item.count,
              0,
            );
            const hiddenCount = Math.max(
              0,
              (day?.total || 0) - representedCount,
            );
            const label = day
              ? `${date.month() + 1}月${date.date()}日，${day.total} 条观看记录`
              : `${date.month() + 1}月${date.date()}日，无观看记录`;

            return (
              <button
                className={[
                  styles.calendarDay,
                  !inCurrentMonth ? styles.outsideMonth : '',
                  dateKey === todayKey ? styles.today : '',
                  dateKey === selectedDate ? styles.selectedDay : '',
                  day ? styles.activeDay : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                disabled={!inCurrentMonth}
                key={dateKey}
                onClick={() => void loadDay(dateKey)}
                type="button"
                aria-label={label}
              >
                {inCurrentMonth && (
                  <span className={styles.dayNumber}>{date.date()}</span>
                )}
                {day && (
                  <span className={styles.dayMeta}>
                    {day.movie_count > 0 && `${day.movie_count} 部`}
                    {day.movie_count > 0 && day.episode_count > 0 && ' · '}
                    {day.episode_count > 0 && `${day.episode_count} 集`}
                  </span>
                )}
                {day && (
                  <span className={styles.posterStrip}>
                    {items.length > 0 ? (
                      items.map((item) => (
                        <CalendarPoster
                          item={item}
                          key={`${item.item_type}-${item.poster_id}`}
                        />
                      ))
                    ) : (
                      <span
                        className={`${styles.calendarPoster} ${styles.posterFallback}`}
                      >
                        <Clapperboard aria-hidden="true" />
                      </span>
                    )}
                    {hiddenCount > 0 && (
                      <span className={styles.hiddenCount}>+{hiddenCount}</span>
                    )}
                    {day.total > 1 && (
                      <span className={styles.mobileDayCount}>{day.total}</span>
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {monthLoading && (
          <div className={styles.loadingOverlay} aria-live="polite">
            <LoaderCircle aria-hidden="true" />
            <span>正在翻找这个月的胶片</span>
          </div>
        )}

        {monthError && (
          <div className={styles.monthError} role="alert">
            <span>{monthError}</span>
            <button onClick={() => void loadMonth()} type="button">
              <RotateCcw aria-hidden="true" />
              再试一次
            </button>
          </div>
        )}
      </section>

      {selectedDate && (
        <>
          <button
            className={styles.detailBackdrop}
            aria-label="关闭当天记录"
            onClick={closeDetails}
            type="button"
          />
          <aside
            className={styles.detailPanel}
            aria-label={`${selectedDate} 的观看记录`}
            aria-modal="true"
            ref={detailPanelRef}
            role="dialog"
            tabIndex={-1}
          >
            <header className={styles.detailHeader}>
              <div>
                <p>
                  {LONG_WEEKDAYS[dayjs(selectedDate).day()]}
                  {selectedDay && ` · ${selectedDay.total} 条记录`}
                </p>
                <h2>
                  {dayjs(selectedDate).month() + 1} 月{' '}
                  {dayjs(selectedDate).date()} 日
                </h2>
              </div>
              <button
                aria-label="关闭当天记录"
                onClick={closeDetails}
                type="button"
              >
                <X aria-hidden="true" />
              </button>
            </header>

            <div className={styles.recordList}>
              {dayRecords.map((record) => {
                const isEpisode = record.item_type === 'Episode';
                const recordTitle = isEpisode
                  ? record.series_name || record.title
                  : record.title;
                const secondary = isEpisode
                  ? `${episodeCode(record)}${record.title ? ` · ${record.title}` : ''}`
                  : record.production_year || '';
                return (
                  <article className={styles.recordItem} key={record.id}>
                    <RecordPoster record={record} />
                    <div className={styles.recordCopy}>
                      <p>{isEpisode ? '剧集' : '电影'}</p>
                      <h3>{recordTitle}</h3>
                      {secondary && <span>{secondary}</span>}
                      <small>
                        <Clock3 aria-hidden="true" />
                        {dayjs(record.watched_at).format('HH:mm')}
                        {(record.runtime_minutes || 0) > 0 &&
                          ` · ${record.runtime_minutes} 分钟`}
                      </small>
                    </div>
                  </article>
                );
              })}

              {!dayLoading && !dayError && dayRecords.length === 0 && (
                <div className={styles.detailEmpty}>
                  <CalendarDays aria-hidden="true" />
                  <p>这一天没有留下观影记录</p>
                </div>
              )}

              {dayLoading && (
                <div className={styles.detailLoading} aria-live="polite">
                  <LoaderCircle aria-hidden="true" />
                  <span>正在读取当天片单</span>
                </div>
              )}

              {dayError && (
                <div className={styles.detailError} role="alert">
                  <span>{dayError}</span>
                  <button
                    onClick={() => void loadDay(selectedDate)}
                    type="button"
                  >
                    重试
                  </button>
                </div>
              )}
            </div>
          </aside>
        </>
      )}

      {monthPickerOpen && (
        <>
          <button
            className={styles.monthPickerBackdrop}
            aria-label="关闭年月选择"
            onClick={() => setMonthPickerOpen(false)}
            type="button"
          />
          <section
            className={styles.monthPickerPanel}
            aria-labelledby="emby-watch-month-picker-title"
            aria-modal="true"
            role="dialog"
          >
            <header className={styles.monthPickerHeader}>
              <div>
                <p>选择年月</p>
                <h2 id="emby-watch-month-picker-title">{pickerYear} 年</h2>
              </div>
              <div className={styles.pickerYearControls}>
                <button
                  aria-label="上一年"
                  onClick={() => setPickerYear((current) => current - 1)}
                  type="button"
                >
                  <ChevronLeft aria-hidden="true" />
                </button>
                <button
                  aria-label="下一年"
                  onClick={() => setPickerYear((current) => current + 1)}
                  type="button"
                >
                  <ChevronRight aria-hidden="true" />
                </button>
              </div>
            </header>

            <div className={styles.pickerMonthGrid}>
              {MONTH_OPTIONS.map((monthNumber) => {
                const monthIndex = monthNumber - 1;
                const selected =
                  pickerYear === panelMonth.year() &&
                  monthIndex === panelMonth.month();
                const current =
                  pickerYear === dayjs().year() &&
                  monthIndex === dayjs().month();
                return (
                  <button
                    className={[
                      selected ? styles.pickerMonthSelected : '',
                      current ? styles.pickerMonthCurrent : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    aria-pressed={selected}
                    key={monthNumber}
                    onClick={() => selectPickerMonth(monthIndex)}
                    type="button"
                  >
                    <span>{monthNumber} 月</span>
                    {current && <small>本月</small>}
                  </button>
                );
              })}
            </div>

            <footer className={styles.monthPickerFooter}>
              <span>
                当前显示 {panelMonth.year()} 年 {panelMonth.month() + 1} 月
              </span>
              <button
                onClick={() => {
                  setPanelMonth(dayjs().startOf('month'));
                  setMonthPickerOpen(false);
                }}
                type="button"
              >
                回到本月
              </button>
            </footer>
          </section>
        </>
      )}
    </div>
  );
};

export default CalendarTab;
