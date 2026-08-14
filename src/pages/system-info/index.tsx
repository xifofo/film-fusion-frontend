import {
  EyeInvisibleOutlined,
  EyeOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  message,
  Space,
  Tag,
  Typography,
} from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { getSystemInfo, type SystemInfo } from '@/services/film-fusion';

const { Paragraph, Text } = Typography;

const errorText = (error: any) =>
  error?.response?.data?.message || error?.message || '获取系统信息失败';

const maskedToken = (token: string) => {
  if (token.length <= 16) return '••••••••••••••••';
  return `${token.slice(0, 8)}${'•'.repeat(24)}${token.slice(-8)}`;
};

const SystemInfoPage = () => {
  const [messageApi, contextHolder] = message.useMessage();
  const [info, setInfo] = useState<SystemInfo>();
  const [loading, setLoading] = useState(true);
  const [tokenVisible, setTokenVisible] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getSystemInfo();
      if (response.code !== 0 || !response.data) {
        throw new Error(response.message || '获取系统信息失败');
      }
      setInfo(response.data);
    } catch (error: any) {
      messageApi.error(errorText(error));
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  useEffect(() => {
    load();
  }, [load]);

  const worker = info?.rss_generator_worker;
  const token = worker?.token || '';
  const available = Boolean(worker?.status.available);

  return (
    <PageContainer
      header={{
        title: '系统信息',
        subTitle: '查看 FilmFusion 关联服务的只读运行信息',
        extra: [
          <Button
            icon={<ReloadOutlined />}
            key="refresh"
            loading={loading}
            onClick={load}
          >
            刷新
          </Button>,
        ],
      }}
    >
      {contextHolder}
      <Card
        loading={loading && !worker}
        title={
          <Space>
            <SafetyCertificateOutlined />
            <span>RSS Generator Worker</span>
          </Space>
        }
      >
        {worker && (
          <>
            <Descriptions column={{ xs: 1, sm: 1, md: 2 }}>
              <Descriptions.Item label="运行状态">
                <Tag color={available ? 'success' : 'error'}>
                  {available ? '运行正常' : '不可用'}
                </Tag>
                {worker.status.error && (
                  <Text type="secondary">{worker.status.error}</Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="鉴权状态">
                <Tag color={worker.status.auth_configured ? 'blue' : 'warning'}>
                  {worker.status.auth_configured ? '已配置' : '未配置'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="服务名称">
                {worker.status.service || 'rss-generator-worker'}
              </Descriptions.Item>
              <Descriptions.Item label="Worker 版本">
                {worker.status.version || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="内部地址" span={2}>
                <Text code copyable={{ text: worker.url }}>
                  {worker.url}
                </Text>
              </Descriptions.Item>
            </Descriptions>

            <div style={{ marginTop: 24 }}>
              <Space style={{ marginBottom: 8 }}>
                <Text strong>内部鉴权 Token</Text>
                <Tag>仅管理员可见</Tag>
              </Space>
              {token ? (
                <Space
                  align="start"
                  direction="vertical"
                  style={{ width: '100%' }}
                >
                  <Paragraph
                    code
                    copyable={{
                      text: token,
                      tooltips: ['复制 Token', '已复制'],
                    }}
                    style={{
                      marginBottom: 0,
                      maxWidth: '100%',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {tokenVisible ? token : maskedToken(token)}
                  </Paragraph>
                  <Button
                    aria-label={
                      tokenVisible ? '隐藏 Worker Token' : '显示 Worker Token'
                    }
                    icon={
                      tokenVisible ? <EyeInvisibleOutlined /> : <EyeOutlined />
                    }
                    onClick={() => setTokenVisible((current) => !current)}
                    type="link"
                  >
                    {tokenVisible ? '隐藏完整 Token' : '显示完整 Token'}
                  </Button>
                </Space>
              ) : (
                <Alert
                  message="Worker Token 暂不可用"
                  description={
                    worker.token_error ||
                    '请在“系统设置 → RSS 生成器”中设置内部 Token'
                  }
                  showIcon
                  type="error"
                />
              )}
            </div>

            <Alert
              description="该 Token 用于 FilmFusion 调用内部 Worker。请勿公开，并确保它与 Worker 容器的 WORKER_AUTH_TOKEN 完全一致。"
              message="内部服务凭证"
              showIcon
              style={{ marginTop: 24 }}
              type="warning"
            />
          </>
        )}
      </Card>
    </PageContainer>
  );
};

export default SystemInfoPage;
