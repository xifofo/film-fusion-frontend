import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CheckCircleFilled,
  LinkOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Col,
  Collapse,
  Descriptions,
  Form,
  Input,
  InputNumber,
  message,
  Row,
  Select,
  Space,
  Steps,
  Switch,
  Tag,
  Typography,
} from 'antd';
import { useEffect, useMemo, useState } from 'react';
import type {
  RSSAutomationCreateResult,
  RSSAutomationDefinition,
  RSSAutomationMapping,
  RSSAutomationNodeProtocol,
  RSSAutomationParsedFeed,
  RSSAutomationSourceInput,
  RSSAutomationTarget,
} from '@/services/film-fusion';
import {
  createRSSAutomation,
  DEFAULT_ATOM_AUTOMATION_MAPPING,
  DEFAULT_RSS_AUTOMATION_DEFINITION,
  DEFAULT_RSS_AUTOMATION_MAPPING,
  sampleRSSAutomationSource,
} from '@/services/film-fusion';
import { ACTION_NODE_TYPES } from './flow';
import styles from './index.module.less';
import WorkflowPanel from './WorkflowPanel';

const { Paragraph, Text, Title } = Typography;

type FeedPreset = 'auto' | 'rss' | 'atom';

type SourceStepValues = {
  feed_url: string;
  name?: string;
  interval_minutes: number;
  preset: FeedPreset;
};

type PublishStepValues = {
  name: string;
  description?: string;
  enabled: boolean;
};

type AutomationWizardProps = {
  targets: RSSAutomationTarget[];
  cloudStorages: API.CloudStorage[];
  cloudDirectories: API.CloudDirectory[];
  nodeProtocols?: RSSAutomationNodeProtocol[];
  onCancel: () => void;
  onCreated: (result: RSSAutomationCreateResult) => Promise<void> | void;
};

const mappingsForPreset = (preset: FeedPreset): RSSAutomationMapping[] => {
  if (preset === 'rss')
    return [structuredClone(DEFAULT_RSS_AUTOMATION_MAPPING)];
  if (preset === 'atom')
    return [structuredClone(DEFAULT_ATOM_AUTOMATION_MAPPING)];
  return [
    structuredClone(DEFAULT_RSS_AUTOMATION_MAPPING),
    structuredClone(DEFAULT_ATOM_AUTOMATION_MAPPING),
  ];
};

