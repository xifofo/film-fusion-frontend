import { ReloadOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import {
  Button,
  Card,
  Input,
  InputNumber,
  message,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getServerLogFiles, getServerLogs } from '@/services/film-fusion';

const { Text, Paragraph } = Typography;

const POLL_MS = 5000;

const LEVEL_COLORS: Record<string, string> = {
  debug: 'default',
  info: 'blue',
  warn: 'orange',
  warning: 'orange',
  error: 'red',
  fatal: 'magenta',
  dpanic: 'magenta',
  panic: 'magenta',
};

const levelColor = (level?: string) =>
  LEVEL_COLORS[(level || '').toLowerCase()] || 'default';

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
  const timerRef = useRef<ReturnType<typeof setInterval>>();

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
      title: '时间',
      dataIndex: 'timestamp',
      width: 170,
      render: (v: string) => <Text type="secondary">{v || '-'}</Text>,
    },
    {
      title: '级别',
      dataIndex: 'level',
      width: 90,
      render: (v: string) =>
        v ? <Tag color={levelColor(v)}>{v.toUpperCase()}</Tag> : <Tag>-</Tag>,
    },
    {
      title: '消息',
      dataIndex: 'msg',
      render: (v: string, record) => (
        <Paragraph
          style={{
            marginBottom: 0,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
          copyable={{ text: record.raw }}
        >
          {v || record.raw}
        </Paragraph>
      ),
    },
  ];

  return (
    <PageContainer header={{ title: '运行日志' }}>
      {contextHolder}
      <Card>
        <Space wrap style={{ marginBottom: 16 }}>
          <Space>
            <Text>日志文件</Text>
            <Select
              style={{ width: 260 }}
              value={file}
              placeholder="选择日志文件"
              onChange={setFile}
              options={files.map((f) => ({
                label: `${f.name}（${formatSize(f.size)}）`,
                value: f.name,
              }))}
              showSearch
              optionFilterProp="label"
            />
          </Space>
          <Space>
            <Text>级别</Text>
            <Select
              style={{ width: 120 }}
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
          </Space>
          <Space>
            <Text>最近</Text>
            <InputNumber
              min={50}
              max={5000}
              step={100}
              value={lines}
              onChange={(v) => setLines(v || 500)}
              addonAfter="行"
              style={{ width: 130 }}
            />
          </Space>
          <Input.Search
            style={{ width: 240 }}
            placeholder="关键字过滤"
            allowClear
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onSearch={() => loadLogs()}
          />
          <Button
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={() => loadLogs()}
          >
            刷新
          </Button>
          <Space>
            <Tooltip title={`每 ${POLL_MS / 1000} 秒自动刷新`}>
              <Switch
                checkedChildren="自动"
                unCheckedChildren="自动"
                checked={autoRefresh}
                onChange={setAutoRefresh}
              />
            </Tooltip>
          </Space>
        </Space>

        <Table<API.ServerLogEntry>
          rowKey={(_, index) => String(index)}
          size="small"
          loading={loading}
          columns={columns}
          dataSource={entries}
          pagination={{
            pageSize: 100,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
          }}
          expandable={{
            rowExpandable: (record) => !!record.stacktrace,
            expandedRowRender: (record) => (
              <pre
                style={{
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  fontSize: 12,
                  color: '#a8071a',
                }}
              >
                {record.stacktrace}
              </pre>
            ),
          }}
        />
      </Card>
    </PageContainer>
  );
};

export default ServerLogsPage;
