import {
  DeleteOutlined,
  EditOutlined,
  ExperimentOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import {
  Alert,
  Badge,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  message,
  Popconfirm,
  Space,
  Statistic,
  Switch,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useState } from 'react';
import {
  createRSSRule,
  createRSSSource,
  deleteRSSRule,
  deleteRSSSource,
  getRSSMonitorDashboard,
  refreshRSSMonitor,
  testRSSRule,
  updateRSSRule,
  updateRSSSource,
} from '@/services/film-fusion';
import styles from './index.module.less';

const { Text, Link } = Typography;

const DEFAULT_TEMPLATE =
  '{{media_title}} ({{media_year}}) {{season_episode}} 新资源上线\n评分：{{rating}}，类型：{{media_type}}，类别：{{media_category}}\n质量：{{quality}}，共{{file_count}}个文件，大小：{{size}}\n{{link}}';

const TEMPLATE_PLACEHOLDERS = [
  '{{media_title}}',
  '{{media_year}}',
  '{{media_type}}',
  '{{media_category}}',
  '{{season_episode}}',
  '{{rating}}',
  '{{quality}}',
  '{{file_count}}',
  '{{tmdb_id}}',
  '{{poster_url}}',
  '{{title}}',
  '{{category}}',
  '{{size}}',
  '{{pub_date}}',
  '{{link}}',
  '{{rule_name}}',
];

type RuleFormValues = API.RSSNotificationRuleInput & {
  sample_title: string;
  sample_category: string;
};

const formatDateTime = (value?: string) =>
  value && dayjs(value).isValid()
    ? dayjs(value).format('YYYY-MM-DD HH:mm:ss')
    : '-';

const formatSize = (bytes?: number) => {
  if (!bytes || bytes <= 0) return '-';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(2)} ${units[unit]}`;
};

const notificationTag = (item: API.RSSMonitorItem) => {
  switch (item.notification_status) {
    case 'sent':
      return <Tag color="success">已推送</Tag>;
    case 'failed':
      return (
        <Tooltip title={item.notification_error || '推送失败'}>
          <Tag color="error">推送失败</Tag>
        </Tooltip>
      );
    case 'baseline':
      return <Tag color="processing">基线</Tag>;
    default:
      return <Tag>未命中</Tag>;
  }
};

const recognizedMediaLabel = (item: API.RSSMonitorItem) => {
  if (!item.media_title) return undefined;
  const year = item.media_year ? ` (${item.media_year})` : '';
  const seasonEpisode = item.season_episode ? ` ${item.season_episode}` : '';
  return `${item.media_title}${year}${seasonEpisode}`;
};

const RSSMonitorPage: React.FC = () => {
  const [dashboard, setDashboard] = useState<API.RSSMonitorDashboard>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sourceModalOpen, setSourceModalOpen] = useState(false);
  const [sourceSaving, setSourceSaving] = useState(false);
  const [editingSource, setEditingSource] = useState<API.RSSMonitorSettings>();
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [ruleSaving, setRuleSaving] = useState(false);
  const [ruleTesting, setRuleTesting] = useState(false);
  const [editingRule, setEditingRule] = useState<API.RSSNotificationRule>();
  const [rulePreview, setRulePreview] = useState<string>();
  const [sourceForm] = Form.useForm<API.RSSMonitorSettingsInput>();
  const [ruleForm] = Form.useForm<RuleFormValues>();
  const [messageApi, contextHolder] = message.useMessage();

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const response = await getRSSMonitorDashboard();
        if (response.code !== 0 || !response.data) {
          throw new Error(response.message || '获取 RSS 监控信息失败');
        }
        setDashboard(response.data);
      } catch (error: any) {
        if (!silent)
          messageApi.error(error?.message || '获取 RSS 监控信息失败');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [messageApi],
  );

  useEffect(() => {
    load();
    const timer = window.setInterval(() => load(true), 15000);
    return () => window.clearInterval(timer);
  }, [load]);

  const openSourceModal = (source?: API.RSSMonitorSettings) => {
    setEditingSource(source);
    setSourceModalOpen(true);
    window.setTimeout(() => {
      sourceForm.setFieldsValue({
        enabled: source?.enabled ?? true,
        feed_name: source?.feed_name || '',
        feed_url: source?.feed_url || '',
        interval_minutes: source?.interval_minutes || 2,
      });
    });
  };

  const saveSource = async () => {
    setSourceSaving(true);
    try {
      const values = await sourceForm.validateFields();
      const response = editingSource
        ? await updateRSSSource(editingSource.id, values)
        : await createRSSSource(values);
      if (response.code !== 0) throw new Error(response.message);
      messageApi.success(editingSource ? 'RSS 源已更新' : 'RSS 源已添加');
      setSourceModalOpen(false);
      await load(true);
    } catch (error: any) {
      if (error?.errorFields) return;
      messageApi.error(error?.data || error?.message || '保存 RSS 源失败');
    } finally {
      setSourceSaving(false);
    }
  };

  const toggleSource = async (
    source: API.RSSMonitorSettings,
    enabled: boolean,
  ) => {
    try {
      const response = await updateRSSSource(source.id, { ...source, enabled });
      if (response.code !== 0) throw new Error(response.message);
      await load(true);
    } catch (error: any) {
      messageApi.error(error?.data || error?.message || '更新 RSS 源失败');
    }
  };

  const removeSource = async (id: number) => {
    try {
      const response = await deleteRSSSource(id);
      if (response.code !== 0) throw new Error(response.message);
      messageApi.success('RSS 源已删除');
      await load(true);
    } catch (error: any) {
      messageApi.error(error?.data || error?.message || '删除 RSS 源失败');
    }
  };

  const runRefresh = async () => {
    setRefreshing(true);
    try {
      const response = await refreshRSSMonitor();
      if (response.code !== 0 || !response.data) {
        throw new Error(response.message || '刷新失败');
      }
      const result = response.data;
      if (result.failed_sources) {
        messageApi.warning(
          `刷新完成：发现 ${result.new_items} 条，${result.failed_sources} 个源失败`,
        );
      } else if (result.baseline) {
        messageApi.success(`基线已建立，共记录 ${result.new_items} 条`);
      } else if (result.not_modified) {
        messageApi.info('RSS 内容未变化');
      } else {
        messageApi.success(
          `发现 ${result.new_items} 条，命中 ${result.matched} 条，推送 ${result.notified} 条`,
        );
      }
      await load(true);
    } catch (error: any) {
      messageApi.error(error?.data || error?.message || '刷新失败');
    } finally {
      setRefreshing(false);
    }
  };

  const openRuleModal = (rule?: API.RSSNotificationRule) => {
    setEditingRule(rule);
    setRulePreview(undefined);
    setRuleModalOpen(true);
    window.setTimeout(() => {
      ruleForm.setFieldsValue({
        name: rule?.name || '',
        enabled: rule?.enabled ?? true,
        use_mp2_recognition: rule?.use_mp2_recognition ?? true,
        priority: rule?.priority ?? 100,
        title_pattern: rule?.title_pattern || '',
        category_pattern: rule?.category_pattern || '',
        message_template: rule?.message_template || DEFAULT_TEMPLATE,
        sample_title: 'New Show S01E01 2160p WEB-DL',
        sample_category: '剧集',
      });
    });
  };

  const rulePayload = (
    values: RuleFormValues,
  ): API.RSSNotificationRuleInput => ({
    name: values.name,
    enabled: values.enabled,
    use_mp2_recognition: values.use_mp2_recognition,
    priority: values.priority,
    title_pattern: values.title_pattern,
    category_pattern: values.category_pattern,
    message_template: values.message_template,
  });

  const saveRule = async () => {
    setRuleSaving(true);
    try {
      const values = await ruleForm.validateFields([
        'name',
        'enabled',
        'use_mp2_recognition',
        'priority',
        'title_pattern',
        'category_pattern',
        'message_template',
      ]);
      const response = editingRule
        ? await updateRSSRule(
            editingRule.id,
            rulePayload(values as RuleFormValues),
          )
        : await createRSSRule(rulePayload(values as RuleFormValues));
      if (response.code !== 0) throw new Error(response.message);
      messageApi.success(editingRule ? '规则已更新' : '规则已创建');
      setRuleModalOpen(false);
      await load(true);
    } catch (error: any) {
      if (error?.errorFields) return;
      messageApi.error(error?.data || error?.message || '保存规则失败');
    } finally {
      setRuleSaving(false);
    }
  };

  const testRule = async () => {
    setRuleTesting(true);
    try {
      const values = await ruleForm.validateFields();
      const response = await testRSSRule({
        rule: rulePayload(values),
        title: values.sample_title,
        category: values.sample_category,
      });
      if (response.code !== 0 || !response.data) {
        throw new Error(response.message || '规则测试失败');
      }
      if (response.data.matched) {
        setRulePreview(response.data.preview || '命中');
        messageApi.success('测试样例命中规则');
      } else {
        setRulePreview(undefined);
        messageApi.warning('测试样例未命中');
      }
    } catch (error: any) {
      if (error?.errorFields) return;
      messageApi.error(error?.data || error?.message || '规则测试失败');
    } finally {
      setRuleTesting(false);
    }
  };

  const toggleRule = async (
    rule: API.RSSNotificationRule,
    enabled: boolean,
  ) => {
    try {
      const response = await updateRSSRule(rule.id, { ...rule, enabled });
      if (response.code !== 0) throw new Error(response.message);
      await load(true);
    } catch (error: any) {
      messageApi.error(error?.data || error?.message || '更新规则失败');
    }
  };

  const removeRule = async (id: number) => {
    try {
      const response = await deleteRSSRule(id);
      if (response.code !== 0) throw new Error(response.message);
      messageApi.success('规则已删除');
      await load(true);
    } catch (error: any) {
      messageApi.error(error?.data || error?.message || '删除规则失败');
    }
  };

  const sourceColumns: ColumnsType<API.RSSMonitorSettings> = [
    {
      title: 'RSS 源',
      dataIndex: 'feed_name',
      render: (_, source) => (
        <div className={styles.sourceContent}>
          <Space size={8}>
            <Badge status={source.enabled ? 'processing' : 'default'} />
            <Text strong>{source.feed_name}</Text>
          </Space>
          <Tooltip title={source.feed_url}>
            <div className={styles.sourceUrl}>{source.feed_url}</div>
          </Tooltip>
          {source.last_error ? (
            <Tooltip title={source.last_error}>
              <div className={styles.sourceError}>{source.last_error}</div>
            </Tooltip>
          ) : (
            <div className={styles.sourceMeta}>
              最近检查 {formatDateTime(source.last_checked_at)}
            </div>
          )}
        </div>
      ),
    },
    {
      title: '间隔',
      dataIndex: 'interval_minutes',
      width: 80,
      render: (value) => `${value} 分钟`,
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      width: 64,
      render: (_, source) => (
        <Switch
          size="small"
          checked={source.enabled}
          onChange={(checked) => toggleSource(source, checked)}
          aria-label={`${source.feed_name}启用状态`}
        />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 88,
      render: (_, source) => (
        <Space size={4}>
          <Tooltip title="编辑 RSS 源">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => openSourceModal(source)}
              aria-label="编辑 RSS 源"
            />
          </Tooltip>
          <Popconfirm
            title="删除这个 RSS 源？"
            description="历史事件会保留。"
            okText="删除"
            okButtonProps={{ danger: true }}
            cancelText="取消"
            onConfirm={() => removeSource(source.id)}
          >
            <Tooltip title="删除 RSS 源">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                aria-label="删除 RSS 源"
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const ruleColumns: ColumnsType<API.RSSNotificationRule> = [
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 82,
      sorter: (a, b) => a.priority - b.priority,
    },
    {
      title: '规则',
      dataIndex: 'name',
      width: 180,
      render: (_, rule) => (
        <Space size={8}>
          <Badge status={rule.enabled ? 'success' : 'default'} />
          <Text strong>{rule.name}</Text>
        </Space>
      ),
    },
    {
      title: '标题正则',
      dataIndex: 'title_pattern',
      ellipsis: true,
      render: (value) => (
        <Tooltip title={value}>
          <code className={styles.pattern}>{value}</code>
        </Tooltip>
      ),
    },
    {
      title: '分类正则',
      dataIndex: 'category_pattern',
      width: 160,
      ellipsis: true,
      render: (value) => value || <Text type="secondary">全部</Text>,
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      width: 72,
      render: (_, rule) => (
        <Switch
          size="small"
          checked={rule.enabled}
          onChange={(checked) => toggleRule(rule, checked)}
          aria-label={`${rule.name}启用状态`}
        />
      ),
    },
    {
      title: 'MP2',
      dataIndex: 'use_mp2_recognition',
      width: 72,
      render: (value) =>
        value ? (
          <Tag color="processing">识别</Tag>
        ) : (
          <Text type="secondary">关闭</Text>
        ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 88,
      fixed: 'right',
      render: (_, rule) => (
        <Space size={4}>
          <Tooltip title="编辑规则">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => openRuleModal(rule)}
              aria-label="编辑规则"
            />
          </Tooltip>
          <Popconfirm
            title="删除这条规则？"
            okText="删除"
            okButtonProps={{ danger: true }}
            cancelText="取消"
            onConfirm={() => removeRule(rule.id)}
          >
            <Tooltip title="删除规则">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                aria-label="删除规则"
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const eventColumns: ColumnsType<API.RSSMonitorItem> = [
    {
      title: 'RSS 条目',
      dataIndex: 'title',
      render: (_, item) => (
        <div className={styles.eventContent}>
          {item.link ? (
            <Link
              className={styles.eventTitle}
              href={item.link}
              target="_blank"
              rel="noreferrer"
            >
              {item.title}
            </Link>
          ) : (
            <span className={styles.eventTitle}>{item.title}</span>
          )}
          <div className={styles.eventMeta}>
            {[item.category || '未分类', formatSize(item.size_bytes)]
              .filter(Boolean)
              .join(' · ')}
          </div>
          {recognizedMediaLabel(item) ? (
            <Tooltip
              title={item.recognition_error || recognizedMediaLabel(item)}
            >
              <div className={styles.recognitionMeta}>
                识别：{recognizedMediaLabel(item)}
              </div>
            </Tooltip>
          ) : item.recognition_error ? (
            <Tooltip title={item.recognition_error}>
              <div className={styles.recognitionMuted}>MP2 未识别</div>
            </Tooltip>
          ) : null}
        </div>
      ),
    },
    {
      title: '来源',
      dataIndex: 'source_name',
      width: 140,
      render: (value) => value || <Text type="secondary">历史源</Text>,
    },
    {
      title: '规则',
      dataIndex: 'rule_name',
      width: 150,
      render: (value) => value || <Text type="secondary">未命中</Text>,
    },
    {
      title: '状态',
      dataIndex: 'notification_status',
      width: 104,
      render: (_, item) => notificationTag(item),
    },
    {
      title: '发现时间',
      dataIndex: 'discovered_at',
      width: 172,
      render: (value) => formatDateTime(value),
    },
  ];

  const sources = dashboard?.sources || [];
  const enabledSourceCount = sources.filter((source) => source.enabled).length;
  const failedSourceCount = sources.filter(
    (source) => source.last_error,
  ).length;
  const recentItems = dashboard?.recent_items || [];
  const recentMatchedItems = dashboard?.recent_matched_items || [];
  const eventTable = (items: API.RSSMonitorItem[], emptyText: string) => (
    <Table
      rowKey="id"
      size="small"
      columns={eventColumns}
      dataSource={items}
      pagination={{ pageSize: 10, showSizeChanger: false }}
      scroll={{ x: 900 }}
      locale={{ emptyText }}
    />
  );

  return (
    <PageContainer
      header={{ title: 'RSS 监控' }}
      extra={[
        <Button
          key="refresh"
          icon={<ReloadOutlined />}
          loading={refreshing || dashboard?.running}
          onClick={runRefresh}
        >
          立即刷新
        </Button>,
        <Button
          key="source"
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => openSourceModal()}
        >
          添加 RSS 源
        </Button>,
        <Button
          key="rule"
          icon={<PlusOutlined />}
          onClick={() => openRuleModal()}
        >
          新建规则
        </Button>,
      ]}
      loading={loading}
    >
      {contextHolder}
      <section className={styles.statusStrip} aria-label="RSS 监控状态">
        <div className={`${styles.statusCell} ${styles.statusPrimary}`}>
          <div className={styles.statusName}>
            {sources.length ? `${sources.length} 个 RSS 源` : '未配置 RSS 源'}
          </div>
          <div>
            <Badge
              status={enabledSourceCount ? 'processing' : 'default'}
              text={enabledSourceCount ? '监控中' : '已停用'}
            />
            <div className={styles.statusMeta}>
              {enabledSourceCount} 个源已启用
            </div>
          </div>
        </div>
        <div className={styles.statusCell}>
          <Statistic
            title="启用源"
            value={enabledSourceCount}
            suffix={`/ ${sources.length}`}
          />
        </div>
        <div className={styles.statusCell}>
          <Statistic title="已记录" value={dashboard?.total_seen || 0} />
        </div>
        <div className={styles.statusCell}>
          <Statistic title="已推送" value={dashboard?.total_notified || 0} />
        </div>
      </section>

      {failedSourceCount > 0 && (
        <Alert
          type="error"
          showIcon
          message={`${failedSourceCount} 个 RSS 源最近刷新失败`}
          description="可在 RSS 源列表中查看具体错误。"
          style={{ marginBottom: 16 }}
        />
      )}
      {dashboard && !dashboard.telegram_ready && (
        <Alert
          type="warning"
          showIcon
          message="Telegram 通知尚未就绪"
          action={
            <Button type="link" href="/system-settings">
              打开系统设置
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      <div className={styles.workspace}>
        <Card
          title={
            <div className={styles.panelTitle}>
              <span>RSS 源</span>
              <Button
                type="link"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => openSourceModal()}
              >
                添加
              </Button>
            </div>
          }
          size="small"
        >
          <Table
            rowKey="id"
            size="small"
            columns={sourceColumns}
            dataSource={sources}
            pagination={false}
            scroll={{ x: 620 }}
            locale={{ emptyText: '暂无 RSS 源' }}
          />
        </Card>

        <Card
          size="small"
          title={
            <div className={styles.panelTitle}>
              <span>通知规则</span>
              <Text type="secondary">优先级从小到大</Text>
            </div>
          }
        >
          <Table
            rowKey="id"
            size="small"
            columns={ruleColumns}
            dataSource={dashboard?.rules || []}
            pagination={false}
            scroll={{ x: 832 }}
          />
        </Card>
      </div>

      <Card
        size="small"
        title={
          <div className={styles.eventPanelTitle}>
            <span>最近事件</span>
            <Text type="secondary" className={styles.retentionHint}>
              存入数据库；刷新时自动保留最近{' '}
              {(dashboard?.retention_limit || 5000).toLocaleString()} 条
            </Text>
          </div>
        }
      >
        <Tabs
          defaultActiveKey="matched"
          className={styles.eventTabs}
          items={[
            {
              key: 'matched',
              label: '命中规则',
              children: eventTable(recentMatchedItems, '暂无命中规则的事件'),
            },
            {
              key: 'all',
              label: '所有事件',
              children: eventTable(recentItems, '暂无 RSS 事件'),
            },
          ]}
        />
      </Card>

      <Modal
        title={editingSource ? '编辑 RSS 源' : '添加 RSS 源'}
        open={sourceModalOpen}
        destroyOnHidden
        okText="保存"
        cancelText="取消"
        confirmLoading={sourceSaving}
        onOk={saveSource}
        onCancel={() => setSourceModalOpen(false)}
      >
        <Form
          form={sourceForm}
          layout="vertical"
          requiredMark={false}
          preserve={false}
        >
          <Form.Item name="enabled" label="监控状态" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
          <Form.Item
            name="feed_name"
            label="源名称"
            rules={[{ required: true, message: '请输入源名称' }]}
          >
            <Input placeholder="Torrent RSS" maxLength={120} />
          </Form.Item>
          <Form.Item
            name="feed_url"
            label="RSS 地址"
            rules={[
              { required: true, message: '请输入 RSS 地址' },
              { type: 'url', message: '请输入有效的 URL' },
            ]}
          >
            <Input.Password
              placeholder="https://example.com/torrentrss.php?..."
              autoComplete="off"
            />
          </Form.Item>
          <Form.Item
            name="interval_minutes"
            label="刷新间隔"
            rules={[{ required: true, message: '请输入刷新间隔' }]}
          >
            <InputNumber
              min={1}
              max={1440}
              precision={0}
              addonAfter="分钟"
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingRule ? '编辑通知规则' : '新建通知规则'}
        open={ruleModalOpen}
        width={720}
        destroyOnHidden
        okText="保存规则"
        cancelText="取消"
        confirmLoading={ruleSaving}
        onOk={saveRule}
        onCancel={() => setRuleModalOpen(false)}
        footer={(_, { OkBtn, CancelBtn }) => (
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Button
              icon={<ExperimentOutlined />}
              loading={ruleTesting}
              onClick={testRule}
            >
              测试样例
            </Button>
            <Space>
              <CancelBtn />
              <OkBtn />
            </Space>
          </Space>
        )}
      >
        <Form
          form={ruleForm}
          layout="vertical"
          requiredMark={false}
          preserve={false}
        >
          <Space align="start" wrap style={{ width: '100%' }}>
            <Form.Item
              name="name"
              label="规则名称"
              rules={[{ required: true, message: '请输入规则名称' }]}
            >
              <Input style={{ width: 260 }} maxLength={120} />
            </Form.Item>
            <Form.Item
              name="priority"
              label="优先级"
              rules={[{ required: true }]}
            >
              <InputNumber min={0} max={10000} precision={0} />
            </Form.Item>
            <Form.Item name="enabled" label="状态" valuePropName="checked">
              <Switch checkedChildren="启用" unCheckedChildren="停用" />
            </Form.Item>
            <Form.Item
              name="use_mp2_recognition"
              label="MP2 媒体识别"
              valuePropName="checked"
            >
              <Switch checkedChildren="开启" unCheckedChildren="关闭" />
            </Form.Item>
          </Space>
          <Form.Item
            name="title_pattern"
            label="标题正则"
            rules={[{ required: true, message: '请输入标题正则' }]}
          >
            <Input placeholder="(?i)S[0-9]{1,2}E0*1" />
          </Form.Item>
          <Form.Item name="category_pattern" label="分类正则">
            <Input placeholder="剧集|电视剧|TV" />
          </Form.Item>
          <Form.Item
            name="message_template"
            label="消息模板"
            rules={[{ required: true, message: '请输入消息模板' }]}
          >
            <Input.TextArea
              autoSize={{ minRows: 5, maxRows: 9 }}
              placeholder={DEFAULT_TEMPLATE}
            />
          </Form.Item>
          <div className={styles.placeholderHint}>
            <Text type="secondary">可用占位符：</Text>
            {TEMPLATE_PLACEHOLDERS.map((placeholder) => (
              <code key={placeholder}>{placeholder}</code>
            ))}
          </div>
          <Space align="start" wrap style={{ width: '100%' }}>
            <Form.Item
              name="sample_title"
              label="样例标题"
              rules={[{ required: true, message: '请输入样例标题' }]}
            >
              <Input style={{ width: 'min(420px, calc(100vw - 96px))' }} />
            </Form.Item>
            <Form.Item name="sample_category" label="样例分类">
              <Input style={{ width: 180 }} />
            </Form.Item>
          </Space>
          {rulePreview && (
            <Alert
              type="success"
              showIcon
              message="命中预览"
              description={
                <pre className={styles.templatePreview}>{rulePreview}</pre>
              }
            />
          )}
        </Form>
      </Modal>
    </PageContainer>
  );
};

export default RSSMonitorPage;
