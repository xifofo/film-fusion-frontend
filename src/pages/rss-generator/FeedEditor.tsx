import {
  ApiOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CheckOutlined,
  ChromeOutlined,
  CodeOutlined,
  DeleteOutlined,
  EyeOutlined,
  FileSearchOutlined,
  GlobalOutlined,
  LockOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Col,
  Collapse,
  Form,
  Input,
  InputNumber,
  Radio,
  Row,
  Select,
  Space,
  Steps,
  Switch,
  Typography,
} from 'antd';
import { useEffect, useMemo, useState } from 'react';
import type {
  RSSGeneratorFeed,
  RSSGeneratorFeedInput,
  RSSGeneratorPreview,
} from '@/services/film-fusion';
import {
  DEFAULT_FORM_VALUES,
  feedToValues,
  type GeneratorFormValues,
  parameterDefaults,
  valuesToDefinition,
} from './definition';
import styles from './index.module.less';
import PreviewPanel from './PreviewPanel';

const { Paragraph, Text, Title } = Typography;

type FeedEditorProps = {
  feed?: RSSGeneratorFeed;
  saving: boolean;
  onCancel: () => void;
  onPreview: (
    definition: RSSGeneratorFeedInput,
    params: Record<string, string>,
    feedId?: number,
  ) => Promise<RSSGeneratorPreview>;
  onSave: (definition: RSSGeneratorFeedInput) => Promise<void>;
};

const modeOptions = [
  {
    value: 'http_json',
    label: 'JSON API',
    icon: <ApiOutlined />,
    help: '读取 JSON 接口，用字段路径生成条目。',
  },
  {
    value: 'http_html',
    label: 'HTML 页面',
    icon: <CodeOutlined />,
    help: '用 CSS 选择器提取网页内容。',
  },
  {
    value: 'browser',
    label: '无头浏览器',
    icon: <ChromeOutlined />,
    help: '执行 JavaScript、等待页面渲染后提取。',
  },
] as const;

const fieldOptions = [
  { value: 'title', label: '标题 title' },
  { value: 'link', label: '链接 link' },
  { value: 'description', label: '摘要 description' },
  { value: 'content', label: '正文 content' },
  { value: 'author', label: '作者 author' },
  { value: 'categories', label: '分类 categories' },
  { value: 'date', label: '发布时间 date' },
  { value: 'guid', label: '唯一 ID guid' },
  { value: 'enclosure_url', label: '附件地址 enclosure_url' },
  { value: 'enclosure_type', label: '附件类型 enclosure_type' },
  { value: 'enclosure_length', label: '附件大小 enclosure_length' },
  { value: 'detail_link', label: '详情页链接 detail_link' },
  { value: 'detail_content', label: '详情页正文 detail_content' },
];

