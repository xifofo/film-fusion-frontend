import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
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
  RSSAutomationNodeProtocol,
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
  cloudDirectories: API.CloudDirectory[];
  fieldReferences: NodeFieldReference[];
  nodeProtocol?: RSSAutomationNodeProtocol;
  preview?: RSSAutomationNodePreview;
  onClose: () => void;
  onChange: (node: RSSAutomationNodeDefinition) => void;
  onDelete: (node: RSSAutomationNodeDefinition) => void;
};

export type NodeFieldReference = {
  kind: 'item' | 'variable' | 'node';
  name: string;
  value: string;
  preview?: string;
  dataType?: string;
  description?: string;
};

type NodeInputProtocolMap = Map<
  string,
  RSSAutomationNodeProtocol['inputs'][number]
>;

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

const normalizeReplacementRules = (raw: unknown) => {
  const values = Array.isArray(raw) ? raw : [];
  return values.map((value) => {
    const rule =
      value && typeof value === 'object'
        ? (value as Record<string, unknown>)
        : {};
    return {
      keyword: String(rule.keyword ?? '').trim(),
      replacement: String(rule.replacement ?? ''),
    };
  });
};

const normalizeBranches = (raw: unknown) => {
  const values = Array.isArray(raw) ? raw : [];
  return values
    .map((value) => String(value).trim())
    .filter(Boolean)
    .map((value) => (value.startsWith('branch-') ? value : `branch-${value}`))
    .filter((value, index, branches) => branches.indexOf(value) === index);
};

const parseHTTPHeaders = (raw: unknown): Record<string, string> => {
  const text = String(raw ?? '').trim();
  if (!text) return {};
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('请求头必须是 JSON 对象');
  }
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(parsed)) {
    if (
      !name.trim() ||
      !['string', 'number', 'boolean'].includes(typeof value)
    ) {
      throw new Error('请求头的名称不能为空，值必须是文本或标量');
    }
    headers[name] = String(value);
  }
  return headers;
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

const TemplateConfigField = ({
  field,
  label,
  references,
  protocol,
  placeholder,
  required = false,
  insertMode = 'reference',
}: {
  field: string;
  label: string;
  references: NodeFieldReference[];
  protocol?: RSSAutomationNodeProtocol['inputs'][number];
  placeholder?: string;
  required?: boolean;
  insertMode?: 'reference' | 'template';
}) => (
  <Form.Item
    className={styles.nodeConfigFull}
    extra={protocol ? protocolFieldExtra(protocol) : undefined}
    label={label}
    name={field}
    rules={required ? [{ required: true }] : undefined}
  >
    <TemplateVariableInput
      ariaLabel={label}
      insertMode={insertMode}
      placeholder={placeholder || '输入内容，或点击“插入变量”'}
      references={references}
    />
  </Form.Item>
);

const protocolExample = (value: unknown) => {
  if (value == null || value === '') return '';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.replace(
    /\{\{([^{}]+)\}\}/g,
    (_, path: string) => `[变量：$${path}]`,
  );
};

const protocolFieldExtra = (
  protocol?: RSSAutomationNodeProtocol['inputs'][number],
) => {
  if (!protocol) return undefined;
  const example = protocolExample(protocol.example);
  return `${protocol.description}（${protocol.type}）${example ? ` 例：${example}` : ''}`;
};

