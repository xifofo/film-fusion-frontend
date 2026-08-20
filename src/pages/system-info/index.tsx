import { Alert, Button, Card, Descriptions, Progress, Switch } from 'antd';
import {
  Activity,
  Box,
  Clock3,
  Cpu,
  Gauge,
  HardDrive,
  type LucideIcon,
  MemoryStick,
  RefreshCw,
  Server,
  ServerCrash,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSystemInfo, type SystemInfo } from '@/services/film-fusion';
import styles from './index.module.less';

const REFRESH_INTERVAL_MS = 5000;

type MetricTone = 'blue' | 'violet' | 'emerald' | 'amber';

type MetricCardProps = {
  detail: string;
  icon: LucideIcon;
  label: string;
  percent: number;
  primary: string;
  secondary: string;
  tone: MetricTone;
};

const percentValue = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
};

const progressColor = (percent: number, tone: MetricTone) => {
  if (percent >= 90) return '#e5484d';
  if (percent >= 75) return '#f59e0b';
  return {
    blue: '#3b82f6',
    violet: '#8b5cf6',
    emerald: '#10b981',
    amber: '#f59e0b',
  }[tone];
};

export const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** unitIndex;
  return `${new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: value >= 100 ? 0 : 1,
  }).format(value)} ${units[unitIndex]}`;
};

export const formatDuration = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '不足 1 分钟';
  const units = [
    { label: '天', seconds: 86400 },
    { label: '小时', seconds: 3600 },
    { label: '分钟', seconds: 60 },
  ];
  let remaining = Math.floor(seconds);
  const parts: string[] = [];

  for (const unit of units) {
    const value = Math.floor(remaining / unit.seconds);
    if (value > 0) {
      parts.push(`${value} ${unit.label}`);
      remaining %= unit.seconds;
    }
    if (parts.length === 2) break;
  }

  return parts.join(' ') || `${Math.floor(seconds)} 秒`;
};

export const formatPercent = (value: number) =>
  new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 }).format(
    percentValue(value),
  );

