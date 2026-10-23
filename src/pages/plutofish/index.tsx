import {
  Alert,
  App,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  Table,
  Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Play, RefreshCw, Square } from 'lucide-react';
import { useEffect, useState } from 'react';
import ConsolePage from '@/components/ConsolePage';
import {
  getPlutoFishCloudPaths,
  getPlutoFishConfig,
  getPlutoFishEvents,
  getPlutoFishStatus,
  type PlutoFishConfig,
  type PlutoFishConfigInput,
  type PlutoFishEvent,
  type PlutoFishStatus,
  retryPlutoFishEvent,
  startPlutoFish,
  stopPlutoFish,
  updatePlutoFishConfig,
} from '@/services/film-fusion/plutofish';

const connectionLabels: Record<string, [string, string]> = {
  stopped: ['已停止', 'default'],
  disabled: ['未启用', 'default'],
  connecting: ['连接中', 'processing'],
  starting: ['启动中', 'processing'],
  catching_up: ['补收历史', 'processing'],
  streaming: ['实时订阅中', 'success'],
  connected: ['已连接', 'success'],
  polling: ['HTTP 轮询中', 'processing'],
  backing_off: ['等待重连', 'warning'],
  backoff: ['等待重连', 'warning'],
  error: ['连接异常', 'error'],
  blocked: ['需检查配置', 'error'],
};

const eventStates: Record<PlutoFishEvent['state'], [string, string]> = {
  pending: ['待处理', 'processing'],
  review: ['待人工核对', 'warning'],
  completed: ['本地处理完成', 'success'],
  recorded: ['已记录结果', 'default'],
  duplicate: ['重复任务', 'default'],
};

const resultStates: Record<string, [string, string]> = {
  succeeded: ['转存成功', 'success'],
  failed: ['转存失败', 'error'],
  unknown: ['转存待核对', 'warning'],
};

export const redactPlutoFishError = (value: string) =>
  value
    .replace(/pf_events_[A-Za-z0-9_-]+/g, '[已隐藏密钥]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [已隐藏密钥]');

const errorText = (error: unknown, fallback: string) => {
  const response = error as { response?: { data?: { message?: unknown } } };
  const value = response?.response?.data?.message;
  return redactPlutoFishError(
    typeof value === 'string'
      ? value
      : error instanceof Error
        ? error.message
        : fallback,
  );
};

const unwrap = <T,>(response: API.Response<T>): T => {
  if (response.code !== 0) throw new Error(response.message || '操作失败');
  return response.data;
};

const formatTime = (value?: string) => {
  const time = value ? new Date(value) : null;
  return time && !Number.isNaN(time.getTime()) && time.getFullYear() > 1
    ? time.toLocaleString('zh-CN', { hour12: false })
    : '暂无';
};

