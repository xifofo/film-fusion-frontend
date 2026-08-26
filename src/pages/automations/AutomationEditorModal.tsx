import { CloudOutlined, FolderOpenOutlined } from '@ant-design/icons';
import {
  Alert,
  Col,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
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
import DirectoryIdInput from './DirectoryIdInput';
import {
  type AutomationActionValues,
  buildAutomationDefinition,
  readAutomationActions,
} from './workflow';

const { Text, Title } = Typography;

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
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const cloudStorageID = Form.useWatch('cloud_storage_id', form);
  const selectedPath = Form.useWatch('directory_path', form);
  const organizeEnabled = Form.useWatch('organize_enabled', form);
  const notificationEnabled = Form.useWatch('notification_enabled', form);

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue(initialValues(source, workflow));
    setValidationErrors([]);
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

  const save = async () => {
    setSaving(true);
    setValidationErrors([]);
    try {
      const values = await form.validateFields();
      const definition = buildAutomationDefinition(values);
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
      if (!error?.errorFields) {
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
      cancelText="取消"
      destroyOnHidden
      okButtonProps={{ loading: saving }}
      okText={source ? '保存更改' : '创建自动化'}
      onCancel={onCancel}
      onOk={save}
      open={open}
      title={source ? '编辑 115 目录自动化' : '创建 115 目录自动化'}
      width={760}
    >
      <Form<AutomationEditorValues>
        form={form}
        layout="vertical"
        preserve={false}
        requiredMark="optional"
      >
        <Alert
          description="首次扫描只记录现有内容作为基线；之后只处理新增并且在静默期内保持不变的媒体文件或目录。"
          showIcon
          title="增量监控不会把存量内容当成新事件"
          type="info"
        />

        <Title level={5}>基本信息</Title>
        <Row gutter={16}>
          <Col span={16}>
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
          <Col span={8}>
            <Form.Item label="立即启用" name="enabled" valuePropName="checked">
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

        <Divider />
        <Title level={5}>115 监控范围</Title>
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
          extra="选择目录后会为它和每个已发现的子目录分别保存增量游标。"
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
          <Col span={8}>
            <Form.Item
              label="递归监控子目录"
              name="recursive"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              label="检查间隔（秒）"
              name="interval_seconds"
              rules={[{ required: true }]}
            >
              <InputNumber min={30} max={86400} step={30} />
            </Form.Item>
          </Col>
          <Col span={8}>
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

        <Divider />
        <Title level={5}>发现新媒体后</Title>
        <Form.Item label="媒体识别" name="recognition">
          <Radio.Group
            options={[
              { label: 'FilmFusion 本地识别', value: 'local' },
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
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            {!selectedStorage?.cookie && (
              <Alert
                description="增量扫描使用 OpenAPI；现有媒体整理链路还需要同一个账号配置 Cookie。请先到云存储管理补充 Cookie。"
                showIcon
                title="所选账号缺少整理所需的 Cookie"
                type="warning"
              />
            )}
            <Row gutter={16}>
              <Col span={12}>
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
                            new Error('所选 115 账号缺少整理所需的 Cookie'),
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
              <Col span={6}>
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
              <Col span={6}>
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
            <Col span={10}>
              <Form.Item label="通知标题" name="notification_title">
                <Input placeholder="115 目录发现新媒体" />
              </Form.Item>
            </Col>
            <Col span={14}>
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
            title="流程配置未通过校验"
            type="error"
          />
        )}
      </Form>
    </Modal>
  );
};

export default AutomationEditorModal;