const NodeConfigModal = ({
  node,
  targets,
  cloudStorages,
  cloudDirectories,
  fieldReferences,
  nodeProtocol,
  preview,
  onClose,
  onChange,
  onDelete,
}: NodeConfigModalProps) => {
  const [form] = Form.useForm<Record<string, any>>();
  const operator = Form.useWatch('condition_operator', form);
  const cloudStorageID = Form.useWatch('cloud_storage_id', form);
  const directoryPath = Form.useWatch('directory_path', form);
  const filenameRegexEnabled = Form.useWatch('filename_regex_enabled', form);
  const recognitionMode = Form.useWatch('recognition_mode', form);
  const inputProtocols: NodeInputProtocolMap = new Map(
    (nodeProtocol?.inputs || []).map((protocol) => [protocol.name, protocol]),
  );
  const inputProtocol = (field: string) => inputProtocols.get(field);
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
      headers_json: JSON.stringify(config.headers || {}, null, 2),
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
      'replacements',
      'replacement',
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
      'poll_interval_seconds',
      'max_wait_minutes',
      'image_url',
      'tmdb_id',
      'recognition_mode',
      'lookup_tmdb',
      'input',
      'year',
      'resolution',
      'pan_type',
      'slug',
      'cloud_directory_id',
      'media_type',
      'best_version_enabled',
      'delete_source_folder',
      'filename_regex_enabled',
      'filename_regex_pattern',
      'filename_regex_replacement',
      'title',
      'message',
      'refresh_library',
      'method',
      'body',
      'content_type',
      'allow_private_network',
      'follow_redirects',
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
    if (node.type === 'keyword_replace') {
      config.replacements = normalizeReplacementRules(values.replacements);
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
    if (node.type === 'http_request') {
      config.headers = parseHTTPHeaders(values.headers_json);
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
              extra={
                protocolFieldExtra(inputProtocol('input')) ||
                '选择当前 RSS 字段，或前面节点已经生成的变量。'
              }
              label="输入字段"
              name="input"
              rules={[{ required: true }]}
            >
              <TemplateVariableInput
                ariaLabel="输入字段"
                placeholder="点击“插入变量”选择 RSS 字段或上游变量"
                references={fieldReferences}
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
              extra={
                protocolFieldExtra(inputProtocol('input')) ||
                '选择当前 RSS 字段，或前面节点已经生成的变量。'
              }
              label="输入字段"
              name="input"
              rules={[{ required: true }]}
            >
              <TemplateVariableInput
                ariaLabel="输入字段"
                placeholder="点击“插入变量”选择 RSS 字段或上游变量"
                references={fieldReferences}
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
      case 'keyword_replace':
        return (
          <>
            <Text className={styles.nodeConfigHint} type="secondary">
              按列表顺序执行字面量全局替换，并将最终文本保存到 $vars.变量名。
            </Text>
            <TemplateConfigField
              field="input"
              label="输入字段"
              protocol={inputProtocol('input')}
              references={fieldReferences}
              required
            />
            <Form.List
              name="replacements"
              rules={[
                {
                  validator: (_, rules) => {
                    if (!Array.isArray(rules) || rules.length === 0) {
                      return Promise.reject(
                        new Error('请至少添加一条关键词替换规则'),
                      );
                    }
                    if (rules.length > 100) {
                      return Promise.reject(
                        new Error('关键词替换规则不能超过 100 条'),
                      );
                    }
                    return Promise.resolve();
                  },
                },
              ]}
            >
              {(fields, { add, remove }, { errors }) => (
                <div
                  className={`${styles.nodeConfigFull} ${styles.replacementRuleList}`}
                >
                  {fields.map((field, index) => (
                    <div className={styles.replacementRuleRow} key={field.key}>
                      <Form.Item
                        label={`关键词 ${index + 1}`}
                        name={[field.name, 'keyword']}
                        rules={[
                          {
                            required: true,
                            whitespace: true,
                            message: '请输入要替换的关键词',
                          },
                        ]}
                      >
                        <Input maxLength={200} placeholder="例如：WEB-DL" />
                      </Form.Item>
                      <Form.Item
                        extra="留空表示删除关键词"
                        label="替换为"
                        name={[field.name, 'replacement']}
                      >
                        <Input maxLength={2000} placeholder="例如：WEB" />
                      </Form.Item>
                      <Button
                        aria-label={`删除关键词替换规则 ${index + 1}`}
                        className={styles.replacementRuleDelete}
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => remove(field.name)}
                        type="text"
                      />
                    </div>
                  ))}
                  <Button
                    block
                    icon={<PlusOutlined />}
                    onClick={() => add({ keyword: '', replacement: '' })}
                    type="dashed"
                  >
                    添加替换规则
                  </Button>
                  <Form.ErrorList errors={errors} />
                </div>
              )}
            </Form.List>
            <Form.Item
              label="区分大小写"
              name="case_sensitive"
              valuePropName="checked"
            >
              <Switch checkedChildren="区分" unCheckedChildren="忽略" />
            </Form.Item>
            <Form.Item
              label="保存变量名"
              name="variable"
              rules={[{ required: true }]}
            >
              <Input placeholder="normalized_title" />
            </Form.Item>
          </>
        );
      case 'regex_replace':
        return (
          <>
            <Text className={styles.nodeConfigHint} type="secondary">
              使用 Go/RE2 正则全局替换所有命中内容，并将结果保存到
              $vars.变量名。
            </Text>
            <TemplateConfigField
              field="input"
              label="输入字段"
              protocol={inputProtocol('input')}
              references={fieldReferences}
              required
            />
            <Form.Item
              label="正则表达式"
              name="pattern"
              rules={[{ required: true }]}
            >
              <Input placeholder="[._-]+" />
            </Form.Item>
            <Form.Item
              extra="支持 ${1} 或 ${name} 捕获组；捕获组后紧接文字时必须使用花括号。留空表示删除命中内容。"
              label="替换内容"
              name="replacement"
            >
              <Input placeholder="例如：${name} 第${2}集" />
            </Form.Item>
            <Form.Item
              label="保存变量名"
              name="variable"
              rules={[{ required: true }]}
            >
              <Input placeholder="normalized_title" />
            </Form.Item>
          </>
        );
      case 'convert':
        return (
          <>
            <Form.Item
              className={styles.nodeConfigFull}
              extra={
                protocolFieldExtra(inputProtocol('input')) ||
                '选择当前 RSS 字段，或前面节点已经生成的变量。'
              }
              label="输入字段"
              name="input"
              rules={[{ required: true }]}
            >
              <TemplateVariableInput
                ariaLabel="输入字段"
                placeholder="点击“插入变量”选择 RSS 字段或上游变量"
                references={fieldReferences}
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
              extra={
                protocolFieldExtra(inputProtocol('condition.field')) ||
                '只列出当前 RSS 字段和这个判断节点之前生成的变量。'
              }
              label="比较字段"
              name="condition_field"
              rules={[{ required: true }]}
            >
              <TemplateVariableInput
                ariaLabel="比较字段"
                placeholder="点击“插入变量”选择要判断的字段或变量"
                references={fieldReferences}
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
                extra={
                  protocolFieldExtra(inputProtocol('condition.value')) ||
                  (operator === 'in' ? '多个值用英文逗号分隔' : undefined)
                }
              >
                <TemplateVariableInput
                  ariaLabel="比较值"
                  placeholder={
                    operator === 'in'
                      ? '多个值用英文逗号分隔'
                      : '输入固定值，或点击“插入变量”'
                  }
                  references={fieldReferences}
                />
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
                placeholder="请先在“下载器设置”添加 qBittorrent 账号"
              />
            </Form.Item>
            <ActionFields fieldReferences={fieldReferences} showQB />
          </>
        );
      case 'wait_qbittorrent':
        return (
          <>
            <Alert
              className={styles.nodeConfigFull}
              description="直接连接 qBittorrent 下载节点的成功出口。FilmFusion 会用提交时附加的内部标签定位任务，服务重启后仍可继续等待。"
              title="只有 qBittorrent 下载完成后才走成功出口"
              showIcon
              type="info"
            />
            <Form.Item
              label="检查间隔（秒）"
              name="poll_interval_seconds"
              rules={[{ required: true }]}
            >
              <InputNumber max={300} min={5} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              extra="默认 10080 分钟，即 7 天。"
              label="最长等待（分钟）"
              name="max_wait_minutes"
              rules={[{ required: true }]}
            >
              <InputNumber max={43200} min={1} style={{ width: '100%' }} />
            </Form.Item>
          </>
        );
      case 'moviepilot_transfer':
        return (
          <>
            <Alert
              className={styles.nodeConfigFull}
              description="直接连接“等待 qBittorrent 完成”的成功出口。节点会同步调用 MP2 手动整理接口；只有 MP2 明确返回成功，后续删种节点才会执行。"
              title="先完成 MP2 整理，再继续后续操作"
              showIcon
              type="info"
            />
            <Form.Item
              className={styles.nodeConfigFull}
              extra="留空使用 qB 返回的 content_path；如果 qB 与 MP2 的容器挂载路径不同，请填写 MP2 容器内可见的路径或流程变量。"
              label="MP2 可见源路径（可选）"
              name="source_path"
            >
              <TemplateVariableInput
                ariaLabel="MP2 可见源路径"
                placeholder="留空自动使用 qB 完成路径，或点击“插入变量”"
                references={fieldReferences}
              />
            </Form.Item>
            <Form.Item label="源路径类型" name="file_type">
              <Select
                options={[
                  { label: '自动判断', value: 'auto' },
                  { label: '单个文件', value: 'file' },
                  { label: '文件夹', value: 'dir' },
                ]}
              />
            </Form.Item>
            <Form.Item label="媒体类型" name="media_type">
              <Select
                options={[
                  { label: '自动识别', value: 'auto' },
                  { label: '电影', value: 'movie' },
                  { label: '电视剧', value: 'tv' },
                ]}
              />
            </Form.Item>
            <Form.Item
              className={styles.nodeConfigFull}
              extra="可留空让 MP2 自动识别；也可引用下载前的 MP 标题识别结果。"
              label="辅助 TMDB ID（可选）"
              name="tmdb_id"
              rules={[
                {
                  validator: (_, value) => {
                    const text = String(value || '').trim();
                    if (
                      !text ||
                      /^[1-9]\d{0,19}$/.test(text) ||
                      text.startsWith('$') ||
                      text.includes('{{')
                    ) {
                      return Promise.resolve();
                    }
                    return Promise.reject(
                      new Error('请输入正整数 TMDB ID 或流程变量'),
                    );
                  },
                },
              ]}
            >
              <TemplateVariableInput
                ariaLabel="MP2 整理辅助 TMDB ID"
                placeholder="例如 1396，或点击“插入变量”"
                references={fieldReferences}
              />
            </Form.Item>
            <Form.Item
              extra="留空沿用 MP2 目录配置；也可填写 MP2 支持的 copy、move、link 等方式。"
              label="整理方式（可选）"
              name="transfer_type"
            >
              <Input placeholder="留空沿用 MP2 配置" />
            </Form.Item>
            <Form.Item label="刮削元数据" name="scrape" valuePropName="checked">
              <Switch />
            </Form.Item>
          </>
        );
      case 'delete_qbittorrent':
        return (
          <>
            <Alert
              className={styles.nodeConfigFull}
              description="默认只从 qBittorrent 删除任务并停止做种，不删除下载数据。若开启同时删除文件，流程必须直接连接在“MP2 整理入库”成功出口之后。"
              title="删除操作不会自动重试"
              showIcon
              type="warning"
            />
            <Form.Item
              className={styles.nodeConfigFull}
              extra="开启后会让 qBittorrent 删除源下载数据；后端会强制校验 MP2 已整理成功。"
              label="同时删除下载文件"
              name="delete_files"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
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
      case 'wait115':
        return (
          <>
            <Alert
              className={styles.nodeConfigFull}
              description="直接连接在 115 Cookie/OpenAPI 离线节点的“成功”出口。任务提交后会持久化查询进度，服务重启也会继续等待。"
              title="只有 115 云下载真正完成后，才会走成功出口。"
              showIcon
              type="info"
            />
            <Form.Item
              label="检查间隔（秒）"
              name="poll_interval_seconds"
              rules={[{ required: true }]}
            >
              <InputNumber max={300} min={5} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label="最长等待（分钟）"
              name="max_wait_minutes"
              rules={[{ required: true }]}
              extra="默认 10080 分钟，即 7 天；超时后走失败出口。"
            >
              <InputNumber max={43200} min={1} style={{ width: '100%' }} />
            </Form.Item>
          </>
        );
      case 'rename115_openapi':
        return (
          <>
            <Alert
              className={styles.nodeConfigFull}
              description="通常连接在“等待 115 下载完成”的成功出口，并把该节点的 file_id 插入下方。样本预览只展示将要使用的 ID 和名称，不会调用真实 115 接口。"
              title="通过 115 OpenAPI 重命名文件或文件夹"
              showIcon
              type="info"
            />
            <Form.Item
              className={styles.nodeConfigFull}
              label="115 OpenAPI 账号"
              name="cloud_storage_id"
              rules={[{ required: true }]}
            >
              <Select
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
                placeholder="选择执行重命名的 115 OpenAPI 账号"
              />
            </Form.Item>
            <Form.Item
              className={styles.nodeConfigFull}
              extra={
                protocolFieldExtra(inputProtocol('file_id')) ||
                '推荐插入“等待 115 下载完成 · 首个完成文件 ID”。'
              }
              label="文件或文件夹 ID"
              name="file_id"
              rules={[{ required: true }]}
            >
              <TemplateVariableInput
                ariaLabel="115 重命名对象 ID"
                placeholder="点击“插入变量”选择等待节点的 file_id"
                references={fieldReferences}
              />
            </Form.Item>
            <Form.Item
              className={styles.nodeConfigFull}
              extra={
                protocolFieldExtra(inputProtocol('new_name')) ||
                '最大 255 字节；重命名文件时请在模板中保留 .mkv 等扩展名。'
              }
              label="新名称"
              name="new_name"
              rules={[{ required: true }]}
            >
              <TemplateVariableInput
                ariaLabel="115 重命名新名称"
                placeholder="例如：{{item.title}}.mkv"
                references={fieldReferences}
              />
            </Form.Item>
          </>
        );
      case 'filmfusion_recognize':
        return (
          <>
            <Text className={styles.nodeConfigHint} type="secondary">
              {recognitionMode === 'file'
                ? '直接连接“等待 115 下载完成”的成功出口，递归读取其中的视频文件；不会修改云端文件名，也不会调用 MP2。'
                : '读取 RSS 标题或任意流程变量，应用“识别词管理”中已保存的词表后，由 FilmFusion 本地内核解析。'}
            </Text>
            <Form.Item
              className={styles.nodeConfigFull}
              extra={protocolFieldExtra(inputProtocol('recognition_mode'))}
              label="识别对象"
              name="recognition_mode"
              rules={[{ required: true }]}
            >
              <Select
                options={[
                  { label: '发布标题', value: 'title' },
                  { label: '115 下载文件', value: 'file' },
                ]}
              />
            </Form.Item>
            {recognitionMode !== 'file' && (
              <Form.Item
                className={styles.nodeConfigFull}
                extra={
                  protocolFieldExtra(inputProtocol('input')) ||
                  '通常选择 $item.title，也可以选择上游生成的标题变量。'
                }
                label="待识别标题"
                name="input"
                rules={[{ required: true }]}
              >
                <TemplateVariableInput
                  ariaLabel="FilmFusion 本地识别标题"
                  placeholder="点击“插入变量”选择 RSS 标题或上游变量"
                  references={fieldReferences}
                />
              </Form.Item>
            )}
            <Form.Item
              className={styles.nodeConfigFull}
              extra={
                protocolFieldExtra(inputProtocol('lookup_tmdb')) ||
                '关闭后仍会执行识别词和本地解析，只是不再向 TMDB 补全海报、评分等信息。'
              }
              label="查询 TMDB"
              name="lookup_tmdb"
              valuePropName="checked"
            >
              <Switch checkedChildren="查询" unCheckedChildren="仅本地" />
            </Form.Item>
            <Form.Item
              className={styles.nodeConfigFull}
              extra={
                protocolFieldExtra(inputProtocol('tmdb_id')) ||
                '可留空自动解析；填写后会加入 {tmdb-ID} 标记并校验结果。'
              }
              label="辅助 TMDB ID（可选）"
              name="tmdb_id"
              rules={[
                {
                  validator: (_, value) => {
                    const text = String(value || '').trim();
                    if (
                      !text ||
                      /^[1-9]\d{0,19}$/.test(text) ||
                      text.startsWith('$') ||
                      text.includes('{{')
                    ) {
                      return Promise.resolve();
                    }
                    return Promise.reject(
                      new Error('请输入正整数 TMDB ID 或流程变量'),
                    );
                  },
                },
              ]}
            >
              <TemplateVariableInput
                ariaLabel="FilmFusion 本地识别辅助 TMDB ID"
                placeholder="例如 1396，或点击“插入变量”"
                references={fieldReferences}
              />
            </Form.Item>
          </>
        );
      case 'moviepilot_recognize':
        return (
          <>
            <Alert
              className={styles.nodeConfigFull}
              description="直接连接在“等待 115 下载完成”节点的成功出口。若下载结果是文件夹，会递归识别其中的视频文件。"
              title="识别只读取文件名和文件夹上下文，不会修改 115 云端文件名。"
              showIcon
              type="info"
            />
            <Form.Item
              className={styles.nodeConfigFull}
              extra={`${protocolFieldExtra(inputProtocol('tmdb_id')) || '可留空自动识别。'} 运行时会按整理模块的规则构造 {tmdb-ID} 辅助识别名。`}
              label="辅助 TMDB ID（可选）"
              name="tmdb_id"
              rules={[
                {
                  validator: (_, value) => {
                    const text = String(value || '').trim();
                    if (
                      !text ||
                      /^[1-9]\d{0,19}$/.test(text) ||
                      text.startsWith('$') ||
                      text.includes('{{')
                    ) {
                      return Promise.resolve();
                    }
                    return Promise.reject(
                      new Error('请输入正整数 TMDB ID 或流程变量'),
                    );
                  },
                },
              ]}
            >
              <TemplateVariableInput
                ariaLabel="辅助 TMDB ID"
                placeholder="例如 1396，或点击“插入变量”"
                references={fieldReferences}
              />
            </Form.Item>
          </>
        );
      case 'moviepilot_title_recognize':
        return (
          <>
            <Alert
              className={styles.nodeConfigFull}
              description="可放在关键词或 IF 筛选后、下载节点前。节点会输出 TMDB ID、标题、年份、分类、评分和海报地址，供下载路径或通知继续使用。"
              title="使用 RSS 标题调用 MoviePilot 识别，不依赖 115 下载。"
              showIcon
              type="info"
            />
            <Form.Item
              className={styles.nodeConfigFull}
              extra={
                protocolFieldExtra(inputProtocol('input')) ||
                '通常选择 $item.title，也可以选择上游生成的标题变量。'
              }
              label="待识别标题"
              name="input"
              rules={[{ required: true }]}
            >
              <TemplateVariableInput
                ariaLabel="待识别标题"
                placeholder="点击“插入变量”选择 RSS 标题或上游变量"
                references={fieldReferences}
              />
            </Form.Item>
            <Form.Item
              className={styles.nodeConfigFull}
              extra={protocolFieldExtra(inputProtocol('tmdb_id'))}
              label="辅助 TMDB ID（可选）"
              name="tmdb_id"
              rules={[
                {
                  validator: (_, value) => {
                    const text = String(value || '').trim();
                    if (
                      !text ||
                      /^[1-9]\d{0,19}$/.test(text) ||
                      text.startsWith('$') ||
                      text.includes('{{')
                    ) {
                      return Promise.resolve();
                    }
                    return Promise.reject(
                      new Error('请输入正整数 TMDB ID 或流程变量'),
                    );
                  },
                },
              ]}
            >
              <TemplateVariableInput
                ariaLabel="标题识别辅助 TMDB ID"
                placeholder="例如 1396，或点击“插入变量”"
                references={fieldReferences}
              />
            </Form.Item>
          </>
        );
      case 'media_exists':
        return (
          <>
            <Alert
              className={styles.nodeConfigFull}
              description="按目录配置计算本地目标目录，同时用 TMDB ID 查询 Emby。已存在走“已存在”，不存在走“不存在”。"
              title="建议放在下载节点之前避免重复下载"
              showIcon
              type="info"
            />
            <Form.Item
              className={styles.nodeConfigFull}
              label="查重目录配置"
              name="cloud_directory_id"
              rules={[{ required: true, message: '请选择查重目录配置' }]}
            >
              <Select
                options={cloudDirectories.map((directory) => ({
                  label: [
                    directory.directory_name,
                    directory.save_path || '未配置本地保存路径',
                  ].join(' · '),
                  value: directory.id,
                  disabled: !directory.save_path,
                }))}
                placeholder="选择目录配置"
                showSearch
              />
            </Form.Item>
            <TemplateConfigField
              field="tmdb_id"
              label="TMDB ID"
              placeholder="点击“插入变量”选择 MP 识别结果"
              protocol={inputProtocol('tmdb_id')}
              references={fieldReferences}
              required
            />
            <TemplateConfigField
              field="title"
              label="媒体标题"
              protocol={inputProtocol('title')}
              references={fieldReferences}
            />
            <TemplateConfigField
              field="year"
              label="年份"
              protocol={inputProtocol('year')}
              references={fieldReferences}
            />
            <TemplateConfigField
              field="media_type"
              label="媒体类型"
              protocol={inputProtocol('media_type')}
              references={fieldReferences}
            />
            <TemplateConfigField
              field="category"
              label="媒体分类"
              protocol={inputProtocol('category')}
              references={fieldReferences}
            />
          </>
        );
      case 'hdhive_query':
        return (
          <>
            <Alert
              className={styles.nodeConfigFull}
              description="按 TMDB ID 查询 HDHive，可按分辨率和网盘类型筛选。找到资源走“找到资源”，否则走“没有资源”。"
              title="这里只查询资源，不会扣积分或解锁"
              showIcon
              type="info"
            />
            <TemplateConfigField
              field="tmdb_id"
              label="TMDB ID"
              protocol={inputProtocol('tmdb_id')}
              references={fieldReferences}
              required
            />
            <TemplateConfigField
              field="media_type"
              label="媒体类型"
              placeholder="movie、tv 或上游变量"
              protocol={inputProtocol('media_type')}
              references={fieldReferences}
              required
            />
            <TemplateConfigField
              field="resolution"
              label="分辨率筛选（可选）"
              placeholder="例如 2160p"
              protocol={inputProtocol('resolution')}
              references={fieldReferences}
            />
            <TemplateConfigField
              field="pan_type"
              label="网盘类型筛选（可选）"
              placeholder="例如 115"
              protocol={inputProtocol('pan_type')}
              references={fieldReferences}
            />
          </>
        );
      case 'hdhive_unlock':
        return (
          <>
            <Alert
              className={styles.nodeConfigFull}
              description="连接 HDHive 查询节点的“找到资源”出口。运行时会真实解锁资源，可能消耗 HDHive 积分。"
              title="这是实际解锁动作"
              showIcon
              type="warning"
            />
            <TemplateConfigField
              field="slug"
              label="资源 slug"
              placeholder="点击“插入变量”选择查询节点的 selected_slug"
              protocol={inputProtocol('slug')}
              references={fieldReferences}
              required
            />
          </>
        );
      case 'organize_strm':
        return (
          <>
            <Alert
              className={styles.nodeConfigFull}
              description="运行时会复用“目录配置”里的分类、过滤、保存路径和 STRM 前缀，真实重命名并移动 115 文件，然后写入本地 STRM。默认不删除源目录，也不自动重试。"
              title="这是实际整理动作"
              showIcon
              type="warning"
            />
            <Form.Item
              className={styles.nodeConfigFull}
              extra="目录配置必须与上游 115 下载节点使用同一个账号，并且需要设置保存路径和可用 Cookie。"
              label="整理目录配置"
              name="cloud_directory_id"
              rules={[{ required: true, message: '请选择整理目录配置' }]}
            >
              <Select
                aria-label="整理目录配置"
                options={cloudDirectories.map((directory) => {
                  const storageType =
                    directory.cloud_storage?.storage_type || '';
                  const disabled =
                    !directory.save_path ||
                    (storageType !== '' && storageType !== '115open');
                  return {
                    label: [
                      directory.directory_name,
                      directory.cloud_storage?.storage_name,
                      directory.save_path || '未配置 STRM 保存路径',
                    ]
                      .filter(Boolean)
                      .join(' · '),
                    value: directory.id,
                    disabled,
                  };
                })}
                placeholder="选择现有目录配置"
                showSearch={{ optionFilterProp: 'label' }}
              />
            </Form.Item>
            <Form.Item label="媒体类型" name="media_type">
              <Select
                options={[
                  { label: '自动识别', value: 'auto' },
                  { label: '电影', value: 'movie' },
                  { label: '电视剧 / 动漫', value: 'tv' },
                ]}
              />
            </Form.Item>
            <Form.Item
              extra="留空时沿用 MoviePilot 分类和目录配置的分类规则。"
              label="指定分类（可选）"
              name="category"
            >
              <Input placeholder="例如 国产剧集" />
            </Form.Item>
            <Form.Item
              label="只保留最佳版本"
              name="best_version_enabled"
              valuePropName="checked"
            >
              <Switch checkedChildren="开启" unCheckedChildren="关闭" />
            </Form.Item>
            <Form.Item
              extra="直接下载到单个文件时不会删除其整个父目录。字幕尚未下载完时会进入延迟删除。"
              label="整理成功后删除源目录"
              name="delete_source_folder"
              valuePropName="checked"
            >
              <Switch checkedChildren="删除" unCheckedChildren="保留" />
            </Form.Item>
            <Divider className={styles.nodeConfigFull} />
            <Form.Item
              label="启用文件名正则预处理"
              name="filename_regex_enabled"
              valuePropName="checked"
            >
              <Switch checkedChildren="开启" unCheckedChildren="关闭" />
            </Form.Item>
            {filenameRegexEnabled && (
              <>
                <Form.Item
                  label="文件名正则"
                  name="filename_regex_pattern"
                  rules={[{ required: true, message: '请输入文件名正则' }]}
                >
                  <Input placeholder=".* - (.*)-.*" />
                </Form.Item>
                <Form.Item label="替换内容" name="filename_regex_replacement">
                  <Input placeholder="$1" />
                </Form.Item>
              </>
            )}
          </>
        );
      case 'strm_verify':
        return (
          <>
            <Alert
              className={styles.nodeConfigFull}
              description="只读取整理节点返回的 STRM 文件，校验路径边界、文件类型、大小和非空内容，不访问 115。"
              title="只读校验，不会修改或重生成 STRM"
              showIcon
              type="info"
            />
            <Form.Item
              className={styles.nodeConfigFull}
              label="STRM 目录配置"
              name="cloud_directory_id"
              rules={[{ required: true, message: '请选择 STRM 目录配置' }]}
            >
              <Select
                options={cloudDirectories.map((directory) => ({
                  label: [
                    directory.directory_name,
                    directory.save_path || '未配置 STRM 保存路径',
                  ].join(' · '),
                  value: directory.id,
                  disabled: !directory.save_path,
                }))}
                placeholder="选择与整理节点相同的目录配置"
                showSearch
              />
            </Form.Item>
          </>
        );
      case 'strm_regenerate':
        return (
          <>
            <Alert
              className={styles.nodeConfigFull}
              description="只使用上游整理节点已返回的 STRM 路径和内容，在配置的本地根目录内原子重写；不请求 115。"
              title="只能连接 STRM 校验节点的“无效”出口"
              showIcon
              type="warning"
            />
            <Form.Item
              className={styles.nodeConfigFull}
              label="STRM 目录配置"
              name="cloud_directory_id"
              rules={[{ required: true, message: '请选择 STRM 目录配置' }]}
            >
              <Select
                options={cloudDirectories.map((directory) => ({
                  label: [
                    directory.directory_name,
                    directory.save_path || '未配置 STRM 保存路径',
                  ].join(' · '),
                  value: directory.id,
                  disabled: !directory.save_path,
                }))}
                placeholder="选择与整理 / 校验节点相同的目录配置"
                showSearch
              />
            </Form.Item>
          </>
        );
      case 'emby_refresh_wait':
        return (
          <>
            <Alert
              className={styles.nodeConfigFull}
              description="首次执行触发一次 Emby 全库刷新，然后按 TMDB ID 轮询；服务重启后会继续等待且不会重复刷新。"
              title="用于确认 STRM 已真正进入 Emby 媒体库"
              showIcon
              type="info"
            />
            <TemplateConfigField
              field="tmdb_id"
              label="TMDB ID"
              protocol={inputProtocol('tmdb_id')}
              references={fieldReferences}
              required
            />
            <TemplateConfigField
              field="media_type"
              label="媒体类型（可选）"
              placeholder="movie、tv 或上游变量"
              protocol={inputProtocol('media_type')}
              references={fieldReferences}
            />
            <Form.Item
              label="触发 Emby 媒体库刷新"
              name="refresh_library"
              valuePropName="checked"
            >
              <Switch checkedChildren="刷新" unCheckedChildren="只等待" />
            </Form.Item>
            <Form.Item
              label="检查间隔（秒）"
              name="poll_interval_seconds"
              rules={[{ required: true }]}
            >
              <InputNumber max={300} min={5} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label="最长等待（分钟）"
              name="max_wait_minutes"
              rules={[{ required: true }]}
            >
              <InputNumber max={1440} min={1} style={{ width: '100%' }} />
            </Form.Item>
          </>
        );
      case 'http_request':
        return (
          <>
            <Alert
              className={styles.nodeConfigFull}
              description="预览时不发起请求。真正运行时默认禁止访问内网地址、禁止跳转，响应最多保留 1 MiB。"
              title="通用 HTTP / Webhook 节点"
              showIcon
              type="info"
            />
            <Form.Item
              label="HTTP 方法"
              name="method"
              rules={[{ required: true }]}
            >
              <Select
                options={['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(
                  (value) => ({ label: value, value }),
                )}
              />
            </Form.Item>
            <TemplateConfigField
              field="url"
              insertMode="template"
              label="请求地址"
              placeholder="例如 https://hooks.example/api/media，也可插入变量"
              protocol={inputProtocol('url')}
              references={fieldReferences}
              required
            />
            <Form.Item label="Content-Type" name="content_type">
              <Input placeholder="application/json" />
            </Form.Item>
            <Form.Item
              className={styles.nodeConfigFull}
              extra={`${protocolFieldExtra(inputProtocol('headers')) || 'JSON 对象；请求头的值支持变量。'} Authorization 等敏感值会保存在流程定义中。`}
              label="请求头 JSON"
              name="headers_json"
              rules={[
                {
                  validator: (_, value) => {
                    try {
                      parseHTTPHeaders(value);
                      return Promise.resolve();
                    } catch (error: any) {
                      return Promise.reject(
                        new Error(error?.message || '请求头 JSON 无效'),
                      );
                    }
                  },
                },
              ]}
            >
              <TemplateVariableInput
                ariaLabel="HTTP 请求头 JSON"
                insertMode="template"
                multiline
                placeholder={'{\n  "X-Media-Type": "movie"\n}'}
                references={fieldReferences}
              />
            </Form.Item>
            <Form.Item
              className={styles.nodeConfigFull}
              extra={
                protocolFieldExtra(inputProtocol('body')) ||
                '最大 1 MiB；点击“插入变量”可选择 RSS 字段或上游输出。'
              }
              label="请求体（可选）"
              name="body"
            >
              <TemplateVariableInput
                ariaLabel="HTTP 请求体"
                insertMode="template"
                multiline
                placeholder={'{\n  "tmdb_id": "1396"\n}'}
                references={fieldReferences}
              />
            </Form.Item>
            <Form.Item
              extra="只有调用 NAS / 容器内部接口时才开启。"
              label="允许访问内网"
              name="allow_private_network"
              valuePropName="checked"
            >
              <Switch checkedChildren="允许" unCheckedChildren="禁止" />
            </Form.Item>
            <Form.Item
              label="跟随 HTTP 跳转"
              name="follow_redirects"
              valuePropName="checked"
            >
              <Switch checkedChildren="跟随" unCheckedChildren="禁止" />
            </Form.Item>
          </>
        );
      case 'notification':
        return (
          <>
            <Form.Item
              className={styles.nodeConfigFull}
              extra={
                protocolFieldExtra(inputProtocol('image_url')) ||
                '可留空；通常选择 MP 标题识别输出的海报地址。'
              }
              label="通知图片 / 海报（可选）"
              name="image_url"
            >
              <TemplateVariableInput
                ariaLabel="通知图片地址"
                placeholder="输入图片地址，或点击“插入变量”"
                references={fieldReferences}
              />
            </Form.Item>
            <Form.Item
              className={styles.nodeConfigFull}
              extra={protocolFieldExtra(inputProtocol('title'))}
              label="通知标题"
              name="title"
            >
              <TemplateVariableInput
                ariaLabel="通知标题"
                insertMode="template"
                placeholder="RSS 自动化命中"
                references={fieldReferences}
              />
            </Form.Item>
            <Form.Item
              className={styles.nodeConfigFull}
              label="通知内容"
              name="message"
              rules={[{ required: true }]}
              extra={
                protocolFieldExtra(inputProtocol('message')) ||
                '点击“插入变量”，选中后会放到当前光标位置。'
              }
            >
              <TemplateVariableInput
                ariaLabel="通知内容"
                insertMode="template"
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
      mask={{ closable: false }}
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
              title={
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
          {nodeProtocol && (
            <Alert
              className={styles.nodeConfigPreview}
              description={`输入 ${nodeProtocol.inputs.length} 个 · 输出 ${nodeProtocol.outputs.length} 个；变量均声明名称、类型、说明和示例值。`}
              title="节点变量协议已登记"
              showIcon
              type="info"
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
                  <InputNumber
                    disabled={[
                      'moviepilot_transfer',
                      'delete_qbittorrent',
                      'organize_strm',
                      'strm_regenerate',
                      'http_request',
                    ].includes(node.type)}
                    max={
                      [
                        'moviepilot_transfer',
                        'delete_qbittorrent',
                        'organize_strm',
                        'strm_regenerate',
                        'http_request',
                      ].includes(node.type)
                        ? 1
                        : 10
                    }
                    min={1}
                  />
                </Form.Item>
                {[
                  'qbittorrent',
                  'wait_qbittorrent',
                  'moviepilot_transfer',
                  'delete_qbittorrent',
                  'offline115',
                  'offline115_openapi',
                  'wait115',
                  'rename115_openapi',
                  'moviepilot_title_recognize',
                  'filmfusion_recognize',
                  'media_exists',
                  'hdhive_query',
                  'hdhive_unlock',
                  'moviepilot_recognize',
                  'organize_strm',
                  'strm_verify',
                  'strm_regenerate',
                  'emby_refresh_wait',
                  'http_request',
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
      <TemplateVariableInput
        ariaLabel="下载 URL"
        placeholder="点击“插入变量”选择 RSS 下载字段或上游变量"
        references={fieldReferences}
      />
    </Form.Item>
    {showQB && (
      <>
        <Form.Item label="保存路径" name="save_path">
          <TemplateVariableInput
            ariaLabel="qBittorrent 保存路径"
            insertMode="template"
            placeholder="例如 /downloads/电影，可在光标处插入变量"
            references={fieldReferences}
          />
        </Form.Item>
        <Form.Item label="分类" name="category">
          <TemplateVariableInput
            ariaLabel="qBittorrent 分类"
            insertMode="template"
            placeholder="例如 电影，或点击“插入变量”"
            references={fieldReferences}
          />
        </Form.Item>
        <Form.Item className={styles.nodeConfigFull} label="标签" name="tags">
          <TemplateVariableInput
            ariaLabel="qBittorrent 标签"
            insertMode="template"
            placeholder="例如 rss,电影，可在光标处插入变量"
            references={fieldReferences}
          />
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
