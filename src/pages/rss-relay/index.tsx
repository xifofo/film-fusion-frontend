import {
  DeleteOutlined,
  EditOutlined,
  LinkOutlined,
  PlusOutlined,
  ReloadOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  message,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useRef, useState } from 'react';
import ConsolePage from '@/components/ConsolePage';
import {
  createRSSRelay,
  deleteRSSRelay,
  getRSSRelays,
  type RSSRelay,
  type RSSRelayInput,
  refreshRSSRelay,
  rotateRSSRelayToken,
  setRSSRelayEnabled,
  updateRSSRelay,
} from '@/services/film-fusion/rssRelay';

const { Text, Paragraph } = Typography;
const formatTime = (value?: string) =>
  value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '暂无';
const relayURL = (relay: RSSRelay) =>
  new URL(relay.relay_path, window.location.origin).href;

const RSSRelayPage = () => {
  const [relays, setRelays] = useState<RSSRelay[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState<RSSRelay>();
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyID, setBusyID] = useState<number>();
  const [form] = Form.useForm<RSSRelayInput>();
  const [messageApi, messageHolder] = message.useMessage();
  const loadSequence = useRef(0);

  const load = useCallback(async (quiet = false) => {
    const sequence = ++loadSequence.current;
    if (!quiet) setLoading(true);
    try {
      const response = await getRSSRelays();
      if (response.code !== 0)
        throw new Error(response.message || '读取 RSS 中转失败');
      if (sequence !== loadSequence.current) return;
      setRelays(response.data || []);
      setLoadError('');
    } catch (error) {
      if (sequence === loadSequence.current)
        setLoadError(
          error instanceof Error ? error.message : '读取 RSS 中转失败',
        );
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (editorOpen || busyID !== undefined) return;
    const timer = window.setInterval(() => {
      void load(true);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [load, editorOpen, busyID]);

  const openEditor = (relay?: RSSRelay) => {
    setEditing(relay);
    form.resetFields();
    form.setFieldsValue(
      relay || {
        name: '',
        feed_url: '',
        enabled: true,
        min_interval_seconds: 180,
      },
    );
    setEditorOpen(true);
  };
  const save = async () => {
    try {
      const input = await form.validateFields();
      setSaving(true);
      const response = editing
        ? await updateRSSRelay(editing.id, input)
        : await createRSSRelay(input);
      if (response.code !== 0) throw new Error(response.message || '保存失败');
      messageApi.success(editing ? 'RSS 中转已更新' : 'RSS 中转已创建');
      setEditorOpen(false);
      await load(true);
    } catch (error) {
      if (error instanceof Error) messageApi.error(error.message);
    } finally {
      setSaving(false);
    }
  };
  const act = async (
    relay: RSSRelay,
    action: () => Promise<API.Response<unknown>>,
    success: string,
  ) => {
    setBusyID(relay.id);
    try {
      const response = await action();
      if (response.code !== 0) throw new Error(response.message || '操作失败');
      messageApi.success(success);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '操作失败');
    } finally {
      await load(true);
      setBusyID(undefined);
    }
  };

  const columns: ColumnsType<RSSRelay> = [
    {
      title: '名称 / 原始地址',
      key: 'name',
      width: 250,
      render: (_, relay) => (
        <Space orientation="vertical" size={4}>
          <Text strong>{relay.name}</Text>
          <Text
            type="secondary"
            ellipsis={{ tooltip: relay.feed_url }}
            style={{ maxWidth: 225 }}
          >
            {relay.feed_url}
          </Text>
        </Space>
      ),
    },
    {
      title: '状态',
      key: 'status',
      width: 165,
      render: (_, relay) => (
        <Space orientation="vertical" size={8}>
          <Space>
            <Switch
              size="small"
              aria-label={`${relay.name}启用状态`}
              checked={relay.enabled}
              loading={busyID === relay.id}
              disabled={busyID !== undefined}
              onChange={(enabled) =>
                void act(
                  relay,
                  () => setRSSRelayEnabled(relay.id, enabled),
                  enabled ? '已启用中转' : '已停用中转',
                )
              }
            />
            <Text>{relay.enabled ? '已启用' : '已停用'}</Text>
          </Space>
          {relay.last_error ? (
            <Tooltip title={relay.last_error}>
              <Tag color={relay.has_cache ? 'warning' : 'error'}>
                {relay.has_cache ? '上游异常 · 提供缓存' : '抓取失败'}
              </Tag>
            </Tooltip>
          ) : (
            <Tag color={relay.has_cache ? 'success' : 'default'}>
              {relay.has_cache ? '已有缓存' : '等待首次抓取'}
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: '最小间隔',
      dataIndex: 'min_interval_seconds',
      width: 100,
      render: (seconds: number) => `${seconds} 秒`,
    },
    {
      title: '抓取时间',
      key: 'time',
      width: 220,
      render: (_, relay) => (
        <Space orientation="vertical" size={4}>
          <Text type="secondary">
            最近成功：{formatTime(relay.last_success_at)}
          </Text>
          <Text type="secondary">
            下次允许：{formatTime(relay.next_fetch_at)}
          </Text>
        </Space>
      ),
    },
    {
      title: '中转链接',
      key: 'link',
      width: 250,
      render: (_, relay) => (
        <>
          <Paragraph
            copyable={{ text: relayURL(relay) }}
            style={{ marginBottom: 0, overflowWrap: 'anywhere' }}
          >
            {relayURL(relay)}
          </Paragraph>
          {!relay.enabled && <Text type="secondary">启用后可访问</Text>}
        </>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      fixed: 'right',
      width: 180,
      render: (_, relay) => (
        <Space size={0}>
          <Tooltip title="刷新缓存（遵守最小间隔）">
            <Button
              type="text"
              icon={<SyncOutlined />}
              aria-label={`刷新${relay.name}`}
              disabled={busyID !== undefined}
              onClick={() =>
                void act(
                  relay,
                  () => refreshRSSRelay(relay.id),
                  '已检查缓存，冷却期间复用已有内容',
                )
              }
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              aria-label={`编辑${relay.name}`}
              disabled={busyID !== undefined}
              onClick={() => openEditor(relay)}
            />
          </Tooltip>
          <Popconfirm
            title="重新生成中转链接？"
            description="旧链接将立即失效，请同步更新 FilmFusion 自动化和 MP2。"
            okText="重新生成"
            cancelText="取消"
            onConfirm={() =>
              act(
                relay,
                () => rotateRSSRelayToken(relay.id),
                '已生成新链接，旧链接已失效',
              )
            }
          >
            <Tooltip title="重置链接">
              <Button
                type="text"
                icon={<LinkOutlined />}
                aria-label={`重置${relay.name}的链接`}
                disabled={busyID !== undefined}
              />
            </Tooltip>
          </Popconfirm>
          <Popconfirm
            title="删除此 RSS 中转？"
            description="使用此链接的系统将无法继续读取，请先更换订阅地址。"
            okText="删除"
            cancelText="取消"
            onConfirm={() =>
              act(relay, () => deleteRSSRelay(relay.id), 'RSS 中转已删除')
            }
          >
            <Tooltip title="删除">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                aria-label={`删除${relay.name}`}
                disabled={busyID !== undefined}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <ConsolePage
      eyebrow="RSS Relay"
      title="RSS 中转"
      actions={
        <>
          <Button
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={() => void load()}
          >
            刷新状态
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => openEditor()}
          >
            添加 RSS 中转
          </Button>
        </>
      }
    >
      {messageHolder}
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          title="独立抓取一份 RSS，供多个系统使用"
          description="添加原始 RSS 地址后，将生成的中转链接填入 FilmFusion 自动化和 MP2。中转独立定时更新，停用或删除自动化不会影响中转。"
        />
        {loadError && (
          <Alert
            type="error"
            showIcon
            title="读取失败"
            description={loadError}
          />
        )}
        <Table<RSSRelay>
          rowKey="id"
          columns={columns}
          dataSource={relays}
          loading={loading}
          scroll={{ x: 1165 }}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          locale={{ emptyText: '还没有 RSS 中转，点击右上角添加即可独立使用' }}
        />
        <Text type="secondary">
          默认间隔 180 秒，最低 120
          秒。同一原始地址共用缓存和间隔。其他机器或容器请使用可访问的
          FilmFusion 地址；中转链接包含访问凭证，请仅提供给自己的系统。
        </Text>
      </Space>
      <Modal
        title={editing ? '编辑 RSS 中转' : '添加 RSS 中转'}
        open={editorOpen}
        forceRender
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
        onOk={() => void save()}
        onCancel={() => {
          if (!saving) setEditorOpen(false);
        }}
        mask={{ closable: false }}
      >
        <Form<RSSRelayInput>
          form={form}
          layout="vertical"
          style={{ marginTop: 20 }}
        >
          <Form.Item
            name="name"
            label="名称"
            rules={[
              { required: true, whitespace: true, message: '请输入名称' },
              { max: 120 },
            ]}
          >
            <Input maxLength={120} placeholder="例如：我的 RSS 订阅" />
          </Form.Item>
          <Form.Item
            name="feed_url"
            label="原始 RSS 地址"
            rules={[
              { required: true, message: '请输入原始 RSS 地址' },
              {
                type: 'url',
                pattern: /^https?:\/\//i,
                message: '请输入有效的 HTTP 或 HTTPS 地址',
              },
            ]}
            extra={
              editing
                ? '修改原始地址会生成新中转链接，请同步更新使用方。'
                : '填写上游原始地址，不需要先创建自动化。'
            }
          >
            <Input placeholder="https://example.com/rss" />
          </Form.Item>
          <Form.Item
            name="min_interval_seconds"
            label="最小抓取间隔（秒）"
            rules={[
              { required: true },
              {
                type: 'integer',
                min: 120,
                max: 86400,
                message: '请输入 120 到 86400 之间的整数',
              },
            ]}
            extra="定时抓取、手动刷新和客户端请求均遵守此间隔。"
          >
            <InputNumber
              min={120}
              max={86400}
              step={60}
              precision={0}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item
            name="enabled"
            label="启用中转"
            valuePropName="checked"
            extra="停用后停止定时抓取和链接访问，保留已有缓存。"
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </ConsolePage>
  );
};

export default RSSRelayPage;
