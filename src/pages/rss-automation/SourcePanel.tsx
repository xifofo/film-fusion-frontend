import {
  DeleteOutlined,
  EditOutlined,
  ExperimentOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {
  Alert,
  AutoComplete,
  Button,
  Card,
  Col,
  Collapse,
  Form,
  Input,
  InputNumber,
  Modal,
  message,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useState } from 'react';
import type {
  RSSAutomationMapping,
  RSSAutomationParsedFeed,
  RSSAutomationSource,
  RSSAutomationSourceInput,
} from '@/services/film-fusion';
import {
  DEFAULT_RSS_AUTOMATION_MAPPING,
  deleteRSSAutomation,
  refreshRSSAutomation,
  sampleRSSAutomationSource,
  updateRSSAutomationSource,
} from '@/services/film-fusion';
import styles from './index.module.less';

const { Paragraph, Text } = Typography;

type SourcePanelProps = {
  sources: RSSAutomationSource[];
  loading: boolean;
  onChanged: () => Promise<void> | void;
};

const parseMapping = (raw?: string): RSSAutomationMapping => {
  try {
    const value = JSON.parse(raw || '') as RSSAutomationMapping;
    return value?.fields
      ? value
      : structuredClone(DEFAULT_RSS_AUTOMATION_MAPPING);
  } catch {
    return structuredClone(DEFAULT_RSS_AUTOMATION_MAPPING);
  }
};

const sourceInput = (
  source: RSSAutomationSource,
): RSSAutomationSourceInput => ({
  name: source.name,
  enabled: source.enabled,
  feed_url: source.feed_url,
  interval_minutes: source.interval_minutes,
  mapping: parseMapping(source.mapping_json),
});

const SourcePanel = ({ sources, loading, onChanged }: SourcePanelProps) => {
  const [form] = Form.useForm<RSSAutomationSourceInput>();
  const [editing, setEditing] = useState<RSSAutomationSource>();
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sampling, setSampling] = useState(false);
  const [sample, setSample] = useState<RSSAutomationParsedFeed>();
  const [refreshingId, setRefreshingId] = useState<number>();
  const [messageApi, contextHolder] = message.useMessage();

  const open = (source: RSSAutomationSource) => {
    setEditing(source);
    setSample(undefined);
    setModalOpen(true);
    window.setTimeout(() => {
      form.setFieldsValue(sourceInput(source));
    });
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const values = await form.validateFields();
      const response = await updateRSSAutomationSource(editing.id, values);
      if (response.code !== 0) throw new Error(response.message);
      messageApi.success('RSS 自动化已更新');
      setModalOpen(false);
      await onChanged();
    } catch (error: any) {
      if (!error?.errorFields) {
        messageApi.error(error?.data || error?.message || '保存自动化源失败');
      }
    } finally {
      setSaving(false);
    }
  };

  const testSample = async () => {
    setSampling(true);
    try {
      const values = await form.validateFields();
      const response = await sampleRSSAutomationSource(values);
      if (response.code !== 0 || !response.data) {
        throw new Error(response.message || '样本解析失败');
      }
      setSample(response.data);
      messageApi.success(`已解析 ${response.data.items.length} 条样本`);
    } catch (error: any) {
      if (!error?.errorFields) {
        messageApi.error(error?.data || error?.message || '样本解析失败');
      }
    } finally {
      setSampling(false);
    }
  };

  const toggle = async (source: RSSAutomationSource, enabled: boolean) => {
    try {
      const response = await updateRSSAutomationSource(source.id, {
        ...sourceInput(source),
        enabled,
      });
      if (response.code !== 0) throw new Error(response.message);
      await onChanged();
    } catch (error: any) {
      messageApi.error(error?.data || error?.message || '更新自动化源失败');
    }
  };

  const remove = async (source: RSSAutomationSource) => {
    try {
      const response = await deleteRSSAutomation(source.id);
      if (response.code !== 0) throw new Error(response.message);
      messageApi.success('RSS 自动化及其流程已删除');
      await onChanged();
    } catch (error: any) {
      messageApi.error(error?.data || error?.message || '删除自动化源失败');
    }
  };

  const refresh = async (source: RSSAutomationSource) => {
    setRefreshingId(source.id);
    try {
      const response = await refreshRSSAutomation(source.id);
      if (response.code !== 0) throw new Error(response.message);
      messageApi.success(
        source.initialized
          ? '刷新完成，新条目已进入匹配流程'
          : '首次基线已建立；基线条目不会执行动作',
      );
      await onChanged();
    } catch (error: any) {
      messageApi.error(error?.data || error?.message || '刷新失败');
    } finally {
      setRefreshingId(undefined);
    }
  };

  const columns: ColumnsType<RSSAutomationSource> = [
    {
      title: '名称',
      dataIndex: 'name',
      render: (_, source) => (
        <Space direction="vertical" size={0}>
          <Text strong>{source.name}</Text>
          <Text copyable ellipsis type="secondary">
            {source.feed_url}
          </Text>
        </Space>
      ),
    },
    {
      title: '状态',
      width: 150,
      render: (_, source) => (
        <Space>
          <Switch
            checked={source.enabled}
            onChange={(enabled) => toggle(source, enabled)}
            size="small"
          />
          <Tag color={source.initialized ? 'success' : 'processing'}>
            {source.initialized ? '增量监控' : '待建基线'}
          </Tag>
        </Space>
      ),
    },
    {
      title: '间隔',
      dataIndex: 'interval_minutes',
      width: 90,
      render: (value: number) => `${value} 分钟`,
    },
    {
      title: '最近检查',
      dataIndex: 'last_checked_at',
      width: 175,
      render: (value?: string) =>
        value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
    {
      title: '结果',
      width: 180,
      render: (_, source) =>
        source.last_error ? (
          <Tooltip title={source.last_error}>
            <Tag color="error">刷新失败</Tag>
          </Tooltip>
        ) : source.last_success_at ? (
          <Tag color="success">正常</Tag>
        ) : (
          <Tag>未刷新</Tag>
        ),
    },
    {
      title: '操作',
      key: 'actions',
      fixed: 'right',
      width: 180,
      render: (_, source) => (
        <Space>
          <Tooltip title="立即刷新">
            <Button
              icon={<ReloadOutlined />}
              loading={refreshingId === source.id}
              onClick={() => refresh(source)}
              size="small"
            />
          </Tooltip>
          <Button
            aria-label={`编辑 RSS 设置 ${source.name}`}
            icon={<EditOutlined />}
            onClick={() => open(source)}
            size="small"
          >
            编辑
          </Button>
          <Popconfirm
            description="RSS 源和唯一流程会一起删除，历史运行记录仍会保留。"
            onConfirm={() => remove(source)}
            title="删除这个 RSS 自动化？"
          >
            <Button danger icon={<DeleteOutlined />} size="small" />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const selectorOptions = (sample?.selectors || []).map((selector) => ({
    label: selector,
    value: selector,
  }));

  return (
    <>
      {contextHolder}
      <Card
        extra={<Tag color="blue">1 个 RSS = 1 个流程</Tag>}
        title="RSS / Atom 配置"
      >
        <Alert
          className={styles.panelAlert}
          message="RSS 源与流程一一绑定；新建请使用自动化向导。首次刷新只建立基线，之后的新条目才会进入唯一流程。"
          showIcon
          type="info"
        />
        <Table
          columns={columns}
          dataSource={sources}
          loading={loading}
          pagination={false}
          rowKey="id"
          scroll={{ x: 1000 }}
        />
      </Card>

      <Modal
        cancelText="取消"
        destroyOnHidden
        maskClosable={false}
        okButtonProps={{ loading: saving }}
        okText="保存自动化"
        onCancel={() => setModalOpen(false)}
        onOk={save}
        open={modalOpen}
        title="编辑 RSS 自动化"
        width={1050}
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                label="源名称"
                name="name"
                rules={[{ required: true }]}
              >
                <Input placeholder="动画更新" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="RSS 地址"
                name="feed_url"
                rules={[{ required: true, type: 'url' }]}
              >
                <Input placeholder="https://example.com/rss.xml" />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item
                label="刷新间隔"
                name="interval_minutes"
                rules={[{ required: true }]}
              >
                <InputNumber addonAfter="分钟" max={1440} min={1} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="启用自动化" name="enabled" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Card
            extra={
              <Button
                icon={<ExperimentOutlined />}
                loading={sampling}
                onClick={testSample}
              >
                拉取样本并预览
              </Button>
            }
            size="small"
            title="XML 字段映射"
          >
            <Form.Item
              label="条目节点路径"
              name={['mapping', 'item_selector']}
              rules={[{ required: true }]}
              extra="RSS 2.0 通常是 channel/item；Atom 通常是 entry。命名空间前缀可省略。"
            >
              <Input placeholder="channel/item" />
            </Form.Item>
            <Form.List name={['mapping', 'fields']}>
              {(fields, { add, remove }) => (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  {fields.map((field, index) => (
                    <Card
                      extra={
                        <Button
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => remove(field.name)}
                          size="small"
                          type="text"
                        />
                      }
                      key={field.key}
                      size="small"
                      title={`字段 ${index + 1}`}
                    >
                      <Row gutter={12}>
                        <Col span={5}>
                          <Form.Item
                            label="字段名"
                            name={[field.name, 'name']}
                            rules={[{ required: true }]}
                          >
                            <Input placeholder="download_url" />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item
                            label="节点 / 属性选择器"
                            name={[field.name, 'selector']}
                            rules={[{ required: true }]}
                          >
                            <AutoComplete
                              options={selectorOptions}
                              placeholder="enclosure@url"
                            />
                          </Form.Item>
                        </Col>
                        <Col span={4}>
                          <Form.Item label="值类型" name={[field.name, 'type']}>
                            <Select
                              options={[
                                'string',
                                'integer',
                                'number',
                                'boolean',
                                'datetime',
                              ].map((value) => ({ label: value, value }))}
                            />
                          </Form.Item>
                        </Col>
                        <Col span={3}>
                          <Form.Item
                            label="必填"
                            name={[field.name, 'required']}
                            valuePropName="checked"
                          >
                            <Switch />
                          </Form.Item>
                        </Col>
                        <Col span={4}>
                          <Form.Item
                            label="收集多个值"
                            name={[field.name, 'multiple']}
                            valuePropName="checked"
                          >
                            <Switch />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Row gutter={12}>
                        <Col span={6}>
                          <Form.Item
                            label="筛选属性"
                            name={[field.name, 'match_attribute']}
                          >
                            <Input placeholder="rel / type" />
                          </Form.Item>
                        </Col>
                        <Col span={10}>
                          <Form.Item
                            label="属性值正则"
                            name={[field.name, 'match_pattern']}
                          >
                            <Input placeholder="^enclosure$" />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item
                            label="多值连接符"
                            name={[field.name, 'join_with']}
                          >
                            <Input placeholder=", " />
                          </Form.Item>
                        </Col>
                      </Row>
                    </Card>
                  ))}
                  <Button
                    block
                    icon={<PlusOutlined />}
                    onClick={() =>
                      add({ name: '', selector: '', type: 'string' })
                    }
                    type="dashed"
                  >
                    添加映射字段
                  </Button>
                </Space>
              )}
            </Form.List>
          </Card>
          {sample && (
            <Collapse
              className={styles.samplePreview}
              defaultActiveKey={['preview']}
              items={[
                {
                  key: 'preview',
                  label: `样本预览 · ${sample.title || '未命名源'} · ${sample.items.length} 条`,
                  children: (
                    <>
                      {(sample.items[0]?.errors?.length || 0) > 0 && (
                        <Alert
                          message={sample.items[0].errors?.join('；')}
                          type="warning"
                        />
                      )}
                      <Paragraph>
                        <pre className={styles.jsonPreview}>
                          {JSON.stringify(
                            sample.items[0]?.fields || {},
                            null,
                            2,
                          )}
                        </pre>
                      </Paragraph>
                      <Text type="secondary">
                        已发现 {sample.selectors?.length || 0}{' '}
                        个可选节点/属性，已加入选择器输入提示。
                      </Text>
                    </>
                  ),
                },
              ]}
            />
          )}
        </Form>
      </Modal>
    </>
  );
};

export default SourcePanel;
