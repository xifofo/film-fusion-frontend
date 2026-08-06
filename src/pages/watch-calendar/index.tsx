import { useQuery } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import LiquidGlass from 'liquid-glass-react';
import {
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Clock3,
  House,
  LoaderCircle,
  Menu as MenuIcon,
  RotateCcw,
  Settings2,
  UserRound,
  X,
} from 'lucide-react';
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { OpticalLogo } from '@/components/OpticalLogo';
import { useAppState } from '@/contexts/app-state';
import {
  embyWatchImageUrl,
  getEmbyWatchAnnualReport,
  getEmbyWatchCalendar,
  getEmbyWatchRecords,
  getEmbyWatchSummary,
  getEmbyWatchUsers,
  getPublicAppConfig,
} from '@/services/film-fusion';
import styles from './index.module.less';
import StatisticsView from './statistics-view';

const ACTIVE_USER_STORAGE_KEY = 'film-fusion-watch-calendar-user';
const DETAIL_PAGE_SIZE = 48;
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
const RESTING_GLASS_POINTER = {
  globalMousePos: { x: 0, y: 0 },
  mouseOffset: { x: 0, y: 0 },
};

function glassPointerFromEvent(event: ReactPointerEvent<HTMLElement>) {
  const bounds = event.currentTarget.getBoundingClientRect();
  return {
    globalMousePos: { x: event.clientX, y: event.clientY },
    mouseOffset: {
      x: ((event.clientX - bounds.left) / bounds.width - 0.5) * 100,
      y: ((event.clientY - bounds.top) / bounds.height - 0.5) * 100,
    },
  };
}

const DEFAULT_SITE: API.PublicAppConfig = {
  login_title: 'Film Fusion',
  login_subtitle: 'Film Fusion 是简单的 Emby + 网盘的辅助工具',
  login_background_interval: 12,
  login_backgrounds: [],
};

const DARK_BACKGROUND = [
  'radial-gradient(circle at 14% 16%, color-mix(in srgb, var(--watch-accent) 13%, transparent), transparent 29%)',
  'radial-gradient(circle at 84% 18%, rgba(115, 139, 165, 0.12), transparent 34%)',
  'radial-gradient(circle at 62% 88%, rgba(255, 255, 255, 0.055), transparent 32%)',
  'linear-gradient(145deg, #050609 0%, #10141a 50%, #06070a 100%)',
].join(', ');

type WatchThemeStyle = CSSProperties & {
  '--watch-accent': string;
  '--watch-accent-foreground': string;
};

function readableAccentForeground(color: string) {
  const normalized = color.trim().replace(/^#/, '');
  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map((character) => character.repeat(2))
          .join('')
      : normalized;
  if (!/^[\da-f]{6}$/i.test(expanded)) {
    return '#ffffff';
  }
  const channels = [0, 2, 4].map((offset) =>
    Number.parseInt(expanded.slice(offset, offset + 2), 16),
  );
  const luminance =
    (channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722) / 255;
  return luminance > 0.62 ? '#11151b' : '#ffffff';
}

function buildBackgroundImage(backgroundURL?: string) {
  const normalizedURL = backgroundURL?.trim();
  if (!normalizedURL) {
    return DARK_BACKGROUND;
  }
  return [
    'linear-gradient(115deg, rgba(2, 3, 5, 0.9), rgba(4, 6, 9, 0.5) 52%, rgba(2, 3, 5, 0.88))',
    `url(${JSON.stringify(normalizedURL)})`,
    DARK_BACKGROUND,
  ].join(', ');
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

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

function episodeCode(record: API.EmbyWatchRecord) {
  const season = String(record.season_number ?? 0).padStart(2, '0');
  const episode = String(record.episode_number ?? 0).padStart(2, '0');
  return `S${season}E${episode}`;
}

function CalendarPoster({ item }: { item: API.EmbyWatchCalendarItem }) {
  const [failed, setFailed] = useState(false);
  const imageURL = embyWatchImageUrl(item.poster_id, 160);

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
        <span className={styles.posterCount} aria-hidden="true">
          {item.count}
        </span>
      )}
    </span>
  );
}

