import {
  CopyOutlined,
  DeleteOutlined,
  KeyOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';
import { useState } from 'react';
import type {
  RSSGeneratorFeed,
  RSSGeneratorToken,
  RSSGeneratorTokenInput,
  RSSGeneratorTokenSecret,
} from '@/services/film-fusion';
import styles from './index.module.less';

const { Paragraph, Text, Title } = Typography;

export const absoluteFeedURL = (
  value: string,
  origin = window.location.origin,
) => new URL(value, origin).toString();

type TokenFormValues = {
  name: string;
  expires_at?: Dayjs;
  rate_limit_per_minute?: number;
};

type TokenManagerProps = {
  autoOpenCreate?: boolean;
  feed: RSSGeneratorFeed;
  loading: boolean;
  tokens: RSSGeneratorToken[];
  onCreate: (input: RSSGeneratorTokenInput) => Promise<RSSGeneratorTokenSecret>;
  onDelete: (token: RSSGeneratorToken) => Promise<void>;
  onReload: () => void;
  onRotate: (token: RSSGeneratorToken) => Promise<RSSGeneratorTokenSecret>;
};

const statusTag = (status: RSSGeneratorToken['status']) => {
  if (status === 'active') return <Tag color="success">有效</Tag>;
  if (status === 'expired') return <Tag color="warning">已过期</Tag>;
  return <Tag>已撤销</Tag>;
};

const TokenManager = ({
  autoOpenCreate = false,
  feed,
  loading,
  tokens,
  onCreate,
  onDelete,
  onReload,
  onRotate,
}: TokenManagerProps) => {
  const [form] = Form.useForm<TokenFormValues>();
  const [createOpen, setCreateOpen] = useState(autoOpenCreate);
  const [creating, setCreating] = useState(false);
  const [rotatingId, setRotatingId] = useState<number>();
  const [secret, setSecret] = useState<RSSGeneratorTokenSecret>();

  const openCreate = () => {
    form.setFieldsValue({
      name: '',
      expires_at: undefined,
      rate_limit_per_minute: 60,
    });
    setCreateOpen(true);
  };

  const create = async () => {
    setCreating(true);
    try {
      const values = await form.validateFields();
      const result = await onCreate({
        name: values.name.trim(),
        expires_at: values.expires_at?.toISOString(),
        rate_limit_per_minute: values.rate_limit_per_minute,
      });
      setCreateOpen(false);
      setSecret(result);
    } catch (error: any) {
      if (error?.errorFields) return;
    } finally {
      setCreating(false);
    }
  };

  const rotate = async (token: RSSGeneratorToken) => {
    setRotatingId(token.id);
    try {
      setSecret(await onRotate(token));
    } finally {
      setRotatingId(undefined);
    }
  };

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
  };

  const columns: ColumnsType<RSSGeneratorToken> = [
    {
      title: '名称 / 前缀',
      key: 'identity',
      render: (_, token) => (
        <Space direction="vertical" size={0}>
          <Text strong>{token.name || '未命名访问令牌'}</Text>
          <Text code>{token.prefix}••••••••</Text>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: statusTag,
    },
    {
      title: '到期时间',
      dataIndex: 'expires_at',
      width: 170,
      responsive: ['md'],
      render: (value?: string) =>
        value && dayjs(value).isValid()
          ? dayjs(value).format('YYYY-MM-DD HH:mm')
          : '永不过期',
    },
    {
      title: '最后使用',
      dataIndex: 'last_used_at',
      width: 170,
      responsive: ['lg'],
      render: (value?: string) =>
        value && dayjs(value).isValid()
          ? dayjs(value).format('YYYY-MM-DD HH:mm')
          : '尚未使用',
    },
    {
      title: '操作',
      key: 'actions',
      width: 170,
      render: (_, token) => (
        <Space>
          <Popconfirm
            description="旧 Token 会立即失效。"
            onConfirm={() => rotate(token)}
            title="轮换这个 Token？"
          >
            <Button
              disabled={token.status !== 'active'}
              icon={<ReloadOutlined />}
              loading={rotatingId === token.id}
              size="small"
            >
              轮换
            </Button>
          </Popconfirm>
          <Popconfirm
            description="使用这个 Token 的所有外部订阅会立即失败。"
            okButtonProps={{ danger: true }}
            okText="撤销"
            onConfirm={() => onDelete(token)}
            title="撤销这个 Token？"
          >
            <Button
              danger
              disabled={token.status === 'revoked'}
              icon={<DeleteOutlined />}
              size="small"
              type="text"
            >
              撤销
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.tokenShell}>
      <Alert
        description="公开订阅使用独立的只读 Token，不会暴露登录 JWT。每位使用者建议创建独立 Token，便于单独轮换或撤销。"
        icon={<SafetyCertificateOutlined />}
        message="Token 访问控制"
        showIcon
        type="info"
      />

      <Card>
        <div className={styles.tokenHeading}>
          <div>
            <Title level={4}>{feed.name}</Title>
            <Paragraph type="secondary">
              这里只显示 Token 前缀、状态和使用时间；完整 Token 不可再次查看。
            </Paragraph>
          </div>
          <Space>
            <Button
              icon={<ReloadOutlined />}
              loading={loading}
              onClick={onReload}
            >
              刷新
            </Button>
            <Button icon={<PlusOutlined />} onClick={openCreate} type="primary">
              创建 Token
            </Button>
          </Space>
        </div>
        <Table
          columns={columns}
          dataSource={tokens}
          loading={loading}
          pagination={false}
          rowKey="id"
          scroll={{ x: 760 }}
        />
      </Card>

      <Modal
        cancelText="取消"
        okButtonProps={{ loading: creating }}
        okText="创建"
        onCancel={() => setCreateOpen(false)}
        onOk={create}
        open={createOpen}
        title="创建公开订阅 Token"
      >
        <Form
          form={form}
          initialValues={{ name: '', rate_limit_per_minute: 60 }}
          layout="vertical"
        >
          <Form.Item
            label="用途名称"
            name="name"
            rules={[{ required: true, message: '请填写这个 Token 的用途' }]}
          >
            <Input placeholder="例如：家里的 FreshRSS" />
          </Form.Item>
          <Form.Item label="到期时间" name="expires_at">
            <DatePicker
              disabledDate={(date) => date.isBefore(dayjs(), 'day')}
              showTime
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item
            extra="留空时由服务端使用默认限制"
            label="每分钟请求上限"
            name="rate_limit_per_minute"
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        cancelButtonProps={{ style: { display: 'none' } }}
        okText="我已保存"
        onCancel={() => setSecret(undefined)}
        onOk={() => setSecret(undefined)}
        open={Boolean(secret)}
        title={
          <Space>
            <KeyOutlined /> Token 只展示这一次
          </Space>
        }
      >
        <Alert
          description="关闭窗口后无法找回完整 Token。如遗失，请轮换生成新 Token。不要把订阅地址发给不受信任的人。"
          message="请立即复制并安全保存"
          showIcon
          type="warning"
        />
        {secret && (
          <div className={styles.secretFields}>
            {[
              ['完整 Token', secret.token],
              ['RSS 2.0 地址', absoluteFeedURL(secret.rss_url)],
              ['Atom 地址', absoluteFeedURL(secret.atom_url)],
            ].map(([label, value], index) => (
              <label htmlFor={`rss-token-secret-${index}`} key={label}>
                <Text>{label}</Text>
                <Input
                  addonAfter={
                    <Button
                      aria-label={`复制${label}`}
                      icon={<CopyOutlined />}
                      onClick={() => copy(value)}
                      size="small"
                      type="text"
                    />
                  }
                  id={`rss-token-secret-${index}`}
                  readOnly
                  value={value}
                />
              </label>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TokenManager;