const PlutoFishPage = () => {
  const { message } = App.useApp();
  const [form] = Form.useForm<PlutoFishConfigInput>();
  const mode = Form.useWatch('mode', form);
  const [config, setConfig] = useState<PlutoFishConfig>();
  const [status, setStatus] = useState<PlutoFishStatus>();
  const [events, setEvents] = useState<PlutoFishEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [action, setAction] = useState('');
  const [loadError, setLoadError] = useState('');
  const [configError, setConfigError] = useState('');
  const [cloudPaths, setCloudPaths] = useState<API.CloudPath[]>([]);
  const [pathsError, setPathsError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const loadPaths = async () => {
      const collected: API.CloudPath[] = [];
      try {
        for (let current = 1; !controller.signal.aborted; current += 1) {
          const data = unwrap(
            await getPlutoFishCloudPaths(current, controller.signal),
          );
          collected.push(...(data.list || []));
          if (!data.list?.length || collected.length >= data.total) break;
        }
        if (!controller.signal.aborted) setCloudPaths(collected);
      } catch {
        if (!controller.signal.aborted)
          setPathsError('读取本地云路径配置失败，请刷新页面后重试。');
      }
    };
    void loadPaths();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void getPlutoFishConfig(controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        const next = unwrap(response);
        setConfig(next);
        form.setFieldsValue({ ...next, apiKey: '' });
        setConfigError('');
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setConfigError(errorText(error, '读取通知配置失败'));
      });
    return () => controller.abort();
  }, [form]);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async (quiet: boolean) => {
      if (!quiet) setLoading(true);
      try {
        const [statusResponse, eventsResponse] = await Promise.all([
          getPlutoFishStatus(controller.signal),
          getPlutoFishEvents(page, pageSize, controller.signal),
        ]);
        if (controller.signal.aborted) return;
        const nextStatus = unwrap(statusResponse);
        const nextEvents = unwrap(eventsResponse);
        setStatus(nextStatus);
        setEvents(nextEvents.items || []);
        setTotal(nextEvents.total);
        setLoadError('');
      } catch (error) {
        if (!controller.signal.aborted)
          setLoadError(errorText(error, '读取通知状态失败'));
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          timer = setTimeout(() => void load(true), 10_000);
        }
      }
    };
    void load(false);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [page, pageSize, revision]);

  const refresh = () => setRevision((value) => value + 1);

  const save = async (values: PlutoFishConfigInput) => {
    setSaving(true);
    try {
      const input = { ...values, apiKey: values.apiKey?.trim() || undefined };
      const next = unwrap(await updatePlutoFishConfig(input));
      setConfig(next);
      form.setFieldsValue({ ...next, apiKey: '' });
      setConfigError('');
      message.success('通知配置已保存');
      refresh();
    } catch (error) {
      setConfigError(errorText(error, '保存通知配置失败'));
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (
    name: string,
    run: () => Promise<API.Response<unknown>>,
    success: string,
  ) => {
    setAction(name);
    try {
      unwrap(await run());
      message.success(success);
      refresh();
    } catch (error) {
      setLoadError(errorText(error, '操作失败'));
    } finally {
      setAction('');
    }
  };

  const columns: ColumnsType<PlutoFishEvent> = [
    {
      title: '作品 / 文件',
      key: 'file',
      width: 220,
      render: (_, event) => (
        <div style={{ overflowWrap: 'anywhere' }}>
          <strong>{event.workTitle || '未提供作品名称'}</strong>
          <div>{event.fileName || '未提供文件名'}</div>
        </div>
      ),
    },
    {
      title: '转存结果',
      dataIndex: 'status',
      width: 130,
      render: (value: string) => {
        const [label, color] = resultStates[value] || [value, 'warning'];
        return <Tag color={color}>{label || '未知结果'}</Tag>;
      },
    },
    {
      title: '本地处理',
      dataIndex: 'state',
      width: 140,
      render: (value: PlutoFishEvent['state']) => {
        const [label, color] = eventStates[value] || [value, 'warning'];
        return <Tag color={color}>{label || '未知状态'}</Tag>;
      },
    },
    {
      title: '处理说明',
      dataIndex: 'reason',
      width: 300,
      render: (value: string, event) => (
        <div style={{ overflowWrap: 'anywhere' }}>
          <div>{redactPlutoFishError(value || '—')}</div>
          {event.outputPath && <div>本地文件：{event.outputPath}</div>}
        </div>
      ),
    },
    {
      title: '事件 / 任务 ID',
      key: 'identity',
      width: 210,
      render: (_, event) => (
        <div style={{ overflowWrap: 'anywhere' }}>
          <div>{event.eventID}</div>
          <div>{event.transferID || '未提供任务 ID'}</div>
        </div>
      ),
    },
    {
      title: '事件时间',
      dataIndex: 'occurredAt',
      width: 180,
      render: formatTime,
    },
    {
      title: '操作',
      key: 'action',
      width: 165,
      render: (_, event) =>
        event.type === 'transfer.succeeded' &&
        event.schemaVersion === 1 &&
        event.status === 'succeeded' &&
        event.state === 'review' ? (
          <Button
            size="small"
            disabled={!!action || saving}
            loading={action === `retry-${event.id}`}
            onClick={() =>
              void runAction(
                `retry-${event.id}`,
                () => retryPlutoFishEvent(event.id),
                '已重新提交本地处理',
              )
            }
          >
            重新处理本地任务
          </Button>
        ) : (
          '—'
        ),
    },
  ];

  const [connectionLabel, connectionColor] = connectionLabels[
    status?.state || 'stopped'
  ] || [status?.state || '未知', 'warning'];

  return (
    <ConsolePage
      eyebrow="PlutoFish Events"
      title="PlutoFish 转存通知"
      actions={
        <Button
          icon={<RefreshCw size={16} />}
          loading={loading}
          onClick={refresh}
        >
          刷新状态
        </Button>
      }
    >
      <div style={{ display: 'grid', gap: 20, minWidth: 0 }}>
        <Alert
          type="info"
          showIcon
          title="由 FilmFusion 后端主动接收通知"
          description="无需公网回调或端口映射。先补收历史，再订阅实时事件；离开本页不会停止接收。成功事件会进入本地处理，信息不完整的事件保留为待处理。失败及待核对结果仅记录，不会重新执行网盘转存。"
        />
        {(loadError || status?.lastError) && (
          <Alert
            type="error"
            showIcon
            title="通知接收状态需要检查"
            description={redactPlutoFishError(
              loadError || status?.lastError || '',
            )}
          />
        )}
        <Card title="连接与处理进度">
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 16,
              alignItems: 'center',
            }}
          >
            <Tag color={connectionColor}>{connectionLabel}</Tag>
            <span>待处理：{status?.pendingCount ?? '—'}</span>
            <span>待核对：{status?.reviewCount ?? '—'}</span>
            <span>最近事件：{formatTime(status?.lastEventAt)}</span>
          </div>
          <p style={{ overflowWrap: 'anywhere' }}>
            已提交游标：{status?.cursor || '尚未提交'}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Button
              icon={<Play size={16} />}
              disabled={
                !config?.keyConfigured || !config.enabled || saving || !!action
              }
              loading={action === 'start'}
              onClick={() =>
                void runAction('start', startPlutoFish, '已请求启动通知接收')
              }
            >
              启动接收
            </Button>
            <Button
              icon={<Square size={16} />}
              disabled={saving || !!action}
              loading={action === 'stop'}
              onClick={() =>
                void runAction('stop', stopPlutoFish, '已停止通知接收')
              }
            >
              停止接收
            </Button>
          </div>
          <p style={{ marginBottom: 0 }}>
            请先启用自动连接并保存配置。停止接收仅影响当前运行；如需重启后仍停用，请关闭自动连接并保存。
          </p>
        </Card>
        <Card title="通知接入配置" loading={!config && !configError}>
          {configError && (
            <Alert
              type="error"
              showIcon
              title="配置操作失败"
              description={configError}
              style={{ marginBottom: 16 }}
            />
          )}
          <Form<PlutoFishConfigInput>
            form={form}
            layout="vertical"
            onFinish={(values) => void save(values)}
            autoComplete="off"
            clearOnDestroy
            disabled={saving || !!action || !config}
            initialValues={{
              enabled: false,
              baseURL: 'https://plutofish.shop',
              ownerUID: '',
              mode: 'sse',
              pollSeconds: 15,
              mappings: [],
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
                columnGap: 24,
              }}
            >
              <Form.Item
                name="baseURL"
                label="PlutoFish 服务地址"
                rules={[{ required: true, message: '请输入服务地址' }]}
                extra="填写服务根地址，例如 https://plutofish.shop。生产环境使用 HTTPS。"
              >
                <Input
                  placeholder="https://plutofish.shop"
                  autoComplete="off"
                />
              </Form.Item>
              <Form.Item
                name="ownerUID"
                label="PlutoFish 用户 UID"
                rules={[
                  {
                    required: true,
                    whitespace: true,
                    message: '请输入所属用户 UID',
                  },
                ]}
                extra="用于隔离用户进度。同一用户换密钥保留此值继续原进度；更换用户必须填写新 UID 和新密钥，旧用户历史仍会保留。"
              >
                <Input placeholder="密钥所属用户的 UID" autoComplete="off" />
              </Form.Item>
              <Form.Item
                name="apiKey"
                label={`API Key${config?.keyConfigured ? '（已配置）' : '（未配置）'}`}
                extra="在 PlutoFish「我的 → 通知接入」创建后填写。留空保留现有密钥；保存后不回显。"
              >
                <Input.Password
                  placeholder={
                    config?.keyConfigured
                      ? '留空保留现有密钥'
                      : '在此本地填写 API Key'
                  }
                  autoComplete="new-password"
                />
              </Form.Item>
              <Form.Item
                name="mode"
                label="接收方式"
                rules={[{ required: true }]}
              >
                <Select
                  options={[
                    { label: 'SSE 实时订阅（推荐）', value: 'sse' },
                    { label: 'HTTP 轮询', value: 'poll' },
                  ]}
                />
              </Form.Item>
              <Form.Item
                name="pollSeconds"
                label="HTTP 轮询间隔（秒）"
                hidden={mode !== 'poll'}
                rules={[
                  {
                    required: true,
                    type: 'integer',
                    min: 10,
                    max: 3600,
                    message: '请输入 10 到 3600 之间的整数',
                  },
                ]}
                extra="无更多历史页时至少等待此间隔，并自动加入随机抖动。"
              >
                <InputNumber
                  min={10}
                  max={3600}
                  precision={0}
                  style={{ width: '100%' }}
                />
              </Form.Item>
              <Form.Item
                name="enabled"
                label="自动连接"
                valuePropName="checked"
                extra="启用并保存后开始接收，后续随 FilmFusion 启动。关闭并保存可持久停用，保留游标与事件记录。"
              >
                <Switch />
              </Form.Item>
            </div>
            <h3>成功事件 → 本地 STRM</h3>
            <p>
              将 PlutoFish 接收网盘 ID 绑定到已有的云路径映射，沿用其 STRM
              内容前缀和本地目录。这里只读取本地配置并生成文件，不扫描网盘，也不刷新
              Emby。
              未配置映射或通知缺少目标目录路径、文件名时，事件会保留为待处理。
            </p>
            {pathsError && (
              <Alert
                type="warning"
                title={pathsError}
                style={{ marginBottom: 16 }}
              />
            )}
            <Form.List name="mappings">
              {(fields, { add, remove }) => (
                <div style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
                  {fields.map((field) => (
                    <div
                      key={field.key}
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'start',
                        gap: 12,
                      }}
                    >
                      <Form.Item
                        name={[field.name, 'targetAccountID']}
                        label="PlutoFish 接收网盘 ID"
                        style={{ flex: '1 1 220px', marginBottom: 0 }}
                        rules={[
                          {
                            required: true,
                            whitespace: true,
                            message: '请输入接收网盘 ID',
                          },
                        ]}
                      >
                        <Input placeholder="事件中的 targetAccountId" />
                      </Form.Item>
                      <Form.Item
                        name={[field.name, 'cloudPathID']}
                        label="FilmFusion 云路径映射"
                        style={{ flex: '2 1 320px', marginBottom: 0 }}
                        rules={[
                          { required: true, message: '请选择已有云路径映射' },
                        ]}
                      >
                        <Select
                          placeholder="选择已配置 STRM 的云路径"
                          showSearch={{ optionFilterProp: 'label' }}
                          options={cloudPaths.map((path) => ({
                            value: path.id,
                            label: `#${path.id} ${path.cloud_storage?.storage_name || ''} ${path.source_path} → ${path.local_path || '未配置本地目录'}`,
                          }))}
                          notFoundContent="没有可用配置，请先到「云路径映射」添加"
                        />
                      </Form.Item>
                      <Button
                        danger
                        style={{ marginTop: 30 }}
                        onClick={() => remove(field.name)}
                        aria-label={`移除第 ${field.name + 1} 条映射`}
                      >
                        移除
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="dashed"
                    onClick={() =>
                      add({ targetAccountID: '', cloudPathID: undefined })
                    }
                    style={{ justifySelf: 'start' }}
                  >
                    添加网盘与 STRM 映射
                  </Button>
                </div>
              )}
            </Form.List>
            <Button type="primary" htmlType="submit" loading={saving}>
              保存配置
            </Button>
          </Form>
        </Card>
        <Card title="本地事件与待处理队列">
          <p>
            补充配置后可重新处理成功事件；此操作仅重试 FilmFusion
            本地处理，不会重新转存。
          </p>
          <Table<PlutoFishEvent>
            rowKey="id"
            columns={columns}
            dataSource={events}
            loading={loading}
            scroll={{ x: 1345 }}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              showTotal: (count) => `共 ${count} 条事件`,
              onChange: (nextPage, nextPageSize) => {
                setPage(nextPageSize === pageSize ? nextPage : 1);
                setPageSize(nextPageSize);
              },
            }}
            locale={{
              emptyText: '尚未接收到事件。保存配置并启动后，先补收已有通知。',
            }}
          />
        </Card>
      </div>
    </ConsolePage>
  );
};

export default PlutoFishPage;
