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
  Card,
  Form,
  Modal,
  message,
  Space,
  Spin,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import React, { useCallback, useEffect, useState } from 'react';
import {
  getAppConfig,
  getHDHiveAuthorizeURL,
  refreshHDHiveToken,
  saveAppConfig,
  testTelegramNotification,
} from '@/services/film-fusion';

const restartTag = (
  <Tag color="orange" style={{ marginInlineStart: 4 }}>
    需重启
  </Tag>
);

const SystemSettingsPage: React.FC = () => {
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
    <PageContainer header={{ title: '系统设置' }}>
      {contextHolder}
      <Alert
        style={{ marginBottom: 16 }}
        type="info"
        showIcon
        message="在线编辑 config.yaml。多数配置保存后即时生效（Emby 连接、新媒体开关、封面参数与定时、MoviePilot、TMDB、HDHive 等）；标有「需重启」的项（HTTP/代理端口、日志、115 并发）需重启后端生效。密钥类字段留空表示不修改。"
      />
      <Card>
        <Spin spinning={loading}>
          {config && (
            <ProForm<API.AppConfig>
              form={form}
              initialValues={config}
              onFinish={onFinish}
              layout="vertical"
              submitter={{
                searchConfig: { submitText: '保存配置', resetText: '重置' },
              }}
            >
              <Tabs
                items={[
                  {
                    key: 'server',
                    label: '服务器',
                    forceRender: true,
                    children: (
                      <>
                        <ProFormText
                          width="md"
                          name={['server', 'port']}
                          label={<span>HTTP 端口{restartTag}</span>}
                          rules={[{ required: true, message: '请输入端口' }]}
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
                            placeholder: secretPlaceholder('server.password'),
                          }}
                        />
                        <ProFormSwitch
                          name={['server', 'security', 'enabled']}
                          label="启用管理后台登录保护"
                        />
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
                          name={['server', 'security', 'max_failures_per_ip']}
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
                          name={['server', 'security', 'trusted_proxy_cidrs']}
                          label="可信代理 IP / CIDR"
                          fieldProps={{
                            mode: 'tags',
                            tokenSeparators: [',', ' '],
                            placeholder: '直接对外开放时保持为空',
                          }}
                        />
                        <ProFormDigit
                          width="md"
                          name={['server', 'download_115_concurrency']}
                          label={<span>115 下载并发{restartTag}</span>}
                          min={1}
                          fieldProps={{ precision: 0 }}
                        />
                        <ProFormSwitch
                          name={['server', 'process_new_media']}
                          label="处理新增媒体事件"
                        />
                      </>
                    ),
                  },
                  {
                    key: 'webhook',
                    label: 'Webhook',
                    forceRender: true,
                    children: (
                      <div style={{ maxWidth: 760 }}>
                        <Alert
                          style={{ marginBottom: 20 }}
                          type={
                            secrets['webhook.clouddrive2.token']
                              ? 'success'
                              : 'warning'
                          }
                          showIcon
                          icon={<SafetyCertificateOutlined />}
                          message={
                            secrets['webhook.clouddrive2.token']
                              ? 'CloudDrive2 Webhook Token 已配置'
                              : '配置独立 Token 后再启用 Webhook'
                          }
                          description="Token 只用于 CloudDrive2，不要复用管理后台密码或 JWT 密钥。保存后立即生效。"
                        />
                        <ProFormSwitch
                          name={['webhook', 'clouddrive2', 'enabled']}
                          label="启用 CloudDrive2 Webhook"
                        />
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
                        <Typography.Title level={5} style={{ marginTop: 24 }}>
                          添加到现有 [global_params.default_headers]
                        </Typography.Title>
                        {cloudDrive2HeaderConfig ? (
                          <Typography.Paragraph
                            code
                            copyable={{ text: cloudDrive2HeaderConfig }}
                            style={{ whiteSpace: 'pre-wrap' }}
                          >
                            {cloudDrive2HeaderConfig}
                          </Typography.Paragraph>
                        ) : (
                          <Typography.Text type="secondary">
                            已保存的 Token
                            不会回显。点击“生成”后保存，并在刷新页面前复制配置到
                            CloudDrive2；如果已经配置完成，无需再次生成。
                          </Typography.Text>
                        )}
                      </div>
                    ),
                  },
                  {
                    key: 'emby',
                    label: 'Emby',
                    forceRender: true,
                    children: (
                      <>
                        <ProFormSwitch
                          name={['emby', 'enabled']}
                          label={<span>启用 Emby 代理服务{restartTag}</span>}
                        />
                        <ProFormText
                          width="lg"
                          name={['emby', 'url']}
                          label="Emby 地址"
                          placeholder="http://127.0.0.1:8096"
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
                        <ProFormSwitch
                          name={['emby', 'add_current_media_info']}
                          label="播放时补充当前媒体信息"
                        />
                        <ProFormSwitch
                          name={['emby', 'add_next_media_info']}
                          label="添加下一部媒体信息"
                        />
                        <ProFormDigit
                          width="md"
                          name={['emby', 'run_proxy_port']}
                          label={<span>Emby 代理端口{restartTag}</span>}
                          min={0}
                          fieldProps={{ precision: 0 }}
                        />
                        <ProFormSwitch
                          name={['emby', 'security', 'enabled']}
                          label="启用登录保护"
                        />
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
                      </>
                    ),
                  },
                  {
                    key: 'telegram',
                    label: 'Telegram',
                    forceRender: true,
                    children: (
                      <>
                        <ProFormSwitch
                          name={['telegram', 'enabled']}
                          label="启用 Telegram 通知"
                        />
                        <Alert
                          style={{ marginBottom: 16 }}
                          type="info"
                          showIcon
                          message="通知连接"
                          description="测试消息使用已保存的配置。修改下方字段后请先保存。"
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
                      </>
                    ),
                  },
                  {
                    key: 'cover',
                    label: '封面生成',
                    forceRender: true,
                    children: (
                      <>
                        <ProFormSwitch
                          name={['emby', 'cover', 'enabled']}
                          label="启用封面生成"
                        />
                        <ProFormText
                          width="md"
                          name={['emby', 'cover', 'cron']}
                          label="定时 cron"
                          placeholder="如 0 3 * * * （留空仅手动）"
                          tooltip="保存后自动重新调度，无需重启"
                        />
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
                        <ProFormDigit
                          width="md"
                          name={['emby', 'cover', 'poster_count']}
                          label="拼接海报数量"
                          min={1}
                          fieldProps={{ precision: 0 }}
                        />
                      </>
                    ),
                  },
                  {
                    key: 'moviepilot',
                    label: 'MoviePilot',
                    forceRender: true,
                    children: (
                      <>
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
                      </>
                    ),
                  },
                  {
                    key: 'tmdb',
                    label: 'TMDB',
                    forceRender: true,
                    children: (
                      <>
                        <ProFormSwitch
                          name={['tmdb', 'enabled']}
                          label="启用 TMDB API"
                        />
                        <Alert
                          style={{ marginBottom: 16 }}
                          type="info"
                          showIcon
                          message="用于后台预整理队列对比 TMDB 本季集数"
                          description="启用后，队列会按识别到的季号读取 TMDB TV Season Details 的 episodes 数量，并按缓存时间复用结果。"
                        />
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
                            placeholder: secretPlaceholder('tmdb.access_token'),
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
                      </>
                    ),
                  },
                  {
                    key: 'hdhive',
                    label: 'HDHive',
                    forceRender: true,
                    children: (
                      <>
                        <ProFormSwitch
                          name={['hdhive', 'enabled']}
                          label="启用 HDHive OpenAPI"
                        />
                        <ProFormSwitch
                          name={['hdhive', 'auto_refresh']}
                          label="自动刷新 Access Token"
                        />
                        <Alert
                          style={{ marginBottom: 16 }}
                          type="warning"
                          showIcon
                          message="保存配置不会自动获得 Token"
                          description="保存只会写入 Client ID、应用 Secret、回调地址等配置。需要点击“打开授权页”，在 HDHive 确认授权后，由回调页自动换取并保存 Access Token / Refresh Token。启用自动刷新后，后端会在启动时和定时任务中用 Refresh Token 续期 Access Token。"
                          action={
                            <Space>
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
                            placeholder: secretPlaceholder('hdhive.api_key'),
                          }}
                        />
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
                        <ProFormDigit
                          width="md"
                          name={['hdhive', 'timeout_seconds']}
                          label="请求超时 (秒)"
                          min={1}
                          fieldProps={{ precision: 0 }}
                        />
                      </>
                    ),
                  },
                  {
                    key: 'log',
                    label: '日志',
                    forceRender: true,
                    children: (
                      <>
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
                        <ProFormSwitch
                          name={['log', 'compress']}
                          label={<span>压缩旧日志{restartTag}</span>}
                        />
                      </>
                    ),
                  },
                  {
                    key: 'jwt',
                    label: '安全 (JWT)',
                    forceRender: true,
                    children: (
                      <>
                        <ProFormText.Password
                          width="md"
                          name={['jwt', 'secret']}
                          label="JWT 密钥"
                          tooltip="修改后即时生效，但会使所有已登录会话失效，需重新登录"
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
                      </>
                    ),
                  },
                ]}
              />
            </ProForm>
          )}
        </Spin>
      </Card>
    </PageContainer>
  );
};

export default SystemSettingsPage;
