import React, { useState, useEffect, useRef } from 'react';
import { Modal, Form, Input, QRCode, Steps, Button, Typography, Space, message, Spin, Alert, Progress } from 'antd';
import { CheckCircleOutlined, LoadingOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { getAuth115QRCode, checkAuth115Status, completeAuth115, Auth115QRCodeData } from '@/services/film-fusion/auth115';

const { Title, Text, Paragraph } = Typography;

interface Storage115ConfigProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

// 授权状态枚举
enum AuthStatus {
  WAITING_SCAN = 0,    // 等待扫码
  SCAN_SUCCESS = 1,    // 扫码成功，等待确认
  LOGIN_SUCCESS = 2,   // 确认登录成功
  CANCELLED = -2,      // 已取消登录
}

const Storage115Config: React.FC<Storage115ConfigProps> = ({
  open,
  onCancel,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [current, setCurrent] = useState(0);
  const [qrCodeData, setQrCodeData] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');
  const [authStatus, setAuthStatus] = useState<AuthStatus>(AuthStatus.WAITING_SCAN);
  const [countdown, setCountdown] = useState(300); // 5分钟倒计时
  const [qrLoading, setQrLoading] = useState(false);
  const [completeLoading, setCompleteLoading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const statusCheckTimer = useRef<NodeJS.Timeout | null>(null);
  const countdownTimer = useRef<NodeJS.Timeout | null>(null);
  const isCheckingStatus = useRef<boolean>(false); // 标记是否正在检查状态
  const shouldStopChecking = useRef<boolean>(false); // 标记是否应该停止检查

  // 获取二维码
  const getQRCode = async (params: { client_id: string; name: string }) => {
    setQrLoading(true);
    try {
      const result = await getAuth115QRCode(params);
      console.log('[Storage115Config] 获取二维码成功:', result);

      setQrCodeData(result.qr_code_data);
      setSessionId(result.session_id);
      setCurrent(1);
      startStatusCheck(result.session_id);
      startCountdown();
      messageApi.success('二维码获取成功，请使用115手机客户端扫描');
    } catch (error: any) {
      console.error('[Storage115Config] 获取二维码失败:', error);
      messageApi.error('获取二维码失败：' + (error.message || '请重试'));
    } finally {
      setQrLoading(false);
    }
  };

  // 完成授权
  const completeAuth = async (params: { session_id: string }) => {
    setCompleteLoading(true);
    try {
      await completeAuth115(params);
      messageApi.success('115云存储配置成功');
      stopTimers();
      onSuccess();
      handleCancel();
    } catch (error: any) {
      messageApi.error('完成授权失败：' + (error.message || '请重试'));
    } finally {
      setCompleteLoading(false);
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

  // 获取状态显示信息
  const getStatusInfo = () => {
    switch (authStatus) {
      case AuthStatus.WAITING_SCAN:
        return {
          icon: <LoadingOutlined style={{ color: '#1890ff' }} />,
          text: '等待扫码...',
          color: '#1890ff'
        };
      case AuthStatus.SCAN_SUCCESS:
        return {
          icon: <LoadingOutlined style={{ color: '#faad14' }} />,
          text: '扫码成功，请在手机上确认登录',
          color: '#faad14'
        };
      case AuthStatus.LOGIN_SUCCESS:
        return {
          icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
          text: '登录成功！',
          color: '#52c41a'
        };
      case AuthStatus.CANCELLED:
        return {
          icon: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
          text: '用户已取消登录',
          color: '#ff4d4f'
        };
      default:
        return {
          icon: <LoadingOutlined style={{ color: '#1890ff' }} />,
          text: '未知状态',
          color: '#1890ff'
        };
    }
  };

  const handleNext = async () => {
    if (current === 0) {
      try {
        const values = await form.validateFields(['storage_name', 'app_id']);

        // 重置状态
        stopTimers();
        setAuthStatus(AuthStatus.WAITING_SCAN);
        setQrCodeData('');
        setSessionId('');
        setCountdown(300);

        await getQRCode({
          client_id: values.app_id,
          name: values.storage_name,
        });
      } catch (error) {
        // 表单验证失败，不执行任何操作
      }
    } else if (current === 1) {
      setCurrent(2);
    }
  };

  const handleSubmit = async () => {
    if (sessionId) {
      await completeAuth({ session_id: sessionId });
    }
  };

  const handleCancel = () => {
    stopTimers();
    setCurrent(0);
    setQrCodeData('');
    setSessionId('');
    setAuthStatus(AuthStatus.WAITING_SCAN);
    setCountdown(300);
    form.resetFields();
    onCancel();
  };

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      stopTimers();
    };
  }, []);

  const statusInfo = getStatusInfo();

  const steps = [
    {
      title: '基本信息',
      content: (
        <div style={{ padding: '20px 0' }}>
          <Form form={form} layout="vertical">
            <Form.Item
              name="storage_name"
              label="存储名称"
              rules={[{ required: true, message: '请输入存储名称' }]}
            >
              <Input placeholder="请输入存储名称，如：我的115网盘" />
            </Form.Item>
            <Form.Item
              name="app_id"
              label="应用ID (Client ID)"
              rules={[{ required: true, message: '请输入应用ID' }]}
            >
              <Input placeholder="请输入115开放平台的应用ID" />
            </Form.Item>
          </Form>
          <div style={{ marginTop: 16 }}>
            <Title level={5}>如何获取应用ID？</Title>
            <Paragraph type="secondary">
              1. 访问 115 开放平台 (https://open.115.com)<br/>
              2. 登录您的115账号<br/>
              3. 创建应用并获取应用ID (Client ID)<br/>
              4. 将应用ID填入上方输入框
            </Paragraph>
          </div>
        </div>
      ),
    },
    {
      title: '扫码授权',
      content: (
        <div style={{ padding: '20px 0', textAlign: 'center' }}>
          <Title level={4}>使用115手机客户端扫描二维码</Title>

          {/* 二维码显示 */}
          <div style={{ margin: '20px 0' }}>
            {qrCodeData && (
              <QRCode
                value={qrCodeData}
                size={200}
                style={{ margin: '0 auto' }}
              />
            )}
          </div>

          {/* 状态显示 */}
          <div style={{ margin: '20px 0' }}>
            <Alert
              message={
                <Space>
                  {statusInfo.icon}
                  <span style={{ color: statusInfo.color }}>
                    {statusInfo.text}
                  </span>
                </Space>
              }
              type={authStatus === AuthStatus.LOGIN_SUCCESS ? 'success' :
                    authStatus === AuthStatus.CANCELLED ? 'error' : 'info'}
              showIcon={false}
            />
          </div>

          {/* 重新获取二维码按钮 */}
          {(authStatus === AuthStatus.CANCELLED || countdown <= 0) && (
            <Button
              type="default"
              onClick={() => {
                stopTimers();
                setCurrent(0);
                setQrCodeData('');
                setSessionId('');
                setAuthStatus(AuthStatus.WAITING_SCAN);
                setCountdown(300);
              }}
              loading={qrLoading}
            >
              重新获取二维码
            </Button>
          )}
        </div>
      ),
    },
    {
      title: '完成配置',
      content: (
        <div style={{ padding: '20px 0', textAlign: 'center' }}>
          <div style={{ marginBottom: 24 }}>
            <CheckCircleOutlined
              style={{ fontSize: 48, color: '#52c41a', marginBottom: 16 }}
            />
            <Title level={4} style={{ color: '#52c41a' }}>
              授权成功！
            </Title>
          </div>

          <Alert
            message="115网盘授权成功"
            description="系统已获取到访问令牌，即将为您保存配置并添加到云存储列表中。"
            type="success"
            showIcon
            style={{ marginBottom: 24, textAlign: 'left' }}
          />

        </div>
      ),
    },
  ];

  return (
    <>
      {contextHolder}
      <Modal
        title="添加115云存储"
        open={open}
        onCancel={handleCancel}
        width={600}
        footer={
          <Space>
            <Button onClick={handleCancel}>取消</Button>
            {current > 0 && current !== 2 && (
              <Button onClick={() => setCurrent(current - 1)}>上一步</Button>
            )}
            {current === 0 && (
              <Button
                type="primary"
                onClick={handleNext}
                loading={qrLoading}
              >
                获取授权二维码
              </Button>
            )}
            {current === 1 && authStatus === AuthStatus.LOGIN_SUCCESS && (
              <Button
                type="primary"
                onClick={() => setCurrent(2)}
              >
                下一步
              </Button>
            )}
            {current === 2 && (
              <Button
                type="primary"
                onClick={handleSubmit}
                loading={completeLoading}
              >
                完成配置
              </Button>
            )}
          </Space>
        }
        destroyOnHidden
        maskClosable={false}
      >
        <Steps current={current} style={{ marginBottom: 24 }}>
          {steps.map(item => (
            <Steps.Step key={item.title} title={item.title} />
          ))}
        </Steps>
        <div>
          {qrLoading && current === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Spin size="large" />
              <div style={{ marginTop: 16 }}>正在获取授权二维码...</div>
            </div>
          ) : (
            steps[current].content
          )}
        </div>
      </Modal>
    </>
  );
};

export default Storage115Config;