const AutomationWizard = ({
  targets,
  cloudStorages,
  cloudDirectories,
  nodeProtocols = [],
  onCancel,
  onCreated,
}: AutomationWizardProps) => {
  const [sourceForm] = Form.useForm<SourceStepValues>();
  const [publishForm] = Form.useForm<PublishStepValues>();
  const [step, setStep] = useState(0);
  const [sampling, setSampling] = useState(false);
  const [creating, setCreating] = useState(false);
  const [sample, setSample] = useState<RSSAutomationParsedFeed>();
  const [source, setSource] = useState<RSSAutomationSourceInput>();
  const [suggestedName, setSuggestedName] = useState('新的 RSS 自动化');
  const [definition, setDefinition] = useState<RSSAutomationDefinition>(() =>
    structuredClone(DEFAULT_RSS_AUTOMATION_DEFINITION),
  );
  const [selectedSample, setSelectedSample] = useState(0);
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    const frame = window.requestAnimationFrame(() =>
      window.scrollTo({ top: 0 }),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [step]);

  const selectedFields = sample?.items[selectedSample]?.fields || {};
  const actionCount = useMemo(
    () =>
      definition.nodes.filter((node) => ACTION_NODE_TYPES.includes(node.type))
        .length,
    [definition],
  );

  const parseFeed = async () => {
    let values: SourceStepValues;
    try {
      values = await sourceForm.validateFields();
    } catch {
      return;
    }
    setSampling(true);
    let lastError: unknown;
    try {
      for (const mapping of mappingsForPreset(values.preset || 'auto')) {
        const input: RSSAutomationSourceInput = {
          name: values.name?.trim() || '新的 RSS 自动化',
          enabled: true,
          feed_url: values.feed_url.trim(),
          interval_minutes: values.interval_minutes || 5,
          mapping,
        };
        try {
          const response = await sampleRSSAutomationSource(input);
          if (response.code !== 0 || !response.data) {
            throw new Error(response.message || 'RSS 解析失败');
          }
          const detectedName =
            values.name?.trim() || response.data.title || '新的 RSS 自动化';
          const resolvedSource = { ...input, name: detectedName };
          sourceForm.setFieldValue('name', detectedName);
          setSource(resolvedSource);
          setSample(response.data);
          setSelectedSample(0);
          setSuggestedName(`${detectedName}自动化`);
          messageApi.success(
            `解析成功，找到 ${response.data.items.length} 条样本`,
          );
          return;
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError || new Error('没有识别出 RSS 条目');
    } catch (error: any) {
      setSample(undefined);
      setSource(undefined);
      messageApi.error(
        error?.data || error?.message || '无法解析这个 RSS，请检查链接或格式',
      );
    } finally {
      setSampling(false);
    }
  };

  const goToDesigner = async () => {
    let values: SourceStepValues;
    try {
      values = await sourceForm.validateFields();
    } catch {
      return;
    }
    if (!source || !sample || source.feed_url !== values.feed_url.trim()) {
      messageApi.warning('RSS 链接有变化，请重新解析');
      return;
    }
    setStep(1);
  };

  const publish = async () => {
    if (!source) return;
    let values: PublishStepValues;
    try {
      values = await publishForm.validateFields();
    } catch {
      return;
    }
    if (values.enabled && actionCount === 0) {
      messageApi.warning(
        '流程还没有下载或通知动作；请返回添加动作，或先关闭“立即启用”保存为草稿',
      );
      return;
    }
    setCreating(true);
    try {
      const response = await createRSSAutomation({
        source: { ...source, enabled: values.enabled },
        workflow: {
          name: values.name.trim(),
          description: values.description?.trim() || '',
          enabled: values.enabled,
          definition,
        },
      });
      if (response.code !== 0 || !response.data) {
        throw new Error(response.message || '创建自动化失败');
      }
      messageApi.success(
        values.enabled ? '自动化已创建并启用' : '自动化草稿已保存',
      );
      await onCreated(response.data);
    } catch (error: any) {
      messageApi.error(error?.data || error?.message || '创建自动化失败');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className={styles.wizardShell}>
      {contextHolder}
      <Steps
        className={styles.wizardSteps}
        current={step}
        direction="horizontal"
        items={[
          { title: 'RSS', description: '解析真实内容' },
          { title: '流程', description: '边设计边预览' },
          { title: '启用', description: '保存自动化' },
        ]}
        responsive={false}
      />

      {step === 0 && (
        <Card className={styles.wizardStepCard}>
          <div className={styles.wizardStepIntro}>
            <div className={styles.wizardStepIcon}>
              <LinkOutlined />
            </div>
            <div>
              <Title level={4}>先粘贴 RSS 链接</Title>
              <Text type="secondary">
                我们会先读取最多 20
                条内容作为流程设计样本，不会创建任务或触发下载。
              </Text>
            </div>
          </div>
          <Form
            form={sourceForm}
            initialValues={{ interval_minutes: 5, preset: 'auto' }}
            layout="vertical"
            onValuesChange={(changed) => {
              if ('feed_url' in changed) {
                setSample(undefined);
                setSource(undefined);
              }
            }}
          >
            <Form.Item
              label="RSS 链接"
              name="feed_url"
              rules={[
                { required: true, message: '请输入 RSS 链接' },
                { type: 'url', message: '请输入完整的 HTTP/HTTPS 链接' },
              ]}
            >
              <Input
                className={styles.wizardURLInput}
                placeholder="https://example.com/rss.xml"
                prefix={<LinkOutlined />}
                size="large"
                onPressEnter={() => parseFeed()}
              />
            </Form.Item>
            <Button
              icon={<RocketOutlined />}
              loading={sampling}
              onClick={parseFeed}
              size="large"
              type="primary"
            >
              解析 RSS 内容
            </Button>

            <Collapse
              className={styles.wizardAdvanced}
              ghost
              items={[
                {
                  key: 'advanced',
                  label: '高级设置（可选）',
                  forceRender: true,
                  children: (
                    <Row gutter={16}>
                      <Col md={10} xs={24}>
                        <Form.Item label="源名称" name="name">
                          <Input placeholder="解析后自动使用 RSS 标题" />
                        </Form.Item>
                      </Col>
                      <Col md={7} xs={12}>
                        <Form.Item label="格式" name="preset">
                          <Select
                            options={[
                              { label: '自动识别', value: 'auto' },
                              { label: 'RSS 2.0', value: 'rss' },
                              { label: 'Atom', value: 'atom' },
                            ]}
                          />
                        </Form.Item>
                      </Col>
                      <Col md={7} xs={12}>
                        <Form.Item label="刷新间隔" name="interval_minutes">
                          <InputNumber addonAfter="分钟" max={1440} min={1} />
                        </Form.Item>
                      </Col>
                    </Row>
                  ),
                },
              ]}
            />
          </Form>

          {sample && (
            <div className={styles.wizardSampleResult}>
              <div className={styles.wizardSampleHeading}>
                <div>
                  <Space>
                    <CheckCircleFilled className={styles.successIcon} />
                    <Text strong>{sample.title || source?.name}</Text>
                  </Space>
                  <div>
                    <Text type="secondary">
                      已读取 {sample.items.length} 条样本，选择一条查看解析结果
                    </Text>
                  </div>
                </div>
                <Tag color="success">连接正常</Tag>
              </div>
              <Select
                aria-label="选择预览样本"
                className={styles.sampleChoiceSelect}
                onChange={setSelectedSample}
                optionFilterProp="label"
                options={sample.items.map((item, index) => ({
                  label: `${index + 1}. ${String(item.fields.title || `样本 ${index + 1}`)}`,
                  value: index,
                }))}
                showSearch
                value={selectedSample}
              />
              <div className={styles.sampleFieldGrid}>
                {Object.entries(selectedFields).map(([name, value]) => (
                  <div className={styles.sampleFieldCard} key={name}>
                    <Text code>{name}</Text>
                    <Paragraph copyable ellipsis={{ rows: 2 }}>
                      {String(value ?? '—')}
                    </Paragraph>
                  </div>
                ))}
              </div>
              <Alert
                message="这些字段会直接出现在下一步的流程预览中"
                showIcon
                type="info"
              />
            </div>
          )}

          <div className={styles.wizardFooter}>
            <Button onClick={onCancel}>取消</Button>
            <Button
              disabled={!sample}
              icon={<ArrowRightOutlined />}
              onClick={goToDesigner}
              type="primary"
            >
              下一步：设计流程
            </Button>
          </div>
        </Card>
      )}

      {step === 1 && sample && (
        <WorkflowPanel
          cloudDirectories={cloudDirectories}
          cloudStorages={cloudStorages}
          initialDefinition={definition}
          loading={false}
          mode="wizard"
          nodeProtocols={nodeProtocols}
          onChanged={() => undefined}
          onWizardBack={(nextDefinition) => {
            setDefinition(nextDefinition);
            setStep(0);
          }}
          onWizardNext={(nextDefinition) => {
            setDefinition(nextDefinition);
            setStep(2);
          }}
          previewFeed={sample}
          sources={[]}
          targets={targets}
          workflows={[]}
        />
      )}

      {step === 2 && source && sample && (
        <Card className={styles.wizardStepCard}>
          <div className={styles.wizardStepIntro}>
            <div className={styles.wizardStepIcon}>
              <CheckCircleFilled />
            </div>
            <div>
              <Title level={4}>确认后启用自动化</Title>
              <Text type="secondary">
                RSS 源和流程会一次性创建，不会留下只创建了一半的配置。
              </Text>
            </div>
          </div>
          <Row gutter={[24, 24]}>
            <Col lg={14} xs={24}>
              <Form
                form={publishForm}
                initialValues={{ enabled: true, name: suggestedName }}
                layout="vertical"
              >
                <Form.Item
                  label="自动化名称"
                  name="name"
                  rules={[{ required: true, message: '请输入自动化名称' }]}
                >
                  <Input maxLength={120} size="large" />
                </Form.Item>
                <Form.Item label="说明（可选）" name="description">
                  <Input.TextArea
                    autoSize={{ minRows: 3, maxRows: 6 }}
                    placeholder="说明这个自动化会筛选什么、执行什么"
                  />
                </Form.Item>
                <Form.Item
                  label="创建后立即启用"
                  name="enabled"
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
              </Form>
              <Alert
                description="首次刷新只记录当前已有条目作为基线，不会把历史内容突然全部下载；之后出现的新条目才会进入流程。"
                message="首次启用是安全的"
                showIcon
                type="success"
              />
              {actionCount === 0 && (
                <Alert
                  description="如果要立即启用，请返回流程设计，添加 qBittorrent、115 离线或通知节点；也可以先关闭立即启用，将它保存成草稿。"
                  message="当前流程还没有执行动作"
                  showIcon
                  style={{ marginTop: 12 }}
                  type="warning"
                />
              )}
            </Col>
            <Col lg={10} xs={24}>
              <Card size="small" title="创建内容">
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="RSS">
                    {source.name}
                  </Descriptions.Item>
                  <Descriptions.Item label="链接">
                    <Text copyable ellipsis>
                      {source.feed_url}
                    </Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="刷新">
                    每 {source.interval_minutes} 分钟
                  </Descriptions.Item>
                  <Descriptions.Item label="流程节点">
                    {definition.nodes.length} 个
                  </Descriptions.Item>
                  <Descriptions.Item label="执行动作">
                    {actionCount} 个
                  </Descriptions.Item>
                  <Descriptions.Item label="预览样本">
                    {sample.items.length} 条
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </Col>
          </Row>
          <div className={styles.wizardFooter}>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => setStep(1)}
              size="large"
            >
              返回修改流程
            </Button>
            <Button
              icon={<CheckCircleFilled />}
              loading={creating}
              onClick={publish}
              size="large"
              type="primary"
            >
              创建自动化
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};

export default AutomationWizard;
