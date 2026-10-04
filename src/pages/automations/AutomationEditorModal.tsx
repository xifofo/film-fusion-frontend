import {
  ApartmentOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CloudOutlined,
  FolderOpenOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Switch,
  Typography,
} from 'antd';
import { useEffect, useMemo, useState } from 'react';
import type {
  AutomationCreateInput,
  AutomationSource,
  AutomationWorkflow,
} from '@/services/film-fusion';
import { validateAutomationWorkflow } from '@/services/film-fusion';
import AutomationSteps from './AutomationSteps';
import DirectoryIdInput from './DirectoryIdInput';
import {
  AUTOMATION_DELAY_MAX_SECONDS,
  type AutomationDelayUnit,
  automationDelayMaxValue,
  automationDelayUnitOptions,
  toAutomationDelaySeconds,
} from './delay';
import styles from './Editor.module.less';
import { automationNodeLabel } from './presentation';
import {
  type AutomationActionValues,
  buildAutomationDefinition,
  editAutomationDefinition,
  readAutomationActions,
} from './workflow';

const { Text } = Typography;

type AutomationEditorValues = AutomationActionValues & {
  name: string;
  description: string;
  enabled: boolean;
  cloud_storage_id?: number;
  directory_id: string;
  directory_path: string;
  recursive: boolean;
  interval_seconds: number;
  quiet_seconds: number;
};

type AutomationEditorModalProps = {
  open: boolean;
  source?: AutomationSource;
  workflow?: AutomationWorkflow;
  cloudStorages: API.CloudStorage[];
  cloudDirectories: API.CloudDirectory[];
  onCancel: () => void;
  onSubmit: (input: AutomationCreateInput) => Promise<void>;
};

const initialValues = (
  source?: AutomationSource,
  workflow?: AutomationWorkflow,
): AutomationEditorValues => ({
  name: source?.name || '新的 115 目录自动化',
  description: source?.description || '',
  enabled: source?.enabled ?? true,
  cloud_storage_id: source?.cloud_storage_id,
  directory_id: source?.directory_id || '0',
  directory_path: source?.directory_path || '/',
  recursive: source?.recursive ?? true,
  interval_seconds: source?.interval_seconds || 300,
  quiet_seconds: source?.quiet_seconds || 120,
  ...readAutomationActions(workflow),
});

