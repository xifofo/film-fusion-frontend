import React, { useState, useEffect, useRef } from 'react';
import { Modal, Form, Input, QRCode, Steps, Button, Typography, Space, message, Spin, Alert, Progress, Radio, Divider } from 'antd';
import { CheckCircleOutlined, LoadingOutlined, CloseCircleOutlined, QrcodeOutlined, KeyOutlined } from '@ant-design/icons';
import { getAuth115QRCode, checkAuth115Status, completeAuth115 } from '@/services/film-fusion/auth115';
import { updateCloudStorage } from '@/services/film-fusion';

const { Title, Text, Paragraph } = Typography;

interface ReloginModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  cloudStorage: API.CloudStorage;
}

// 授权状态枚举
enum AuthStatus {
  WAITING_SCAN = 0,    // 等待扫码
  SCAN_SUCCESS = 1,    // 扫码成功，等待确认
  LOGIN_SUCCESS = 2,   // 确认登录成功
  CANCELLED = -2,      // 已取消登录
}

// 重新登录方式
enum ReloginType {
  QR_CODE = 'qr_code',  // 扫码登录
  APP_SECRET = 'app_secret'  // 使用AppID和AppSecret
}

const ReloginModal: React.FC<ReloginModalProps> = ({
  open,
  onCancel,
  onSuccess,
  cloudStorage,
}) => {
  const [form] = Form.useForm();
  const [reloginType, setReloginType] = useState<ReloginType>(ReloginType.QR_CODE);
  const [current, setCurrent] = useState(0);
  const [qrCodeData, setQrCodeData] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');
  const [authStatus, setAuthStatus] = useState<AuthStatus>(AuthStatus.WAITING_SCAN);
  const [countdown, setCountdown] = useState(300); // 5分钟倒计时
  const [qrLoading, setQrLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const statusCheckTimer = useRef<NodeJS.Timeout | null>(null);
  const countdownTimer = useRef<NodeJS.Timeout | null>(null);
  const isCheckingStatus = useRef<boolean>(false);
  const shouldStopChecking = useRef<boolean>(false);

  // 获取二维码
  const getQRCode = async () => {
    if (!cloudStorage.app_id) {
      messageApi.error('请先配置应用ID');
      return;
    }

    setQrLoading(true);
    try {
      const result = await getAuth115QRCode({
        client_id: cloudStorage.app_id,
        name: cloudStorage.storage_name,
      });

      setQrCodeData(result.qr_code_data);
      setSessionId(result.session_id);
      setCurrent(1);
      startStatusCheck(result.session_id);
      startCountdown();
      messageApi.success('二维码获取成功，请使用115手机客户端扫描');
    } catch (error: any) {
      messageApi.error('获取二维码失败：' + (error.message || '请重试'));
    } finally {
      setQrLoading(false);
    }
  };  // 完成扫码授权
  const completeQRAuth = async () => {
    setUpdating(true);
    try {
      // 检查授权状态是否为登录成功
      if (authStatus !== AuthStatus.LOGIN_SUCCESS) {
        messageApi.error('请先完成扫码授权');
        return;
      }

      // 调用完成授权API，传递存储ID进行更新而不是创建新记录
      await completeAuth115({
        session_id: sessionId,
        storage_id: cloudStorage.id  // 传递存储ID，后端会根据此ID更新现有记录
      });

      messageApi.success('重新登录成功，令牌已更新');
      stopTimers();
      onSuccess();
      handleCancel();
    } catch (error: any) {
      messageApi.error('完成授权失败：' + (error.message || '请重试'));
    } finally {
      setUpdating(false);
    }
  };

  // 使用AppSecret登录
  const handleAppSecretLogin = async () => {
    try {
      const values = await form.validateFields();
      setUpdating(true);

      await updateCloudStorage({
        id: cloudStorage.id,
        storage_name: cloudStorage.storage_name,
        app_id: values.app_id,
        app_secret: values.app_secret,
        auto_refresh: cloudStorage.auto_refresh,
        refresh_before_min: cloudStorage.refresh_before_min,
        config: cloudStorage.config,
      });

      messageApi.success('重新登录成功，配置已更新');
      onSuccess();
      handleCancel();
    } catch (error: any) {
      messageApi.error('更新配置失败：' + (error.message || '请重试'));
    } finally {
      setUpdating(false);
    }
  };

  // 开始状态检查
  const startStatusCheck = (currentSessionId?: string) => {
    stopStatusCheck();

    const checkSessionId = currentSessionId || sessionId;
    if (!checkSessionId) return;

    shouldStopChecking.current = false;

    const checkStatus = async () => {
      if (shouldStopChecking.current || isCheckingStatus.current) {
        statusCheckTimer.current = setTimeout(checkStatus, 2000);
        return;
      }

      try {
        isCheckingStatus.current = true;
        const result = await checkAuth115Status({ session_id: checkSessionId });

        if (shouldStopChecking.current) return;

        setAuthStatus(result.status);

        if (result.status === AuthStatus.LOGIN_SUCCESS) {
          stopTimers();
          setCurrent(2);
          return;
        } else if (result.status === AuthStatus.CANCELLED) {
          stopTimers();
          messageApi.error('用户已取消登录');
          handleCancel();
          return;
        }

        statusCheckTimer.current = setTimeout(checkStatus, 2000);
      } catch (error) {
        if (!shouldStopChecking.current) {
          statusCheckTimer.current = setTimeout(checkStatus, 2000);
        }
      } finally {
        isCheckingStatus.current = false;
      }
    };

    checkStatus();
  };

  // 停止状态检查
  const stopStatusCheck = () => {
    shouldStopChecking.current = true;
    if (statusCheckTimer.current) {
      clearTimeout(statusCheckTimer.current);
      statusCheckTimer.current = null;
    }
  };

  // 开始倒计时
  const startCountdown = () => {
    setCountdown(300);
    countdownTimer.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          stopTimers();
          messageApi.error('二维码已过期，请重新获取');
          setCurrent(0);
          return 300;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // 停止所有定时器
  const stopTimers = () => {
    stopStatusCheck();
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current);
      countdownTimer.current = null;
    }
  };

  // 重置状态
  const resetState = () => {
    stopTimers();
    setCurrent(0);
    setQrCodeData('');
    setSessionId('');
    setAuthStatus(AuthStatus.WAITING_SCAN);
    setCountdown(300);
    form.resetFields();
  };

  // 处理取消
  const handleCancel = () => {
    resetState();
    onCancel();
  };

  // 监听对话框关闭
  useEffect(() => {
    if (!open) {
      resetState();
    } else {
      // 设置表单初始值
      form.setFieldsValue({
        app_id: cloudStorage.app_id,
        app_secret: cloudStorage.app_secret,
        access_token: cloudStorage.access_token,
        refresh_token: cloudStorage.refresh_token,
      });
    }
  }, [open, cloudStorage]);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      stopTimers();
    };
  }, []);

  // 格式化倒计时
  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 获取授权状态文本
  const getStatusText = () => {
    switch (authStatus) {
      case AuthStatus.WAITING_SCAN:
        return '等待扫码';
      case AuthStatus.SCAN_SUCCESS:
        return '扫码成功，请在手机上确认';
      case AuthStatus.LOGIN_SUCCESS:
        return '登录成功';
      case AuthStatus.CANCELLED:
        return '已取消';
      default:
        return '未知状态';
    }
  };

  // 获取步骤
  const getSteps = () => {
    if (reloginType === ReloginType.QR_CODE) {
      return [
        {
          title: '获取二维码',
          description: '点击按钮获取授权二维码',
        },
        {
          title: '扫码授权',
          description: '使用115手机客户端扫描二维码',
        },
        {
          title: '完成授权',
          description: '确认授权并更新配置',
        },
      ];
    } else {
      return [
        {
          title: '配置信息',
          description: '输入应用ID和密钥等信息',
        },
      ];
    }
  };

  const renderQRCodeContent = () => {
    if (current === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Paragraph>
            点击下方按钮获取115网盘授权二维码，然后使用115手机客户端扫描
          </Paragraph>
          <Button
            type="primary"
            icon={<QrcodeOutlined />}
            loading={qrLoading}
            onClick={getQRCode}
            size="large"
          >
            获取二维码
          </Button>
        </div>
      );
    }

    if (current === 1) {
      return (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Alert
              message={getStatusText()}
              type={authStatus === AuthStatus.SCAN_SUCCESS ? 'warning' : 'info'}
              showIcon
            />

            {qrCodeData && (
              <div>
                <QRCode
                  value={qrCodeData}
                  size={200}
                  style={{ margin: '0 auto' }}
                />
                <div style={{ marginTop: 16 }}>
                  <Progress
                    percent={((300 - countdown) / 300) * 100}
                    showInfo={false}
                    strokeColor="#1890ff"
                  />
                  <Text type="secondary">
                    二维码有效期：{formatCountdown(countdown)}
                  </Text>
                </div>
              </div>
            )}

            <Space>
              <Button onClick={() => setCurrent(0)}>
                重新获取
              </Button>
              <Button onClick={handleCancel}>
                取消
              </Button>
            </Space>
          </Space>
        </div>
      );
    }

    if (current === 2) {
      return (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Space direction="vertical" size="large">
            <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a' }} />
            <Title level={4}>扫码授权成功</Title>
            <Paragraph>
              已获取到授权令牌，点击下方按钮完成配置更新
            </Paragraph>
            <Space>
              <Button
                type="primary"
                loading={updating}
                onClick={completeQRAuth}
              >
                完成配置
              </Button>
              <Button onClick={handleCancel}>
                取消
              </Button>
            </Space>
          </Space>
        </div>
      );
    }

    return null;
  };

  const renderAppSecretContent = () => {
    return (
      <Form
        form={form}
        layout="vertical"
        style={{ maxWidth: 500, margin: '0 auto' }}
      >
        <Form.Item
          label="应用ID"
          name="app_id"
          rules={[{ required: true, message: '请输入应用ID' }]}
        >
          <Input placeholder="请输入115网盘应用ID" />
        </Form.Item>

        <Form.Item
          label="应用密钥"
          name="app_secret"
          rules={[{ required: true, message: '请输入应用密钥' }]}
        >
          <Input.Password placeholder="请输入115网盘应用密钥" />
        </Form.Item>

        <Form.Item
          label="访问令牌"
          name="access_token"
        >
          <Input.TextArea
            placeholder="可选：如果已有访问令牌可直接输入"
            rows={3}
          />
        </Form.Item>

        <Form.Item
          label="刷新令牌"
          name="refresh_token"
        >
          <Input.TextArea
            placeholder="可选：如果已有刷新令牌可直接输入"
            rows={3}
          />
        </Form.Item>

        <Form.Item style={{ textAlign: 'center', marginTop: 32 }}>
          <Space>
            <Button
              type="primary"
              loading={updating}
              onClick={handleAppSecretLogin}
            >
              更新配置
            </Button>
            <Button onClick={handleCancel}>
              取消
            </Button>
          </Space>
        </Form.Item>
      </Form>
    );
  };

  return (
    <>
      {contextHolder}
      <Modal
        title={`重新登录 - ${cloudStorage.storage_name}`}
        open={open}
        onCancel={handleCancel}
        footer={null}
        width={600}
        maskClosable={false}
        destroyOnClose
      >
        <div style={{ padding: '16px 0' }}>
          <div style={{ marginBottom: 24 }}>
            <Text strong>选择重新登录方式：</Text>
            <Radio.Group
              value={reloginType}
              onChange={(e) => {
                setReloginType(e.target.value);
                resetState();
              }}
              style={{ marginTop: 8 }}
            >
              <Radio.Button value={ReloginType.QR_CODE}>
                <QrcodeOutlined /> 扫码授权
              </Radio.Button>
              <Radio.Button value={ReloginType.APP_SECRET}>
                <KeyOutlined /> 手动配置
              </Radio.Button>
            </Radio.Group>
          </div>

          <Divider />

          {reloginType === ReloginType.QR_CODE ? (
            <div>
              <Steps
                current={current}
                items={getSteps()}
                style={{ marginBottom: 32 }}
              />
              {renderQRCodeContent()}
            </div>
          ) : (
            renderAppSecretContent()
          )}
        </div>
      </Modal>
    </>
  );
};

export default ReloginModal;