const FeedEditor = ({
  feed,
  saving,
  onCancel,
  onPreview,
  onSave,
}: FeedEditorProps) => {
  const [form] = Form.useForm<GeneratorFormValues>();
  const [step, setStep] = useState(0);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<RSSGeneratorPreview>();
  const [previewError, setPreviewError] = useState<string>();
  const [definition, setDefinition] = useState<RSSGeneratorFeedInput>();
  const [previewParams, setPreviewParams] = useState<Record<string, string>>(
    {},
  );
  const routeKind = Form.useWatch('route_kind', form);
  const method = Form.useWatch('method', form);

  useEffect(() => {
    const values = feed
      ? feedToValues(feed)
      : structuredClone(DEFAULT_FORM_VALUES);
    form.setFieldsValue(values);
    setDefinition(feed);
    setPreview(undefined);
    setPreviewError(undefined);
    setPreviewParams(feed ? parameterDefaults(feed.parameters || []) : {});
    setStep(0);
  }, [feed, form]);

  useEffect(() => {
    if (routeKind === 'browser' && form.getFieldValue('method') !== 'GET') {
      form.setFieldValue('method', 'GET');
    }
  }, [form, routeKind]);

  const parameterList = useMemo(
    () => definition?.parameters || [],
    [definition],
  );

  const validateDefinition = async () => {
    await form.validateFields();
    const values = form.getFieldsValue(true) as GeneratorFormValues;
    const nextDefinition = valuesToDefinition(values);
    setDefinition(nextDefinition);
    setPreviewParams((current) => ({
      ...parameterDefaults(nextDefinition.parameters),
      ...current,
    }));
    return nextDefinition;
  };

  const next = async () => {
    try {
      await validateDefinition();
      setStep((current) => Math.min(current + 1, 4));
    } catch {
      // Ant Design renders validation messages next to their fields.
    }
  };

  const runPreview = async () => {
    setPreviewing(true);
    setPreviewError(undefined);
    try {
      const nextDefinition = await validateDefinition();
      const result = await onPreview(nextDefinition, previewParams, feed?.id);
      setPreview(result);
    } catch (error: any) {
      setPreview(undefined);
      setPreviewError(
        error?.data || error?.message || '预览失败，请检查配置和目标站点',
      );
    } finally {
      setPreviewing(false);
    }
  };

  const save = async () => {
    try {
      await onSave(await validateDefinition());
    } catch {
      // Parent reports request errors; validation remains visible in the form.
    }
  };

  const maskedJSONRule = (label: string) => ({
    validator: async (_: unknown, value?: string) => {
      if (!value?.trim() || value.trim() === '********') return;
      try {
        const parsed = JSON.parse(value);
        if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
          throw new Error();
        }
      } catch {
        throw new Error(`${label}必须是 JSON 对象`);
      }
    },
  });

  return (
    <div className={styles.editorShell}>
      <Steps
        className={styles.editorSteps}
        current={step}
        items={[
          { title: '来源', description: 'URL 与参数' },
          { title: '规则', description: '零代码提取' },
          { title: '访问', description: '登录与代理' },
          { title: '预览', description: '真实抓取' },
          { title: '发布', description: '缓存与 Token' },
        ]}
        responsive={false}
      />

      <Form
        form={form}
        initialValues={DEFAULT_FORM_VALUES}
        layout="vertical"
        preserve
      >
        {step === 0 && (
          <Card className={styles.editorCard}>
            <div className={styles.editorIntro}>
              <span className={styles.editorIcon}>
                <GlobalOutlined />
              </span>
              <div>
                <Title level={4}>定义来源与路由标识</Title>
                <Paragraph type="secondary">
                  URL 可以使用参数占位符，例如{' '}
                  {'https://example.com/u/{{params.user}}'}。 订阅者在公开 Feed
                  地址添加同名查询参数即可复用这条路由。
                </Paragraph>
              </div>
            </div>

            <Row gutter={16}>
              <Col md={14} xs={24}>
                <Form.Item
                  label="Feed 名称"
                  name="name"
                  rules={[{ required: true, message: '请输入 Feed 名称' }]}
                >
                  <Input placeholder="例如：某站作者动态" />
                </Form.Item>
              </Col>
              <Col md={10} xs={24}>
                <Form.Item
                  extra="仅使用小写字母、数字和连字符"
                  label="路由 Slug"
                  name="slug"
                  rules={[
                    { required: true, message: '请输入路由 Slug' },
                    {
                      pattern: /^[a-z0-9][a-z0-9_-]*$/,
                      message: '格式示例：author-updates',
                    },
                  ]}
                >
                  <Input addonBefore="/" placeholder="author-updates" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col md={12} xs={24}>
                <Form.Item label="Feed 描述" name="description">
                  <Input placeholder="这个订阅源收录什么内容" />
                </Form.Item>
              </Col>
              <Col md={12} xs={24}>
                <Form.Item
                  label="站点主页"
                  name="home_page_url"
                  rules={[{ type: 'url', warningOnly: true }]}
                >
                  <Input placeholder="https://example.com" />
                </Form.Item>
              </Col>
              <Col md={12} xs={24}>
                <Form.Item label="作者" name="author">
                  <Input placeholder="站点或内容作者" />
                </Form.Item>
              </Col>
              <Col md={12} xs={24}>
                <Form.Item
                  label="Feed 图片"
                  name="image_url"
                  rules={[{ type: 'url', warningOnly: true }]}
                >
                  <Input placeholder="https://example.com/icon.png" />
                </Form.Item>
              </Col>
              <Col md={12} xs={24}>
                <Form.Item label="语言" name="language">
                  <Input placeholder="zh-CN" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item label="抓取模式" name="route_kind">
              <Radio.Group className={styles.modeGrid}>
                {modeOptions.map((option) => (
                  <Radio.Button key={option.value} value={option.value}>
                    <span className={styles.modeIcon}>{option.icon}</span>
                    <strong>{option.label}</strong>
                    <Text type="secondary">{option.help}</Text>
                  </Radio.Button>
                ))}
              </Radio.Group>
            </Form.Item>

            <Row gutter={16}>
              <Col md={5} xs={24}>
                <Form.Item label="请求方法" name="method">
                  <Select
                    options={[
                      { value: 'GET' },
                      {
                        value: 'POST',
                        disabled: routeKind === 'browser',
                        label:
                          routeKind === 'browser'
                            ? 'POST（浏览器模式不支持）'
                            : 'POST',
                      },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col md={19} xs={24}>
                <Form.Item
                  label="来源 URL 模板"
                  name="source_url_template"
                  rules={[
                    { required: true, message: '请输入来源 URL' },
                    {
                      pattern: /^https?:\/\//i,
                      message: '只支持 HTTP 或 HTTPS URL',
                    },
                  ]}
                >
                  <Input placeholder="https://example.com/api/users/{{params.user}}/posts" />
                </Form.Item>
              </Col>
            </Row>

            {method === 'POST' && (
              <Form.Item
                extra="支持 {{params.name}}（URL 编码）和 {{json.params.name}}（安全 JSON 编码）；JSON 请求请同时添加 Content-Type Header。"
                label="POST 请求体模板"
                name="request_body_template"
                rules={[
                  { required: true, message: 'POST 请求需要填写请求体模板' },
                ]}
              >
                <Input.TextArea
                  autoSize={{ minRows: 5, maxRows: 14 }}
                  placeholder={'{"user":{{json.params.user}}}'}
                />
              </Form.Item>
            )}

            <div className={styles.sectionHeading}>
              <div>
                <Text strong>路由参数</Text>
                <Paragraph type="secondary">
                  每个参数对应 URL 中的 {'{{params.参数名}}'}
                  ，也会显示在预览区。
                </Paragraph>
              </div>
            </div>
            <Form.List name="parameters">
              {(fields, { add, remove }) => (
                <Space className={styles.dynamicList} direction="vertical">
                  {fields.map((field) => (
                    <div className={styles.parameterRow} key={field.key}>
                      <Form.Item
                        label="参数名"
                        name={[field.name, 'name']}
                        rules={[
                          { required: true, message: '请输入参数名' },
                          {
                            pattern: /^[a-zA-Z_][a-zA-Z0-9_-]*$/,
                            message: '参数名格式不正确',
                          },
                        ]}
                      >
                        <Input placeholder="user" />
                      </Form.Item>
                      <Form.Item
                        label="类型"
                        name={[field.name, 'type']}
                        rules={[{ required: true, message: '请选择类型' }]}
                      >
                        <Select
                          options={[
                            { value: 'string', label: '文本' },
                            { value: 'number', label: '数字' },
                            { value: 'boolean', label: '布尔值' },
                          ]}
                        />
                      </Form.Item>
                      <Form.Item label="显示名" name={[field.name, 'label']}>
                        <Input placeholder="用户 ID" />
                      </Form.Item>
                      <Form.Item label="默认值" name={[field.name, 'default']}>
                        <Input />
                      </Form.Item>
                      <Form.Item
                        label="说明"
                        name={[field.name, 'description']}
                      >
                        <Input placeholder="例如：用户 ID" />
                      </Form.Item>
                      <Form.Item
                        label="正则校验"
                        name={[field.name, 'pattern']}
                      >
                        <Input placeholder="^[a-z0-9-]+$" />
                      </Form.Item>
                      <Form.Item label="枚举值" name={[field.name, 'enum']}>
                        <Select mode="tags" placeholder="输入后回车" />
                      </Form.Item>
                      <Form.Item
                        label="必填"
                        name={[field.name, 'required']}
                        valuePropName="checked"
                      >
                        <Switch />
                      </Form.Item>
                      <Button
                        aria-label="删除参数"
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
                    onClick={() => add({ type: 'string', required: false })}
                    type="dashed"
                  >
                    添加参数
                  </Button>
                </Space>
              )}
            </Form.List>
          </Card>
        )}

        {step === 1 && (
          <Card className={styles.editorCard}>
            <div className={styles.editorIntro}>
              <span className={styles.editorIcon}>
                {routeKind === 'http_json' ? <ApiOutlined /> : <CodeOutlined />}
              </span>
              <div>
                <Title level={4}>配置条目与字段提取</Title>
                <Paragraph type="secondary">
                  {routeKind === 'http_json'
                    ? '填写 JSON 点路径，无需编写路由代码。例如 data.items、author.name。'
                    : '填写 CSS 选择器和取值方式，无需编写路由代码。每条规则都相对于条目节点执行。'}
                </Paragraph>
              </div>
            </div>

            <Form.Item
              extra={
                routeKind === 'http_json'
                  ? '指向条目数组，例如 data.items'
                  : '定位页面中重复的条目节点，例如 .article-list > article'
              }
              label={
                routeKind === 'http_json' ? '条目数组路径' : '条目列表选择器'
              }
              name="item_selector"
              rules={[{ required: true, message: '请填写条目定位规则' }]}
            >
              <Input
                addonBefore={routeKind === 'http_json' ? 'JSON' : 'CSS'}
                placeholder={
                  routeKind === 'http_json' ? 'data.items' : '.article'
                }
              />
            </Form.Item>

            <Form.List name="field_rules">
              {(fields, { add, remove }) => (
                <Space className={styles.dynamicList} direction="vertical">
                  {fields.map((field) => (
                    <div className={styles.mappingRow} key={field.key}>
                      <Form.Item
                        label="RSS 字段"
                        name={[field.name, 'field']}
                        rules={[{ required: true, message: '请选择字段' }]}
                      >
                        <Select
                          options={fieldOptions}
                          placeholder="选择字段"
                          showSearch
                        />
                      </Form.Item>
                      <Form.Item
                        label={
                          routeKind === 'http_json' ? '字段路径' : 'CSS 选择器'
                        }
                        name={[field.name, 'selector']}
                        rules={
                          routeKind === 'http_json'
                            ? [{ required: true, message: '请填写提取规则' }]
                            : []
                        }
                      >
                        <Input
                          placeholder={
                            routeKind === 'http_json'
                              ? 'title'
                              : '.title（留空表示条目根节点）'
                          }
                        />
                      </Form.Item>
                      {routeKind !== 'http_json' && (
                        <Form.Item
                          label="取值"
                          name={[field.name, 'attribute']}
                        >
                          <Select
                            options={[
                              { value: 'text', label: '文本' },
                              { value: 'html', label: 'HTML' },
                              { value: 'href', label: 'href' },
                              { value: 'src', label: 'src' },
                              { value: 'datetime', label: 'datetime' },
                            ]}
                            placeholder="文本或属性"
                            showSearch
                          />
                        </Form.Item>
                      )}
                      <Button
                        aria-label="删除字段映射"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => remove(field.name)}
                        type="text"
                      />
                    </div>
                  ))}
                  <Button
                    aria-label="添加字段映射"
                    block
                    icon={<PlusOutlined />}
                    onClick={() =>
                      add({ field: 'title', selector: '', attribute: 'text' })
                    }
                    type="dashed"
                  >
                    添加字段映射
                  </Button>
                </Space>
              )}
            </Form.List>

            {routeKind === 'browser' && (
              <Row gutter={16} className={styles.browserWaitRow}>
                <Col md={10} xs={24}>
                  <Form.Item
                    extra="浏览器等待这个元素出现后开始提取"
                    label="等待选择器"
                    name="browser_wait_selector"
                  >
                    <Input placeholder=".article-list" />
                  </Form.Item>
                </Col>
                <Col md={7} xs={24}>
                  <Form.Item label="页面等待阶段" name="browser_wait_until">
                    <Select
                      options={[
                        { value: 'domcontentloaded', label: 'DOM 就绪' },
                        { value: 'load', label: '页面加载' },
                        { value: 'networkidle', label: '网络空闲' },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col md={7} xs={24}>
                  <Form.Item label="渲染等待（毫秒）" name="browser_wait_ms">
                    <InputNumber
                      min={0}
                      max={30_000}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
              </Row>
            )}

            <Collapse
              ghost
              items={[
                {
                  key: 'advanced',
                  label: '高级：补充原始选择器 JSON',
                  children: (
                    <Form.Item
                      extra="这里的键会与上方规则合并，适合执行引擎支持的扩展选项。普通 Feed 不需要填写。"
                      name="advanced_selectors_json"
                      rules={[maskedJSONRule('高级选择器')]}
                    >
                      <Input.TextArea autoSize={{ minRows: 5, maxRows: 12 }} />
                    </Form.Item>
                  ),
                },
              ]}
            />
          </Card>
        )}

        {step === 2 && (
          <div className={styles.editorGrid}>
            <Card className={styles.editorCard} title="请求头">
              <Form.List name="headers_list">
                {(fields, { add, remove }) => (
                  <Space className={styles.dynamicList} direction="vertical">
                    {fields.map((field) => (
                      <div className={styles.headerRow} key={field.key}>
                        <Form.Item
                          name={[field.name, 'name']}
                          rules={[
                            { required: true, message: '请输入 Header 名称' },
                          ]}
                        >
                          <Input placeholder="Authorization" />
                        </Form.Item>
                        <Form.Item name={[field.name, 'value']}>
                          <Input.Password placeholder="Header 值" />
                        </Form.Item>
                        <Button
                          aria-label="删除请求头"
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
                      onClick={() => add({ name: '', value: '' })}
                      type="dashed"
                    >
                      添加 Header
                    </Button>
                  </Space>
                )}
              </Form.List>
              {feed && (
                <Form.Item
                  extra="开启后保存，将删除所有已加密保存的请求头。"
                  label="清除已保存请求头"
                  name="clear_headers"
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
              )}

              <div className={styles.sectionHeading}>
                <div>
                  <Text strong>私密查询参数</Text>
                  <Paragraph type="secondary">
                    用于 API Key
                    等固定密钥，由服务端追加到来源请求；不会出现在公开订阅 URL。
                  </Paragraph>
                </div>
              </div>
              <Form.List name="secret_query_params_list">
                {(fields, { add, remove }) => (
                  <Space className={styles.dynamicList} direction="vertical">
                    {fields.map((field) => (
                      <div className={styles.headerRow} key={field.key}>
                        <Form.Item
                          name={[field.name, 'name']}
                          rules={[
                            { required: true, message: '请输入查询参数名' },
                          ]}
                        >
                          <Input placeholder="api_key" />
                        </Form.Item>
                        <Form.Item name={[field.name, 'value']}>
                          <Input.Password placeholder="私密参数值" />
                        </Form.Item>
                        <Button
                          aria-label="删除私密查询参数"
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
                      onClick={() => add({ name: '', value: '' })}
                      type="dashed"
                    >
                      添加私密查询参数
                    </Button>
                  </Space>
                )}
              </Form.List>
              {feed && (
                <Form.Item
                  extra="开启后保存，将删除全部已加密的私密查询参数。"
                  label="清除已保存私密查询参数"
                  name="clear_secret_query_params"
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
              )}
            </Card>

            <Card className={styles.editorCard} title="登录态与代理">
              <Alert
                className={styles.sensitiveAlert}
                description="Cookie、Storage State 和代理可能包含账号凭证，服务端会加密保存并在读取时返回掩码。编辑时保留掩码即表示不修改原值。"
                icon={<LockOutlined />}
                message="敏感配置"
                showIcon
                type="warning"
              />
              <Form.Item
                extra="直接粘贴 Cookie 请求头内容"
                label="Cookie"
                name="cookie"
              >
                <Input.Password placeholder="session=...; token=..." />
              </Form.Item>
              {feed && (
                <Form.Item
                  label="清除已保存 Cookie"
                  name="clear_cookie"
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
              )}
              <Form.Item
                extra="支持 HTTP、HTTPS 或 SOCKS5（以服务端执行引擎支持为准）"
                label="代理 URL"
                name="proxy_url"
              >
                <Input.Password placeholder="http://user:pass@proxy.example:8080" />
              </Form.Item>
              <Form.Item
                extra="仅在代理服务确实位于局域网时启用；会放宽代理地址的内网限制。"
                label="允许局域网代理"
                name="proxy_allow_private"
                valuePropName="checked"
              >
                <Switch checkedChildren="允许" unCheckedChildren="禁止" />
              </Form.Item>
              {feed && (
                <Form.Item
                  label="清除已保存代理"
                  name="clear_proxy_url"
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
              )}
              <Collapse
                ghost
                items={[
                  {
                    key: 'storage-state',
                    label: '高级：浏览器 Storage State JSON',
                    children: (
                      <Form.Item
                        extra="Playwright storageState，包含 cookies 和 origins。仅浏览器模式使用。"
                        name="browser_storage_state_json"
                        rules={[maskedJSONRule('Storage State')]}
                      >
                        <Input.TextArea
                          autoSize={{ minRows: 6, maxRows: 16 }}
                          placeholder={'{"cookies":[],"origins":[]}'}
                        />
                      </Form.Item>
                    ),
                  },
                ]}
              />
              {feed && routeKind === 'browser' && (
                <Form.Item
                  label="清除已保存 Storage State"
                  name="clear_browser_storage_state"
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
              )}
              {routeKind !== 'browser' && method === 'GET' && (
                <Form.Item
                  extra="普通 HTTP 抓取遇到 JavaScript 页面或挑战时，自动交给浏览器执行；可识别验证码，但不会自动破解或绕过。"
                  label="浏览器回退"
                  name="browser_fallback"
                  valuePropName="checked"
                >
                  <Switch checkedChildren="启用" unCheckedChildren="关闭" />
                </Form.Item>
              )}
            </Card>
          </div>
        )}

        {step === 3 && (
          <Card className={styles.editorCard}>
            <div className={styles.previewHeading}>
              <div>
                <Title level={4}>真实抓取预览</Title>
                <Paragraph type="secondary">
                  填写本次预览参数并运行抓取。发布后，订阅者可在公开地址使用同名参数。
                </Paragraph>
              </div>
              <Button
                icon={<EyeOutlined />}
                loading={previewing}
                onClick={runPreview}
                type="primary"
              >
                生成预览
              </Button>
            </div>

            {parameterList.length > 0 && (
              <div className={styles.parameterGrid}>
                {parameterList.map((parameter) => (
                  <label
                    htmlFor={`rss-generator-preview-${parameter.name}`}
                    key={parameter.name}
                  >
                    <span>
                      {parameter.description || parameter.name}
                      {parameter.required ? ' *' : ''}
                    </span>
                    <Input
                      aria-label={`预览参数 ${parameter.name}`}
                      id={`rss-generator-preview-${parameter.name}`}
                      onChange={(event) =>
                        setPreviewParams((current) => ({
                          ...current,
                          [parameter.name]: event.target.value,
                        }))
                      }
                      placeholder={parameter.description || parameter.pattern}
                      value={previewParams[parameter.name] || ''}
                    />
                  </label>
                ))}
              </div>
            )}

            <PreviewPanel
              emptyIcon={<FileSearchOutlined />}
              error={previewError}
              loading={previewing}
              preview={preview}
            />
          </Card>
        )}

        {step === 4 && (
          <Card className={styles.editorCard}>
            <div className={styles.editorIntro}>
              <span className={styles.editorIcon}>
                <CheckOutlined />
              </span>
              <div>
                <Title level={4}>缓存并发布 Feed</Title>
                <Paragraph type="secondary">
                  保存后会直接进入 Token 管理，你可以立即签发 RSS / Atom
                  公开地址。
                </Paragraph>
              </div>
            </div>
            <Row gutter={16}>
              <Col md={8} xs={24}>
                <Form.Item
                  label="新鲜缓存（秒）"
                  name="cache_ttl_seconds"
                  rules={[{ required: true }]}
                >
                  <InputNumber
                    max={86_400}
                    min={1}
                    step={60}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
              <Col md={8} xs={24}>
                <Form.Item
                  extra="来源暂时失败时可继续返回旧内容"
                  label="过期可用（秒）"
                  name="stale_ttl_seconds"
                  dependencies={['cache_ttl_seconds']}
                  rules={[
                    { required: true },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (
                          value === undefined ||
                          value >= getFieldValue('cache_ttl_seconds')
                        ) {
                          return Promise.resolve();
                        }
                        return Promise.reject(
                          new Error('过期可用时间不能小于新鲜缓存'),
                        );
                      },
                    }),
                  ]}
                >
                  <InputNumber
                    max={604_800}
                    min={1}
                    step={300}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
              <Col md={8} xs={24}>
                <Form.Item
                  extra="避免误匹配整页拖垮服务"
                  label="最大条目数"
                  name="item_limit"
                  rules={[{ required: true }]}
                >
                  <InputNumber min={1} max={500} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item label="启用状态" name="enabled" valuePropName="checked">
              <Switch checkedChildren="发布" unCheckedChildren="保存为停用" />
            </Form.Item>
            {!preview && (
              <Alert
                description="建议先返回上一步完成真实预览；你仍可保存配置，之后从列表再次预览。"
                message="尚未完成本次预览"
                showIcon
                type="warning"
              />
            )}
          </Card>
        )}
      </Form>

      <div className={styles.editorFooter}>
        <Button onClick={onCancel}>取消</Button>
        <Space>
          {step > 0 && (
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => setStep((current) => current - 1)}
            >
              上一步
            </Button>
          )}
          {step < 4 ? (
            <Button onClick={next} type="primary">
              下一步 <ArrowRightOutlined />
            </Button>
          ) : (
            <Button
              icon={<CheckOutlined />}
              loading={saving}
              onClick={save}
              type="primary"
            >
              {feed ? '保存并管理 Token' : '创建并签发 Token'}
            </Button>
          )}
        </Space>
      </div>
    </div>
  );
};

export default FeedEditor;