const AutomationEditorModal = ({
  open,
  source,
  workflow,
  cloudStorages,
  cloudDirectories,
  onCancel,
  onSubmit,
}: AutomationEditorModalProps) => {
  const [form] = Form.useForm<AutomationEditorValues>();
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);
  const watchedValues = Form.useWatch([], form);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const cloudStorageID = Form.useWatch('cloud_storage_id', form);
  const selectedPath = Form.useWatch('directory_path', form);
  const delayUnit = (Form.useWatch('delay_unit', form) ||
    'minutes') as AutomationDelayUnit;
  const organizeEnabled = Form.useWatch('organize_enabled', form);
  const notificationEnabled = Form.useWatch('notification_enabled', form);

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue(initialValues(source, workflow));
    setValidationErrors([]);
    setStep(0);
  }, [form, open, source, workflow]);

  const storageOptions = useMemo(
    () =>
      cloudStorages
        .filter((storage) => storage.storage_type === '115open')
        .map((storage) => ({
          label: `${storage.storage_name}${storage.status === 'active' ? '' : '（不可用）'}`,
          value: storage.id,
          disabled: storage.status !== 'active',
        })),
    [cloudStorages],
  );

  const organizeDirectories = useMemo(
    () =>
      cloudDirectories.filter(
        (directory) => directory.cloud_storage_id === cloudStorageID,
      ),
    [cloudDirectories, cloudStorageID],
  );
  const selectedStorage = cloudStorages.find(
    (storage) => storage.id === cloudStorageID,
  );

  const currentValues: AutomationEditorValues = {
    ...initialValues(source, workflow),
    ...watchedValues,
  };
  const previewNodes = buildAutomationDefinition(currentValues).nodes.filter(
    (node) => node.type !== 'end',
  );
  const next = async () => {
    const fields =
      step === 0
        ? [
            'cloud_storage_id',
            'directory_id',
            'interval_seconds',
            'quiet_seconds',
          ]
        : [
            'delay_value',
            ...(organizeEnabled ? ['cloud_directory_id'] : []),
            ...(notificationEnabled ? ['notification_message'] : []),
          ];
    try {
      await form.validateFields(fields);
      setValidationErrors([]);
      setStep((value) => value + 1);
    } catch {
      /* Form fields display validation errors in the current step. */
    }
  };

  const save = async () => {
    setSaving(true);
    setValidationErrors([]);
    try {
      const values = await form.validateFields();
      const definition = editAutomationDefinition(values, workflow);
      const validationResponse = await validateAutomationWorkflow(definition);
      if (validationResponse.code !== 0 || !validationResponse.data?.valid) {
        const errors = validationResponse.data?.errors?.length
          ? validationResponse.data.errors
          : [validationResponse.message || '流程校验失败'];
        setValidationErrors(errors);
        return;
      }
      const sourceInput = {
        name: values.name.trim(),
        description: values.description?.trim() || '',
        enabled: values.enabled,
        trigger_type: '115_directory' as const,
        cloud_storage_id: values.cloud_storage_id as number,
        directory_id: values.directory_id,
        directory_path: values.directory_path,
        recursive: values.recursive,
        interval_seconds: values.interval_seconds,
        quiet_seconds: values.quiet_seconds,
      };
      await onSubmit({
        source: sourceInput,
        workflow: {
          name: sourceInput.name,
          description: sourceInput.description,
          enabled: sourceInput.enabled,
          definition,
        },
      });
    } catch (error: any) {
      if (error?.errorFields?.length) {
        const field = error.errorFields[0].name[0];
        setStep(
          ['name', 'description', 'enabled'].includes(field)
            ? 2
            : [
                  'cloud_storage_id',
                  'directory_id',
                  'interval_seconds',
                  'quiet_seconds',
                ].includes(field)
              ? 0
              : 1,
        );
      } else {
        setValidationErrors([
          error?.data || error?.message || '保存自动化失败',
        ]);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      destroyOnHidden
      footer={null}
      mask={{ closable: !saving }}
      closable={!saving}
      keyboard={!saving}
      onCancel={onCancel}
      open={open}
      title={source ? '编辑 115 目录自动化' : '创建 115 目录自动化'}
      width={1000}
    >
      <AutomationSteps current={step} trigger="115 目录" />
      <Form<AutomationEditorValues>
        form={form}
        layout="vertical"
        preserve={false}
        requiredMark
      >
        <div className={styles.editorGrid}>
          <div className={styles.formPanel}>
            <div hidden={step !== 2}>
              <h3>确认这条自动化</h3>
              <p className={styles.intro}>
                给流程起个容易辨认的名字，并选择是否立即开始监控。
              </p>
              <div className={styles.reviewScope}>
                <div>
                  <span>监控账号：</span>
                  {selectedStorage?.storage_name || '尚未选择'}
                </div>
                <div>
                  <span>监控目录：</span>
                  {currentValues.directory_path || '/'}
                  {currentValues.recursive ? '（包含子目录）' : ''}
                </div>
                <div>
                  <span>检查频率：</span>每 {currentValues.interval_seconds}{' '}
                  秒检查，内容稳定 {currentValues.quiet_seconds} 秒后触发
                </div>
              </div>
              <Row gutter={16}>
                <Col xs={24} sm={16}>
                  <Form.Item
                    label="名称"
                    name="name"
                    rules={[
                      { required: true, message: '请输入自动化名称' },
                      { max: 120, message: '名称不能超过 120 个字符' },
                    ]}
                  >
                    <Input placeholder="例如：115 入库目录" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item
                    label="立即启用"
                    name="enabled"
                    valuePropName="checked"
                  >
                    <Switch checkedChildren="启用" unCheckedChildren="停用" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item label="说明" name="description">
                <Input.TextArea
                  autoSize={{ minRows: 2, maxRows: 4 }}
                  placeholder="这条自动化负责什么内容"
                />
              </Form.Item>
            </div>
            <div hidden={step !== 0}>
              <h3>从哪里发现新媒体？</h3>
              <p className={styles.intro}>
                选择 115 账号与监控目录，新内容稳定后会自动进入流程。
              </p>
              {storageOptions.length === 0 && (
                <Alert
                  description="请先在云存储管理中添加并完成 115 OpenAPI 授权。目录监控不使用 Cookie 模式。"
                  showIcon
                  title="没有可用的 115 OpenAPI 账号"
                  type="warning"
                />
              )}
              <Form.Item
                label="115 OpenAPI 账号"
                name="cloud_storage_id"
                rules={[{ required: true, message: '请选择 115 OpenAPI 账号' }]}
              >
                <Select
                  options={storageOptions}
                  placeholder="选择已授权的 115 账号"
                  prefix={<CloudOutlined />}
                  onChange={() => {
                    form.setFieldsValue({
                      directory_id: '0',
                      directory_path: '/',
                      cloud_directory_id: undefined,
                    });
                  }}
                />
              </Form.Item>
              <Form.Item name="directory_path" hidden>
                <Input />
              </Form.Item>
              <Form.Item
                extra="只处理这个范围内新增且已稳定的媒体。"
                label="监控目录"
                name="directory_id"
                rules={[{ required: true, message: '请选择要监控的目录' }]}
              >
                <DirectoryIdInput
                  accessMethod="openapi"
                  cloudStorageId={cloudStorageID}
                  onSelectedPathChange={(path) =>
                    form.setFieldValue('directory_path', path)
                  }
                  selectedPath={selectedPath}
                />
              </Form.Item>
              <Row gutter={16}>
                <Col xs={24} sm={8}>
                  <Form.Item
                    label="递归监控子目录"
                    name="recursive"
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item
                    label="检查间隔（秒）"
                    name="interval_seconds"
                    rules={[{ required: true }]}
                  >
                    <InputNumber min={30} max={86400} step={30} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item
                    extra="避免正在上传的目录被提前处理"
                    label="静默期（秒）"
                    name="quiet_seconds"
                    rules={[{ required: true }]}
                  >
                    <InputNumber min={30} max={86400} step={30} />
                  </Form.Item>
                </Col>
              </Row>
            </div>
            <div hidden={step !== 1}>
              <h3>发现新媒体后，做什么？</h3>
              <p className={styles.intro}>
                按顺序完成识别、整理与通知，右侧会同步展示当前流程。
              </p>
              <Form.Item
                extra="0 表示立即执行，也可以等一段时间再开始处理。"
                label="触发后延迟"
                required
              >
                <Space.Compact block>
                  <Form.Item
                    name="delay_value"
                    noStyle
                    rules={[
                      { required: true, message: '请输入延迟时长' },
                      {
                        validator: (_, value) => {
                          const numeric = Number(value);
                          const seconds = toAutomationDelaySeconds(
                            value,
                            form.getFieldValue('delay_unit') || 'minutes',
                          );
                          if (!Number.isInteger(numeric) || numeric < 0) {
                            return Promise.reject(
                              new Error('延迟时长必须是大于等于 0 的整数'),
                            );
                          }
                          if (seconds > AUTOMATION_DELAY_MAX_SECONDS) {
                            return Promise.reject(
                              new Error('延迟时长不能超过 30 天'),
                            );
                          }
                          return Promise.resolve();
                        },
                      },
                    ]}
                  >
                    <InputNumber
                      max={automationDelayMaxValue(delayUnit)}
                      min={0}
                      precision={0}
                      style={{ width: 'calc(100% - 110px)' }}
                    />
                  </Form.Item>
                  <Form.Item name="delay_unit" noStyle>
                    <Select
                      options={automationDelayUnitOptions}
                      style={{ width: 110 }}
                    />
                  </Form.Item>
                </Space.Compact>
              </Form.Item>
              <Form.Item label="媒体识别" name="recognition">
                <Select
                  options={[
                    { label: '旧本地识别（兼容）', value: 'local' },
                    { label: 'medianame', value: 'medianame' },
                    { label: '仅 MP2', value: 'moviepilot' },
                    { label: '影子模式（MP2 优先）', value: 'shadow' },
                    { label: '不识别', value: 'none' },
                  ]}
                />
              </Form.Item>

              <Form.Item
                label="媒体整理与 STRM 生成"
                name="organize_enabled"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
              {organizeEnabled && (
                <Space
                  orientation="vertical"
                  size={12}
                  style={{ width: '100%' }}
                >
                  <Form.Item
                    label="仅生成整理预览"
                    name="organize_dry_run"
                    valuePropName="checked"
                    extra="保存完整计划与影子对比，不移动文件或写入 STRM。"
                  >
                    <Switch />
                  </Form.Item>
                  {!selectedStorage?.cookie && (
                    <Alert
                      description="增量扫描使用 OpenAPI；现有媒体整理链路还需要同一个账号配置 Cookie。请先到云存储管理补充 Cookie。"
                      showIcon
                      title="所选账号缺少整理所需的 Cookie"
                      type="warning"
                    />
                  )}
                  <Row gutter={16}>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        extra="只显示当前 115 账号下已经配置的整理目录。"
                        label="整理目录配置"
                        name="cloud_directory_id"
                        rules={[
                          { required: true, message: '请选择整理目录配置' },
                          {
                            validator: (_, value) => {
                              if (!selectedStorage?.cookie) {
                                return Promise.reject(
                                  new Error(
                                    '所选 115 账号缺少整理所需的 Cookie',
                                  ),
                                );
                              }
                              const directory = organizeDirectories.find(
                                (item) => item.id === value,
                              );
                              if (
                                directory &&
                                directory.directory_id ===
                                  form.getFieldValue('directory_id')
                              ) {
                                return Promise.reject(
                                  new Error('整理目标不能与监控根目录相同'),
                                );
                              }
                              return Promise.resolve();
                            },
                          },
                        ]}
                      >
                        <Select
                          options={organizeDirectories.map((directory) => ({
                            label: directory.directory_name,
                            value: directory.id,
                          }))}
                          placeholder="选择目录配置"
                          prefix={<FolderOpenOutlined />}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={12} sm={6}>
                      <Form.Item label="媒体类型" name="media_type">
                        <Select
                          options={[
                            { label: '自动判断', value: 'auto' },
                            { label: '电影', value: 'movie' },
                            { label: '电视剧', value: 'tv' },
                          ]}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={12} sm={6}>
                      <Form.Item label="媒体分类" name="category">
                        <Input placeholder="可选" />
                      </Form.Item>
                    </Col>
                  </Row>
                </Space>
              )}

              <Form.Item
                label="发送通知"
                name="notification_enabled"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
              {notificationEnabled && (
                <Row gutter={16}>
                  <Col xs={24} sm={10}>
                    <Form.Item label="通知标题" name="notification_title">
                      <Input placeholder="115 目录发现新媒体" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={14}>
                    <Form.Item
                      extra="可使用 {{item.title}}、{{item.path}} 等事件变量。"
                      label="通知内容"
                      name="notification_message"
                      rules={[{ required: true, message: '请输入通知内容' }]}
                    >
                      <Input placeholder="{{item.path}}" />
                    </Form.Item>
                  </Col>
                </Row>
              )}
            </div>
          </div>
          <aside className={styles.summary} aria-label="当前流程预览">
            <div className={styles.summaryHeading}>
              <ApartmentOutlined /> 当前流程
            </div>
            <p className={styles.summaryHint}>配置会实时反映在这里</p>
            <ol className={styles.summaryNodes}>
              {previewNodes.map((node, index) => (
                <li key={node.id}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <span>{automationNodeLabel(node)}</span>
                </li>
              ))}
            </ol>
            <div className={styles.baselineNote}>
              <strong>首次检查仅建立基线</strong>
              已有内容会被记录；之后新出现且保持稳定的媒体才会触发处理。
            </div>
          </aside>
        </div>
        {validationErrors.length > 0 && (
          <Alert
            description={
              <Space orientation="vertical" size={2}>
                {validationErrors.map((error) => (
                  <Text key={error}>{error}</Text>
                ))}
              </Space>
            }
            showIcon
            className={styles.error}
            title="流程配置未通过校验"
            type="error"
          />
        )}
      </Form>
      <div className={styles.footer}>
        <span className={styles.footerHint}>
          {step < 2
            ? '完成确认后才会保存配置'
            : currentValues.enabled
              ? '保存后开始监控新内容'
              : '保存后保持停用，可随时启用'}
        </span>
        <Space>
          <Button disabled={saving} onClick={onCancel}>
            取消
          </Button>
          {step > 0 && (
            <Button
              disabled={saving}
              icon={<ArrowLeftOutlined />}
              onClick={() => setStep((value) => value - 1)}
            >
              上一步
            </Button>
          )}
          {step < 2 ? (
            <Button icon={<ArrowRightOutlined />} onClick={next} type="primary">
              {step === 0 ? '下一步：设计流程' : '下一步：确认启用'}
            </Button>
          ) : (
            <Button loading={saving} onClick={save} type="primary">
              {source
                ? '保存更改'
                : currentValues.enabled
                  ? '创建并启用'
                  : '保存自动化'}
            </Button>
          )}
        </Space>
      </div>
    </Modal>
  );
};

export default AutomationEditorModal;
