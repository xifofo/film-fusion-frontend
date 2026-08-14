import {
  KeyOutlined,
  PictureOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import {
  PageContainer,
  ProForm,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import {
  Alert,
  Button,
  Form,
  Modal,
  message,
  Space,
  Spin,
  Tabs,
  Tag,
  Typography,
  Upload,
} from 'antd';
import { createStyles } from 'antd-style';
import type { ReactNode } from 'react';
import React, { useCallback, useEffect, useState } from 'react';
import { WEB115_RELOGIN_APP_OPTIONS } from '@/constants/web115';
import { SettingsToggle } from '@/pages/system-settings/components/SettingsToggle';
import {
  getAppConfig,
  getHDHiveAuthorizeURL,
  refreshHDHiveToken,
  saveAppConfig,
  testNotificationChannel,
  uploadLoginBackground,
} from '@/services/film-fusion';

const restartTag = (
  <Tag color="orange" bordered={false} style={{ marginInlineStart: 6 }}>
    需重启
  </Tag>
);

const notificationChannelOptions: Array<{
  label: string;
  value: API.NotificationChannelID;
}> = [
  { label: 'Telegram', value: 'telegram' },
  { label: 'Webhook', value: 'webhook' },
];

const DEFAULT_RSS_AUTOMATION_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36';

const useStyles = createStyles(({ css, token }) => ({
  page: css`
    --settings-panel-radius: 12px;
  `,
  intro: css`
    margin-bottom: 16px;
    border: 1px solid ${token.colorInfoBorder};
    border-radius: var(--settings-panel-radius);

    .ant-alert-message {
      line-height: 22px;
    }
  `,
  introTitle: css`
    margin-inline-end: 16px;
    white-space: nowrap;
  `,
  loadingArea: css`
    min-height: 420px;
  `,
  settingsTabs: css`
    .ant-tabs-nav {
      position: sticky;
      top: 56px;
      z-index: 8;
      margin: 0;
      padding: 0 24px;
      border-radius: var(--settings-panel-radius);
      background: color-mix(in srgb, ${token.colorBgContainer} 94%, transparent);
      backdrop-filter: blur(12px);
    }

    .ant-tabs-tab {
      padding-block: 18px 14px;
    }

    .ant-tabs-content-holder {
      padding: 24px 0;
      background: transparent;
    }

    @media (max-width: 767px) {
      .ant-tabs-nav {
        top: 48px;
        padding-inline: 16px;
      }

      .ant-tabs-content-holder {
        padding: 16px 0;
      }
    }
  `,
  tabPanel: css`
    display: grid;
    width: 100%;
    max-width: 1120px;
    gap: 16px;
  `,
  section: css`
    padding: 24px 24px 4px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: var(--settings-panel-radius);
    background: ${token.colorBgContainer};
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);

    @media (max-width: 767px) {
      padding: 16px 16px 2px;
    }
  `,
  sectionHeader: css`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 18px;
    padding-bottom: 14px;
    border-bottom: 1px solid ${token.colorBorderSecondary};
  `,
  sectionTitle: css`
    margin: 0 !important;
    color: ${token.colorTextHeading};
    font-size: 16px !important;
    line-height: 24px !important;
  `,
  sectionDescription: css`
    display: block;
    max-width: 680px;
    margin-top: 3px;
    color: ${token.colorTextSecondary};
    line-height: 20px;
  `,
  fieldGrid: css`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 24px;

    > .ant-form-item {
      min-width: 0;
    }

    .pro-field-md,
    .pro-field-lg,
    .pro-field-xl,
    .ant-input-number,
    .ant-select {
      width: 100% !important;
      max-width: none;
    }

    @media (max-width: 900px) {
      grid-template-columns: 1fr;
    }
  `,
  toggleGrid: css`
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 20px;
  `,
  sectionAlert: css`
    margin-bottom: 20px;
    border-radius: 8px;
  `,
  codeBlock: css`
    margin: 0 0 20px !important;
    padding: 14px 16px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 8px;
    background: ${token.colorFillAlter};
    white-space: pre-wrap;
  `,
  helperText: css`
    display: block;
    margin-bottom: 20px;
    line-height: 22px;
  `,
  userAgentActions: css`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px 14px;
    margin-bottom: 20px;
  `,
  userAgentEditor: css`
    .pro-field-xl,
    .ant-input-textarea {
      width: 100% !important;
      max-width: none;
    }
  `,
  backgroundAsset: css`
    display: grid;
    grid-column: 1 / -1;
    grid-template-columns: minmax(240px, 360px) minmax(0, 1fr);
    gap: 16px;
    margin-bottom: 20px;

    @media (max-width: 760px) {
      grid-template-columns: 1fr;
    }
  `,
  backgroundPreview: css`
    position: relative;
    display: grid;
    min-width: 0;
    aspect-ratio: 16 / 9;
    align-self: start;
    overflow: hidden;
    place-items: center;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 10px;
    background:
      linear-gradient(45deg, ${token.colorFillAlter} 25%, transparent 25%),
      linear-gradient(-45deg, ${token.colorFillAlter} 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, ${token.colorFillAlter} 75%),
      linear-gradient(-45deg, transparent 75%, ${token.colorFillAlter} 75%);
    background-position:
      0 0,
      0 8px,
      8px -8px,
      -8px 0;
    background-size: 16px 16px;

    img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  `,
  backgroundPreviewEmpty: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 24px;
    color: ${token.colorTextSecondary};
    text-align: center;

    .anticon {
      color: ${token.colorTextQuaternary};
      font-size: 30px;
    }
  `,
  backgroundUploadPanel: css`
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 12px;
  `,
  backgroundUploader: css`
    flex: 1;

    &.ant-upload-wrapper .ant-upload-drag {
      min-height: 126px;
      border-color: ${token.colorBorder};
      border-radius: 10px;
      background: ${token.colorFillAlter};
    }

    &.ant-upload-wrapper .ant-upload-drag:hover {
      border-color: ${token.colorText};
    }

    .ant-upload-drag-icon {
      margin-bottom: 10px !important;
    }

    .ant-upload-drag-icon .anticon {
      color: ${token.colorTextSecondary} !important;
    }
  `,
  backgroundUploadActions: css`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 16px;
  `,
  formActions: css`
    position: sticky;
    bottom: 16px;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    max-width: 1120px;
    margin-top: 16px;
    padding: 12px 14px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: var(--settings-panel-radius);
    background: color-mix(in srgb, ${token.colorBgContainer} 94%, transparent);
    box-shadow: ${token.boxShadowSecondary};
    backdrop-filter: blur(12px);

    @media (max-width: 600px) {
      align-items: flex-start;
      flex-direction: column;

      .ant-space {
        width: 100%;
      }

      .ant-space-item {
        flex: 1;
      }

      .ant-btn {
        width: 100%;
      }
    }
  `,
}));

interface SettingsSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

const SettingsSection: React.FC<SettingsSectionProps> = ({
  title,
  description,
  children,
}) => {
  const { styles } = useStyles();

  return (
    <section className={styles.section}>
      <header className={styles.sectionHeader}>
        <div>
          <Typography.Title level={5} className={styles.sectionTitle}>
            {title}
          </Typography.Title>
          {description && (
            <Typography.Text className={styles.sectionDescription}>
              {description}
            </Typography.Text>
          )}
        </div>
      </header>
      {children}
    </section>
  );
};

const SystemSettingsPage: React.FC = () => {
  const { styles } = useStyles();
  const [form] = Form.useForm<API.AppConfig>();
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<API.AppConfig>();
  const [secrets, setSecrets] = useState<Record<string, boolean>>({});
  const [hdhiveAuthorizing, setHdhiveAuthorizing] = useState(false);
  const [hdhiveRefreshing, setHdhiveRefreshing] = useState(false);
  const [notificationChannelTesting, setNotificationChannelTesting] =
    useState<API.NotificationChannelID>();
  const [backgroundUploading, setBackgroundUploading] = useState(false);
  const [backgroundPreviewFailed, setBackgroundPreviewFailed] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const webhookAuthEnabled = Form.useWatch(
    ['webhook', 'clouddrive2', 'enabled'],
    form,
  );
  const webhookToken = Form.useWatch(['webhook', 'clouddrive2', 'token'], form);
  const browserUserAgent =
    Form.useWatch(['server', 'web_115_user_agent'], form) || '';
  const loginBackgroundURL = Form.useWatch(
    ['site', 'login_background_url'],
    form,
  );
  const loginBackgroundSource =
    Form.useWatch(['site', 'login_background_source'], form) || 'custom';
  const embyEnabled = Form.useWatch(['emby', 'enabled'], form);
  const embyURL = Form.useWatch(['emby', 'url'], form);
  const embyAPIKey = Form.useWatch(['emby', 'api_key'], form);
  const embyBackgroundAvailable = Boolean(
    embyEnabled &&
      embyURL?.trim() &&
      (embyAPIKey?.trim() || secrets['emby.api_key']),
  );
  const tmdbEnabled = Form.useWatch(['tmdb', 'enabled'], form);
  const tmdbAPIKey = Form.useWatch(['tmdb', 'api_key'], form);
  const tmdbAccessToken = Form.useWatch(['tmdb', 'access_token'], form);
  const tmdbCredentialsConfigured = Boolean(
    tmdbAPIKey?.trim() ||
      tmdbAccessToken?.trim() ||
      secrets['tmdb.api_key'] ||
      secrets['tmdb.access_token'],
  );
  const tmdbBackgroundAvailable = Boolean(
    tmdbEnabled && tmdbCredentialsConfigured,
  );
  const unavailableBackgroundSourceHint = [
    !embyBackgroundAvailable
      ? 'Emby 来源不可用：请先在「Emby」标签页启用服务，并配置地址和 API Key'
      : '',
    !tmdbBackgroundAvailable
      ? 'TMDB 来源不可用：请先在「TMDB」标签页启用 API，并配置 API Key 或 Access Token'
      : '',
  ]
    .filter(Boolean)
    .join('；');

  useEffect(() => {
    setBackgroundPreviewFailed(false);
  }, [loginBackgroundURL]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAppConfig();
      if (res.code === 0 && res.data) {
        setConfig(res.data.config);
        setSecrets(res.data.secrets || {});
      } else {
        messageApi.error(res.message || '获取配置失败');
      }
    } catch (error: any) {
      messageApi.error(error?.message || '获取配置失败');
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  useEffect(() => {
    load();
  }, [load]);

  const secretPlaceholder = (key: string) =>
    secrets[key] ? '已设置，留空则不修改' : '未设置';

  const generateWebhookToken = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('');
    form.setFieldValue(['webhook', 'clouddrive2', 'token'], token);
    form.setFieldValue(['webhook', 'clouddrive2', 'enabled'], true);
    messageApi.success('已生成 256 位随机 Token，保存后生效');
  };

  const cloudDrive2HeaderConfig = webhookToken
    ? `authorization = "Bearer ${webhookToken}"`
    : '';

  const onFinish = async (values: API.AppConfig) => {
    try {
      const res = await saveAppConfig(values);
      if (res.code === 0) {
        const restart = res.data?.restart_fields || [];
        form.setFieldValue(['rss_generator', 'worker_token'], '');
        if (restart.length > 0) {
          Modal.warning({
            title: '已保存（部分项需重启生效）',
            content: `多数改动已即时生效；以下需重启后端后生效：${restart.join('、')}`,
          });
        } else {
          messageApi.success('保存成功，已即时生效');
        }
        // 刷新脱敏占位状态
        const fresh = await getAppConfig();
        if (fresh.code === 0 && fresh.data) {
          setSecrets(fresh.data.secrets || {});
        }
        return true;
      }
      messageApi.error(res.message || '保存失败');
      return false;
    } catch (error: any) {
      messageApi.error(error?.message || '保存失败');
      return false;
    }
  };

  const handleHDHiveAuthorize = async () => {
    setHdhiveAuthorizing(true);
    try {
      const res = await getHDHiveAuthorizeURL({ response_mode: 'redirect' });
      if (res.code === 0 && res.data?.authorize_url) {
        window.localStorage.setItem('hdhive_oauth_state', res.data.state || '');
        window.open(res.data.authorize_url, '_blank', 'noopener,noreferrer');
        messageApi.info(
          '已打开 HDHive 授权页，授权完成后会回到回调页写入 Token',
        );
      } else {
        messageApi.error(res.message || '生成 HDHive 授权链接失败');
      }
    } catch (error: any) {
      messageApi.error(error?.message || '生成 HDHive 授权链接失败');
    } finally {
      setHdhiveAuthorizing(false);
    }
  };

  const handleHDHiveRefresh = async () => {
    setHdhiveRefreshing(true);
    try {
      const res = await refreshHDHiveToken();
      if (res.code === 0 && res.data?.success) {
        messageApi.success('HDHive Token 已刷新');
        await load();
      } else {
        messageApi.error(
          res.message || res.data?.message || '刷新 HDHive Token 失败',
        );
      }
    } catch (error: any) {
      messageApi.error(error?.message || '刷新 HDHive Token 失败');
    } finally {
      setHdhiveRefreshing(false);
    }
  };

  const handleNotificationChannelTest = async (
    channel: API.NotificationChannelID,
    label: string,
  ) => {
    setNotificationChannelTesting(channel);
    try {
      const res = await testNotificationChannel(channel);
      if (res.code === 0) {
        messageApi.success(`${label} 测试消息已发送`);
      } else {
        messageApi.error(res.message || '测试消息发送失败');
      }
    } catch (error: any) {
      messageApi.error(error?.data || error?.message || '测试消息发送失败');
    } finally {
      setNotificationChannelTesting(undefined);
    }
  };

  const handleLoginBackgroundUpload = async (file: File) => {
    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (file.type && !allowedTypes.has(file.type)) {
      messageApi.error('仅支持 JPG、PNG 和 WebP 图片');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      messageApi.error('背景图片不能超过 10 MiB');
      return;
    }

    setBackgroundUploading(true);
    try {
      const response = await uploadLoginBackground(file);
      if (response.code !== 0 || !response.data?.url) {
        messageApi.error(response.message || '背景图片上传失败');
        return;
      }

      form.setFieldValue(['site', 'login_background_url'], response.data.url);
      form.setFieldValue(['site', 'login_background_source'], 'custom');
      messageApi.success(
        `上传完成（${response.data.width} × ${response.data.height}），点击“保存配置”后生效`,
      );
    } catch (error: any) {
      messageApi.error(error?.message || '背景图片上传失败');
    } finally {
      setBackgroundUploading(false);
    }
  };

  const handleGetBrowserUserAgent = () => {
    if (typeof navigator === 'undefined') {
      messageApi.error('当前环境无法读取浏览器 UA');
      return;
    }

    form.setFieldValue(['server', 'web_115_user_agent'], navigator.userAgent);
    messageApi.success('已获取当前浏览器 UA，请点击“保存配置”完成保存');
  };

  const handleResetRSSAutomationUserAgent = () => {
    form.setFieldValue(
      ['rss_automation', 'user_agent'],
      DEFAULT_RSS_AUTOMATION_USER_AGENT,
    );
    messageApi.success('已恢复默认 RSS 自动化 UA，请点击“保存配置”完成保存');
  };

  return (
    <PageContainer
      className={styles.page}
      header={{
        title: '系统设置',
        subTitle: '集中管理 FilmFusion 的服务连接、通知与安全策略',
      }}
    >
      {contextHolder}
      <Alert
        className={styles.intro}
        type="info"
        showIcon
        message={
          <span>
            <Typography.Text strong className={styles.introTitle}>
              配置按用途持久化
            </Typography.Text>
            <Typography.Text type="secondary">
              登录页外观、115 与 RSS 自动化运行配置保存到数据库，其余配置写入
              config.yaml；「需重启」项除外。
            </Typography.Text>
          </span>
        }
      />
      <div>
        <Spin spinning={loading} className={styles.loadingArea}>
          {config && (
            <ProForm<API.AppConfig>
              form={form}
              initialValues={config}
              onFinish={onFinish}
              layout="vertical"
              submitter={{
                searchConfig: { submitText: '保存配置', resetText: '重置' },
                render: (_props, doms) => (
                  <div className={styles.formActions}>
                    <Typography.Text type="secondary">
                      修改仅在点击保存后生效
                    </Typography.Text>
                    <Space>{doms}</Space>
                  </div>
                ),
              }}
            >
              <Tabs
                className={styles.settingsTabs}
                tabBarGutter={28}
                items={[
                  {
                    key: 'server',
                    label: '服务器',
                    forceRender: true,
                    children: (
                      <div className={styles.tabPanel}>
                        <SettingsSection
                          title="基础服务"
                          description="管理后台的监听端口与登录凭据。"
                        >
                          <div className={styles.fieldGrid}>
                            <ProFormText
                              width="md"
                              name={['server', 'port']}
                              label={<span>HTTP 端口{restartTag}</span>}
                              rules={[
                                { required: true, message: '请输入端口' },
                              ]}
                            />
                            <ProFormText
                              width="md"
                              name={['server', 'username']}
                              label="登录用户名"
                            />
                            <ProFormText.Password
                              width="md"
                              name={['server', 'password']}
                              label="登录密码"
                              fieldProps={{
                                placeholder:
                                  secretPlaceholder('server.password'),
                              }}
                            />
                          </div>
                        </SettingsSection>

                        <SettingsSection
                          title="登录与访问保护"
                          description="限制连续失败请求；可信代理配置也用于识别 RSS 局域网免 Token 请求。"
                        >
                          <div className={styles.toggleGrid}>
                            <SettingsToggle
                              name={['server', 'security', 'enabled']}
                              title="管理后台登录保护"
                              description="登录失败达到阈值后，临时封禁账号与来源 IP。"
                            />
                          </div>
                          <div className={styles.fieldGrid}>
                            <ProFormDigit
                              width="md"
                              name={['server', 'security', 'window_minutes']}
                              label="失败统计窗口 (分钟)"
                              min={1}
                              fieldProps={{ precision: 0 }}
                            />
                            <ProFormDigit
                              width="md"
                              name={[
                                'server',
                                'security',
                                'max_failures_per_account_ip',
                              ]}
                              label="单账号与 IP 最大失败次数"
                              min={1}
                              fieldProps={{ precision: 0 }}
                            />
                            <ProFormDigit
                              width="md"
                              name={[
                                'server',
                                'security',
                                'max_failures_per_ip',
                              ]}
                              label="单 IP 最大失败次数"
                              min={1}
                              fieldProps={{ precision: 0 }}
                            />
                            <ProFormDigit
                              width="md"
                              name={['server', 'security', 'block_minutes']}
                              label="封禁时长 (分钟)"
                              min={1}
                              fieldProps={{ precision: 0 }}
                            />
                            <ProFormSelect
                              width="lg"
                              name={[
                                'server',
                                'security',
                                'trusted_proxy_cidrs',
                              ]}
                              label="可信代理 IP / CIDR"
                              fieldProps={{
                                mode: 'tags',
                                tokenSeparators: [',', ' '],
                                placeholder: '直连时留空，仅填写实际代理地址',
                              }}
                            />
                          </div>
                        </SettingsSection>

                        <SettingsSection
                          title="媒体事件"
                          description="控制是否接收并处理新入库媒体事件。"
                        >
                          <div className={styles.toggleGrid}>
                            <SettingsToggle
                              name={['server', 'process_new_media']}
                              title="处理新增媒体事件"
                              description="收到 Webhook 新入库通知后，执行已配置的媒体处理流程。"
                            />
                          </div>
                        </SettingsSection>
                      </div>
                    ),
                  },
                  {
                    key: 'rss-automation',
                    label: 'RSS 自动化',
                    forceRender: true,
                    children: (
                      <div className={styles.tabPanel}>
                        <SettingsSection
                          title="RSS 请求"
                          description="设置 RSS 自动化在样本预览和定时抓取时发送的浏览器标识。"
                        >
                          <div className={styles.userAgentEditor}>
                            <ProFormTextArea
                              width="xl"
                              name={['rss_automation', 'user_agent']}
                              label="User-Agent"
                              placeholder="例如：Mozilla/5.0 ..."
                              extra="保存后立即用于新的 RSS 自动化请求，不影响旧 RSS 监控。"
                              fieldProps={{
                                autoSize: { minRows: 3, maxRows: 6 },
                                maxLength: 2048,
                                showCount: true,
                              }}
                              rules={[
                                {
                                  required: true,
                                  whitespace: true,
                                  message: '请输入 RSS 自动化 User-Agent',
                                },
                                {
                                  max: 2048,
                                  message: 'User-Agent 不能超过 2048 个字符',
                                },
                                {
                                  pattern: /^[^\r\n]*$/,
                                  message: 'User-Agent 不能包含换行',
                                },
                              ]}
                            />
                          </div>
                          <div className={styles.userAgentActions}>
                            <Button onClick={handleResetRSSAutomationUserAgent}>
                              恢复默认 UA
                            </Button>
                            <Typography.Text type="secondary">
                              默认模拟 macOS Chrome
                              150；自定义值只保存在数据库。
                            </Typography.Text>
                          </div>
                        </SettingsSection>
                      </div>
                    ),
                  },
                  {
                    key: 'rss-generator',
                    label: 'RSS 生成器',
                    forceRender: true,
                    children: (
                      <div className={styles.tabPanel}>
                        <SettingsSection
                          title="Worker 鉴权"
                          description="设置 FilmFusion 调用 RSS Generator Worker 使用的内部凭证。"
                        >
                          <Alert
                            className={styles.sectionAlert}
                            type="warning"
                            showIcon
                            message="需要在两处手工填写完全相同的 Token"
                            description="先在 Worker 的 Compose 环境变量 WORKER_AUTH_TOKEN 中填写，再在下方填写相同值。保存后 FilmFusion 立即使用新 Token；修改 Compose 后需要重建 Worker 容器。"
                          />
                          <div className={styles.fieldGrid}>
                            <ProFormText.Password
                              width="xl"
                              name={['rss_generator', 'worker_token']}
                              label="Worker Token"
                              extra="至少 32 个字符。后台不会回显明文，留空保存表示保持现值。"
                              fieldProps={{
                                autoComplete: 'new-password',
                                placeholder: secretPlaceholder(
                                  'rss_generator.worker_token',
                                ),
                              }}
                              rules={[
                                {
                                  validator: async (_, value?: string) => {
                                    const raw = value || '';
                                    const token = raw.trim();
                                    if (!token) {
                                      if (
                                        secrets['rss_generator.worker_token']
                                      ) {
                                        return;
                                      }
                                      throw new Error('请输入 Worker Token');
                                    }
                                    if (/[\r\n]/.test(raw)) {
                                      throw new Error(
                                        'Worker Token 不能包含换行',
                                      );
                                    }
                                    const length = new TextEncoder().encode(
                                      token,
                                    ).length;
                                    if (length < 32) {
                                      throw new Error(
                                        'Worker Token 至少需要 32 个字符',
                                      );
                                    }
                                    if (length > 512) {
                                      throw new Error(
                                        'Worker Token 不能超过 512 个字符',
                                      );
                                    }
                                  },
                                },
                              ]}
                            />
                          </div>
                          <Typography.Text type="secondary">
                            当前内部地址：
                            <Typography.Text code>
                              {config.rss_generator?.worker_url ||
                                'http://rss-generator-worker:8787'}
                            </Typography.Text>
                          </Typography.Text>
                        </SettingsSection>
                      </div>
                    ),
                  },
                  {
                    key: '115',
                    label: '115',
                    forceRender: true,
                    children: (
                      <div className={styles.tabPanel}>
                        <SettingsSection
                          title="115 Open 下载"
                          description="设置 115 下载队列的并发处理数量。"
                        >
                          <div className={styles.fieldGrid}>
                            <ProFormDigit
                              width="md"
                              name={['server', 'download_115_concurrency']}
                              label={<span>下载并发{restartTag}</span>}
                              min={1}
                              fieldProps={{ precision: 0 }}
                            />
                          </div>
                        </SettingsSection>

                        <SettingsSection
                          title="Cookie 保活"
                          description="设置未单独指定设备端的 115 存储在自动续期时使用的全局默认值。"
                        >
                          <div className={styles.fieldGrid}>
                            <ProFormSelect
                              width="md"
                              name={['server', 'cookie_115_default_app']}
                              label="默认自动续期设备端"
                              tooltip="保存后即时生效，但不会立即触发续期；单存储设置仍优先于此默认值。"
                              options={[...WEB115_RELOGIN_APP_OPTIONS]}
                              rules={[
                                {
                                  required: true,
                                  message: '请选择默认自动续期设备端',
                                },
                              ]}
                            />
                          </div>
                        </SettingsSection>

                        <SettingsSection
                          title="115 User-Agent"
                          description="可手动配置，也可读取当前浏览器的 User-Agent；当前仅持久化，暂不参与任何 115 请求。"
                        >
                          <div className={styles.userAgentEditor}>
                            <ProFormTextArea
                              width="xl"
                              name={['server', 'web_115_user_agent']}
                              label="User-Agent"
                              placeholder="例如：Mozilla/5.0 ..."
                              fieldProps={{
                                autoSize: { minRows: 2, maxRows: 5 },
                                maxLength: 2048,
                                showCount: true,
                              }}
                              rules={[
                                {
                                  max: 2048,
                                  message: 'User-Agent 不能超过 2048 个字符',
                                },
                                {
                                  pattern: /^[^\r\n]*$/,
                                  message: 'User-Agent 不能包含换行',
                                },
                              ]}
                            />
                          </div>
                          <div className={styles.userAgentActions}>
                            <Button onClick={handleGetBrowserUserAgent}>
                              获取当前浏览器 UA
                            </Button>
                            <Typography.Text
                              type="secondary"
                              copyable={
                                browserUserAgent
                                  ? { text: browserUserAgent }
                                  : false
                              }
                            >
                              {browserUserAgent
                                ? '复制当前填写的 UA'
                                : '可手动填写，或从当前浏览器获取'}
                            </Typography.Text>
                          </div>
                        </SettingsSection>
                      </div>
                    ),
                  },
                  {
                    key: 'appearance',
                    label: '外观设置',
                    forceRender: true,
                    children: (
                      <div className={styles.tabPanel}>
                        <SettingsSection
                          title="登录页外观"
                          description="配置登录页品牌文案、全屏背景及底部备案信息；上传图片会保存在持久化 data 目录。"
                        >
                          <div className={styles.fieldGrid}>
                            <ProFormText
                              width="md"
                              name={['site', 'login_title']}
                              label="左上角站点标题"
                              placeholder="例如：Film Fusion"
                              rules={[
                                {
                                  required: true,
                                  whitespace: true,
                                  message: '请输入登录页内容标题',
                                },
                              ]}
                            />
                            <ProFormText
                              width="md"
                              name={['site', 'login_subtitle']}
                              label="左上角站点副标题"
                              placeholder="例如：简单的 Emby + 网盘辅助工具"
                              rules={[
                                {
                                  required: true,
                                  whitespace: true,
                                  message: '请输入登录页内容副标题',
                                },
                              ]}
                            />
                            <ProFormText
                              width="md"
                              name={['site', 'login_form_title']}
                              label="表单主标题"
                              placeholder="例如：欢迎回来"
                              rules={[
                                {
                                  required: true,
                                  whitespace: true,
                                  message: '请输入登录表单主标题',
                                },
                              ]}
                            />
                            <ProFormText
                              width="md"
                              name={['site', 'login_form_subtitle']}
                              label="表单说明"
                              placeholder="例如：使用管理员账户进入控制台"
                              rules={[
                                {
                                  required: true,
                                  whitespace: true,
                                  message: '请输入登录表单说明',
                                },
                              ]}
                            />
                            <ProFormSelect
                              width="md"
                              name={['site', 'login_background_source']}
                              label="背景图片来源"
                              initialValue="custom"
                              extra={
                                unavailableBackgroundSourceHint || undefined
                              }
                              options={[
                                { label: '手动图片', value: 'custom' },
                                {
                                  label: embyBackgroundAvailable
                                    ? 'Emby 媒体库'
                                    : 'Emby 媒体库（请先完成 Emby 配置）',
                                  value: 'emby',
                                  disabled: !embyBackgroundAvailable,
                                },
                                {
                                  label: tmdbBackgroundAvailable
                                    ? 'TMDB'
                                    : 'TMDB（请先完成 TMDB 配置）',
                                  value: 'tmdb',
                                  disabled: !tmdbBackgroundAvailable,
                                },
                              ]}
                              rules={[
                                {
                                  validator: async (_, value) => {
                                    if (
                                      value === 'emby' &&
                                      !embyBackgroundAvailable
                                    ) {
                                      throw new Error(
                                        '请先启用 Emby 服务，并配置 Emby 地址和 API Key',
                                      );
                                    }
                                    if (
                                      value === 'tmdb' &&
                                      !tmdbBackgroundAvailable
                                    ) {
                                      throw new Error(
                                        '请先启用 TMDB API，并配置 API Key 或 Access Token',
                                      );
                                    }
                                  },
                                },
                              ]}
                            />
                            {loginBackgroundSource !== 'custom' && (
                              <>
                                <ProFormSelect
                                  width="md"
                                  name={['site', 'login_background_mode']}
                                  label="动态内容"
                                  initialValue="latest"
                                  options={[
                                    { label: '最新内容', value: 'latest' },
                                    { label: '最流行内容', value: 'popular' },
                                  ]}
                                />
                                <ProFormDigit
                                  width="md"
                                  name={['site', 'login_background_interval']}
                                  label="轮播间隔（秒）"
                                  initialValue={12}
                                  min={5}
                                  max={300}
                                  fieldProps={{ precision: 0 }}
                                />
                                <ProFormDigit
                                  width="md"
                                  name={['site', 'login_background_limit']}
                                  label="轮播图片数量"
                                  initialValue={10}
                                  min={1}
                                  max={20}
                                  fieldProps={{ precision: 0 }}
                                />
                                <div style={{ gridColumn: '1 / -1' }}>
                                  <Alert
                                    className={styles.sectionAlert}
                                    type="info"
                                    showIcon
                                    message={
                                      loginBackgroundSource === 'emby'
                                        ? '从 Emby 媒体库读取横向 Backdrop'
                                        : '从 TMDB 电影与剧集榜单读取横向 Backdrop'
                                    }
                                    description="登录页会预加载并交叉淡化轮播；动态来源未配置、请求失败或没有剧照时，自动使用下方手动图片。"
                                  />
                                </div>
                              </>
                            )}
                            <ProFormText
                              width="md"
                              name={['site', 'footer_text']}
                              label="底部版权文字"
                              placeholder="例如：Powered by Kumayi"
                            />
                            <div className={styles.backgroundAsset}>
                              <div className={styles.backgroundPreview}>
                                {loginBackgroundURL &&
                                !backgroundPreviewFailed ? (
                                  <img
                                    alt="当前登录页背景预览"
                                    onError={() =>
                                      setBackgroundPreviewFailed(true)
                                    }
                                    src={loginBackgroundURL}
                                  />
                                ) : (
                                  <div
                                    className={styles.backgroundPreviewEmpty}
                                  >
                                    <PictureOutlined aria-hidden="true" />
                                    <span>
                                      {backgroundPreviewFailed
                                        ? '当前图片无法加载，请检查 URL 或重新上传'
                                        : loginBackgroundSource === 'custom'
                                          ? '当前使用内置黑白渐变背景'
                                          : '未设置动态来源的回退图片'}
                                    </span>
                                  </div>
                                )}
                              </div>

                              <div className={styles.backgroundUploadPanel}>
                                <Upload.Dragger
                                  accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                                  beforeUpload={async (file) => {
                                    await handleLoginBackgroundUpload(file);
                                    return Upload.LIST_IGNORE;
                                  }}
                                  className={styles.backgroundUploader}
                                  disabled={backgroundUploading}
                                  maxCount={1}
                                  showUploadList={false}
                                >
                                  <p className="ant-upload-drag-icon">
                                    <UploadOutlined />
                                  </p>
                                  <p className="ant-upload-text">
                                    {backgroundUploading
                                      ? '正在上传背景图片'
                                      : '点击或拖拽图片到这里上传'}
                                  </p>
                                  <p className="ant-upload-hint">
                                    JPG / PNG / WebP，最大 10 MiB
                                  </p>
                                </Upload.Dragger>
                                <div className={styles.backgroundUploadActions}>
                                  <Typography.Text type="secondary">
                                    文件保存到
                                    {' data/uploads/login-backgrounds/'}
                                  </Typography.Text>
                                  <Button
                                    disabled={
                                      !loginBackgroundURL || backgroundUploading
                                    }
                                    onClick={() =>
                                      form.setFieldValue(
                                        ['site', 'login_background_url'],
                                        '',
                                      )
                                    }
                                    size="small"
                                  >
                                    清除手动背景
                                  </Button>
                                </div>
                              </div>
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                              <ProFormText
                                width="xl"
                                name={['site', 'login_background_url']}
                                label={
                                  loginBackgroundSource === 'custom'
                                    ? '登录页背景图片 URL'
                                    : '动态来源失败时的回退图片 URL'
                                }
                                tooltip="上传后会自动填写并切换为手动图片；也支持 HTTPS 地址或站内绝对路径"
                                placeholder="例如：https://example.com/background.jpg"
                              />
                            </div>
                            <ProFormText
                              width="md"
                              name={['site', 'icp_number']}
                              label="ICP备案号"
                              placeholder="例如：京ICP备12345678号"
                            />
                            <ProFormText
                              width="md"
                              name={['site', 'police_number']}
                              label="公安备案号"
                              placeholder="例如：京公网安备 11000002000001号"
                            />
                          </div>
                        </SettingsSection>
                      </div>
                    ),
                  },
                  {
                    key: 'webhook',
                    label: 'Webhook',
                    forceRender: true,
                    children: (
                      <div className={styles.tabPanel}>
                        <SettingsSection
                          title="CloudDrive2 Webhook"
                          description="Webhook 始终接收通知；启用鉴权后，只有携带正确 Bearer Token 的请求才会被接受。"
                        >
                          <Alert
                            className={styles.sectionAlert}
                            type={
                              !webhookAuthEnabled
                                ? 'info'
                                : secrets['webhook.clouddrive2.token'] ||
                                    webhookToken
                                  ? 'success'
                                  : 'warning'
                            }
                            showIcon
                            icon={<SafetyCertificateOutlined />}
                            message={
                              !webhookAuthEnabled
                                ? 'Webhook 鉴权已关闭'
                                : secrets['webhook.clouddrive2.token'] ||
                                    webhookToken
                                  ? 'Webhook Token 已配置'
                                  : '请先配置独立 Token'
                            }
                            description={
                              webhookAuthEnabled
                                ? '保存后立即生效；出于安全考虑，已保存的 Token 不会再次回显。'
                                : '关闭鉴权不会停用 Webhook，CloudDrive2 通知仍会被正常接收。'
                            }
                          />
                          <div className={styles.toggleGrid}>
                            <SettingsToggle
                              name={['webhook', 'clouddrive2', 'enabled']}
                              title="Bearer Token 鉴权"
                              description="要求 CloudDrive2 请求携带正确 Token；关闭后仍会接收 Webhook。"
                            />
                          </div>
                          <div className={styles.fieldGrid}>
                            <ProFormText.Password
                              width="lg"
                              name={['webhook', 'clouddrive2', 'token']}
                              label="Bearer Token"
                              tooltip="启用鉴权时至少 32 个字符；留空表示保持当前 Token 不变。"
                              fieldProps={{
                                placeholder: secretPlaceholder(
                                  'webhook.clouddrive2.token',
                                ),
                                addonAfter: (
                                  <Button
                                    type="text"
                                    size="small"
                                    icon={<KeyOutlined />}
                                    onClick={generateWebhookToken}
                                  >
                                    生成
                                  </Button>
                                ),
                              }}
                            />
                          </div>
                          <Typography.Title level={5}>
                            CloudDrive2 请求头配置
                          </Typography.Title>
                          {cloudDrive2HeaderConfig ? (
                            <Typography.Paragraph
                              code
                              copyable={{ text: cloudDrive2HeaderConfig }}
                              className={styles.codeBlock}
                            >
                              {cloudDrive2HeaderConfig}
                            </Typography.Paragraph>
                          ) : (
                            <Typography.Text
                              type="secondary"
                              className={styles.helperText}
                            >
                              点击“生成”后，请在刷新页面前复制配置到现有的
                              {' [global_params.default_headers]'}
                              ；如果已经配置完成，无需再次生成。
                            </Typography.Text>
                          )}
                        </SettingsSection>
                      </div>
                    ),
                  },
                  {
                    key: 'emby',
                    label: 'Emby',
                    forceRender: true,
                    children: (
                      <div className={styles.tabPanel}>
                        <SettingsSection
                          title="代理服务"
                          description="连接 Emby 并配置 FilmFusion 的代理监听参数。"
                        >
                          <div className={styles.toggleGrid}>
                            <SettingsToggle
                              name={['emby', 'enabled']}
                              title="Emby 代理服务"
                              description="启动 FilmFusion 的 Emby 反向代理监听。"
                              badge={restartTag}
                            />
                          </div>
                          <div className={styles.fieldGrid}>
                            <ProFormText
                              width="lg"
                              name={['emby', 'url']}
                              label="Emby 地址"
                              placeholder="http://127.0.0.1:8096"
                            />
                            <ProFormDigit
                              width="md"
                              name={['emby', 'run_proxy_port']}
                              label={<span>Emby 代理端口{restartTag}</span>}
                              min={0}
                              fieldProps={{ precision: 0 }}
                            />
                            <ProFormText.Password
                              width="md"
                              name={['emby', 'api_key']}
                              label="Emby API Key"
                              fieldProps={{
                                placeholder: secretPlaceholder('emby.api_key'),
                              }}
                            />
                            <ProFormText
                              width="md"
                              name={['emby', 'admin_user_id']}
                              label="管理员用户 ID"
                            />
                            <ProFormDigit
                              width="md"
                              name={['emby', 'cache_time']}
                              label="API 超时 (秒)"
                              min={0}
                              fieldProps={{ precision: 0 }}
                            />
                          </div>
                        </SettingsSection>

                        <SettingsSection
                          title="播放信息"
                          description="控制播放请求中需要补充的媒体元数据。"
                        >
                          <div className={styles.toggleGrid}>
                            <SettingsToggle
                              name={['emby', 'add_current_media_info']}
                              title="补充当前媒体信息"
                              description="开始播放时，获取并补充当前媒体的播放信息。"
                            />
                            <SettingsToggle
                              name={['emby', 'add_next_media_info']}
                              title="预取下一集媒体信息"
                              description="播放剧集时，提前获取下一集的媒体信息。"
                            />
                          </div>
                        </SettingsSection>

                        <SettingsSection
                          title="登录保护"
                          description="限制 Emby 登录失败请求；直接开放代理端口时无需填写可信代理。"
                        >
                          <div className={styles.toggleGrid}>
                            <SettingsToggle
                              name={['emby', 'security', 'enabled']}
                              title="Emby 登录保护"
                              description="登录失败达到阈值后，临时封禁账号与来源 IP。"
                            />
                          </div>
                          <div className={styles.fieldGrid}>
                            <ProFormDigit
                              width="md"
                              name={['emby', 'security', 'window_minutes']}
                              label="失败统计窗口 (分钟)"
                              min={1}
                              fieldProps={{ precision: 0 }}
                            />
                            <ProFormDigit
                              width="md"
                              name={[
                                'emby',
                                'security',
                                'max_failures_per_account_ip',
                              ]}
                              label="单账号与 IP 最大失败次数"
                              min={1}
                              fieldProps={{ precision: 0 }}
                            />
                            <ProFormDigit
                              width="md"
                              name={['emby', 'security', 'max_failures_per_ip']}
                              label="单 IP 最大失败次数"
                              min={1}
                              fieldProps={{ precision: 0 }}
                            />
                            <ProFormDigit
                              width="md"
                              name={['emby', 'security', 'block_minutes']}
                              label="封禁时长 (分钟)"
                              min={1}
                              fieldProps={{ precision: 0 }}
                            />
                            <ProFormSelect
                              width="lg"
                              name={['emby', 'security', 'trusted_proxy_cidrs']}
                              label="可信代理 IP / CIDR"
                              fieldProps={{
                                mode: 'tags',
                                tokenSeparators: [',', ' '],
                                placeholder: '直接开放 8097 时保持为空',
                              }}
                            />
                          </div>
                        </SettingsSection>
                      </div>
                    ),
                  },
                  {
                    key: 'notifications',
                    label: '通知',
                    forceRender: true,
                    children: (
                      <div className={styles.tabPanel}>
                        <SettingsSection
                          title="通知身份"
                          description="统一标识当前 FilmFusion 实例；事件内容与投递渠道彼此独立。"
                        >
                          <div className={styles.fieldGrid}>
                            <ProFormText
                              width="md"
                              name={['notifications', 'instance_name']}
                              label="实例名称"
                              placeholder="FilmFusion"
                              rules={[
                                { required: true, message: '请输入实例名称' },
                                {
                                  max: 120,
                                  message: '实例名称不能超过 120 个字符',
                                },
                              ]}
                            />
                          </div>
                        </SettingsSection>

                        <SettingsSection
                          title="Telegram 渠道"
                          description="Telegram 只负责投递；接收哪些事件由下方事件路由决定。"
                        >
                          <Alert
                            className={styles.sectionAlert}
                            type="info"
                            showIcon
                            message="渠道测试使用已保存的配置"
                            description="修改下方字段后请先保存，再发送测试消息。"
                            action={
                              <Button
                                icon={<SendOutlined />}
                                loading={
                                  notificationChannelTesting === 'telegram'
                                }
                                onClick={() =>
                                  handleNotificationChannelTest(
                                    'telegram',
                                    'Telegram',
                                  )
                                }
                              >
                                发送测试消息
                              </Button>
                            }
                          />
                          <div className={styles.toggleGrid}>
                            <SettingsToggle
                              name={['notifications', 'telegram', 'enabled']}
                              title="启用 Telegram"
                              description="允许事件路由向 Telegram Bot 投递消息。"
                            />
                            <SettingsToggle
                              name={['notifications', 'telegram', 'silent']}
                              title="静默发送"
                              description="Telegram 收到消息时不播放提示音。"
                            />
                          </div>
                          <div className={styles.fieldGrid}>
                            <ProFormText.Password
                              width="lg"
                              name={['notifications', 'telegram', 'bot_token']}
                              label="Bot Token"
                              fieldProps={{
                                placeholder: secretPlaceholder(
                                  'notifications.telegram.bot_token',
                                ),
                              }}
                            />
                            <ProFormText
                              width="lg"
                              name={['notifications', 'telegram', 'chat_id']}
                              label="Chat ID"
                              placeholder="-1001234567890"
                            />
                            <ProFormDigit
                              width="md"
                              name={[
                                'notifications',
                                'telegram',
                                'message_thread_id',
                              ]}
                              label="话题 ID"
                              tooltip="论坛群需要指定话题时填写；0 表示发送到群组默认话题。"
                              min={0}
                              fieldProps={{ precision: 0 }}
                            />
                            <ProFormText
                              width="lg"
                              name={['notifications', 'telegram', 'api_base']}
                              label="API 地址"
                              placeholder="https://api.telegram.org"
                            />
                            <ProFormDigit
                              width="md"
                              name={[
                                'notifications',
                                'telegram',
                                'timeout_seconds',
                              ]}
                              label="请求超时 (秒)"
                              min={1}
                              fieldProps={{ precision: 0 }}
                            />
                          </div>
                        </SettingsSection>

                        <SettingsSection
                          title="Webhook 渠道"
                          description="向自建服务发送统一 JSON 事件；可用 Bearer Token 验证来源。"
                        >
                          <Alert
                            className={styles.sectionAlert}
                            type="info"
                            showIcon
                            message="Webhook 收到结构化通知事件"
                            description="POST JSON 包含 instance、event、title、message、image_url、severity、occurred_at 与 metadata。修改后请先保存再测试。"
                            action={
                              <Button
                                icon={<SendOutlined />}
                                loading={
                                  notificationChannelTesting === 'webhook'
                                }
                                onClick={() =>
                                  handleNotificationChannelTest(
                                    'webhook',
                                    'Webhook',
                                  )
                                }
                              >
                                发送测试消息
                              </Button>
                            }
                          />
                          <div className={styles.toggleGrid}>
                            <SettingsToggle
                              name={['notifications', 'webhook', 'enabled']}
                              title="启用 Webhook"
                              description="允许事件路由向下方 URL 投递 JSON。"
                            />
                          </div>
                          <div className={styles.fieldGrid}>
                            <ProFormText
                              width="xl"
                              name={['notifications', 'webhook', 'url']}
                              label="Webhook URL"
                              placeholder="https://example.com/filmfusion/events"
                            />
                            <ProFormText.Password
                              width="lg"
                              name={['notifications', 'webhook', 'token']}
                              label="Bearer Token"
                              fieldProps={{
                                placeholder: secretPlaceholder(
                                  'notifications.webhook.token',
                                ),
                              }}
                            />
                            <ProFormDigit
                              width="md"
                              name={[
                                'notifications',
                                'webhook',
                                'timeout_seconds',
                              ]}
                              label="请求超时 (秒)"
                              min={1}
                              fieldProps={{ precision: 0 }}
                            />
                          </div>
                        </SettingsSection>

                        <SettingsSection
                          title="事件路由"
                          description="每类事件可以同时发送到多个渠道；清空选择表示关闭该类通知。"
                        >
                          <div className={styles.fieldGrid}>
                            <ProFormSelect
                              width="lg"
                              name={[
                                'notifications',
                                'routes',
                                'emby_brute_force',
                              ]}
                              label="Emby 登录爆破"
                              options={notificationChannelOptions}
                              fieldProps={{
                                mode: 'multiple',
                                allowClear: true,
                              }}
                            />
                            <ProFormSelect
                              width="lg"
                              name={[
                                'notifications',
                                'routes',
                                'system_brute_force',
                              ]}
                              label="FilmFusion 登录爆破"
                              options={notificationChannelOptions}
                              fieldProps={{
                                mode: 'multiple',
                                allowClear: true,
                              }}
                            />
                            <ProFormSelect
                              width="lg"
                              name={['notifications', 'routes', 'rss_matched']}
                              label="RSS 规则命中"
                              options={notificationChannelOptions}
                              fieldProps={{
                                mode: 'multiple',
                                allowClear: true,
                              }}
                            />
                            <ProFormSelect
                              width="lg"
                              name={[
                                'notifications',
                                'routes',
                                'web_115_cookie_invalid',
                              ]}
                              label="115 Cookie 失效"
                              options={notificationChannelOptions}
                              fieldProps={{
                                mode: 'multiple',
                                allowClear: true,
                              }}
                            />
                          </div>
                        </SettingsSection>
                      </div>
                    ),
                  },
                  {
                    key: 'cover',
                    label: '封面生成',
                    forceRender: true,
                    children: (
                      <div className={styles.tabPanel}>
                        <SettingsSection
                          title="生成策略"
                          description="控制自动生成任务以及海报拼接规则。"
                        >
                          <div className={styles.toggleGrid}>
                            <SettingsToggle
                              name={['emby', 'cover', 'enabled']}
                              title="自动生成媒体库封面"
                              description="允许封面生成器按下方 cron 定时更新媒体库封面。"
                            />
                          </div>
                          <div className={styles.fieldGrid}>
                            <ProFormText
                              width="md"
                              name={['emby', 'cover', 'cron']}
                              label="定时 cron"
                              placeholder="如 0 3 * * * （留空仅手动）"
                              tooltip="保存后自动重新调度，无需重启"
                            />
                            <ProFormDigit
                              width="md"
                              name={['emby', 'cover', 'poster_count']}
                              label="拼接海报数量"
                              min={1}
                              fieldProps={{ precision: 0 }}
                            />
                          </div>
                        </SettingsSection>

                        <SettingsSection
                          title="输出参数"
                          description="设置封面尺寸、JPEG 质量与中英文字体。"
                        >
                          <div className={styles.fieldGrid}>
                            <ProFormDigit
                              width="md"
                              name={['emby', 'cover', 'width']}
                              label="输出宽度"
                              min={1}
                              fieldProps={{ precision: 0 }}
                            />
                            <ProFormDigit
                              width="md"
                              name={['emby', 'cover', 'height']}
                              label="输出高度"
                              min={1}
                              fieldProps={{ precision: 0 }}
                            />
                            <ProFormDigit
                              width="md"
                              name={['emby', 'cover', 'jpeg_quality']}
                              label="JPEG 质量 (1-100)"
                              min={1}
                              max={100}
                              fieldProps={{ precision: 0 }}
                            />
                            <ProFormText
                              width="lg"
                              name={['emby', 'cover', 'font_cn']}
                              label="中文字体路径"
                            />
                            <ProFormText
                              width="lg"
                              name={['emby', 'cover', 'font_en']}
                              label="英文字体路径"
                            />
                          </div>
                        </SettingsSection>
                      </div>
                    ),
                  },
                  {
                    key: 'moviepilot',
                    label: 'MoviePilot',
                    forceRender: true,
                    children: (
                      <div className={styles.tabPanel}>
                        <SettingsSection
                          title="服务连接"
                          description="配置 FilmFusion 访问 MoviePilot 所需的地址与凭据。"
                        >
                          <div className={styles.fieldGrid}>
                            <ProFormText
                              width="lg"
                              name={['moviepilot', 'api']}
                              label="API 地址"
                              placeholder="http://127.0.0.1:3001"
                            />
                            <ProFormText
                              width="md"
                              name={['moviepilot', 'username']}
                              label="用户名"
                            />
                            <ProFormText.Password
                              width="md"
                              name={['moviepilot', 'password']}
                              label="密码"
                              fieldProps={{
                                placeholder: secretPlaceholder(
                                  'moviepilot.password',
                                ),
                              }}
                            />
                          </div>
                        </SettingsSection>
                      </div>
                    ),
                  },
                  {
                    key: 'tmdb',
                    label: 'TMDB',
                    forceRender: true,
                    children: (
                      <div className={styles.tabPanel}>
                        <SettingsSection
                          title="剧集元数据"
                          description="使用 TMDB 的季信息辅助后台预整理队列判断剧集完整度。"
                        >
                          <Alert
                            className={styles.sectionAlert}
                            type="info"
                            showIcon
                            message="队列会按识别到的季号读取 TMDB 本季集数"
                            description="查询结果会按下方缓存时间复用，减少重复请求。"
                          />
                          <div className={styles.toggleGrid}>
                            <SettingsToggle
                              name={['tmdb', 'enabled']}
                              title="TMDB API"
                              description="允许预整理队列查询 TMDB 本季集数并缓存结果。"
                            />
                          </div>
                          <div className={styles.fieldGrid}>
                            <ProFormText
                              width="lg"
                              name={['tmdb', 'base_url']}
                              label="API 地址"
                              placeholder="https://api.themoviedb.org"
                            />
                            <ProFormText.Password
                              width="lg"
                              name={['tmdb', 'api_key']}
                              label="v3 API Key"
                              fieldProps={{
                                placeholder: secretPlaceholder('tmdb.api_key'),
                              }}
                            />
                            <ProFormText.Password
                              width="lg"
                              name={['tmdb', 'access_token']}
                              label="Read Access Token"
                              tooltip="可选。填写后优先使用 Bearer Token；未填写时使用 v3 API Key 查询参数。"
                              fieldProps={{
                                placeholder:
                                  secretPlaceholder('tmdb.access_token'),
                              }}
                            />
                            <ProFormDigit
                              width="md"
                              name={['tmdb', 'timeout_seconds']}
                              label="请求超时 (秒)"
                              min={1}
                              fieldProps={{ precision: 0 }}
                            />
                            <ProFormDigit
                              width="md"
                              name={['tmdb', 'cache_minutes']}
                              label="缓存时间 (分钟)"
                              min={1}
                              fieldProps={{ precision: 0 }}
                            />
                          </div>
                        </SettingsSection>
                      </div>
                    ),
                  },
                  {
                    key: 'hdhive',
                    label: 'HDHive',
                    forceRender: true,
                    children: (
                      <div className={styles.tabPanel}>
                        <SettingsSection
                          title="应用授权"
                          description="保存应用参数后，再打开 HDHive 授权页获取用户 Token。"
                        >
                          <Alert
                            className={styles.sectionAlert}
                            type="warning"
                            showIcon
                            message="保存配置不会自动获得 Token"
                            description="完成应用配置并保存后，打开授权页确认授权；回调页会自动换取并保存 Access Token 与 Refresh Token。"
                            action={
                              <Space wrap>
                                <Button
                                  size="small"
                                  type="primary"
                                  loading={hdhiveAuthorizing}
                                  onClick={handleHDHiveAuthorize}
                                >
                                  打开授权页
                                </Button>
                                <Button
                                  size="small"
                                  loading={hdhiveRefreshing}
                                  onClick={handleHDHiveRefresh}
                                >
                                  刷新 Token
                                </Button>
                              </Space>
                            }
                          />
                          <div className={styles.toggleGrid}>
                            <SettingsToggle
                              name={['hdhive', 'enabled']}
                              title="HDHive OpenAPI"
                              description="允许 FilmFusion 使用下方应用参数调用 HDHive。"
                            />
                          </div>
                          <div className={styles.fieldGrid}>
                            <ProFormText
                              width="lg"
                              name={['hdhive', 'base_url']}
                              label="服务地址"
                              placeholder="https://hdhive.com"
                            />
                            <ProFormText
                              width="lg"
                              name={['hdhive', 'client_id']}
                              label="Client ID"
                              placeholder="app_xxx"
                            />
                            <ProFormText
                              width="lg"
                              name={['hdhive', 'redirect_uri']}
                              label="Redirect URI"
                              placeholder="https://your.domain/hdhive/callback"
                            />
                            <ProFormText
                              width="md"
                              name={['hdhive', 'scope']}
                              label="授权 Scope"
                              placeholder="query unlock"
                            />
                            <ProFormText.Password
                              width="lg"
                              name={['hdhive', 'api_key']}
                              label="应用 Secret (X-API-Key)"
                              fieldProps={{
                                placeholder:
                                  secretPlaceholder('hdhive.api_key'),
                              }}
                            />
                            <ProFormDigit
                              width="md"
                              name={['hdhive', 'timeout_seconds']}
                              label="请求超时 (秒)"
                              min={1}
                              fieldProps={{ precision: 0 }}
                            />
                          </div>
                        </SettingsSection>

                        <SettingsSection
                          title="Token 生命周期"
                          description="管理用户 Token 及其自动续期策略。"
                        >
                          <div className={styles.toggleGrid}>
                            <SettingsToggle
                              name={['hdhive', 'auto_refresh']}
                              title="自动刷新 Access Token"
                              description="到期前使用已保存的 Refresh Token 自动续期。"
                            />
                          </div>
                          <div className={styles.fieldGrid}>
                            <ProFormText.Password
                              width="lg"
                              name={['hdhive', 'access_token']}
                              label="用户 Access Token"
                              fieldProps={{
                                placeholder: secretPlaceholder(
                                  'hdhive.access_token',
                                ),
                              }}
                            />
                            <ProFormText.Password
                              width="lg"
                              name={['hdhive', 'refresh_token']}
                              label="用户 Refresh Token"
                              tooltip="后端自动刷新任务会使用该 Token 续期 Access Token。"
                              fieldProps={{
                                placeholder: secretPlaceholder(
                                  'hdhive.refresh_token',
                                ),
                              }}
                            />
                            <ProFormText
                              width="lg"
                              name={['hdhive', 'access_token_expires_at']}
                              label="Access Token 过期时间"
                              fieldProps={{ disabled: true }}
                            />
                            <ProFormText
                              width="lg"
                              name={['hdhive', 'refresh_token_expires_at']}
                              label="Refresh Token 过期时间"
                              fieldProps={{ disabled: true }}
                            />
                            <ProFormDigit
                              width="md"
                              name={['hdhive', 'refresh_before_minutes']}
                              label="提前刷新 (分钟)"
                              min={1}
                              fieldProps={{ precision: 0 }}
                            />
                            <ProFormDigit
                              width="md"
                              name={['hdhive', 'refresh_check_minutes']}
                              label="检查间隔 (分钟)"
                              min={1}
                              fieldProps={{ precision: 0 }}
                            />
                          </div>
                        </SettingsSection>
                      </div>
                    ),
                  },
                  {
                    key: 'log',
                    label: '日志',
                    forceRender: true,
                    children: (
                      <div className={styles.tabPanel}>
                        <SettingsSection
                          title="日志输出"
                          description="设置日志详细程度、输出形式与文件轮转策略。"
                        >
                          <div className={styles.toggleGrid}>
                            <SettingsToggle
                              name={['log', 'compress']}
                              title="压缩旧日志"
                              description="日志轮转后压缩历史文件，减少磁盘占用。"
                              badge={restartTag}
                            />
                          </div>
                          <div className={styles.fieldGrid}>
                            <ProFormSelect
                              width="md"
                              name={['log', 'level']}
                              label="日志级别"
                              tooltip="修改后即时生效，无需重启"
                              options={[
                                { label: 'debug', value: 'debug' },
                                { label: 'info', value: 'info' },
                                { label: 'warn', value: 'warn' },
                                { label: 'error', value: 'error' },
                                { label: 'fatal', value: 'fatal' },
                              ]}
                            />
                            <ProFormSelect
                              width="md"
                              name={['log', 'format']}
                              label={<span>格式{restartTag}</span>}
                              options={[
                                { label: 'text', value: 'text' },
                                { label: 'json', value: 'json' },
                              ]}
                            />
                            <ProFormSelect
                              width="md"
                              name={['log', 'output']}
                              label={<span>输出{restartTag}</span>}
                              options={[
                                { label: 'stdout', value: 'stdout' },
                                { label: 'file', value: 'file' },
                              ]}
                            />
                            <ProFormDigit
                              width="md"
                              name={['log', 'max_size']}
                              label={<span>单文件最大 (MB){restartTag}</span>}
                              min={1}
                              fieldProps={{ precision: 0 }}
                            />
                            <ProFormDigit
                              width="md"
                              name={['log', 'max_backups']}
                              label={<span>备份数量{restartTag}</span>}
                              min={0}
                              fieldProps={{ precision: 0 }}
                            />
                            <ProFormDigit
                              width="md"
                              name={['log', 'max_age']}
                              label={<span>保留天数{restartTag}</span>}
                              min={0}
                              fieldProps={{ precision: 0 }}
                            />
                          </div>
                        </SettingsSection>
                      </div>
                    ),
                  },
                  {
                    key: 'jwt',
                    label: '安全 (JWT)',
                    forceRender: true,
                    children: (
                      <div className={styles.tabPanel}>
                        <SettingsSection
                          title="会话签名"
                          description="管理后台登录会话的有效期与签发者。"
                        >
                          <div className={styles.fieldGrid}>
                            <ProFormDigit
                              width="md"
                              name={['jwt', 'expire_time']}
                              label="过期时间 (小时)"
                              min={1}
                              fieldProps={{ precision: 0 }}
                            />
                            <ProFormText
                              width="md"
                              name={['jwt', 'issuer']}
                              label="签发者"
                            />
                          </div>
                        </SettingsSection>
                      </div>
                    ),
                  },
                ]}
              />
            </ProForm>
          )}
        </Spin>
      </div>
    </PageContainer>
  );
};

export default SystemSettingsPage;
