import {
  ApiOutlined,
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Badge,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  message,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import { type Ref, useImperativeHandle, useState } from 'react';
import type {
  RSSAutomationTarget,
  RSSAutomationTargetInput,
  RSSAutomationTargetStatus,
} from '@/services/film-fusion';
import {
  createDownloader,
  deleteDownloader,
  testDownloader,
  updateDownloader,
} from '@/services/film-fusion';
import styles from './index.module.less';

const { Link, Text, Title } = Typography;

const QB_API_KEY_MASK = '********';
const QB_API_KEY_PATTERN = /^qbt_[A-Za-z0-9]{28}$/;

type TargetPanelProps = {
  actionRef?: Ref<TargetPanelHandle>;
  targets: RSSAutomationTarget[];
  statuses?: RSSAutomationTargetStatus[];
  statusLoading?: boolean;
  statusError?: string;
  cloudStorages?: API.CloudStorage[];
  show115Accounts?: boolean;
  unframed?: boolean;
  onChanged: () => Promise<void> | void;
  onRefreshStatuses?: () => Promise<void> | void;
};

export type TargetPanelHandle = {
  openCreate: () => void;
};

const formatBytes = (value?: number) => {
  if (value === undefined || !Number.isFinite(value)) return '--';
  if (value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const unitIndex = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1,
  );
  const scaled = value / 1024 ** unitIndex;
  const precision = scaled >= 100 || unitIndex === 0 ? 0 : scaled >= 10 ? 1 : 2;
  return `${Number(scaled.toFixed(precision))} ${units[unitIndex]}`;
};

const formatSpeed = (value?: number) =>
  value === undefined ? '--' : `${formatBytes(value)}/s`;

const formatCheckedAt = (checkedAt?: string) => {
  if (!checkedAt) return '等待首次刷新';
  const checkedDate = new Date(checkedAt);
  if (Number.isNaN(checkedDate.getTime())) return '刚刚刷新';
  return `${checkedDate.toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })} 更新`;
};

const targetStatusMeta = (
  target: RSSAutomationTarget,
  status?: RSSAutomationTargetStatus,
) => {
  if (!target.enabled) {
    return { badge: 'default' as const, label: '已停用' };
  }
  if (!status) {
    return { badge: 'processing' as const, label: '正在读取' };
  }
  if (!status.online) {
    return { badge: 'error' as const, label: 'WebUI 不可达' };
  }
  if (status.connection_status === 'connected') {
    return { badge: 'success' as const, label: '在线' };
  }
  if (status.connection_status === 'firewalled') {
    return { badge: 'warning' as const, label: '在线 · 受防火墙限制' };
  }
  if (status.connection_status === 'disconnected') {
    return { badge: 'warning' as const, label: '在线 · BT 未连接' };
  }
  return { badge: 'processing' as const, label: 'WebUI 在线' };
};

const parseTarget = (target: RSSAutomationTarget): RSSAutomationTargetInput => {
  let config = {
    base_url: '',
    username: '',
    password: QB_API_KEY_MASK,
    api_key: '',
  };
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
  actionRef,
  targets,
  statuses = [],
  statusLoading = false,
  statusError = '',
  cloudStorages = [],
  show115Accounts = false,
  unframed = false,
  onChanged,
  onRefreshStatuses,
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
              config: {
                base_url: '',
                username: '',
                password: '',
                api_key: '',
              },
            },
      );
    });
  };

  useImperativeHandle(actionRef, () => ({
    openCreate: () => openModal(),
  }));

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
      messageApi.success(`${target.name} API 鉴权与连接正常`);
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

  const accounts115 = cloudStorages.filter(
    (storage) => storage.storage_type === '115open',
  );
  const statusesByTarget = new Map(
    statuses.map((status) => [status.target_id, status]),
  );

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      {contextHolder}
      <Card
        className={`${styles.downloaderSection} ${
          unframed ? styles.downloaderSectionUnframed : ''
        }`}
        extra={
          unframed ? undefined : (
            <div className={styles.downloaderToolbar}>
              <Text type="secondary">每 10 秒更新</Text>
              {onRefreshStatuses && (
                <Button
                  icon={<ReloadOutlined />}
                  loading={statusLoading}
                  onClick={onRefreshStatuses}
                >
                  刷新状态
                </Button>
              )}
              <Button
                icon={<PlusOutlined />}
                onClick={() => openModal()}
                type="primary"
              >
                添加 qBittorrent
              </Button>
            </div>
          )
        }
        title={unframed ? undefined : 'qBittorrent 下载器'}
      >
        {statusError && (
          <Alert
            className={styles.downloaderStatusAlert}
            title={`实时状态暂不可用：${statusError}`}
            showIcon
            type="warning"
          />
        )}
        {targets.length === 0 ? (
          <Empty description="还没有 qBittorrent 下载器" />
        ) : (
          <div className={styles.downloaderCardGrid}>
            {targets.map((target) => {
              const status = statusesByTarget.get(target.id);
              const statusMeta = targetStatusMeta(target, status);
              const hasLiveMetrics = target.enabled && status?.online;
              return (
                <Card
                  actions={[
                    <Button
                      className={styles.downloaderCardAction}
                      icon={<ApiOutlined />}
                      key="test"
                      loading={testingId === target.id}
                      onClick={() => test(target)}
                      type="text"
                    >
                      测试连接
                    </Button>,
                    <Button
                      className={styles.downloaderCardAction}
                      icon={<EditOutlined />}
                      key="edit"
                      onClick={() => openModal(target)}
                      type="text"
                    >
                      编辑
                    </Button>,
                    <Popconfirm
                      description="正在被流程使用的目标不能删除。"
                      key="delete"
                      onConfirm={() => remove(target)}
                      title="删除这个目标？"
                    >
                      <Button
                        className={styles.downloaderCardAction}
                        danger
                        icon={<DeleteOutlined />}
                        type="text"
                      >
                        删除
                      </Button>
                    </Popconfirm>,
                  ]}
                  className={`${styles.downloaderCard} ${
                    target.enabled ? '' : styles.downloaderCardDisabled
                  }`}
                  key={target.id}
                >
                  <div className={styles.downloaderCardContent}>
                    <div className={styles.downloaderCardHeading}>
                      <div className={styles.downloaderIdentity}>
                        <div className={styles.downloaderNameLine}>
                          <Title level={5}>{target.name}</Title>
                          <Badge
                            status={statusMeta.badge}
                            text={statusMeta.label}
                          />
                        </div>
                      </div>
                      <div className={styles.downloaderEnable}>
                        <Text type="secondary">启用</Text>
                        <Switch
                          checked={target.enabled}
                          onChange={(enabled) => toggle(target, enabled)}
                          size="small"
                        />
                      </div>
                    </div>

                    <div className={styles.downloaderSpeedGrid}>
                      <div className={styles.downloaderSpeedDownload}>
                        <span>
                          <ArrowDownOutlined /> 下载速度
                        </span>
                        <strong>
                          {formatSpeed(
                            hasLiveMetrics ? status.download_speed : undefined,
                          )}
                        </strong>
                      </div>
                      <div className={styles.downloaderSpeedUpload}>
                        <span>
                          <ArrowUpOutlined /> 上传速度
                        </span>
                        <strong>
                          {formatSpeed(
                            hasLiveMetrics ? status.upload_speed : undefined,
                          )}
                        </strong>
                      </div>
                    </div>

                    {target.enabled && status?.error && (
                      <Tooltip title={status.error}>
                        <div className={styles.downloaderError}>
                          {status.error}
                        </div>
                      </Tooltip>
                    )}
                    <div className={styles.downloaderCheckedAt}>
                      {target.enabled
                        ? formatCheckedAt(status?.checked_at)
                        : '停用后不读取实时状态'}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Card>
      {show115Accounts && (
        <Card title="115 离线下载账号">
          <Alert
            className={styles.panelAlert}
            title={
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
            extra={
              editing
                ? 'qBittorrent 5.2+ / WebAPI 2.14.1+ 推荐；保持 ******** 沿用，清空则改用用户名密码。'
                : 'qBittorrent 5.2+ / WebAPI 2.14.1+ 推荐；填写后优先于用户名密码。'
            }
            label="API Key（推荐）"
            name={['config', 'api_key']}
            rules={[
              {
                validator: (_, value) => {
                  const apiKey = String(value || '').trim();
                  if (
                    !apiKey ||
                    apiKey === QB_API_KEY_MASK ||
                    QB_API_KEY_PATTERN.test(apiKey)
                  ) {
                    return Promise.resolve();
                  }
                  return Promise.reject(
                    new Error('应以 qbt_ 开头，后接 28 位字母或数字'),
                  );
                },
              },
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            dependencies={[['config', 'api_key']]}
            extra="未配置 API Key 时必填。"
            label="用户名"
            name={['config', 'username']}
            rules={[
              ({ getFieldValue }) => ({
                validator: (_, value) => {
                  const apiKey = String(
                    getFieldValue(['config', 'api_key']) || '',
                  ).trim();
                  if (apiKey || String(value || '').trim()) {
                    return Promise.resolve();
                  }
                  return Promise.reject(
                    new Error('请输入用户名或配置 API Key'),
                  );
                },
              }),
            ]}
          >
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item
            dependencies={[['config', 'api_key']]}
            extra={
              editing
                ? '未配置 API Key 时必填；保持 ******** 不变时沿用原密码。'
                : '未配置 API Key 时必填。'
            }
            label="密码"
            name={['config', 'password']}
            rules={[
              ({ getFieldValue }) => ({
                validator: (_, value) => {
                  const apiKey = String(
                    getFieldValue(['config', 'api_key']) || '',
                  ).trim();
                  if (apiKey || String(value || '').trim()) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('请输入密码或配置 API Key'));
                },
              }),
            ]}
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
