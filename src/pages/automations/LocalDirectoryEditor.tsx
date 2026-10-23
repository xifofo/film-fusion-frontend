import {
  Alert,
  Button,
  Checkbox,
  Col,
  Collapse,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Switch,
} from 'antd';
import { useMemo, useState } from 'react';
import WorkflowPanel from '@/pages/rss-automation/WorkflowPanel';
import type {
  AutomationCreateInput,
  AutomationDefinition,
  AutomationNodeProtocol,
  AutomationSource,
  AutomationTarget,
  AutomationWorkflow,
  LocalDirectoryConfig,
} from '@/services/film-fusion';
import { validateAutomationWorkflow } from '@/services/film-fusion';
import AutomationSteps from './AutomationSteps';
import styles from './Editor.module.less';
import {
  largeLocalDirectoryPreset,
  localDirectoryDefinition,
  localDirectoryExample,
  localDirectoryReferences,
  readLocalDirectoryConfig,
} from './localDirectory';

type Values = {
  name: string;
  description: string;
  enabled: boolean;
  directory_path: string;
  recursive: boolean;
  interval_seconds: number;
  quiet_seconds: number;
  local_config: LocalDirectoryConfig;
};

type Props = {
  source?: AutomationSource;
  workflow?: AutomationWorkflow;
  cloudStorages: API.CloudStorage[];
  cloudDirectories: API.CloudDirectory[];
  targets: AutomationTarget[];
  nodeProtocols: AutomationNodeProtocol[];
  onSubmit: (input: AutomationCreateInput) => Promise<void>;
  onCancel: () => void;
};

