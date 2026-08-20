import {
  DesktopOutlined,
  ExperimentOutlined,
  MobileOutlined,
  PictureOutlined,
  SaveOutlined,
  TabletOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Grid,
  InputNumber,
  Row,
  Segmented,
  Select,
  Slider,
  Space,
  Spin,
  Switch,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { createStyles } from 'antd-style';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import ConsolePage from '@/components/ConsolePage';
import {
  getEmbyImageOptimizationSamples,
  getEmbyImageOptimizationSettings,
  saveEmbyImageOptimizationSettings,
  testEmbyImageOptimization,
} from '@/services/film-fusion';

const { Text, Title } = Typography;

type DeviceKey = 'desktop' | 'tablet' | 'mobile';

type ProfileDefinition = {
  key: API.EmbyImageProfileKey;
  title: string;
  shortLabel: string;
  shape: 'landscape' | 'portrait' | 'logo' | 'square';
  requestQuality: number;
  sizes: Record<DeviceKey, [number, number]>;
};

const profiles: ProfileDefinition[] = [
  {
    key: 'library_cover',
    title: '首页媒体库封面',
    shortLabel: '媒体库封面',
    shape: 'landscape',
    requestQuality: 90,
    sizes: { desktop: [676, 380], tablet: [560, 315], mobile: [360, 203] },
  },
  {
    key: 'poster',
    title: '首页竖版海报',
    shortLabel: '竖版海报',
    shape: 'portrait',
    requestQuality: 90,
    sizes: { desktop: [356, 534], tablet: [300, 450], mobile: [240, 360] },
  },
  {
    key: 'continue_backdrop',
    title: '继续观看背景图',
    shortLabel: '继续观看',
    shape: 'landscape',
    requestQuality: 70,
    sizes: { desktop: [674, 379], tablet: [560, 315], mobile: [360, 203] },
  },
  {
    key: 'list_poster',
    title: '列表小海报',
    shortLabel: '列表海报',
    shape: 'portrait',
    requestQuality: 90,
    sizes: { desktop: [160, 240], tablet: [140, 210], mobile: [120, 180] },
  },
  {
    key: 'detail_logo',
    title: '详情页 Logo',
    shortLabel: '详情 Logo',
    shape: 'logo',
    requestQuality: 90,
    sizes: { desktop: [600, 152], tablet: [420, 106], mobile: [280, 71] },
  },
  {
    key: 'detail_backdrop',
    title: '详情页大背景',
    shortLabel: '详情背景',
    shape: 'landscape',
    requestQuality: 70,
    sizes: { desktop: [1920, 1080], tablet: [1280, 720], mobile: [750, 422] },
  },
  {
    key: 'other',
    title: '其他图片',
    shortLabel: '其他',
    shape: 'square',
    requestQuality: 90,
    sizes: { desktop: [800, 800], tablet: [600, 600], mobile: [360, 360] },
  },
];

const deviceOptions = [
  { label: '桌面', value: 'desktop', icon: <DesktopOutlined /> },
  { label: '平板', value: 'tablet', icon: <TabletOutlined /> },
  { label: '手机', value: 'mobile', icon: <MobileOutlined /> },
];

const useStyles = createStyles(({ css, token }) => ({
  pageGrid: css`
    align-items: stretch;
  `,
  panel: css`
    height: 100%;
    border-radius: 8px;
    border-color: ${token.colorBorderSecondary};
  `,
  globalToggle: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 14px;
    margin-bottom: 16px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 6px;
    background: ${token.colorFillAlter};
  `,
  ruleBody: css`
    min-height: 286px;
    padding-inline: 4px;
  `,
  dimensionGrid: css`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;

    @media (max-width: 560px) {
      grid-template-columns: 1fr;
    }
  `,
  qualityHeader: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  `,
  testerToolbar: css`
    display: grid;
    grid-template-columns: minmax(210px, 1fr) auto auto;
    gap: 10px;
    align-items: center;
    margin-bottom: 16px;

    @media (max-width: 760px) {
      grid-template-columns: 1fr;
    }
  `,
  previewCanvas: css`
    min-height: 332px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 22px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 6px;
    background: #17191d;

    @media (max-width: 560px) {
      min-height: 250px;
      padding: 14px;
    }
  `,
  deviceFrame: css`
    width: 100%;
    max-width: 760px;
    padding: 8px;
    border: 1px solid #4b5058;
    border-radius: 7px;
    background: #272a30;
    box-shadow: 0 14px 32px rgba(0, 0, 0, 0.28);

    &[data-device='tablet'] {
      max-width: 580px;
    }

    &[data-device='mobile'] {
      max-width: 330px;
    }
  `,
  screen: css`
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 190px;
    border-radius: 4px;
    background: #0f1115;
  `,
  comparison: css`
    width: 100%;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;

    @media (max-width: 620px) {
      grid-template-columns: 1fr;
    }
  `,
  imagePane: css`
    min-width: 0;
  `,
  paneHeader: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
    color: rgba(255, 255, 255, 0.78);
  `,
  previewImage: css`
    display: block;
    width: 100%;
    height: 206px;
    object-fit: cover;
    border-radius: 3px;
    background: #0b0d10;

    &[data-shape='portrait'] {
      width: auto;
      max-width: 100%;
      margin-inline: auto;
      object-fit: contain;
    }

    &[data-shape='logo'] {
      object-fit: contain;
      padding: 18px;
    }

    &[data-shape='square'] {
      object-fit: contain;
    }
  `,
  metrics: css`
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
    margin-top: 14px;

    @media (max-width: 760px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  `,
  metric: css`
    min-width: 0;
    padding: 10px 12px;
    border-left: 3px solid ${token.colorBorder};
    background: ${token.colorFillAlter};

    &[data-tone='green'] {
      border-left-color: #16a36a;
    }

    &[data-tone='amber'] {
      border-left-color: #d97706;
    }
  `,
  metricValue: css`
    display: block;
    margin-top: 2px;
    font-size: 18px;
    font-weight: 600;
    color: ${token.colorText};
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,
}));

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
};

const transmissionMS = (bytes: number, bandwidth: number) =>
  (bytes * 8 * 1000) / (bandwidth * 1_000_000);

const formatDuration = (ms: number) =>
  ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`;

const profileSupportsSample = (
  profile: API.EmbyImageProfileKey,
  sample: API.EmbyImageSample,
) => {
  if (profile === 'detail_logo') return Boolean(sample.image_tags?.Logo);
  if (profile === 'continue_backdrop' || profile === 'detail_backdrop') {
    return Boolean(sample.backdrop_tags?.length);
  }
  if (profile === 'library_cover') {
    return sample.kind === 'library' && Boolean(sample.image_tags?.Primary);
  }
  if (profile === 'other') return Boolean(sample.image_tags?.Thumb);
  return Boolean(sample.image_tags?.Primary);
};

const imageTagForProfile = (
  profile: API.EmbyImageProfileKey,
  sample?: API.EmbyImageSample,
) => {
  if (!sample) return '';
  if (profile === 'detail_logo') return sample.image_tags?.Logo || '';
  if (profile === 'continue_backdrop' || profile === 'detail_backdrop') {
    return sample.backdrop_tags?.[0] || '';
  }
  if (profile === 'other') return sample.image_tags?.Thumb || '';
  return sample.image_tags?.Primary || '';
};

const RuleEditor: React.FC<{
  form: any;
  profile: ProfileDefinition;
}> = ({ form, profile }) => {
  const { styles } = useStyles();
  const quality = Form.useWatch([profile.key, 'quality'], form) ?? 0;
  const enabled = Form.useWatch([profile.key, 'enabled'], form);

  return (
    <div className={styles.ruleBody}>
      <Space orientation="vertical" size={2} style={{ marginBottom: 18 }}>
        <Title level={5} style={{ margin: 0 }}>
          {profile.title}
        </Title>
        <Text type="secondary">
          客户端基准 {profile.sizes.desktop[0]} × {profile.sizes.desktop[1]}
        </Text>
      </Space>

      <Form.Item
        name={[profile.key, 'enabled']}
        label="启用此规则"
        valuePropName="checked"
      >
        <Switch />
      </Form.Item>

      <div className={styles.dimensionGrid}>
        <Form.Item name={[profile.key, 'max_width']} label="最大宽度">
          <InputNumber
            min={0}
            max={4096}
            precision={0}
            suffix="px"
            disabled={!enabled}
            style={{ width: '100%' }}
          />
        </Form.Item>
        <Form.Item name={[profile.key, 'max_height']} label="最大高度">
          <InputNumber
            min={0}
            max={4096}
            precision={0}
            suffix="px"
            disabled={!enabled}
            style={{ width: '100%' }}
          />
        </Form.Item>
      </div>

      <div className={styles.qualityHeader}>
        <Text>质量上限</Text>
        <Tag color={quality <= 80 ? 'green' : quality <= 90 ? 'gold' : 'red'}>
          {quality || 0}
        </Tag>
      </div>
      <Form.Item name={[profile.key, 'quality']} style={{ marginBottom: 0 }}>
        <Slider
          min={10}
          max={100}
          step={1}
          marks={{ 10: '10', 40: '40', 70: '70', 100: '100' }}
          disabled={!enabled}
          tooltip={{ formatter: (value) => `质量 ${value}` }}
        />
      </Form.Item>
    </div>
  );
};

const Metric: React.FC<{
  label: string;
  value: string;
  tone?: 'green' | 'amber';
}> = ({ label, value, tone }) => {
  const { styles } = useStyles();
  return (
    <div className={styles.metric} data-tone={tone}>
      <Text type="secondary">{label}</Text>
      <span className={styles.metricValue} title={value}>
        {value}
      </span>
    </div>
  );
};

const EmbyImageOptimizationPage: React.FC = () => {
  const { styles } = useStyles();
  const screens = Grid.useBreakpoint();
  const [form] = Form.useForm<API.EmbyImageOptimizationSettings>();
  const { message: messageApi } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [samplesLoading, setSamplesLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [samples, setSamples] = useState<API.EmbyImageSample[]>([]);
  const [profileKey, setProfileKey] =
    useState<API.EmbyImageProfileKey>('library_cover');
  const [device, setDevice] = useState<DeviceKey>('desktop');
  const [bandwidth, setBandwidth] = useState(3);
  const [requestedQuality, setRequestedQuality] = useState(
    profiles[0].requestQuality,
  );
  const [sampleID, setSampleID] = useState<string>();
  const [result, setResult] = useState<API.EmbyImageTestResult>();
  const testRunID = useRef(0);
  const optimizationEnabled = Form.useWatch('enabled', form);
  const profileRuleEnabled = Form.useWatch([profileKey, 'enabled'], form);

  const invalidateTest = useCallback(() => {
    testRunID.current += 1;
    setTesting(false);
    setResult(undefined);
  }, []);

  const profile = useMemo(
    () => profiles.find((item) => item.key === profileKey) || profiles[0],
    [profileKey],
  );

  const compatibleSamples = useMemo(
    () => samples.filter((sample) => profileSupportsSample(profileKey, sample)),
    [profileKey, samples],
  );

  const selectedSample = useMemo(
    () => compatibleSamples.find((sample) => sample.id === sampleID),
    [compatibleSamples, sampleID],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setSamplesLoading(true);
    const samplesRequest = getEmbyImageOptimizationSamples();
    try {
      const settingsResponse = await getEmbyImageOptimizationSettings();
      if (settingsResponse.code !== 0 || !settingsResponse.data) {
        throw new Error(settingsResponse.message || '获取图片设置失败');
      }
      form.setFieldsValue(settingsResponse.data);
    } catch (error: any) {
      messageApi.error(error?.message || '加载图片优化设置失败');
    } finally {
      setLoading(false);
    }

    try {
      const samplesResponse = await samplesRequest;
      if (samplesResponse.code !== 0) {
        throw new Error(samplesResponse.message || '获取 Emby 图片样本失败');
      }
      setSamples(samplesResponse.data?.samples || []);
    } catch (error: any) {
      messageApi.warning(error?.message || '获取 Emby 图片样本失败');
    } finally {
      setSamplesLoading(false);
    }
  }, [form, messageApi]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!compatibleSamples.some((sample) => sample.id === sampleID)) {
      setSampleID(compatibleSamples[0]?.id);
    }
    invalidateTest();
  }, [compatibleSamples, invalidateTest, sampleID]);

  useEffect(() => {
    invalidateTest();
  }, [device, invalidateTest, profileKey]);

  useEffect(() => {
    setRequestedQuality(profile.requestQuality);
  }, [profile.requestQuality]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const settings = await form.validateFields();
      const response = await saveEmbyImageOptimizationSettings(settings);
      if (response.code !== 0) {
        throw new Error(response.message || '保存失败');
      }
      messageApi.success('保存成功，图片代理规则已热生效');
    } catch (error: any) {
      if (error?.errorFields) return;
      messageApi.error(error?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!selectedSample) {
      messageApi.warning('当前场景没有可用的 Emby 图片样本');
      return;
    }
    const runID = testRunID.current + 1;
    testRunID.current = runID;
    setTesting(true);
    try {
      const settings = await form.validateFields();
      const [requestedWidth, requestedHeight] = profile.sizes[device];
      const response = await testEmbyImageOptimization({
        profile: profileKey,
        item_id: selectedSample.id,
        image_tag: imageTagForProfile(profileKey, selectedSample),
        requested_width: requestedWidth,
        requested_height: requestedHeight,
        requested_quality: requestedQuality,
        settings,
      });
      if (response.code !== 0 || !response.data) {
        throw new Error(response.message || '测试失败');
      }
      if (runID === testRunID.current) {
        setResult(response.data);
      }
    } catch (error: any) {
      if (error?.errorFields) return;
      if (runID === testRunID.current) {
        messageApi.error(error?.message || '测试失败');
      }
    } finally {
      if (runID === testRunID.current) {
        setTesting(false);
      }
    }
  };

  const savedBytes = result
    ? Math.max(0, result.original.bytes - result.optimized.bytes)
    : 0;
  const savedPercent =
    result && result.original.bytes > 0
      ? (savedBytes / result.original.bytes) * 100
      : 0;

  return (
    <ConsolePage
      actions={
        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={saving}
          onClick={handleSave}
        >
          保存设置
        </Button>
      }
      eyebrow="Emby tools"
      title="Emby 图片优化"
    >
      <Spin spinning={loading}>
        <Row gutter={[16, 16]} className={styles.pageGrid}>
          <Col xs={24} xl={10}>
            <Card title="场景规则" className={styles.panel}>
              <Form
                form={form}
                layout="vertical"
                onValuesChange={invalidateTest}
              >
                <div className={styles.globalToggle}>
                  <Space orientation="vertical" size={0}>
                    <Text strong>启用图片优化</Text>
                    <Text type="secondary">保存后由 8097 代理即时执行</Text>
                  </Space>
                  <Form.Item name="enabled" valuePropName="checked" noStyle>
                    <Switch />
                  </Form.Item>
                </div>

                <Tabs
                  activeKey={profileKey}
                  onChange={(key) =>
                    setProfileKey(key as API.EmbyImageProfileKey)
                  }
                  tabPlacement={screens.lg ? 'start' : 'top'}
                  items={profiles.map((item) => ({
                    key: item.key,
                    label: item.shortLabel,
                    children: <RuleEditor form={form} profile={item} />,
                  }))}
                />
              </Form>
            </Card>
          </Col>

          <Col xs={24} xl={14}>
            <Card
              title={
                <Space>
                  <ExperimentOutlined />
                  真实图片测试
                </Space>
              }
              className={styles.panel}
            >
              <div className={styles.testerToolbar}>
                <Select
                  value={sampleID}
                  loading={samplesLoading}
                  onChange={(value) => {
                    setSampleID(value);
                    invalidateTest();
                  }}
                  showSearch={{ optionFilterProp: 'label' }}
                  placeholder="选择 Emby 图片样本"
                  options={compatibleSamples.map((sample) => ({
                    value: sample.id,
                    label: `${sample.kind === 'library' ? '媒体库' : sample.type} · ${sample.name}`,
                  }))}
                />
                <Segmented
                  value={device}
                  options={deviceOptions}
                  onChange={(value) => setDevice(value as DeviceKey)}
                />
                <Space.Compact>
                  <Select
                    value={bandwidth}
                    onChange={setBandwidth}
                    style={{ width: 102 }}
                    options={[3, 5, 10, 20, 100].map((value) => ({
                      value,
                      label: `${value} Mbps`,
                    }))}
                  />
                  <Select
                    value={requestedQuality}
                    onChange={(value) => {
                      setRequestedQuality(value);
                      invalidateTest();
                    }}
                    style={{ width: 78 }}
                    options={[60, 70, 80, 90, 100].map((value) => ({
                      value,
                      label: `Q${value}`,
                    }))}
                  />
                  <Button
                    type="primary"
                    icon={<ThunderboltOutlined />}
                    loading={testing}
                    onClick={handleTest}
                  >
                    运行测试
                  </Button>
                </Space.Compact>
              </div>

              <div className={styles.previewCanvas}>
                {result ? (
                  <div className={styles.deviceFrame} data-device={device}>
                    <div className={styles.screen}>
                      <div className={styles.comparison}>
                        <div className={styles.imagePane}>
                          <div className={styles.paneHeader}>
                            <span>当前请求</span>
                            <Tag color="gold">Q{result.original.quality}</Tag>
                          </div>
                          <img
                            className={styles.previewImage}
                            data-shape={profile.shape}
                            src={result.original.data_url}
                            alt="当前参数图片"
                          />
                        </div>
                        <div className={styles.imagePane}>
                          <div className={styles.paneHeader}>
                            <span>优化结果</span>
                            <Tag color="green">Q{result.optimized.quality}</Tag>
                          </div>
                          <img
                            className={styles.previewImage}
                            data-shape={profile.shape}
                            src={result.optimized.data_url}
                            alt="优化参数图片"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Empty
                    image={<PictureOutlined style={{ fontSize: 42 }} />}
                    description={`${profile.title} · ${profile.sizes[device].join(' × ')} px`}
                  />
                )}
              </div>

              {result && !result.changed && (
                <Alert
                  showIcon
                  type="info"
                  style={{ marginTop: 14 }}
                  title={
                    !optimizationEnabled
                      ? '图片优化总开关未启用'
                      : !profileRuleEnabled
                        ? '当前场景规则未启用'
                        : '当前请求已在设置上限内，无需优化'
                  }
                  description={
                    optimizationEnabled && profileRuleEnabled
                      ? `当前 ${result.original.max_width} × ${result.original.max_height}、Q${result.original.quality}；设置上限不会放大尺寸或提高质量。`
                      : '测试结果保持客户端原始请求参数。'
                  }
                />
              )}

              {result && (
                <div className={styles.metrics}>
                  <Metric
                    label="当前体积"
                    value={formatBytes(result.original.bytes)}
                    tone="amber"
                  />
                  <Metric
                    label="优化体积"
                    value={formatBytes(result.optimized.bytes)}
                    tone="green"
                  />
                  <Metric
                    label="减少"
                    value={`${formatBytes(savedBytes)} · ${savedPercent.toFixed(0)}%`}
                    tone="green"
                  />
                  <Metric
                    label={`${bandwidth} Mbps 纯传输`}
                    value={`${formatDuration(
                      transmissionMS(result.original.bytes, bandwidth),
                    )} → ${formatDuration(
                      transmissionMS(result.optimized.bytes, bandwidth),
                    )}`}
                  />
                  <Metric
                    label="当前分辨率"
                    value={`${result.original.width} × ${result.original.height}`}
                  />
                  <Metric
                    label="优化分辨率"
                    value={`${result.optimized.width} × ${result.optimized.height}`}
                  />
                  <Metric
                    label="NAS 当前响应"
                    value={formatDuration(result.original.duration_ms)}
                    tone="amber"
                  />
                  <Metric
                    label="NAS 优化响应"
                    value={formatDuration(result.optimized.duration_ms)}
                    tone="green"
                  />
                </div>
              )}
            </Card>
          </Col>
        </Row>
      </Spin>
    </ConsolePage>
  );
};

export default EmbyImageOptimizationPage;
