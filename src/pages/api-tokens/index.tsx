import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  Alert,
  App,
  Button,
  Form,
  Input,
  Modal,
  Select,
  Table,
  type TableColumnsType,
  Tag,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import { useCallback, useEffect, useRef, useState } from 'react';
import ConsolePage from '@/components/ConsolePage';
import {
  type APIToken,
  type APITokenScope,
  createAPIToken,
  getAPITokenScopes,
  getAPITokens,
  type IssuedAPIToken,
  revokeAPIToken,
} from '@/services/film-fusion/apiToken';

type CreateValues = { name: string; scopes: string[]; days: number };

const formatTime = (value: string | null) =>
  value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '—';

export default function APITokensPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm<CreateValues>();
  const [tokens, setTokens] = useState<APIToken[]>([]);
  const [scopes, setScopes] = useState<APITokenScope[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [creating, setCreating] = useState(false);
  const [issued, setIssued] = useState<IssuedAPIToken | null>(null);
  const [revoking, setRevoking] = useState<APIToken | null>(null);
  const [saving, setSaving] = useState(false);
  const mutationPending = useRef(false);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const [tokenResponse, scopeResponse] = await Promise.all([
        getAPITokens(),
        getAPITokenScopes(),
      ]);
      if (id !== requestId.current) return;
      if (tokenResponse.code !== 0 || scopeResponse.code !== 0) {
        setLoadError(true);
        return;
      }
      setTokens(tokenResponse.data || []);
      setScopes(scopeResponse.data || []);
      setLoadError(false);
    } catch {
      if (id === requestId.current) setLoadError(true);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => {
      requestId.current++;
    };
  }, [load]);

  const create = async (values: CreateValues) => {
    if (mutationPending.current) return;
    mutationPending.current = true;
    setSaving(true);
    try {
      const response = await createAPIToken({
        name: values.name.trim(),
        scopes: values.scopes,
        expires_at: values.days
          ? dayjs().add(values.days, 'day').toISOString()
          : null,
      });
      if (response.code !== 0 || !response.data) {
        void message.error(response.message || '创建失败');
        return;
      }
      setCreating(false);
      setIssued(response.data);
      await load();
    } catch {
      // Keep the draft available for retry; the API client displays errors.
    } finally {
      mutationPending.current = false;
      setSaving(false);
    }
  };

  const revoke = async () => {
    if (!revoking || mutationPending.current) return;
    mutationPending.current = true;
    setSaving(true);
    try {
      const response = await revokeAPIToken(revoking.id);
      if (response.code !== 0) {
        void message.error(response.message || '撤销失败');
        return;
      }
      setRevoking(null);
      void message.success('API Token 已撤销');
      await load();
    } catch {
      // Keep the dialog open for retry.
    } finally {
      mutationPending.current = false;
      setSaving(false);
    }
  };

  const scopeNames = new Map(scopes.map((scope) => [scope.id, scope.name]));
  const columns: TableColumnsType<APIToken> = [
    {
      title: '名称 / 标识',
      key: 'name',
      width: 220,
      render: (_, token) => (
        <div>
          <div className="mb-1 break-all font-medium">{token.name}</div>
          <Typography.Text type="secondary" code>
            {token.prefix}…
          </Typography.Text>
        </div>
      ),
    },
    {
      title: '授权模块',
      key: 'scopes',
      width: 320,
      render: (_, token) => (
        <div className="flex flex-wrap gap-1">
          {token.scopes.map((scope) => (
            <Tag key={scope}>{scopeNames.get(scope) || scope}</Tag>
          ))}
        </div>
      ),
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_, token) => {
        if (token.revoked_at) return <Tag>已撤销</Tag>;
        if (
          token.expires_at &&
          dayjs(token.expires_at).valueOf() <= Date.now()
        ) {
          return <Tag color="orange">已过期</Tag>;
        }
        return <Tag color="success">有效</Tag>;
      },
    },
    {
      title: '到期时间',
      key: 'expiry',
      width: 190,
      render: (_, token) =>
        token.expires_at ? formatTime(token.expires_at) : '永不过期',
    },
    {
      title: '最近使用',
      key: 'lastUsed',
      width: 190,
      render: (_, token) =>
        token.last_used_at ? formatTime(token.last_used_at) : '尚未使用',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 190,
      render: formatTime,
    },
    {
      title: '操作',
      key: 'actions',
      width: 90,
      fixed: 'right',
      render: (_, token) => (
        <Button
          type="link"
          danger
          disabled={!!token.revoked_at || loadError || saving}
          onClick={() => setRevoking(token)}
        >
          撤销
        </Button>
      ),
    },
  ];

  return (
    <ConsolePage
      eyebrow="INTEGRATIONS"
      title="API Token"
      actions={
        <>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={load}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={loading || loadError || scopes.length === 0}
            onClick={() => {
              form.resetFields();
              setCreating(true);
            }}
          >
            创建 Token
          </Button>
        </>
      }
    >
      <div className="mb-5 space-y-3">
        <p className="m-0 text-sm text-neutral-500 dark:text-neutral-400">
          为插件和第三方应用分别创建 Token，授权其调用指定模块的 API。
          请求头使用 Authorization: Bearer &lt;Token&gt;。
        </p>
        {loadError && (
          <Alert type="error" showIcon title="加载失败，请刷新后重试" />
        )}
      </div>
      <Table<APIToken>
        rowKey="id"
        columns={columns}
        dataSource={tokens}
        loading={loading}
        scroll={{ x: 1300 }}
        pagination={{ pageSize: 20, hideOnSinglePage: true }}
        locale={{
          emptyText: '暂无 API Token，创建后即可提供给插件或第三方应用',
        }}
      />

      <Modal
        title="创建 API Token"
        open={creating}
        onCancel={() => {
          if (!saving) setCreating(false);
        }}
        onOk={() => form.submit()}
        okText="创建"
        cancelText="取消"
        confirmLoading={saving}
        cancelButtonProps={{ disabled: saving }}
      >
        <Form<CreateValues>
          form={form}
          layout="vertical"
          initialValues={{ name: '', scopes: [], days: 90 }}
          disabled={saving}
          onFinish={create}
        >
          <Form.Item
            name="name"
            label="名称"
            rules={[
              { required: true, whitespace: true, message: '请输入名称' },
            ]}
          >
            <Input maxLength={80} placeholder="例如：客厅 Emby 插件" />
          </Form.Item>
          <Form.Item
            name="scopes"
            label="授权模块"
            extra="包含所选模块的查询和修改操作。账户、Token 管理及系统登录配置需要后台登录。"
            rules={[
              {
                required: true,
                type: 'array',
                min: 1,
                message: '请至少选择一个模块',
              },
            ]}
          >
            <Select
              mode="multiple"
              placeholder="选择允许调用的 API 模块"
              options={scopes.map((scope) => ({
                value: scope.id,
                label: scope.name,
                description: scope.description,
              }))}
              optionRender={(option) => (
                <div className="whitespace-normal py-1">
                  <div>{option.label}</div>
                  <div className="text-xs text-neutral-500">
                    {option.data.description}
                  </div>
                </div>
              )}
            />
          </Form.Item>
          <Form.Item name="days" label="有效期">
            <Select
              options={[
                { label: '7 天', value: 7 },
                { label: '30 天', value: 30 },
                { label: '90 天', value: 90 },
                { label: '一年', value: 365 },
                { label: '永不过期', value: 0 },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      {issued && (
        <Modal
          title="Token 已创建"
          open
          onCancel={() => setIssued(null)}
          footer={
            <Button type="primary" onClick={() => setIssued(null)}>
              已保存，关闭
            </Button>
          }
          destroyOnHidden
        >
          <Alert
            type="warning"
            showIcon
            title="完整 Token 仅显示这一次，请立即复制保存"
            description="关闭后无法再次查看；如遗失，请撤销并重新创建。"
          />
          <div className="my-4 rounded-lg bg-neutral-50 p-4 dark:bg-white/5">
            <Typography.Paragraph
              className="m-0! break-all font-mono"
              copyable={{ text: issued.token }}
            >
              {issued.token}
            </Typography.Paragraph>
          </div>
          <p className="text-sm text-neutral-500">
            将 Token 配置到应用服务端，通过 HTTPS 请求 FilmFusion 的已授权 API。
          </p>
        </Modal>
      )}

      <Modal
        title="撤销 API Token"
        open={!!revoking}
        onCancel={() => {
          if (!saving) setRevoking(null);
        }}
        onOk={revoke}
        okText="撤销"
        cancelText="取消"
        okButtonProps={{ danger: true }}
        cancelButtonProps={{ disabled: saving }}
        confirmLoading={saving}
      >
        撤销「{revoking?.name}」后，使用它的应用将无法继续调用 API。
        如需恢复接入，请创建新的 Token。
      </Modal>
    </ConsolePage>
  );
}
