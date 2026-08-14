import {
  ApiOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Modal,
  message,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import type {
  RSSAutomationTarget,
  RSSAutomationTargetInput,
} from '@/services/film-fusion';
import {
  createDownloader,
  deleteDownloader,
  testDownloader,
  updateDownloader,
} from '@/services/film-fusion';
import styles from './index.module.less';

const { Link, Text } = Typography;

type TargetPanelProps = {
  targets: RSSAutomationTarget[];
  cloudStorages?: API.CloudStorage[];
  show115Accounts?: boolean;
  onChanged: () => Promise<void> | void;
};

const parseTarget = (target: RSSAutomationTarget): RSSAutomationTargetInput => {
  let config = { base_url: '', username: '', password: '********' };
  try {
    config = { ...config, ...JSON.parse(target.config_json) };
  } catch {
    // The backend will report damaged configuration when it is tested.
  }
  return {
    name: target.name,
    type: 'qbittorrent',
    enabled: target.enabled,
    config,
  };
};

const TargetPanel = ({
  targets,
  cloudStorages = [],
  show115Accounts = false,
  onChanged,
}: TargetPanelProps) => {
  const [form] = Form.useForm<RSSAutomationTargetInput>();
  const [editing, setEditing] = useState<RSSAutomationTarget>();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<number>();
  const [messageApi, contextHolder] = message.useMessage();

  const openModal = (target?: RSSAutomationTarget) => {
    setEditing(target);
    setOpen(true);
    window.setTimeout(() => {
      form.setFieldsValue(
        target
          ? parseTarget(target)
          : {
              name: '',
              type: 'qbittorrent',
              enabled: true,
              config: { base_url: '', username: '', password: '' },
            },
      );
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const values = await form.validateFields();
      const response = editing
        ? await updateDownloader(editing.id, values)
        : await createDownloader(values);
      if (response.code !== 0) throw new Error(response.message);
      messageApi.success(
        editing ? 'qBittorrent 目标已更新' : 'qBittorrent 目标已创建',
      );
      setOpen(false);
      await onChanged();
    } catch (error: any) {
      if (!error?.errorFields) {
        messageApi.error(error?.data || error?.message || '保存下载目标失败');
      }
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (target: RSSAutomationTarget, enabled: boolean) => {
    try {
      const response = await updateDownloader(target.id, {
        ...parseTarget(target),
        enabled,
      });
      if (response.code !== 0) throw new Error(response.message);
      await onChanged();
    } catch (error: any) {
      messageApi.error(error?.data || error?.message || '更新下载目标失败');
    }
  };

  const test = async (target: RSSAutomationTarget) => {
    setTestingId(target.id);
    try {
      const response = await testDownloader(target.id);
      if (response.code !== 0) throw new Error(response.message);
      messageApi.success(`${target.name} 登录与 API 连接正常`);
    } catch (error: any) {
      messageApi.error(error?.data || error?.message || '连接测试失败');
    } finally {
      setTestingId(undefined);
    }
  };

  const remove = async (target: RSSAutomationTarget) => {
    try {
      const response = await deleteDownloader(target.id);
      if (response.code !== 0) throw new Error(response.message);
      messageApi.success('下载目标已删除');
      await onChanged();
    } catch (error: any) {
      messageApi.error(error?.data || error?.message || '删除下载目标失败');
    }
  };

  const columns: ColumnsType<RSSAutomationTarget> = [
    { title: '名称', dataIndex: 'name' },
    {
      title: '地址',
      render: (_, target) => {
        const config = parseTarget(target).config;
        return <Text copyable>{config.base_url}</Text>;
      },
    },
    {
      title: '账号',
      render: (_, target) => parseTarget(target).config.username,
      width: 160,
    },
    {
      title: '启用',
      width: 90,
      render: (_, target) => (
        <Switch
          checked={target.enabled}
          onChange={(enabled) => toggle(target, enabled)}
          size="small"
        />
      ),
    },
    {
      title: '操作',
      width: 190,
      render: (_, target) => (
        <Space>
          <Button
            icon={<ApiOutlined />}
            loading={testingId === target.id}
            onClick={() => test(target)}
            size="small"
          >
            测试
          </Button>
          <Button
            icon={<EditOutlined />}
            onClick={() => openModal(target)}
            size="small"
          />
          <Popconfirm
            description="正在被流程使用的目标不能删除。"
            onConfirm={() => remove(target)}
            title="删除这个目标？"
          >
            <Button danger icon={<DeleteOutlined />} size="small" />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const accounts115 = cloudStorages.filter(
    (storage) => storage.storage_type === '115open',
  );

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {contextHolder}
      <Card
        extra={
          <Button
            icon={<PlusOutlined />}
            onClick={() => openModal()}
            type="primary"
          >
            添加 qBittorrent
          </Button>
        }
        title="qBittorrent 下载器账号"
      >
        <Table
          columns={columns}
          dataSource={targets}
          pagination={false}
          rowKey="id"
        />
      </Card>
      {show115Accounts && (
        <Card title="115 离线下载账号">
          <Alert
            className={styles.panelAlert}
            message={
              <span>
                115 动作直接复用“云存储管理”中的账号与
                Cookie，不在这里重复保存密钥。
                <Link href="/cloud-storage"> 前往云存储管理</Link>
              </span>
            }
            showIcon
            type="info"
          />
          <Table<API.CloudStorage>
            columns={[
              { title: '账号名称', dataIndex: 'storage_name' },
              {
                title: '状态',
                dataIndex: 'status',
                render: (status: API.CloudStorage['status']) => (
                  <Tag color={status === 'active' ? 'success' : 'error'}>
                    {status === 'active' ? '可用' : status}
                  </Tag>
                ),
              },
              {
                title: 'Cookie',
                render: (_, storage) => (
                  <Tag color={storage.cookie ? 'success' : 'warning'}>
                    {storage.cookie ? '已配置' : '缺少 Cookie'}
                  </Tag>
                ),
              },
            ]}
            dataSource={accounts115}
            locale={{ emptyText: '还没有 115 OpenAPI 账号' }}
            pagination={false}
            rowKey="id"
          />
        </Card>
      )}

      <Modal
        cancelText="取消"
        destroyOnHidden
        okButtonProps={{ loading: saving }}
        okText="保存"
        onCancel={() => setOpen(false)}
        onOk={save}
        open={open}
        title={editing ? '编辑 qBittorrent 账号' : '添加 qBittorrent 账号'}
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="type" hidden>
            <Input />
          </Form.Item>
          <Form.Item label="账号名称" name="name" rules={[{ required: true }]}>
            <Input placeholder="家庭 NAS qB" />
          </Form.Item>
          <Form.Item
            label="WebUI 地址"
            name={['config', 'base_url']}
            rules={[{ required: true, type: 'url' }]}
          >
            <Input placeholder="http://192.168.1.10:8080" />
          </Form.Item>
          <Form.Item
            label="用户名"
            name={['config', 'username']}
            rules={[{ required: true }]}
          >
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item
            extra={editing ? '保持 ******** 不变时沿用原密码。' : undefined}
            label="密码"
            name={['config', 'password']}
            rules={[{ required: true }]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item label="启用" name="enabled" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};

export default TargetPanel;