const LocalDirectoryEditor = ({
  source,
  workflow,
  cloudStorages,
  cloudDirectories,
  targets,
  nodeProtocols,
  onSubmit,
  onCancel,
}: Props) => {
  const [form] = Form.useForm<Values>();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState<string[]>([]);
  const [error, setError] = useState('');
  const loaded = useMemo(() => {
    try {
      const definition = workflow
        ? (JSON.parse(workflow.definition_json) as AutomationDefinition)
        : localDirectoryDefinition();
      if (
        definition.schema_version !== 1 ||
        !Array.isArray(definition.nodes) ||
        !Array.isArray(definition.edges)
      )
        throw new Error('原流程无法读取');
      return {
        config: readLocalDirectoryConfig(source),
        definition,
        error: '',
      };
    } catch (cause) {
      return {
        config: readLocalDirectoryConfig(),
        definition: localDirectoryDefinition(),
        error: (cause as Error).message,
      };
    }
  }, [source, workflow]);
  const [definition, setDefinition] = useState(loaded.definition);
  const initialValues: Values = {
    name: source?.name || '新的本机 / NAS 目录监控',
    description: source?.description || '',
    enabled: source?.enabled ?? true,
    directory_path: source?.directory_path || '',
    recursive: source?.recursive ?? true,
    interval_seconds: source?.interval_seconds || 300,
    quiet_seconds: source?.quiet_seconds || 30,
    local_config: loaded.config,
  };
  const values = { ...initialValues, ...Form.useWatch([], form) };
  const mode =
    Form.useWatch(['local_config', 'mode'], form) || loaded.config.mode;
  const initialScan =
    Form.useWatch(['local_config', 'initial_scan'], form) ||
    loaded.config.initial_scan;

  const next = async () => {
    try {
      await form.validateFields();
      setError('');
      setStep(1);
    } catch {
      setAdvancedOpen(['scan', 'retention']);
    }
  };
  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const current = await form.validateFields();
      const response = await validateAutomationWorkflow(definition);
      if (response.code !== 0 || !response.data?.valid)
        throw new Error(
          response.data?.errors?.join('；') ||
            response.message ||
            '流程校验失败',
        );
      const input = {
        ...current,
        name: current.name.trim(),
        description: current.description.trim(),
        directory_path: current.directory_path.trim(),
        trigger_type: 'local_directory' as const,
        local_config: {
          ...current.local_config,
          include_extensions: current.local_config.include_extensions
            .map((extension) =>
              extension.trim().replace(/^\.?/, '.').toLowerCase(),
            )
            .filter((extension) => extension !== '.'),
          exclude_patterns: current.local_config.exclude_patterns
            .map((pattern) => pattern.trim())
            .filter(Boolean),
        },
      };
      await onSubmit({
        expected_version: workflow?.version,
        source: input,
        workflow: {
          name: input.name,
          description: input.description,
          enabled: input.enabled,
          definition,
        },
      });
    } catch (cause: any) {
      if (cause?.errorFields) setStep(0);
      else setError(cause?.message || '保存目录监控失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <AutomationSteps current={step} trigger="本机 / NAS 目录" />
      {(error || loaded.error) && (
        <Alert type="error" showIcon title={error || loaded.error} />
      )}
      <Form<Values>
        form={form}
        initialValues={initialValues}
        layout="vertical"
        disabled={saving || Boolean(loaded.error)}
      >
        <div hidden={step !== 0}>
          <h3>监控哪些目录变化？</h3>
          <p className={styles.intro}>
            自动发现新增子目录；写入稳定后，将事件交给你配置的处理流程。
          </p>
          <Space wrap style={{ marginBottom: 20 }}>
            <Button
              onClick={() => {
                const preset = largeLocalDirectoryPreset();
                form.setFieldsValue({
                  ...preset,
                  local_config: {
                    ...form.getFieldValue('local_config'),
                    ...preset.local_config,
                  },
                });
                setAdvancedOpen(['scan', 'retention']);
              }}
            >
              应用大目录预设
            </Button>
            <span>
              适合几十万目录、百万级文件的起始配置；实际扫描速度取决于存储性能。
            </span>
          </Space>
          <Row gutter={24}>
            <Col xs={24} lg={14}>
              <Form.Item
                label="名称"
                name="name"
                rules={[
                  {
                    required: true,
                    whitespace: true,
                    message: '请输入监控名称',
                  },
                  { max: 120 },
                ]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                label="监控目录"
                name="directory_path"
                extra="填写 FilmFusion 服务所在机器的绝对路径。NAS 请先挂载；Docker 部署请填写容器内路径。"
                rules={[
                  {
                    required: true,
                    whitespace: true,
                    message: '请输入监控目录',
                  },
                  {
                    validator: (_, value) =>
                      !value || /^(\/|[A-Za-z]:[\\/]|\\\\)/.test(value.trim())
                        ? Promise.resolve()
                        : Promise.reject(
                            new Error('请输入绝对路径，例如 /media/downloads'),
                          ),
                  },
                ]}
              >
                <Input placeholder="例如：/media/downloads 或 /mnt/nas/media" />
              </Form.Item>
              <Space size="large" wrap>
                <Form.Item
                  label="包含子目录"
                  name="recursive"
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
                <Form.Item
                  label="立即启用"
                  name="enabled"
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
              </Space>
              <Form.Item
                label="触发事件"
                name={['local_config', 'events']}
                rules={[
                  {
                    type: 'array',
                    min: 1,
                    required: true,
                    message: '至少选择一种事件',
                  },
                ]}
              >
                <Checkbox.Group
                  options={[
                    { label: '新增文件 / 目录', value: 'created' },
                    { label: '已有内容修改', value: 'modified' },
                  ]}
                />
              </Form.Item>
              <Form.Item label="监控对象" name={['local_config', 'item_type']}>
                <Select
                  options={[
                    { label: '文件', value: 'file' },
                    { label: '目录', value: 'directory' },
                    { label: '文件和目录', value: 'all' },
                  ]}
                />
              </Form.Item>
              <Form.Item
                label="文件扩展名"
                name={['local_config', 'include_extensions']}
                extra="留空接收所有文件。仅限制文件，不限制对子目录的发现。"
              >
                <Select
                  mode="tags"
                  maxCount={128}
                  tokenSeparators={[',', '，', ' ']}
                  placeholder="例如 .mkv、.mp4、.torrent"
                />
              </Form.Item>
              <Form.Item
                label="排除规则"
                name={['local_config', 'exclude_patterns']}
                extra="按文件名或相对路径匹配通配符；排除目录时也跳过其子树。例如 *.part、*.tmp、@eaDir。"
              >
                <Select
                  mode="tags"
                  maxCount={128}
                  tokenSeparators={[',', '，']}
                  placeholder="输入规则后按回车"
                />
              </Form.Item>
              <Form.Item label="说明" name="description">
                <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} />
              </Form.Item>
            </Col>
            <Col xs={24} lg={10}>
              <Form.Item
                label="监听方式"
                name={['local_config', 'mode']}
                extra="自动模式使用系统事件并定期补扫。NAS 远端变化可能不产生系统事件，仍会由补扫发现。"
              >
                <Select
                  options={[
                    { label: '自动：系统监听 + 定期补扫', value: 'auto' },
                    { label: '仅定期扫描（适合 NAS）', value: 'poll' },
                  ]}
                />
              </Form.Item>
              <Form.Item
                label={mode === 'poll' ? '扫描间隔（秒）' : '补扫间隔（秒）'}
                name="interval_seconds"
                rules={[
                  { required: true, type: 'number', min: 30, max: 86400 },
                ]}
              >
                <InputNumber
                  min={30}
                  max={86400}
                  precision={0}
                  style={{ width: '100%' }}
                />
              </Form.Item>
              <Form.Item
                label="内容稳定等待（秒）"
                name="quiet_seconds"
                extra="文件大小和修改时间不再变化后才触发，避免处理未写完的文件。"
                rules={[{ required: true, type: 'number', min: 1, max: 86400 }]}
              >
                <InputNumber
                  min={1}
                  max={86400}
                  precision={0}
                  style={{ width: '100%' }}
                />
              </Form.Item>
              <Form.Item
                label="首次扫描"
                name={['local_config', 'initial_scan']}
              >
                <Select
                  options={[
                    { label: '仅建立基线，忽略已有内容', value: 'baseline' },
                    {
                      label: '将已有内容也交给处理流程',
                      value: 'process_existing',
                    },
                  ]}
                />
              </Form.Item>
              {initialScan === 'process_existing' && (
                <Alert
                  type="warning"
                  showIcon
                  title="已有内容也会触发动作"
                  description="首次扫描发现的匹配文件或目录，在稳定后也会进入流程。修改监控范围后建立新基线时同样适用。"
                />
              )}
            </Col>
          </Row>
          <Collapse
            activeKey={advancedOpen}
            onChange={(keys) =>
              setAdvancedOpen(Array.isArray(keys) ? keys : [keys])
            }
            style={{ marginBottom: 20 }}
            items={[
              {
                key: 'scan',
                label: '高级：分段扫描与运行积压',
                forceRender: true,
                children: (
                  <>
                    <p>
                      大目录树分段扫描并保存进度。每段达到时间预算或对象数限制后让出执行机会，后续继续；完整扫描可能跨越多个调度周期。
                    </p>
                    <Row gutter={24}>
                      <Col xs={24} md={12}>
                        <Form.Item
                          label="系统监听目录上限"
                          name={['local_config', 'max_watches']}
                          extra="控制系统监听资源；超过上限的目录仍由定期扫描覆盖。"
                          rules={[
                            {
                              required: true,
                              type: 'number',
                              min: 1,
                              max: 8192,
                            },
                          ]}
                        >
                          <InputNumber
                            min={1}
                            max={8192}
                            precision={0}
                            disabled={mode === 'poll'}
                            style={{ width: '100%' }}
                          />
                        </Form.Item>
                        <Form.Item
                          label="扫描批次大小"
                          name={['local_config', 'batch_size']}
                          extra="分批读取和处理目录内容，避免把整个目录树载入内存。"
                          rules={[
                            {
                              required: true,
                              type: 'number',
                              min: 16,
                              max: 512,
                            },
                          ]}
                        >
                          <InputNumber
                            min={16}
                            max={512}
                            precision={0}
                            style={{ width: '100%' }}
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item
                          label="每段扫描时间预算（毫秒）"
                          name={['local_config', 'scan_budget_ms']}
                          extra="达到预算后在检查点暂停；单次磁盘或 NAS 读取耗时可能超过预算。"
                          rules={[
                            {
                              required: true,
                              type: 'number',
                              min: 100,
                              max: 10000,
                            },
                          ]}
                        >
                          <InputNumber
                            min={100}
                            max={10000}
                            precision={0}
                            style={{ width: '100%' }}
                          />
                        </Form.Item>
                        <Form.Item
                          label="每段扫描对象数上限"
                          name={['local_config', 'scan_item_limit']}
                          extra="限制单段扫描的工作量，与批次大小独立。"
                          rules={[
                            {
                              required: true,
                              type: 'number',
                              min: 128,
                              max: 65536,
                            },
                          ]}
                        >
                          <InputNumber
                            min={128}
                            max={65536}
                            precision={0}
                            style={{ width: '100%' }}
                          />
                        </Form.Item>
                        <Form.Item
                          label="待处理运行数量上限"
                          name={['local_config', 'max_pending_runs']}
                          extra="积压达到上限时暂缓派发新运行，已有任务继续处理；候选事件保留，积压降低后继续派发。"
                          rules={[
                            {
                              required: true,
                              type: 'number',
                              min: 1,
                              max: 100000,
                            },
                          ]}
                        >
                          <InputNumber
                            min={1}
                            max={100000}
                            precision={0}
                            style={{ width: '100%' }}
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Alert
                      type="info"
                      showIcon
                      title="资源与时效需要权衡"
                      description="这些限制控制单段工作量、监听数量与运行积压，不代表固定内存占用或实时发现保证。扫描间隔决定后续检查频率，完整一轮的耗时还取决于目录规模和存储响应。"
                    />
                  </>
                ),
              },
              {
                key: 'retention',
                label: '高级：历史和路径索引保留',
                forceRender: true,
                children: (
                  <Row gutter={24}>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label="运行历史保留天数"
                        name={['local_config', 'history_retention_days']}
                        extra="自动清理过期的已结束运行历史；排队中、运行中等活跃任务保留。"
                        rules={[
                          { required: true, type: 'number', min: 1, max: 365 },
                        ]}
                      >
                        <InputNumber
                          min={1}
                          max={365}
                          precision={0}
                          style={{ width: '100%' }}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label="完成任务历史上限"
                        name={['local_config', 'history_max_runs']}
                        extra="超出上限优先清理最早的可清理历史，活跃任务及被引用记录保留。"
                        rules={[
                          {
                            required: true,
                            type: 'number',
                            min: 100,
                            max: 1000000,
                          },
                        ]}
                      >
                        <InputNumber
                          min={100}
                          max={1000000}
                          precision={0}
                          style={{ width: '100%' }}
                        />
                      </Form.Item>
                      <Form.Item
                        label="消失路径索引保留天数"
                        name={['local_config', 'missing_retention_days']}
                        extra="完整扫描确认路径已消失后保留一段时间，再清理其索引；不删除磁盘上的文件。"
                        rules={[
                          { required: true, type: 'number', min: 1, max: 365 },
                        ]}
                      >
                        <InputNumber
                          min={1}
                          max={365}
                          precision={0}
                          style={{ width: '100%' }}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                ),
              },
            ]}
          />
          <Space>
            <Button onClick={onCancel}>取消</Button>
            <Button type="primary" onClick={next}>
              下一步：设计流程
            </Button>
          </Space>
        </div>
      </Form>
      {step === 1 && (
        <>
          <Alert
            type="info"
            showIcon
            title="目录变化后执行什么动作？"
            description="默认发送通知。可以添加 HTTP 请求、条件分支、标题识别等节点，使用 $item.path、$item.event_type 等变量。画布样本是模拟事件；115 文件整理节点需要独立的 115 文件信息。"
          />
          <WorkflowPanel
            mode="wizard"
            initialDefinition={definition}
            itemReferences={localDirectoryReferences}
            eventLabel="目录事件示例"
            showWizardTemplates={false}
            previewFeed={localDirectoryExample(values.directory_path)}
            workflows={[]}
            sources={[]}
            targets={targets}
            cloudStorages={cloudStorages}
            cloudDirectories={cloudDirectories}
            nodeProtocols={nodeProtocols}
            loading={false}
            onChanged={() => {}}
            onWizardBack={(nextDefinition) => {
              setDefinition(nextDefinition);
              setStep(0);
            }}
            onWizardNext={(nextDefinition) => {
              setDefinition(nextDefinition);
              setStep(2);
            }}
          />
        </>
      )}
      {step === 2 && (
        <>
          <h3>确认目录监控</h3>
          <div className={styles.reviewScope}>
            <div>
              <span>名称：</span>
              {values.name}
            </div>
            <div>
              <span>监控目录：</span>
              {values.directory_path}
              {values.recursive ? '（包含子目录）' : '（仅当前目录）'}
            </div>
            <div>
              <span>检查策略：</span>
              {values.local_config.mode === 'auto'
                ? '系统监听 + 定期补扫'
                : '定期扫描'}
              ，每 {values.interval_seconds} 秒补扫，稳定 {values.quiet_seconds}{' '}
              秒后触发
            </div>
            <div>
              <span>资源限制：</span>最多 {values.local_config.max_watches}{' '}
              个系统监听目录，每批 {values.local_config.batch_size} 项
            </div>
            <div>
              <span>分段与积压：</span>每段时间预算{' '}
              {values.local_config.scan_budget_ms} 毫秒，最多{' '}
              {values.local_config.scan_item_limit} 个对象；待处理运行达到{' '}
              {values.local_config.max_pending_runs} 项后暂缓派发
            </div>
            <div>
              <span>保留策略：</span>已结束运行历史{' '}
              {values.local_config.history_retention_days} 天、最多{' '}
              {values.local_config.history_max_runs} 条可清理历史，消失路径索引{' '}
              {values.local_config.missing_retention_days} 天
            </div>
            <div>
              <span>首次扫描：</span>
              {values.local_config.initial_scan === 'baseline'
                ? '建立基线，忽略已有内容'
                : '已有内容也进入流程'}
            </div>
            <div>
              <span>处理流程：</span>
              {
                definition.nodes.filter(
                  (node) => !['trigger', 'end'].includes(node.type),
                ).length
              }{' '}
              个动作节点
            </div>
            <div>
              <span>保存后：</span>
              {values.enabled ? '启用监控' : '保持停用'}
            </div>
          </div>
          <Space>
            <Button disabled={saving} onClick={() => setStep(1)}>
              上一步：设计流程
            </Button>
            <Button loading={saving} type="primary" onClick={save}>
              {source ? '保存目录监控' : '创建目录监控'}
            </Button>
          </Space>
        </>
      )}
    </>
  );
};

export default LocalDirectoryEditor;