const formatDateTime = (value: string | number) => {
  const date =
    typeof value === 'number' ? new Date(value * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('zh-CN', { hour12: false });
};

const requestErrorText = (error: unknown) => {
  if (!error || typeof error !== 'object') return '获取系统信息失败';
  const candidate = error as {
    data?: string;
    message?: string;
    response?: { data?: { message?: string } };
  };
  return (
    candidate.response?.data?.message ||
    candidate.data ||
    candidate.message ||
    '获取系统信息失败'
  );
};

const MetricCard = ({
  detail,
  icon: Icon,
  label,
  percent,
  primary,
  secondary,
  tone,
}: MetricCardProps) => {
  const normalized = percentValue(percent);
  return (
    <Card className={`${styles.metricCard} ${styles[tone]}`}>
      <div className={styles.metricHeader}>
        <span className={styles.metricIcon}>
          <Icon aria-hidden="true" />
        </span>
        <span className={styles.metricLabel}>{label}</span>
      </div>
      <div className={styles.metricReading}>
        <strong>{formatPercent(normalized)}</strong>
        <span>%</span>
      </div>
      <Progress
        aria-label={`${label} ${formatPercent(normalized)}%`}
        percent={normalized}
        showInfo={false}
        strokeColor={progressColor(normalized, tone)}
        railColor="rgba(128, 128, 128, 0.12)"
      />
      <div className={styles.metricValues}>
        <span>{primary}</span>
        <span>{secondary}</span>
      </div>
      <p>{detail}</p>
    </Card>
  );
};

const SystemInfoSkeleton = () => (
  <div aria-live="polite">
    <span className={styles.srOnly}>正在读取系统资源信息</span>
    <div className={styles.metricGrid}>
      {['cpu', 'memory', 'disk', 'process'].map((key) => (
        <div className={styles.metricSkeleton} key={key} />
      ))}
    </div>
    <div className={styles.detailGrid}>
      <div className={styles.detailSkeleton} />
      <div className={styles.detailSkeleton} />
    </div>
  </div>
);

const SystemInfoPage = () => {
  const [info, setInfo] = useState<SystemInfo>();
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [error, setError] = useState('');
  const requestRef = useRef<Promise<void> | undefined>(undefined);

  const load = useCallback(() => {
    if (requestRef.current) return requestRef.current;
    setLoading(true);
    const request = (async () => {
      try {
        const response = await getSystemInfo();
        if (response.code !== 0 || !response.data) {
          throw new Error(response.message || '获取系统信息失败');
        }
        setInfo(response.data);
        setError('');
      } catch (requestError) {
        setError(requestErrorText(requestError));
      }
    })();
    const trackedRequest = request.finally(() => {
      requestRef.current = undefined;
      setLoading(false);
    });
    requestRef.current = trackedRequest;
    return trackedRequest;
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = window.setInterval(() => {
      void load();
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [autoRefresh, load]);

  const hostItems = useMemo(() => {
    if (!info) return [];
    const virtualization = [
      info.host.virtualization_system,
      info.host.virtualization_role,
    ]
      .filter(Boolean)
      .join(' / ');
    return [
      { key: 'hostname', label: '主机名', children: info.host.hostname || '-' },
      {
        key: 'platform',
        label: '操作系统',
        children:
          [info.host.platform, info.host.platform_version]
            .filter(Boolean)
            .join(' ') ||
          info.host.os ||
          '-',
      },
      {
        key: 'architecture',
        label: '系统架构',
        children: info.host.architecture || '-',
      },
      {
        key: 'kernel',
        label: '内核版本',
        children: info.host.kernel_version || '-',
      },
      {
        key: 'uptime',
        label: '系统运行时长',
        children: formatDuration(info.host.uptime_seconds),
      },
      {
        key: 'boot-time',
        label: '启动时间',
        children: info.host.boot_time
          ? formatDateTime(info.host.boot_time)
          : '-',
      },
      {
        key: 'process-count',
        label: '系统进程数',
        children: info.host.process_count.toLocaleString('zh-CN'),
      },
      {
        key: 'virtualization',
        label: '虚拟化环境',
        children: virtualization || '未检测到',
      },
    ];
  }, [info]);

  const runtimeItems = useMemo(() => {
    if (!info) return [];
    return [
      { key: 'pid', label: '进程 PID', children: info.process.pid },
      {
        key: 'process-uptime',
        label: '服务运行时长',
        children: formatDuration(info.process.uptime_seconds),
      },
      {
        key: 'process-cpu',
        label: '进程 CPU',
        children: `${formatPercent(info.process.cpu_usage_percent)}%`,
      },
      {
        key: 'process-memory',
        label: '进程常驻内存',
        children: formatBytes(info.process.memory_rss),
      },
      {
        key: 'heap',
        label: 'Go 堆内存',
        children: formatBytes(info.process.go_heap_alloc),
      },
      {
        key: 'goroutines',
        label: '协程 / 线程',
        children: `${info.process.goroutines} / ${info.process.threads}`,
      },
      {
        key: 'go-version',
        label: 'Go 版本',
        children: info.process.go_version || '-',
      },
      {
        key: 'disk-path',
        label: '磁盘统计路径',
        children: <code className={styles.pathValue}>{info.disk.path}</code>,
      },
    ];
  }, [info]);

  return (
    <div className="box-border w-full px-4 py-5 sm:px-6 sm:py-7 xl:px-8">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="m-0 text-[11px] font-semibold tracking-[0.18em] text-neutral-400 uppercase dark:text-white/35">
            System monitor
          </p>
          <h1 className="mt-2 mb-0 text-2xl font-semibold tracking-[-0.035em] text-neutral-950 sm:text-[30px] dark:text-white">
            系统信息
          </h1>
        </div>

        <div className={styles.headerActions}>
          <span className={styles.autoRefresh}>
            <Switch
              aria-label="自动刷新系统信息"
              checked={autoRefresh}
              onChange={setAutoRefresh}
              size="small"
            />
            <span>每 5 秒刷新</span>
          </span>
          <Button
            aria-label="刷新系统信息"
            className="!h-9 !rounded-xl !border-0 !bg-black/[0.035] !px-3.5 !text-neutral-600 hover:!bg-black/[0.065] dark:!bg-white/8 dark:!text-white/65 dark:hover:!bg-white/12"
            icon={<RefreshCw aria-hidden="true" className="size-4" />}
            loading={loading}
            onClick={load}
            type="text"
          >
            刷新
          </Button>
        </div>
      </header>

      <div className={styles.page}>
        {error && (
          <Alert
            action={
              <Button loading={loading} onClick={load} size="small">
                重试
              </Button>
            }
            className={styles.notice}
            description="已保留上一次成功读取的数据；请检查后端服务状态后重试。"
            showIcon
            title={error}
            type="error"
          />
        )}

        {info?.warnings && info.warnings.length > 0 && (
          <Alert
            className={styles.notice}
            description={info.warnings.join('；')}
            showIcon
            title="部分系统指标暂不可用"
            type="warning"
          />
        )}

        {loading && !info ? (
          <SystemInfoSkeleton />
        ) : info ? (
          <>
            <div className={styles.snapshotBar}>
              <span className={styles.liveStatus}>
                <i aria-hidden="true" />
                实时资源快照
              </span>
              <span>
                <Clock3 aria-hidden="true" />
                采集于 {formatDateTime(info.collected_at)}
              </span>
            </div>

            <section aria-label="资源占用概览" className={styles.metricGrid}>
              <MetricCard
                detail={info.cpu.model_name || '处理器型号暂不可用'}
                icon={Cpu}
                label="主机 CPU"
                percent={info.cpu.usage_percent}
                primary={`${info.cpu.logical_cores} 逻辑核心`}
                secondary={`${info.cpu.physical_cores || '-'} 物理核心`}
                tone="blue"
              />
              <MetricCard
                detail={`可用 ${formatBytes(info.memory.available)}`}
                icon={MemoryStick}
                label="主机内存"
                percent={info.memory.usage_percent}
                primary={formatBytes(info.memory.used)}
                secondary={`共 ${formatBytes(info.memory.total)}`}
                tone="violet"
              />
              <MetricCard
                detail={`可用 ${formatBytes(info.disk.available)}`}
                icon={HardDrive}
                label="应用目录磁盘"
                percent={info.disk.usage_percent}
                primary={formatBytes(info.disk.used)}
                secondary={`共 ${formatBytes(info.disk.total)}`}
                tone="emerald"
              />
              <MetricCard
                detail={`常驻内存 ${formatBytes(info.process.memory_rss)}`}
                icon={Activity}
                label="FilmFusion 进程 CPU"
                percent={info.process.cpu_usage_percent}
                primary={`${info.process.goroutines} 个协程`}
                secondary={`PID ${info.process.pid}`}
                tone="amber"
              />
            </section>

            <section className={styles.loadPanel}>
              <div className={styles.loadHeading}>
                <span>
                  <Gauge aria-hidden="true" />
                </span>
                <div>
                  <h2>系统负载</h2>
                  <p>最近 1、5、15 分钟的平均运行队列</p>
                </div>
              </div>
              <dl className={styles.loadValues}>
                <div>
                  <dt>1 分钟</dt>
                  <dd>{info.cpu.load_1.toFixed(2)}</dd>
                </div>
                <div>
                  <dt>5 分钟</dt>
                  <dd>{info.cpu.load_5.toFixed(2)}</dd>
                </div>
                <div>
                  <dt>15 分钟</dt>
                  <dd>{info.cpu.load_15.toFixed(2)}</dd>
                </div>
              </dl>
            </section>

            <section className={styles.detailGrid}>
              <Card
                className={styles.detailCard}
                title={
                  <span className={styles.cardTitle}>
                    <Server aria-hidden="true" />
                    运行环境
                  </span>
                }
              >
                <Descriptions
                  className={styles.descriptions}
                  column={{ xs: 1, sm: 2 }}
                  items={hostItems}
                  layout="vertical"
                  size="small"
                />
              </Card>
              <Card
                className={styles.detailCard}
                title={
                  <span className={styles.cardTitle}>
                    <Box aria-hidden="true" />
                    FilmFusion 运行时
                  </span>
                }
              >
                <Descriptions
                  className={styles.descriptions}
                  column={{ xs: 1, sm: 2 }}
                  items={runtimeItems}
                  layout="vertical"
                  size="small"
                />
              </Card>
            </section>
          </>
        ) : (
          <div className={styles.emptyState}>
            <ServerCrash aria-hidden="true" />
            <h2>暂时无法读取系统信息</h2>
            <p>确认 FilmFusion 后端正在运行，然后重新获取实时资源数据。</p>
            <Button loading={loading} onClick={load} type="primary">
              重新获取
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SystemInfoPage;