function RecordPoster({ record }: { record: API.EmbyWatchRecord }) {
  const [failed, setFailed] = useState(false);
  const posterID =
    record.item_type === 'Episode'
      ? record.series_id || record.item_id
      : record.item_id;
  const imageURL = embyWatchImageUrl(posterID, 220);

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
}

export default function WatchCalendarPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeView =
    searchParams.get('view') === 'stats' ? 'stats' : 'calendar';
  const { settings } = useAppState();
  const accentColor =
    typeof settings.colorPrimary === 'string' && settings.colorPrimary.trim()
      ? settings.colorPrimary.trim()
      : '#1890ff';
  const watchThemeStyle = useMemo<WatchThemeStyle>(
    () => ({
      '--watch-accent': accentColor,
      '--watch-accent-foreground': readableAccentForeground(accentColor),
    }),
    [accentColor],
  );
  const [site, setSite] = useState<API.PublicAppConfig>(DEFAULT_SITE);
  const [backgroundIndex, setBackgroundIndex] = useState(0);
  const [users, setUsers] = useState<API.EmbyWatchUserView[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState('');
  const [activeUser, setActiveUser] = useState('');
  const [panelMonth, setPanelMonth] = useState(() => dayjs().startOf('month'));
  const [days, setDays] = useState<API.EmbyWatchCalendarDay[]>([]);
  const [monthLoading, setMonthLoading] = useState(false);
  const [monthError, setMonthError] = useState('');
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => dayjs().year());
  const [selectedDate, setSelectedDate] = useState('');
  const [dayRecords, setDayRecords] = useState<API.EmbyWatchRecord[]>([]);
  const [dayRecordsTotal, setDayRecordsTotal] = useState(0);
  const [dayPage, setDayPage] = useState(1);
  const [dayLoading, setDayLoading] = useState(false);
  const [dayError, setDayError] = useState('');
  const [reducedMotion, setReducedMotion] = useState(false);
  const [topbarPointer, setTopbarPointer] = useState(RESTING_GLASS_POINTER);
  const [menuPointer, setMenuPointer] = useState(RESTING_GLASS_POINTER);
  const [appBarPointer, setAppBarPointer] = useState(RESTING_GLASS_POINTER);
  const dayRequestID = useRef(0);
  const monthPickerRef = useRef<HTMLElement>(null);
  const touchStartX = useRef<number | undefined>(undefined);

  const trackedUsers = useMemo(
    () => users.filter((user) => user.tracked),
    [users],
  );
  const selectedUser = useMemo(
    () =>
      trackedUsers.find((user) => user.emby_user_id === activeUser) ||
      trackedUsers[0],
    [activeUser, trackedUsers],
  );
  const backgroundURLs = useMemo(() => {
    const configured = (site.login_backgrounds || [])
      .map((url) => url.trim())
      .filter(Boolean);
    if (configured.length > 0) {
      return [...new Set(configured)];
    }
    const fallback = site.login_background_url?.trim();
    return fallback ? [fallback] : [];
  }, [site.login_background_url, site.login_backgrounds]);
  const backgroundSlides = backgroundURLs.length > 0 ? backgroundURLs : [''];
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
  const summaryQuery = useQuery({
    enabled: activeView === 'stats' && Boolean(activeUser),
    queryFn: async ({ signal }) => {
      const response = await getEmbyWatchSummary(
        { emby_user_id: activeUser },
        { signal, skipErrorHandler: true },
      );
      if (response.code !== 0 || !response.data) {
        throw new Error(response.message || '全部观影统计暂时无法读取');
      }
      return response.data;
    },
    queryKey: ['watch-calendar-summary', activeUser],
    staleTime: 60_000,
  });
  const habitYear =
    summaryQuery.data?.years && summaryQuery.data.years.length > 0
      ? Math.max(...summaryQuery.data.years)
      : dayjs().year();
  const annualReportQuery = useQuery({
    enabled:
      activeView === 'stats' &&
      Boolean(activeUser) &&
      Boolean(summaryQuery.data),
    queryFn: async ({ signal }) => {
      const response = await getEmbyWatchAnnualReport(
        { emby_user_id: activeUser, year: habitYear },
        { signal, skipErrorHandler: true },
      );
      if (response.code !== 0 || !response.data) {
        throw new Error(response.message || '观影习惯暂时无法读取');
      }
      return response.data;
    },
    queryKey: ['watch-calendar-annual-report', activeUser, habitYear],
    staleTime: 60_000,
  });

  useEffect(() => {
    let active = true;
    getPublicAppConfig({ skipErrorHandler: true })
      .then((response) => {
        if (active && response.code === 0 && response.data) {
          setSite({ ...DEFAULT_SITE, ...response.data });
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const viewTitle = activeView === 'stats' ? '观影统计' : '观影日历';
    document.title = `${viewTitle} · ${site.login_title || 'Film Fusion'}`;
    const themeColor = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]',
    );
    const previousThemeColor = themeColor?.content;
    themeColor?.setAttribute('content', '#07090d');
    return () => {
      if (themeColor && previousThemeColor) {
        themeColor.setAttribute('content', previousThemeColor);
      }
    };
  }, [activeView, site.login_title]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setReducedMotion(media.matches);
    updatePreference();
    media.addEventListener('change', updatePreference);
    return () => media.removeEventListener('change', updatePreference);
  }, []);

  useEffect(() => {
    setBackgroundIndex(0);
    backgroundURLs.forEach((url) => {
      const image = new Image();
      image.decoding = 'async';
      image.src = url;
    });
  }, [backgroundURLs]);

  useEffect(() => {
    if (backgroundSlides.length < 2) {
      return;
    }
    const intervalSeconds = Math.min(
      300,
      Math.max(5, site.login_background_interval || 12),
    );
    const timer = window.setInterval(() => {
      if (!document.hidden) {
        setBackgroundIndex(
          (current) => (current + 1) % backgroundSlides.length,
        );
      }
    }, intervalSeconds * 1000);
    return () => window.clearInterval(timer);
  }, [backgroundSlides.length, site.login_background_interval]);

  useEffect(() => {
    let active = true;
    setUsersLoading(true);
    setUsersError('');
    getEmbyWatchUsers({ skipErrorHandler: true })
      .then((response) => {
        if (!active) {
          return;
        }
        if (response.code !== 0) {
          setUsersError(response.message || '无法读取观影用户');
          return;
        }
        const nextUsers = response.data || [];
        const nextTrackedUsers = nextUsers.filter((user) => user.tracked);
        setUsers(nextUsers);
        const storedUser = localStorage.getItem(ACTIVE_USER_STORAGE_KEY) || '';
        setActiveUser((current) => {
          const preferred = current || storedUser;
          return nextTrackedUsers.some(
            (user) => user.emby_user_id === preferred,
          )
            ? preferred
            : nextTrackedUsers[0]?.emby_user_id || '';
        });
      })
      .catch((error) => {
        if (active) {
          setUsersError(errorMessage(error, '无法读取观影用户'));
        }
      })
      .finally(() => {
        if (active) {
          setUsersLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (activeUser) {
      localStorage.setItem(ACTIVE_USER_STORAGE_KEY, activeUser);
    }
  }, [activeUser]);

  useEffect(() => {
    if (!activeUser) {
      setDays([]);
      return;
    }

    let active = true;
    setMonthLoading(true);
    setMonthError('');
    setDays([]);
    getEmbyWatchCalendar(
      {
        emby_user_id: activeUser,
        year: panelMonth.year(),
        month: panelMonth.month() + 1,
        include_items: true,
      },
      { skipErrorHandler: true },
    )
      .then((response) => {
        if (!active) {
          return;
        }
        if (response.code === 0) {
          setDays(response.data || []);
        } else {
          setMonthError(response.message || '这个月的记录暂时无法读取');
        }
      })
      .catch((error) => {
        if (active) {
          setMonthError(
            errorMessage(error, '这个月的记录暂时无法读取，请稍后重试'),
          );
        }
      })
      .finally(() => {
        if (active) {
          setMonthLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [activeUser, panelMonth]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMonthPickerOpen(false);
        setMobileMenuOpen(false);
        dayRequestID.current += 1;
        setSelectedDate('');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!monthPickerOpen) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusFrame = window.requestAnimationFrame(() => {
      monthPickerRef.current?.focus();
    });
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
    };
  }, [monthPickerOpen]);

  const closeDetails = () => {
    dayRequestID.current += 1;
    setSelectedDate('');
    setDayRecords([]);
    setDayRecordsTotal(0);
    setDayError('');
  };

  const setMainView = (view: 'calendar' | 'stats') => {
    const nextSearchParams = new URLSearchParams(searchParams);
    if (view === 'stats') {
      nextSearchParams.set('view', 'stats');
    } else {
      nextSearchParams.delete('view');
    }
    setSearchParams(nextSearchParams, { replace: true });
    setMonthPickerOpen(false);
    setMobileMenuOpen(false);
    closeDetails();
    window.scrollTo({
      top: 0,
      behavior: reducedMotion ? 'auto' : 'smooth',
    });
  };

  const changeMonth = (amount: number) => {
    setMonthPickerOpen(false);
    setMobileMenuOpen(false);
    closeDetails();
    setPanelMonth((current) => current.add(amount, 'month').startOf('month'));
  };

  const showToday = () => {
    setMonthPickerOpen(false);
    setMobileMenuOpen(false);
    closeDetails();
    setPanelMonth(dayjs().startOf('month'));
  };

  const openMonthPicker = () => {
    setMobileMenuOpen(false);
    closeDetails();
    setPickerYear(panelMonth.year());
    setMonthPickerOpen(true);
  };

  const selectPickerMonth = (month: number) => {
    setMobileMenuOpen(false);
    closeDetails();
    setPanelMonth(dayjs().year(pickerYear).month(month).startOf('month'));
    setMonthPickerOpen(false);
  };

  const loadDay = async (
    date: string,
    page = 1,
    append = false,
  ): Promise<void> => {
    if (!activeUser) {
      return;
    }
    const requestID = ++dayRequestID.current;
    if (!append) {
      setSelectedDate(date);
      setDayRecords([]);
      setDayRecordsTotal(0);
      setDayPage(1);
    }
    setDayLoading(true);
    setDayError('');

    try {
      const response = await getEmbyWatchRecords(
        {
          emby_user_id: activeUser,
          start_date: date,
          end_date: date,
          page,
          page_size: DETAIL_PAGE_SIZE,
        },
        { skipErrorHandler: true },
      );
      if (requestID !== dayRequestID.current) {
        return;
      }
      if (response.code !== 0) {
        setDayError(response.message || '当天记录暂时无法读取');
        return;
      }
      const nextRecords = response.data?.list || [];
      setDayRecords((current) =>
        append ? [...current, ...nextRecords] : nextRecords,
      );
      setDayRecordsTotal(response.data?.total || nextRecords.length);
      setDayPage(page);
    } catch (error) {
      if (requestID === dayRequestID.current) {
        setDayError(errorMessage(error, '当天记录暂时无法读取'));
      }
    } finally {
      if (requestID === dayRequestID.current) {
        setDayLoading(false);
      }
    }
  };

  const handleTouchStart = (event: TouchEvent) => {
    touchStartX.current = event.changedTouches[0]?.clientX;
  };

  const handleTouchEnd = (event: TouchEvent) => {
    const startX = touchStartX.current;
    const endX = event.changedTouches[0]?.clientX;
    touchStartX.current = undefined;
    if (startX === undefined || endX === undefined) {
      return;
    }
    const distance = endX - startX;
    if (Math.abs(distance) < 64) {
      return;
    }
    changeMonth(distance > 0 ? -1 : 1);
  };

  const updateAppBarPointer = (event: ReactPointerEvent<HTMLElement>) => {
    if (reducedMotion) {
      return;
    }
    setAppBarPointer(glassPointerFromEvent(event));
  };

  const releaseAppBarPointer = () => {
    setAppBarPointer(RESTING_GLASS_POINTER);
  };

  const updateTopbarPointer = (event: ReactPointerEvent<HTMLElement>) => {
    if (reducedMotion) {
      return;
    }
    setTopbarPointer(glassPointerFromEvent(event));
  };

  const releaseTopbarPointer = () => {
    setTopbarPointer(RESTING_GLASS_POINTER);
  };

  const updateMenuPointer = (event: ReactPointerEvent<HTMLElement>) => {
    if (reducedMotion) {
      return;
    }
    setMenuPointer(glassPointerFromEvent(event));
  };

  const releaseMenuPointer = () => {
    setMenuPointer(RESTING_GLASS_POINTER);
  };

  const toggleMobileMenu = () => {
    setMonthPickerOpen(false);
    closeDetails();
    setMobileMenuOpen((open) => !open);
  };

  return (
    <main className={styles.page} style={watchThemeStyle}>
      <div className={styles.background} aria-hidden="true">
        {backgroundSlides.map((backgroundURL, index) => (
          <div
            className={`${styles.backgroundSlide} ${
              index === backgroundIndex ? styles.backgroundSlideActive : ''
            }`}
            key={backgroundURL || 'built-in'}
            style={{ backgroundImage: buildBackgroundImage(backgroundURL) }}
          />
        ))}
        <div className={styles.backgroundVeil} />
      </div>

      <div className={styles.pageContent}>
        <header className={styles.mobileTopbar}>
          <button
            className={styles.mobileLogoButton}
            aria-label="返回 Film Fusion 控制台"
            onClick={() => navigate('/')}
            type="button"
          >
            <OpticalLogo />
          </button>

          <div
            className={styles.mobileMenuLiquid}
            onPointerCancel={releaseMenuPointer}
            onPointerDown={updateMenuPointer}
            onPointerLeave={releaseMenuPointer}
            onPointerMove={updateMenuPointer}
            onPointerUp={releaseMenuPointer}
          >
            <LiquidGlass
              aberrationIntensity={reducedMotion ? 0 : 2}
              blurAmount={0.1}
              className={styles.mobileMenuGlass}
              cornerRadius={16}
              displacementScale={reducedMotion ? 0 : 64}
              elasticity={reducedMotion ? 0 : 0.35}
              globalMousePos={menuPointer.globalMousePos}
              mode="standard"
              mouseOffset={menuPointer.mouseOffset}
              padding="0px"
              saturation={130}
              style={{ width: '100%', height: '100%' }}
            >
              <div className={styles.mobileMenuButtonContent}>
                <button
                  className={styles.mobileMenuTrigger}
                  aria-controls="watch-mobile-menu"
                  aria-expanded={mobileMenuOpen}
                  aria-label={mobileMenuOpen ? '关闭菜单' : '打开菜单'}
                  aria-haspopup="dialog"
                  onClick={toggleMobileMenu}
                  type="button"
                >
                  {mobileMenuOpen ? (
                    <X aria-hidden="true" />
                  ) : (
                    <MenuIcon aria-hidden="true" />
                  )}
                </button>
              </div>
            </LiquidGlass>
          </div>
        </header>

        <header className={styles.topbar}>
          <div
            className={styles.desktopTopbarLiquid}
            onPointerCancel={releaseTopbarPointer}
            onPointerDown={updateTopbarPointer}
            onPointerLeave={releaseTopbarPointer}
            onPointerMove={updateTopbarPointer}
            onPointerUp={releaseTopbarPointer}
          >
            <LiquidGlass
              aberrationIntensity={reducedMotion ? 0 : 1.5}
              blurAmount={0.12}
              className={styles.desktopTopbarGlass}
              cornerRadius={25}
              displacementScale={reducedMotion ? 0 : 56}
              elasticity={reducedMotion ? 0 : 0.18}
              globalMousePos={topbarPointer.globalMousePos}
              mode="standard"
              mouseOffset={topbarPointer.mouseOffset}
              padding="0px"
              saturation={140}
              style={{ width: '100%', height: '100%' }}
            >
              <div className={styles.topbarContent}>
                <button
                  className={styles.brand}
                  aria-label="返回 Film Fusion 控制台"
                  onClick={() => navigate('/')}
                  type="button"
                >
                  <OpticalLogo />
                  <span>
                    <strong>{site.login_title || 'Film Fusion'}</strong>
                    <small>
                      {activeView === 'stats' ? '观影统计' : '观影日历'}
                    </small>
                  </span>
                </button>

                <div className={styles.topbarActions}>
                  <div
                    className={styles.desktopViewSwitch}
                    aria-label="切换观影视图"
                    role="toolbar"
                  >
                    <button
                      className={
                        activeView === 'calendar'
                          ? styles.desktopViewSwitchActive
                          : ''
                      }
                      aria-pressed={activeView === 'calendar'}
                      onClick={() => setMainView('calendar')}
                      type="button"
                    >
                      <CalendarDays aria-hidden="true" />
                      <span>日历</span>
                    </button>
                    <button
                      className={
                        activeView === 'stats'
                          ? styles.desktopViewSwitchActive
                          : ''
                      }
                      aria-pressed={activeView === 'stats'}
                      onClick={() => setMainView('stats')}
                      type="button"
                    >
                      <ChartNoAxesColumnIncreasing aria-hidden="true" />
                      <span>统计</span>
                    </button>
                  </div>

                  {selectedUser && (
                    <div className={styles.userPicker}>
                      <UserRound aria-hidden="true" />
                      {trackedUsers.length > 1 ? (
                        <>
                          <select
                            aria-label="切换观影用户"
                            onChange={(event) => {
                              closeDetails();
                              setActiveUser(event.target.value);
                            }}
                            value={activeUser}
                          >
                            {trackedUsers.map((user) => (
                              <option
                                key={user.emby_user_id}
                                value={user.emby_user_id}
                              >
                                {user.emby_user_name || user.emby_user_id}
                              </option>
                            ))}
                          </select>
                          <ChevronDown aria-hidden="true" />
                        </>
                      ) : (
                        <span>
                          {selectedUser.emby_user_name ||
                            selectedUser.emby_user_id}
                        </span>
                      )}
                    </div>
                  )}
                  <button
                    className={styles.manageButton}
                    aria-label="管理记录"
                    onClick={() => navigate('/emby-watch')}
                    type="button"
                  >
                    <Settings2 aria-hidden="true" />
                    <span>管理记录</span>
                  </button>
                </div>
              </div>
            </LiquidGlass>
          </div>
        </header>

        <div
          className={`${styles.workspace} ${
            activeView === 'calendar' && selectedDate
              ? styles.workspaceWithDetails
              : ''
          }`}
        >
          {activeView === 'calendar' ? (
            <>
              <section
                className={styles.calendarSurface}
                aria-label="观影日历"
                onTouchEnd={handleTouchEnd}
                onTouchStart={handleTouchStart}
              >
                <div className={styles.calendarHeader}>
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
                      aria-label={`选择年月，当前为 ${panelMonth.year()} 年 ${panelMonth.month() + 1} 月`}
                      onClick={openMonthPicker}
                      type="button"
                    >
                      {panelMonth.isSame(dayjs(), 'month')
                        ? '本月'
                        : `${panelMonth.month() + 1} 月`}
                    </button>
                    <button
                      aria-label="下个月"
                      onClick={() => changeMonth(1)}
                      type="button"
                    >
                      <ChevronRight aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {usersError && (
                  <div className={styles.inlineError}>
                    <span>{usersError}</span>
                    <button
                      onClick={() => window.location.reload()}
                      type="button"
                    >
                      <RotateCcw aria-hidden="true" />
                      重试
                    </button>
                  </div>
                )}

                {!usersLoading && !usersError && trackedUsers.length === 0 ? (
                  <div className={styles.emptyState}>
                    <CalendarDays aria-hidden="true" />
                    <h1>还没有可展示的观影记录</h1>
                    <p>先在观看记录设置中选择要统计的 Emby 用户并回填历史。</p>
                    <button
                      onClick={() => navigate('/emby-watch')}
                      type="button"
                    >
                      前往统计设置
                      <ChevronRight aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <>
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
                      key={`${activeUser}-${panelMonth.format('YYYY-MM')}`}
                    >
                      {gridDays.map((date) => {
                        const key = date.format('YYYY-MM-DD');
                        const inCurrentMonth = date.isSame(panelMonth, 'month');
                        const day = inCurrentMonth
                          ? dayMap.get(key)
                          : undefined;
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
                              key === todayKey ? styles.today : '',
                              key === selectedDate ? styles.selectedDay : '',
                              day ? styles.activeDay : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                            disabled={!inCurrentMonth}
                            key={key}
                            onClick={() => void loadDay(key)}
                            type="button"
                            aria-label={label}
                          >
                            {inCurrentMonth && (
                              <span className={styles.dayNumber}>
                                {date.date()}
                              </span>
                            )}
                            {day && (
                              <span className={styles.dayMeta}>
                                {day.movie_count > 0 && `${day.movie_count} 部`}
                                {day.movie_count > 0 &&
                                  day.episode_count > 0 &&
                                  ' · '}
                                {day.episode_count > 0 &&
                                  `${day.episode_count} 集`}
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
                                  <span className={styles.hiddenCount}>
                                    +{hiddenCount}
                                  </span>
                                )}
                                {day.total > 1 && (
                                  <span className={styles.mobileDayCount}>
                                    {day.total}
                                  </span>
                                )}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {(monthLoading || usersLoading) && (
                      <div className={styles.loadingOverlay} aria-live="polite">
                        <LoaderCircle aria-hidden="true" />
                        <span>正在翻找这个月的胶片</span>
                      </div>
                    )}

                    {monthError && (
                      <div className={styles.monthError} role="alert">
                        <span>{monthError}</span>
                        <button
                          onClick={() =>
                            setPanelMonth((current) => current.clone())
                          }
                          type="button"
                        >
                          <RotateCcw aria-hidden="true" />
                          再试一次
                        </button>
                      </div>
                    )}
                  </>
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
                  >
                    <div className={styles.detailHandle} aria-hidden="true" />
                    <div className={styles.detailHeader}>
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
                    </div>

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
                          <article
                            className={styles.recordItem}
                            key={record.id}
                          >
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
                          <Clapperboard aria-hidden="true" />
                          <p>这一天没有留下观影记录</p>
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

                      {dayLoading && (
                        <div
                          className={styles.detailLoading}
                          aria-live="polite"
                        >
                          <LoaderCircle aria-hidden="true" />
                          <span>正在读取当天片单</span>
                        </div>
                      )}

                      {!dayLoading &&
                        dayRecords.length > 0 &&
                        dayRecords.length < dayRecordsTotal && (
                          <button
                            className={styles.loadMore}
                            onClick={() =>
                              void loadDay(selectedDate, dayPage + 1, true)
                            }
                            type="button"
                          >
                            再加载{' '}
                            {Math.min(
                              DETAIL_PAGE_SIZE,
                              dayRecordsTotal - dayRecords.length,
                            )}{' '}
                            条
                            <span>
                              {dayRecords.length} / {dayRecordsTotal}
                            </span>
                          </button>
                        )}
                    </div>
                  </aside>
                </>
              )}
            </>
          ) : (
            <StatisticsView
              annualReport={annualReportQuery.data}
              data={summaryQuery.data}
              error={
                usersError ||
                (summaryQuery.error
                  ? errorMessage(summaryQuery.error, '全部观影统计暂时无法读取')
                  : '')
              }
              habitError={
                annualReportQuery.error
                  ? errorMessage(
                      annualReportQuery.error,
                      '观影习惯暂时无法读取',
                    )
                  : ''
              }
              habitLoading={annualReportQuery.isLoading}
              loading={usersLoading || summaryQuery.isLoading}
              onRetry={() => {
                void summaryQuery.refetch();
                void annualReportQuery.refetch();
              }}
              userName={
                selectedUser?.emby_user_name ||
                selectedUser?.emby_user_id ||
                '当前用户'
              }
            />
          )}
        </div>
      </div>

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
            aria-labelledby="month-picker-title"
            aria-modal="true"
            ref={monthPickerRef}
            role="dialog"
            tabIndex={-1}
          >
            <div className={styles.monthPickerHandle} aria-hidden="true" />
            <header className={styles.monthPickerHeader}>
              <div>
                <p>选择年月</p>
                <h2 id="month-picker-title">{pickerYear} 年</h2>
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
                const month = monthNumber - 1;
                const selected =
                  pickerYear === panelMonth.year() &&
                  month === panelMonth.month();
                const current =
                  pickerYear === dayjs().year() && month === dayjs().month();
                return (
                  <button
                    className={[
                      selected ? styles.pickerMonthSelected : '',
                      current ? styles.pickerMonthCurrent : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    aria-pressed={selected}
                    key={`month-${monthNumber}`}
                    onClick={() => selectPickerMonth(month)}
                    type="button"
                  >
                    <span>{month + 1} 月</span>
                    {current && <small>本月</small>}
                  </button>
                );
              })}
            </div>

            <footer className={styles.monthPickerFooter}>
              <span>
                当前显示 {panelMonth.year()} 年 {panelMonth.month() + 1} 月
              </span>
              <button onClick={showToday} type="button">
                回到本月
              </button>
            </footer>
          </section>
        </>
      )}

      {mobileMenuOpen && (
        <>
          <button
            className={styles.mobileMenuBackdrop}
            aria-label="关闭菜单"
            onClick={() => setMobileMenuOpen(false)}
            type="button"
          />
          <aside
            className={styles.mobileMenuPanel}
            id="watch-mobile-menu"
            aria-label="观影日历菜单"
            aria-modal="true"
            role="dialog"
          >
            {selectedUser && (
              <div className={styles.mobileMenuUser}>
                <span className={styles.mobileMenuIcon}>
                  <UserRound aria-hidden="true" />
                </span>
                <span className={styles.mobileMenuCopy}>
                  <small>观影用户</small>
                  {trackedUsers.length > 1 ? (
                    <select
                      aria-label="切换观影用户"
                      onChange={(event) => {
                        closeDetails();
                        setActiveUser(event.target.value);
                        setMobileMenuOpen(false);
                      }}
                      value={activeUser}
                    >
                      {trackedUsers.map((user) => (
                        <option
                          key={user.emby_user_id}
                          value={user.emby_user_id}
                        >
                          {user.emby_user_name || user.emby_user_id}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <strong>
                      {selectedUser.emby_user_name || selectedUser.emby_user_id}
                    </strong>
                  )}
                </span>
                {trackedUsers.length > 1 && <ChevronDown aria-hidden="true" />}
              </div>
            )}

            {selectedUser && <div className={styles.mobileMenuDivider} />}

            <button
              className={styles.mobileMenuItem}
              onClick={() => navigate('/')}
              type="button"
            >
              <span className={styles.mobileMenuIcon}>
                <House aria-hidden="true" />
              </span>
              <span className={styles.mobileMenuCopy}>
                <strong>Film Fusion</strong>
                <small>返回控制台</small>
              </span>
              <ChevronRight aria-hidden="true" />
            </button>
            <button
              className={styles.mobileMenuItem}
              onClick={() => navigate('/emby-watch')}
              type="button"
            >
              <span className={styles.mobileMenuIcon}>
                <Settings2 aria-hidden="true" />
              </span>
              <span className={styles.mobileMenuCopy}>
                <strong>管理记录</strong>
                <small>查看和整理观影历史</small>
              </span>
              <ChevronRight aria-hidden="true" />
            </button>
          </aside>
        </>
      )}

      <nav
        className={styles.mobileAppBar}
        aria-label="观影记录导航"
        onPointerCancel={releaseAppBarPointer}
        onPointerDown={updateAppBarPointer}
        onPointerLeave={releaseAppBarPointer}
        onPointerMove={updateAppBarPointer}
        onPointerUp={releaseAppBarPointer}
      >
        <div className={styles.mobileAppBarLiquid}>
          <LiquidGlass
            aberrationIntensity={reducedMotion ? 0 : 2}
            blurAmount={0.1}
            className={styles.mobileAppBarGlass}
            cornerRadius={30}
            displacementScale={reducedMotion ? 0 : 64}
            elasticity={reducedMotion ? 0 : 0.35}
            globalMousePos={appBarPointer.globalMousePos}
            mode="standard"
            mouseOffset={appBarPointer.mouseOffset}
            padding="0px"
            saturation={130}
            style={{ width: '100%', height: '100%' }}
          >
            <div className={styles.mobileAppBarContent}>
              <button
                className={`${styles.appBarButton} ${
                  activeView === 'calendar' ? styles.appBarButtonActive : ''
                }`}
                aria-current={activeView === 'calendar' ? 'page' : undefined}
                onClick={() => setMainView('calendar')}
                type="button"
              >
                <CalendarDays aria-hidden="true" />
                <span>日历</span>
              </button>
              <button
                className={`${styles.appBarButton} ${
                  activeView === 'stats' ? styles.appBarButtonActive : ''
                }`}
                aria-current={activeView === 'stats' ? 'page' : undefined}
                onClick={() => setMainView('stats')}
                type="button"
              >
                <ChartNoAxesColumnIncreasing aria-hidden="true" />
                <span>统计</span>
              </button>
              <button
                className={styles.appBarButton}
                onClick={() => navigate('/emby-watch')}
                type="button"
              >
                <Settings2 aria-hidden="true" />
                <span>管理</span>
              </button>
            </div>
          </LiquidGlass>
        </div>
      </nav>
    </main>
  );
}
