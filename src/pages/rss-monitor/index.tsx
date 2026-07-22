import {
  DeleteOutlined,
  EditOutlined,
  ExperimentOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
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
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  createRSSRule,
  deleteRSSRule,
  getRSSMonitorDashboard,
  refreshRSSMonitor,
  saveRSSMonitorSettings,
  testRSSRule,
  updateRSSRule,
} from '@/services/film-fusion';
import styles from './index.less';

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
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [ruleSaving, setRuleSaving] = useState(false);
  const [ruleTesting, setRuleTesting] = useState(false);
  const [editingRule, setEditingRule] = useState<API.RSSNotificationRule>();
  const [rulePreview, setRulePreview] = useState<string>();
  const [settingsForm] = Form.useForm<API.RSSMonitorSettingsInput>();
  const [ruleForm] = Form.useForm<RuleFormValues>();
  const [messageApi, contextHolder] = message.useMessage();
  const settingsHydrated = useRef(false);

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
    [messageApi, settingsForm],
  );

  useEffect(() => {
    load();
    const timer = window.setInterval(() => load(true), 15000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!dashboard?.settings || settingsHydrated.current) return;
    settingsForm.setFieldsValue({
      enabled: dashboard.settings.enabled,
      feed_name: dashboard.settings.feed_name,
      feed_url: dashboard.settings.feed_url,
      interval_minutes: dashboard.settings.interval_minutes,
    });
    settingsHydrated.current = true;
  }, [dashboard?.settings, settingsForm]);

  const saveSettings = async (values: API.RSSMonitorSettingsInput) => {
    setSaving(true);
    try {
      const response = await saveRSSMonitorSettings(values);
      if (response.code !== 0) throw new Error(response.message);
      if (response.data) {
        settingsForm.setFieldsValue({
          enabled: response.data.enabled,
          feed_name: response.data.feed_name,
          feed_url: response.data.feed_url,
          interval_minutes: response.data.interval_minutes,
        });
      }
      messageApi.success('RSS 监控配置已保存');
      await load(true);
    } catch (error: any) {
      messageApi.error(error?.data || error?.message || '保存失败');
    } finally {
      setSaving(false);
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
      if (result.baseline) {
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

  const settings = dashboard?.settings;

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
          key="rule"
          type="primary"
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
          <div className={styles.statusName} title={settings?.feed_name}>
            {settings?.feed_name || '未配置 RSS 源'}
          </div>
          <div>
            <Badge
              status={settings?.enabled ? 'processing' : 'default'}
              text={settings?.enabled ? '监控中' : '已停用'}
            />
            <div className={styles.statusMeta}>
              最近检查 {formatDateTime(settings?.last_checked_at)}
            </div>
          </div>
        </div>
        <div className={styles.statusCell}>
          <Statistic
            title="刷新间隔"
            value={settings?.interval_minutes || 2}
            suffix="分钟"
          />
        </div>
        <div className={styles.statusCell}>
          <Statistic title="已记录" value={dashboard?.total_seen || 0} />
        </div>
        <div className={styles.statusCell}>
          <Statistic title="已推送" value={dashboard?.total_notified || 0} />
        </div>
      </section>

      {settings?.last_error && (
        <Alert
          type="error"
          showIcon
          closable
          message="最近一次刷新失败"
          description={settings.last_error}
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
        <Card title="监控配置" size="small">
          <Form
            form={settingsForm}
            layout="vertical"
            onFinish={saveSettings}
            requiredMark={false}
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
              rules={[{ type: 'url', message: '请输入有效的 URL' }]}
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
            <Button
              block
              type="primary"
              htmlType="submit"
              icon={<SaveOutlined />}
              loading={saving}
            >
              保存配置
            </Button>
          </Form>
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

      <Card size="small" title="最近事件">
        <Table
          rowKey="id"
          size="small"
          columns={eventColumns}
          dataSource={dashboard?.recent_items || []}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          scroll={{ x: 760 }}
          locale={{ emptyText: '暂无 RSS 事件' }}
        />
      </Card>

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
