import { DeleteOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Typography,
} from 'antd';
import { useEffect } from 'react';
import type {
  RSSAutomationNodeDefinition,
  RSSAutomationTarget,
} from '@/services/film-fusion';
import DirectoryIdInput from './DirectoryIdInput';
import { NODE_LABELS } from './flow';
import styles from './index.module.less';
import type { RSSAutomationNodePreview } from './preview';
import TemplateVariableInput from './TemplateVariableInput';

const { Text } = Typography;

type NodeConfigModalProps = {
  node?: RSSAutomationNodeDefinition;
  targets: RSSAutomationTarget[];
  cloudStorages: API.CloudStorage[];
  fieldReferences: NodeFieldReference[];
  preview?: RSSAutomationNodePreview;
  onClose: () => void;
  onChange: (node: RSSAutomationNodeDefinition) => void;
  onDelete: (node: RSSAutomationNodeDefinition) => void;
};

export type NodeFieldReference = {
  kind: 'item' | 'variable';
  name: string;
  value: string;
  preview?: string;
};

const valueTypeOptions = [
  { label: '文本 string', value: 'string' },
  { label: '整数 integer', value: 'integer' },
  { label: '小数 number', value: 'number' },
  { label: '布尔 boolean', value: 'boolean' },
  { label: '日期 datetime', value: 'datetime' },
];

const conditionOperators = [
  ['大于', 'gt'],
  ['大于等于', 'gte'],
  ['小于', 'lt'],
  ['小于等于', 'lte'],
  ['等于', 'eq'],
  ['不等于', 'neq'],
  ['包含', 'contains'],
  ['不包含', 'not_contains'],
  ['开头是', 'starts_with'],
  ['结尾是', 'ends_with'],
  ['正则匹配', 'regex'],
  ['属于列表', 'in'],
  ['存在', 'exists'],
  ['不存在', 'not_exists'],
].map(([label, value]) => ({ label, value }));

const keywordModeOptions = [
  { label: '包含任一关键词', value: 'contains_any' },
  { label: '包含全部关键词', value: 'contains_all' },
  { label: '不能包含任一关键词', value: 'contains_none' },
];

const normalizeKeywords = (raw: unknown) => {
  const values = Array.isArray(raw) ? raw : [];
  return values
    .map((value) => String(value).trim())
    .filter(Boolean)
    .filter((value, index, keywords) => keywords.indexOf(value) === index);
};

const normalizeBranches = (raw: unknown) => {
  const values = Array.isArray(raw) ? raw : [];
  return values
    .map((value) => String(value).trim())
    .filter(Boolean)
    .map((value) => (value.startsWith('branch-') ? value : `branch-${value}`))
    .filter((value, index, branches) => branches.indexOf(value) === index);
};

