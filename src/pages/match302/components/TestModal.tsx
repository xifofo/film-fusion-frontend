import { ExperimentOutlined } from '@ant-design/icons';
import { Modal, Form, Input, Button, message, Alert, Space, Typography } from 'antd';
import type { FC } from 'react';
import { useState } from 'react';
import { useRequest } from '@umijs/max';
import { testMatch302Redirect } from '@/services/film-fusion';

const { Text, Paragraph } = Typography;

interface TestModalProps {
  open: boolean;
  record?: API.Match302;
  onClose: () => void;
}

const TestModal: FC<TestModalProps> = (props) => {
  const { open, record, onClose } = props;
  const [form] = Form.useForm();
  const [testResult, setTestResult] = useState<{
    matched: boolean;
    result_path?: string;
    message?: string;
  } | null>(null);

  const { run: testRun, loading: testLoading } = useRequest(testMatch302Redirect, {
    manual: true,
    onSuccess: (result: any) => {
      setTestResult(result.data);
    },
    onError: () => {
      message.error('测试失败，请重试');
    },
  });

  const handleTest = async () => {
    if (!record) return;

    const values = await form.validateFields();
    testRun(record.id, values.test_path);
  };

  const handleClose = () => {
    form.resetFields();
    setTestResult(null);
    onClose();
  };

  return (
    <Modal
      title="测试 Match302 重定向"
      open={open}
      onCancel={handleClose}
      footer={[
        <Button key="cancel" onClick={handleClose}>
          关闭
        </Button>,
        <Button
          key="test"
          type="primary"
          icon={<ExperimentOutlined />}
          loading={testLoading}
          onClick={handleTest}
        >
          测试
        </Button>,
      ]}
      width={600}
    >
      {record && (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Text strong>当前规则：</Text>
            <Paragraph>
              <Text code>{record.source_path}</Text> → <Text code>{record.target_path}</Text>
            </Paragraph>
            <Text type="secondary">
              云存储：{record.cloud_storage?.storage_name} ({record.cloud_storage?.storage_type})
            </Text>
          </div>

          <Form form={form} layout="vertical">
            <Form.Item
              name="test_path"
              label="测试路径"
              rules={[{ required: true, message: '请输入要测试的路径' }]}
            >
              <Input.TextArea
                placeholder="请输入要测试的路径，例如：/test/path/file.mp4"
                rows={3}
              />
            </Form.Item>
          </Form>

          {testResult && (
            <Alert
              type={testResult.matched ? 'success' : 'warning'}
              message={testResult.matched ? '匹配成功' : '路径不匹配'}
              description={
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <Text strong>匹配结果：</Text>
                    <Text>{testResult.message}</Text>
                  </div>
                  {testResult.result_path && (
                    <div>
                      <Text strong>转换后路径：</Text>
                      <Paragraph code copyable>
                        {testResult.result_path}
                      </Paragraph>
                    </div>
                  )}
                </Space>
              }
              showIcon
            />
          )}
        </Space>
      )}
    </Modal>
  );
};

export default TestModal;
