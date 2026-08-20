import { ReloadOutlined } from '@ant-design/icons';
import {
  Button,
  ConfigProvider,
  Input,
  InputNumber,
  message,
  Select,
  Switch,
  Table,
  Tooltip,
  Typography,
  theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import ConsolePage from '@/components/ConsolePage';
import { getServerLogFiles, getServerLogs } from '@/services/film-fusion';
import styles from './index.module.less';

const { Text } = Typography;

const POLL_MS = 5000;

const TERMINAL_THEME = {
  algorithm: theme.darkAlgorithm,
  token: {
    borderRadius: 8,
    colorBgBase: '#070b12',
    colorBgContainer: '#0b111a',
    colorBgElevated: '#111927',
    colorBorder: '#263247',
    colorError: '#fb7185',
    colorPrimary: '#7dd3fc',
    colorSuccess: '#5eead4',
    colorText: '#dbe7f3',
    colorTextSecondary: '#7e8da3',
    colorWarning: '#fbbf24',
    controlHeight: 34,
    fontSize: 13,
  },
  components: {
    Table: {
      borderColor: 'rgba(148, 163, 184, 0.12)',
      cellPaddingBlockSM: 0,
      cellPaddingInlineSM: 0,
      expandIconBg: 'transparent',
    },
  },
};

const levelClassName = (level?: string) => {
  switch ((level || '').toLowerCase()) {
    case 'debug':
      return styles.levelDebug;
    case 'info':
      return styles.levelInfo;
    case 'warn':
    case 'warning':
      return styles.levelWarning;
    case 'error':
      return styles.levelError;
    case 'fatal':
    case 'dpanic':
    case 'panic':
      return styles.levelFatal;
    default:
      return styles.levelDefault;
  }
};

const formatSize = (bytes?: number) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

const ServerLogsPage: React.FC = () => {
  const [files, setFiles] = useState<API.ServerLogFile[]>([]);
  const [file, setFile] = useState<string | undefined>();
  const [level, setLevel] = useState<string | undefined>();
  const [keyword, setKeyword] = useState('');
  const [lines, setLines] = useState<number>(500);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const [entries, setEntries] = useState<API.ServerLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const [messageApi, contextHolder] = message.useMessage();
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(
    undefined,
  );

  // 最新的查询条件引用，供轮询使用，避免闭包过期
  const queryRef = useRef({ file, level, keyword, lines });
  queryRef.current = { file, level, keyword, lines };

  const loadFiles = useCallback(async () => {
    try {
      const res = await getServerLogFiles();
      if (res.code === 0) {
        const list = res.data || [];
        setFiles(list);
        setFile((prev) => prev || (list.length > 0 ? list[0].name : undefined));
      }
    } catch (error: any) {
      messageApi.error(error?.message || '获取日志文件列表失败');
    }
  }, [messageApi]);

  const loadLogs = useCallback(
    async (silent = false) => {
      const q = queryRef.current;
      if (!silent) setLoading(true);
      try {
        const res = await getServerLogs({
          file: q.file,
          level: q.level,
          keyword: q.keyword?.trim() || undefined,
          lines: q.lines,
        });
        if (res.code === 0 && res.data) {
          setEntries(res.data.entries || []);
          if (!q.file && res.data.file) {
            setFile(res.data.file);
          }
        } else if (!silent) {
          messageApi.error(res.message || '获取日志失败');
        }
      } catch (error: any) {
        if (!silent) messageApi.error(error?.message || '获取日志失败');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [messageApi],
  );

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  // 条件变化时刷新
  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, level, lines]);

  // 自动刷新
  useEffect(() => {
    if (autoRefresh) {
      timerRef.current = setInterval(() => loadLogs(true), POLL_MS);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoRefresh, loadLogs]);

  const columns: ColumnsType<API.ServerLogEntry> = [
    {
      title: '日志',
      key: 'terminal-line',
      render: (_, record, index) => (
        <div className={styles.logEntry}>
          <span className={styles.lineNumber} aria-hidden="true">
            {String(index + 1).padStart(3, '0')}
          </span>
          <time className={styles.timestamp}>{record.timestamp || '--'}</time>
          <span className={`${styles.level} ${levelClassName(record.level)}`}>
            [{(record.level || 'log').toUpperCase()}]
          </span>
          <Text
            className={styles.logMessage}
            copyable={{
              text: record.raw,
              tooltips: ['复制原始日志', '已复制'],
            }}
          >
            {record.msg || record.raw}
          </Text>
        </div>
      ),
    },
  ];

  const selectedFile = files.find((item) => item.name === file);

  return (
    <ConsolePage eyebrow="System logs" title="运行日志">
      {contextHolder}
      <ConfigProvider theme={TERMINAL_THEME}>
        <section className={styles.consoleShell} aria-label="运行日志终端">
          <header className={styles.windowBar}>
            <div className={styles.windowControls} aria-hidden="true">
              <span className={styles.closeDot} />
              <span className={styles.minimizeDot} />
              <span className={styles.maximizeDot} />
            </div>

            <div className={styles.windowTitle} title={file}>
              <span className={styles.prompt}>$</span>
              <span className={styles.command}>tail -n {lines}</span>
              <strong>{file || 'waiting-for-log'}</strong>
            </div>

            <div
              className={`${styles.streamStatus} ${
                autoRefresh ? styles.streamLive : styles.streamManual
              }`}
            >
              <span className={styles.statusDot} aria-hidden="true" />
              {autoRefresh ? `LIVE · ${POLL_MS / 1000}s` : 'MANUAL'}
            </div>
          </header>

          <div className={styles.toolbar}>
            <div className={`${styles.controlGroup} ${styles.fileControl}`}>
              <span className={styles.controlLabel}>日志文件</span>
              <Select
                className={styles.fileSelect}
                value={file}
                placeholder="选择日志文件"
                onChange={setFile}
                options={files.map((f) => ({
                  label: `${f.name}（${formatSize(f.size)}）`,
                  value: f.name,
                }))}
                showSearch={{ optionFilterProp: 'label' }}
              />
            </div>

            <div className={styles.controlGroup}>
              <span className={styles.controlLabel}>级别</span>
              <Select
                className={styles.levelSelect}
                value={level}
                placeholder="全部"
                allowClear
                onChange={(v) => setLevel(v)}
                options={[
                  { label: 'DEBUG', value: 'debug' },
                  { label: 'INFO', value: 'info' },
                  { label: 'WARN', value: 'warn' },
                  { label: 'ERROR', value: 'error' },
                  { label: 'FATAL', value: 'fatal' },
                ]}
              />
            </div>

            <div className={styles.controlGroup}>
              <span className={styles.controlLabel}>最近</span>
              <InputNumber
                className={styles.linesInput}
                min={50}
                max={5000}
                step={100}
                value={lines}
                onChange={(v) => setLines(v || 500)}
                suffix="行"
              />
            </div>

            <Input.Search
              className={styles.searchInput}
              placeholder="关键字过滤"
              allowClear
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onSearch={() => loadLogs()}
            />

            <Button
              className={styles.refreshButton}
              icon={<ReloadOutlined />}
              loading={loading}
              onClick={() => loadLogs()}
            >
              刷新
            </Button>

            <div className={`${styles.controlGroup} ${styles.autoControl}`}>
              <span className={styles.controlLabel}>自动刷新</span>
              <Tooltip title={`每 ${POLL_MS / 1000} 秒自动刷新`}>
                <Switch
                  checkedChildren="自动"
                  unCheckedChildren="自动"
                  checked={autoRefresh}
                  onChange={setAutoRefresh}
                />
              </Tooltip>
            </div>
          </div>

          <div className={styles.sessionMeta}>
            <span>
              <span className={styles.sessionDot} aria-hidden="true" />
              {file
                ? `${file} · ${formatSize(selectedFile?.size)}`
                : '等待日志文件'}
            </span>
            <span>{entries.length} 条 · 最新在前</span>
          </div>

          <div
            className={styles.logViewport}
            role="log"
            aria-live="polite"
            aria-busy={loading}
          >
            <Table<API.ServerLogEntry>
              className={styles.terminalTable}
              rowKey={(record) =>
                [
                  record.timestamp,
                  record.level,
                  record.caller,
                  record.msg,
                  record.raw,
                ].join('|')
              }
              size="small"
              showHeader={false}
              rowHoverable={false}
              loading={loading}
              columns={columns}
              dataSource={entries}
              locale={{
                emptyText: (
                  <div className={styles.emptyLog}>
                    <span className={styles.prompt}>$</span>
                    <span>当前筛选条件下没有日志输出</span>
                    <span className={styles.cursor} aria-hidden="true" />
                  </div>
                ),
              }}
              pagination={{
                pageSize: 100,
                showSizeChanger: true,
                showTotal: (t) => `共 ${t} 条`,
              }}
              expandable={{
                rowExpandable: (record) => !!record.stacktrace,
                expandedRowRender: (record) => (
                  <div className={styles.stacktracePanel}>
                    <span className={styles.stacktraceLabel}>STACKTRACE</span>
                    <pre>{record.stacktrace}</pre>
                  </div>
                ),
                columnWidth: 34,
              }}
            />
          </div>
        </section>
      </ConfigProvider>
    </ConsolePage>
  );
};

export default ServerLogsPage;
