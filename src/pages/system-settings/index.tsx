import {
  KeyOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
} from '@ant-design/icons';
import {
  PageContainer,
  ProForm,
  ProFormDigit,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
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
} from 'antd';
import { createStyles } from 'antd-style';
import type { ReactNode } from 'react';
import React, { useCallback, useEffect, useState } from 'react';
import {
  getAppConfig,
  getHDHiveAuthorizeURL,
  refreshHDHiveToken,
  saveAppConfig,
  testTelegramNotification,
} from '@/services/film-fusion';

const restartTag = (
  <Tag color="orange" bordered={false} style={{ marginInlineStart: 6 }}>
    需重启
  </Tag>
);

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
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 20px;

    > .ant-form-item {
      margin: 0;
      padding: 11px 13px;
      border: 1px solid ${token.colorBorderSecondary};
      border-radius: 8px;
      background: ${token.colorFillAlter};
    }

    > .ant-form-item > .ant-form-item-row {
      flex-flow: row nowrap;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    > .ant-form-item .ant-form-item-label {
      flex: 1;
      min-width: 0;
      padding: 0;
      text-align: start;
      white-space: normal;
    }

    > .ant-form-item .ant-form-item-label > label {
      height: auto;
      color: ${token.colorText};
      white-space: normal;
    }

    > .ant-form-item .ant-form-item-control {
      flex: none;
      width: auto;
      min-width: auto;
    }

    @media (max-width: 700px) {
      grid-template-columns: 1fr;
    }
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
  const [telegramTesting, setTelegramTesting] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const webhookToken = Form.useWatch(['webhook', 'clouddrive2', 'token'], form);

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

  const handleTelegramTest = async () => {
    setTelegramTesting(true);
    try {
      const res = await testTelegramNotification();
      if (res.code === 0) {
        messageApi.success('测试消息已发送');
      } else {
        messageApi.error(res.message || '测试消息发送失败');
      }
    } catch (error: any) {
      messageApi.error(error?.data || error?.message || '测试消息发送失败');
    } finally {
      setTelegramTesting(false);
    }
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
              配置直接写入 config.yaml
            </Typography.Text>
            <Typography.Text type="secondary">
              保存后立即生效；「需重启」项除外，密钥留空不修改。
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
                          description="管理后台的监听端口、登录凭据与任务并发。"
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
                            <ProFormDigit
                              width="md"
                              name={['server', 'download_115_concurrency']}
                              label={<span>115 下载并发{restartTag}</span>}
                              min={1}
                              fieldProps={{ precision: 0 }}
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
                          description="限制连续失败请求；经过反向代理时再填写可信代理网段。"
                        >
                          <div className={styles.toggleGrid}>
                            <ProFormSwitch
                              name={['server', 'security', 'enabled']}
                              label="启用管理后台登录保护"
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
                                placeholder: '直接对外开放时保持为空',
                              }}
                            />
                          </div>
                        </SettingsSection>

                        <SettingsSection
                          title="媒体事件"
                          description="控制是否接收并处理新入库媒体事件。"
                        >
                          <div className={styles.toggleGrid}>
                            <ProFormSwitch
                              name={['server', 'process_new_media']}
                              label="处理新增媒体事件"
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
                          description="为 CloudDrive2 单独创建访问凭据，避免复用管理后台密码或 JWT 密钥。"
                        >
                          <Alert
                            className={styles.sectionAlert}
                            type={
                              secrets['webhook.clouddrive2.token']
                                ? 'success'
                                : 'warning'
                            }
                            showIcon
                            icon={<SafetyCertificateOutlined />}
                            message={
                              secrets['webhook.clouddrive2.token']
                                ? 'Webhook Token 已配置'
                                : '请先配置独立 Token'
                            }
                            description="保存后立即生效；出于安全考虑，已保存的 Token 不会再次回显。"
                          />
                          <div className={styles.toggleGrid}>
                            <ProFormSwitch
                              name={['webhook', 'clouddrive2', 'enabled']}
                              label="启用 CloudDrive2 Webhook"
                            />
                          </div>
                          <div className={styles.fieldGrid}>
                            <ProFormText.Password
                              width="lg"
                              name={['webhook', 'clouddrive2', 'token']}
                              label="Bearer Token"
                              tooltip="至少 32 个字符；留空表示保持当前 Token 不变。"
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
                            <ProFormSwitch
                              name={['emby', 'enabled']}
                              label={
                                <span>启用 Emby 代理服务{restartTag}</span>
                              }
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
                            <ProFormSwitch
                              name={['emby', 'add_current_media_info']}
                              label="播放时补充当前媒体信息"
                            />
                            <ProFormSwitch
                              name={['emby', 'add_next_media_info']}
                              label="添加下一部媒体信息"
                            />
                          </div>
                        </SettingsSection>

                        <SettingsSection
                          title="登录保护"
                          description="限制 Emby 登录失败请求；直接开放代理端口时无需填写可信代理。"
                        >
                          <div className={styles.toggleGrid}>
                            <ProFormSwitch
                              name={['emby', 'security', 'enabled']}
                              label="启用登录保护"
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
                    key: 'telegram',
                    label: 'Telegram',
                    forceRender: true,
                    children: (
                      <div className={styles.tabPanel}>
                        <SettingsSection
                          title="通知连接"
                          description="配置 Telegram Bot 与消息接收目标。"
                        >
                          <Alert
                            className={styles.sectionAlert}
                            type="info"
                            showIcon
                            message="测试消息使用已保存的配置"
                            description="修改下方字段后请先保存，再发送测试消息。"
                            action={
                              <Button
                                icon={<SendOutlined />}
                                loading={telegramTesting}
                                onClick={handleTelegramTest}
                              >
                                发送测试消息
                              </Button>
                            }
                          />
                          <div className={styles.toggleGrid}>
                            <ProFormSwitch
                              name={['telegram', 'enabled']}
                              label="启用 Telegram 通知"
                            />
                          </div>
                          <div className={styles.fieldGrid}>
                            <ProFormText
                              width="md"
                              name={['telegram', 'instance_name']}
                              label="实例名称"
                              placeholder="FilmFusion"
                            />
                            <ProFormText.Password
                              width="lg"
                              name={['telegram', 'bot_token']}
                              label="Bot Token"
                              fieldProps={{
                                placeholder:
                                  secretPlaceholder('telegram.bot_token'),
                              }}
                            />
                            <ProFormText
                              width="lg"
                              name={['telegram', 'chat_id']}
                              label="Chat ID"
                              placeholder="-1001234567890"
                            />
                            <ProFormDigit
                              width="md"
                              name={['telegram', 'message_thread_id']}
                              label="话题 ID"
                              tooltip="论坛群需要指定话题时填写；0 表示发送到群组默认话题。"
                              min={0}
                              fieldProps={{ precision: 0 }}
                            />
                            <ProFormText
                              width="lg"
                              name={['telegram', 'api_base']}
                              label="API 地址"
                              placeholder="https://api.telegram.org"
                            />
                            <ProFormDigit
                              width="md"
                              name={['telegram', 'timeout_seconds']}
                              label="请求超时 (秒)"
                              min={1}
                              fieldProps={{ precision: 0 }}
                            />
                          </div>
                        </SettingsSection>

                        <SettingsSection
                          title="通知行为"
                          description="选择消息发送方式与需要推送的安全告警。"
                        >
                          <div className={styles.toggleGrid}>
                            <ProFormSwitch
                              name={['telegram', 'silent']}
                              label="静默发送"
                            />
                            <ProFormSwitch
                              name={['telegram', 'notify_emby_brute_force']}
                              label="Emby 登录爆破告警"
                            />
                            <ProFormSwitch
                              name={['telegram', 'notify_system_brute_force']}
                              label="FilmFusion 登录爆破告警"
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
                            <ProFormSwitch
                              name={['emby', 'cover', 'enabled']}
                              label="启用封面生成"
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
                            <ProFormSwitch
                              name={['tmdb', 'enabled']}
                              label="启用 TMDB API"
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
                            <ProFormSwitch
                              name={['hdhive', 'enabled']}
                              label="启用 HDHive OpenAPI"
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
                            <ProFormSwitch
                              name={['hdhive', 'auto_refresh']}
                              label="自动刷新 Access Token"
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
                            <ProFormSwitch
                              name={['log', 'compress']}
                              label={<span>压缩旧日志{restartTag}</span>}
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
                          description="管理后台登录会话的签名密钥、有效期与签发者。"
                        >
                          <Alert
                            className={styles.sectionAlert}
                            type="warning"
                            showIcon
                            message="修改 JWT 密钥会使所有已登录会话失效"
                            description="保存后新密钥立即生效，所有用户需要重新登录。"
                          />
                          <div className={styles.fieldGrid}>
                            <ProFormText.Password
                              width="md"
                              name={['jwt', 'secret']}
                              label="JWT 密钥"
                              fieldProps={{
                                placeholder: secretPlaceholder('jwt.secret'),
                              }}
                            />
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