const conditionValue = (operator: string, raw: unknown) => {
  if (operator === 'in') {
    return String(raw ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (['gt', 'gte', 'lt', 'lte'].includes(operator)) {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : raw;
  }
  return raw;
};

const fieldReferenceOptions = (references: NodeFieldReference[]) =>
  [
    {
      label: 'RSS 原始字段',
      options: references
        .filter((reference) => reference.kind === 'item')
        .map((reference) => ({
          label: reference.preview
            ? `${reference.name} · ${reference.preview}`
            : reference.name,
          value: reference.value,
        })),
    },
    {
      label: '上游流程变量',
      options: references
        .filter((reference) => reference.kind === 'variable')
        .map((reference) => ({
          label: reference.preview
            ? `${reference.name} · ${reference.preview}`
            : reference.name,
          value: reference.value,
        })),
    },
  ].filter((group) => group.options.length > 0);

const NodeConfigModal = ({
  node,
  targets,
  cloudStorages,
  fieldReferences,
  preview,
  onClose,
  onChange,
  onDelete,
}: NodeConfigModalProps) => {
  const [form] = Form.useForm<Record<string, any>>();
  const operator = Form.useWatch('condition_operator', form);
  const cloudStorageID = Form.useWatch('cloud_storage_id', form);
  const directoryPath = Form.useWatch('directory_path', form);
  const referenceOptions = fieldReferenceOptions(fieldReferences);

  useEffect(() => {
    if (!node) return;
    form.resetFields();
    const config = node.config || {};
    const condition = (config.condition || {}) as Record<string, unknown>;
    const rawConditionValue = condition.value;
    form.setFieldsValue({
      name: node.name || NODE_LABELS[node.type],
      max_attempts: node.max_attempts || 1,
      ...config,
      branches: normalizeBranches(config.branches),
      condition_field: condition.field,
      condition_operator: condition.operator || 'eq',
      condition_value: Array.isArray(rawConditionValue)
        ? rawConditionValue.join(', ')
        : rawConditionValue,
      directory_path:
        typeof node.ui?.directory_path === 'string'
          ? node.ui.directory_path
          : undefined,
    });
  }, [form, node]);

  const save = async () => {
    if (!node) return;
    const values = await form.validateFields();
    const config = { ...(node.config || {}) };
    const configKeys = [
      'input',
      'pattern',
      'group',
      'variable',
      'value_type',
      'keywords',
      'match_mode',
      'case_sensitive',
      'policy',
      'target_id',
      'cloud_storage_id',
      'url',
      'save_path',
      'category',
      'tags',
      'paused',
      'sequential',
      'directory_id',
      'title',
      'message',
      'timeout_seconds',
    ];
    for (const key of configKeys) {
      if (key in values) config[key] = values[key];
    }
    if (node.type === 'parallel') {
      config.branches = normalizeBranches(values.branches);
    }
    if (node.type === 'keyword') {
      config.keywords = normalizeKeywords(values.keywords);
    }
    if (node.type === 'if') {
      config.condition = {
        field: values.condition_field,
        operator: values.condition_operator,
        ...(!['exists', 'not_exists'].includes(values.condition_operator)
          ? {
              value: conditionValue(
                values.condition_operator,
                values.condition_value,
              ),
            }
          : {}),
      };
    }
    const ui = { ...(node.ui || {}) };
    if (node.type === 'offline115' || node.type === 'offline115_openapi') {
      if (values.directory_path) {
        ui.directory_path = values.directory_path;
      } else {
        delete ui.directory_path;
      }
    }
    onChange({
      ...node,
      name: values.name,
      max_attempts: values.max_attempts,
      config,
      ui,
    });
    onClose();
  };

  const renderConfig = () => {
    if (!node) return null;
    switch (node.type) {
      case 'regex':
        return (
          <>
            <Text className={styles.nodeConfigHint} type="secondary">
              从字段取出文本后，将捕获组保存为变量；后续可用 $vars.变量名引用。
            </Text>
            <Form.Item
              className={styles.nodeConfigFull}
              extra="选择当前 RSS 字段，或前面节点已经生成的变量。"
              label="输入字段"
              name="input"
              rules={[{ required: true }]}
            >
              <Select
                aria-label="输入字段"
                optionFilterProp="label"
                options={referenceOptions}
                placeholder="选择 RSS 字段或上游变量"
                showSearch
              />
            </Form.Item>
            <Form.Item
              label="正则表达式"
              name="pattern"
              rules={[{ required: true }]}
            >
              <Input placeholder="(\d+)集" />
            </Form.Item>
            <Form.Item label="捕获组" name="group">
              <Input placeholder="1 或命名捕获组 episode" />
            </Form.Item>
            <Form.Item
              label="保存变量名"
              name="variable"
              rules={[{ required: true }]}
            >
              <Input placeholder="episode" />
            </Form.Item>
            <Form.Item
              label="变量类型"
              name="value_type"
              rules={[{ required: true }]}
            >
              <Select options={valueTypeOptions} />
            </Form.Item>
          </>
        );
      case 'keyword':
        return (
          <>
            <Text className={styles.nodeConfigHint} type="secondary">
              检查字段中是否包含关键词，再从“匹配”或“不匹配”出口继续流程。
            </Text>
            <Form.Item
              className={styles.nodeConfigFull}
              extra="选择当前 RSS 字段，或前面节点已经生成的变量。"
              label="输入字段"
              name="input"
              rules={[{ required: true }]}
            >
              <Select
                aria-label="输入字段"
                optionFilterProp="label"
                options={referenceOptions}
                placeholder="选择 RSS 字段或上游变量"
                showSearch
              />
            </Form.Item>
            <Form.Item
              className={styles.nodeConfigFull}
              extra="输入一个关键词后按回车；支持英文或中文逗号批量分隔。"
              label="关键词"
              name="keywords"
              rules={[
                { required: true, message: '请至少添加一个关键词' },
                {
                  validator: (_, value) =>
                    normalizeKeywords(value).length > 0
                      ? Promise.resolve()
                      : Promise.reject(new Error('请至少添加一个关键词')),
                },
              ]}
            >
              <Select
                aria-label="关键词"
                maxTagCount="responsive"
                mode="tags"
                placeholder="例如：CAM、TS"
                tokenSeparators={[',', '，']}
              />
            </Form.Item>
            <Form.Item
              label="匹配规则"
              name="match_mode"
              rules={[{ required: true }]}
            >
              <Select options={keywordModeOptions} />
            </Form.Item>
            <Form.Item
              label="区分大小写"
              name="case_sensitive"
              valuePropName="checked"
            >
              <Switch checkedChildren="区分" unCheckedChildren="忽略" />
            </Form.Item>
          </>
        );
      case 'convert':
        return (
          <>
            <Form.Item
              className={styles.nodeConfigFull}
              extra="选择当前 RSS 字段，或前面节点已经生成的变量。"
              label="输入字段"
              name="input"
              rules={[{ required: true }]}
            >
              <Select
                aria-label="输入字段"
                optionFilterProp="label"
                options={referenceOptions}
                placeholder="选择 RSS 字段或上游变量"
                showSearch
              />
            </Form.Item>
            <Form.Item
              label="保存变量名"
              name="variable"
              rules={[{ required: true }]}
            >
              <Input placeholder="size" />
            </Form.Item>
            <Form.Item
              label="转换类型"
              name="value_type"
              rules={[{ required: true }]}
            >
              <Select options={valueTypeOptions} />
            </Form.Item>
          </>
        );
      case 'if':
        return (
          <>
            <Text className={styles.nodeConfigHint} type="secondary">
              例如：$vars.episode 大于
              1000。连接“是”和“否”两个出口决定后续流程。
            </Text>
            <Form.Item
              className={styles.nodeConfigFull}
              extra="只列出当前 RSS 字段和这个判断节点之前生成的变量。"
              label="比较字段"
              name="condition_field"
              rules={[{ required: true }]}
            >
              <Select
                aria-label="比较字段"
                optionFilterProp="label"
                options={referenceOptions}
                placeholder="选择要判断的字段或变量"
                showSearch
              />
            </Form.Item>
            <Form.Item
              label="判断方式"
              name="condition_operator"
              rules={[{ required: true }]}
            >
              <Select options={conditionOperators} />
            </Form.Item>
            {!['exists', 'not_exists'].includes(operator) && (
              <Form.Item
                label="比较值"
                name="condition_value"
                rules={[{ required: true }]}
                extra={operator === 'in' ? '多个值用英文逗号分隔' : undefined}
              >
                <Input placeholder="1000" />
              </Form.Item>
            )}
          </>
        );
      case 'parallel':
        return (
          <Form.Item
            className={styles.nodeConfigFull}
            label="并行分支"
            name="branches"
            rules={[
              {
                validator: (_, value) =>
                  normalizeBranches(value).length >= 2
                    ? Promise.resolve()
                    : Promise.reject(new Error('至少配置两个并行分支')),
              },
            ]}
            extra="输入分支名后回车；每个出口同一时间并发执行。"
          >
            <Select mode="tags" tokenSeparators={[',']} />
          </Form.Item>
        );
      case 'join':
        return (
          <>
            <Text className={styles.nodeConfigHint} type="secondary">
              完成型策略只有“继续”出口；按成功结果判断时，才会显示“满足”和“未满足”。
            </Text>
            <Form.Item
              className={styles.nodeConfigFull}
              label="汇合策略"
              name="policy"
            >
              <Select
                options={[
                  { label: '全部完成后继续', value: 'all_completed' },
                  { label: '任一完成立即继续', value: 'any_completed' },
                  { label: '全部成功才满足', value: 'all_success' },
                  { label: '任一成功就满足', value: 'any_success' },
                ]}
              />
            </Form.Item>
          </>
        );
      case 'qbittorrent':
        return (
          <>
            <Form.Item
              className={styles.nodeConfigFull}
              label="qBittorrent 目标"
              name="target_id"
              rules={[{ required: true }]}
            >
              <Select
                options={targets
                  .filter((target) => target.enabled)
                  .map((target) => ({ label: target.name, value: target.id }))}
                placeholder="请先在下载目标中配置 qBittorrent"
              />
            </Form.Item>
            <ActionFields fieldReferences={fieldReferences} showQB />
          </>
        );
      case 'offline115':
      case 'offline115_openapi': {
        const isOpenAPI = node.type === 'offline115_openapi';
        return (
          <>
            <Text className={styles.nodeConfigHint} type="secondary">
              {isOpenAPI
                ? '使用 115 开放平台 AccessToken 提交离线任务。'
                : '使用 115 网页 Cookie 提交离线任务。'}
            </Text>
            <Form.Item
              className={styles.nodeConfigFull}
              label="115 账号"
              name="cloud_storage_id"
              rules={[{ required: true }]}
            >
              <Select
                onChange={() =>
                  form.setFieldsValue({
                    directory_id: undefined,
                    directory_path: undefined,
                  })
                }
                options={cloudStorages
                  .filter(
                    (storage) =>
                      storage.storage_type === '115open' &&
                      storage.status === 'active',
                  )
                  .map((storage) => ({
                    label: storage.storage_name,
                    value: storage.id,
                  }))}
                placeholder={
                  isOpenAPI
                    ? '选择已授权的 115 OpenAPI 账号'
                    : '选择带 Cookie 的 115 账号'
                }
              />
            </Form.Item>
            <ActionFields
              cloudStorageId={cloudStorageID}
              directoryAccessMethod={isOpenAPI ? 'openapi' : 'cookie'}
              directoryPath={directoryPath}
              fieldReferences={fieldReferences}
              onDirectoryPathChange={(path) =>
                form.setFieldValue('directory_path', path)
              }
              show115
            />
          </>
        );
      }
      case 'notification':
        return (
          <>
            <Form.Item
              className={styles.nodeConfigFull}
              label="通知标题"
              name="title"
            >
              <TemplateVariableInput
                ariaLabel="通知标题"
                placeholder="RSS 自动化命中"
                references={fieldReferences}
              />
            </Form.Item>
            <Form.Item
              className={styles.nodeConfigFull}
              label="通知内容"
              name="message"
              rules={[{ required: true }]}
              extra="输入 {{ 唤起智能提示，可用 ↑↓ 选择并按 Enter 插入。"
            >
              <TemplateVariableInput
                ariaLabel="通知内容"
                multiline
                references={fieldReferences}
              />
            </Form.Item>
          </>
        );
      default:
        return (
          <Text className={styles.nodeConfigFull} type="secondary">
            {node.type === 'trigger'
              ? '每个新 RSS 条目从这里进入流程。'
              : '该节点没有额外配置。'}
          </Text>
        );
    }
  };

  return (
    <Modal
      centered
      className={styles.nodeConfigModal}
      destroyOnHidden
      footer={
        <div className={styles.nodeConfigFooter}>
          <div>
            {node && node.type !== 'trigger' && (
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={() => onDelete(node)}
                type="text"
              >
                删除节点
              </Button>
            )}
          </div>
          <Space>
            <Button onClick={onClose}>取消</Button>
            <Button onClick={save} type="primary">
              应用配置
            </Button>
          </Space>
        </div>
      }
      maskClosable={false}
      onCancel={onClose}
      open={Boolean(node)}
      title={node ? `配置 · ${NODE_LABELS[node.type]}` : '节点配置'}
      width={760}
    >
      {node && (
        <Form
          className={styles.nodeConfigForm}
          form={form}
          layout="vertical"
          preserve={false}
        >
          {preview && (
            <Alert
              className={styles.nodeConfigPreview}
              message={
                <>
                  <Text strong>{preview.label}</Text>
                  {preview.detail && (
                    <Text type="secondary"> · {preview.detail}</Text>
                  )}
                </>
              }
              showIcon
              type={
                !preview.active
                  ? 'info'
                  : preview.tone === 'success'
                    ? 'success'
                    : 'warning'
              }
            />
          )}
          <Form.Item
            className={styles.nodeConfigFull}
            label="节点名称"
            name="name"
            rules={[{ required: true, message: '请输入节点名称' }]}
          >
            <Input maxLength={120} />
          </Form.Item>
          {renderConfig()}
          {!['trigger', 'end', 'parallel', 'join', 'if', 'keyword'].includes(
            node.type,
          ) && (
            <>
              <Divider className={styles.nodeConfigFull} />
              <Space className={styles.nodeConfigRetryFields} size="large">
                <Form.Item
                  label="最多尝试次数"
                  name="max_attempts"
                  style={{ marginBottom: 0 }}
                >
                  <InputNumber max={10} min={1} />
                </Form.Item>
                {[
                  'qbittorrent',
                  'offline115',
                  'offline115_openapi',
                  'notification',
                ].includes(node.type) && (
                  <Form.Item
                    label="单次超时（秒）"
                    name="timeout_seconds"
                    style={{ marginBottom: 0 }}
                  >
                    <InputNumber max={600} min={5} />
                  </Form.Item>
                )}
              </Space>
            </>
          )}
        </Form>
      )}
    </Modal>
  );
};

const ActionFields = ({
  showQB,
  show115,
  cloudStorageId,
  directoryAccessMethod,
  directoryPath,
  fieldReferences,
  onDirectoryPathChange,
}: {
  showQB?: boolean;
  show115?: boolean;
  cloudStorageId?: number;
  directoryAccessMethod?: 'cookie' | 'openapi';
  directoryPath?: string;
  fieldReferences: NodeFieldReference[];
  onDirectoryPathChange?: (path: string) => void;
}) => (
  <>
    <Form.Item
      className={styles.nodeConfigFull}
      label="下载 URL"
      name="url"
      rules={[{ required: true }]}
      extra="选择 enclosure@url 等解析出的下载字段，通常为 download_url。"
    >
      <Select
        aria-label="下载 URL"
        optionFilterProp="label"
        options={fieldReferenceOptions(fieldReferences)}
        placeholder="选择 RSS 下载字段或上游变量"
        showSearch
      />
    </Form.Item>
    {showQB && (
      <>
        <Form.Item label="保存路径" name="save_path">
          <Input placeholder="/downloads/{{item.category}}" />
        </Form.Item>
        <Form.Item label="分类" name="category">
          <Input placeholder="{{item.category}}" />
        </Form.Item>
        <Form.Item className={styles.nodeConfigFull} label="标签" name="tags">
          <Input placeholder="rss,自动化" />
        </Form.Item>
        <Space className={styles.nodeConfigFull} size="large">
          <Form.Item label="暂停添加" name="paused" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label="顺序下载" name="sequential" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Space>
      </>
    )}
    {show115 && (
      <>
        <Form.Item hidden name="directory_path">
          <Input />
        </Form.Item>
        <Form.Item
          className={styles.nodeConfigFull}
          extra="选择目录后会保存对应目录 ID；未选择时使用根目录。"
          label="保存目录"
          name="directory_id"
        >
          <DirectoryIdInput
            accessMethod={directoryAccessMethod}
            cloudStorageId={cloudStorageId}
            onSelectedPathChange={onDirectoryPathChange}
            selectedPath={directoryPath}
          />
        </Form.Item>
      </>
    )}
  </>
);

export default NodeConfigModal;
