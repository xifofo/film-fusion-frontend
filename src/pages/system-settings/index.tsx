import {
  PageContainer,
  ProForm,
  ProFormDigit,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
} from '@ant-design/pro-components';
import { Alert, Card, Modal, message, Spin, Tabs, Tag } from 'antd';
import React, { useCallback, useEffect, useState } from 'react';
import { getAppConfig, saveAppConfig } from '@/services/film-fusion';

const restartTag = (
  <Tag color="orange" style={{ marginInlineStart: 4 }}>
    需重启
  </Tag>
);

const SystemSettingsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<API.AppConfig>();
  const [secrets, setSecrets] = useState<Record<string, boolean>>({});
  const [messageApi, contextHolder] = message.useMessage();

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
        if (fresh.code === 0 && fresh.data)
          setSecrets(fresh.data.secrets || {});
        return true;
      }
      messageApi.error(res.message || '保存失败');
      return false;
    } catch (error: any) {
      messageApi.error(error?.message || '保存失败');
      return false;
    }
  };

  return (
    <PageContainer header={{ title: '系统设置' }}>
      {contextHolder}
      <Alert
        style={{ marginBottom: 16 }}
        type="info"
        showIcon
        message="在线编辑 config.yaml。多数配置保存后即时生效（Emby 连接、新媒体开关、封面参数与定时、MoviePilot 等）；标有「需重启」的项（HTTP/代理端口、日志、115 并发）需重启后端生效。密钥类字段留空表示不修改。"
      />
      <Card>
        <Spin spinning={loading}>
          {config && (
            <ProForm<API.AppConfig>
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
