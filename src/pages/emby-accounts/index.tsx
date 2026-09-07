import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import type { TableColumnsType } from 'antd';
import { Alert, App, Button, DatePicker, Input, Modal, Table, Tag } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useCallback, useEffect, useRef, useState } from 'react';
import ConsolePage from '@/components/ConsolePage';
import {
  type EmbyAccount,
  getEmbyAccounts,
  setEmbyAccountExpiry,
} from '@/services/film-fusion/embyAccount';

const formatTime = (value: string | null) =>
  value && dayjs(value).isValid() && dayjs(value).year() > 1
    ? dayjs(value).format('YYYY-MM-DD HH:mm:ss')
    : '—';

function errorMessage(error: unknown) {
  const response = error as { response?: { data?: { message?: string } } };
  return (
    response?.response?.data?.message ||
    '获取 Emby 用户失败，请检查连接配置后重试'
  );
}

export default function EmbyAccountsPage() {
  const { message } = App.useApp();
  const [accounts, setAccounts] = useState<EmbyAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<EmbyAccount | null>(null);
  const [expiresAt, setExpiresAt] = useState<Dayjs | null>(null);
  const [saving, setSaving] = useState(false);
  const requestId = useRef(0);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const loadAccounts = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const response = await getEmbyAccounts();
      if (id !== requestId.current) return;
      if (response.code !== 0) {
        setLoadError(response.message || '获取 Emby 用户失败');
        return;
      }
      setAccounts(response.data || []);
      setLoadError('');
    } catch (error) {
      if (id === requestId.current) setLoadError(errorMessage(error));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccounts();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadAccounts();
    }, 30_000);
    return () => {
      window.clearInterval(timer);
      requestId.current++;
    };
  }, [loadAccounts]);

  const save = async () => {
    if (!editing || saving) return;
    setSaving(true);
    try {
      const response = await setEmbyAccountExpiry(editing.emby_user_id, {
        server_id: editing.server_id,
        expires_at: expiresAt?.toISOString() ?? null,
      });
      if (response.code !== 0) {
        void message.error(response.message || '保存失败');
        return;
      }
      void message.success(expiresAt ? '到期时间已保存' : '已取消自动到期');
      setEditing(null);
      await loadAccounts();
    } catch {
      // The API client displays the error; retain the draft for retry.
    } finally {
      setSaving(false);
    }
  };

  const columns: TableColumnsType<EmbyAccount> = [
    {
      title: '账户',
      key: 'account',
      width: 240,
      render: (_, account) => (
        <div>
          <div className="mb-1 font-medium">
            {account.name}{' '}
            {account.is_administrator && <Tag color="blue">管理员</Tag>}
          </div>
          <div className="break-all text-xs text-neutral-400">
            {account.emby_user_id}
          </div>
        </div>
      ),
    },
    {
      title: '账户状态',
      key: 'status',
      width: 110,
      filters: [
        { text: '正常', value: false },
        { text: '已禁用', value: true },
      ],
      onFilter: (value, account) => account.is_disabled === value,
      render: (_, account) => (
        <Tag color={account.is_disabled ? 'error' : 'success'}>
          {account.is_disabled ? '已禁用' : '正常'}
        </Tag>
      ),
    },
    {
      title: '到期时间',
      key: 'expiry',
      width: 200,
      sorter: (a, b) =>
        (a.expires_at
          ? dayjs(a.expires_at).valueOf()
          : Number.MAX_SAFE_INTEGER) -
        (b.expires_at
          ? dayjs(b.expires_at).valueOf()
          : Number.MAX_SAFE_INTEGER),
      render: (_, account) => (
        <div>
          {account.expires_at ? formatTime(account.expires_at) : '永不过期'}
          {account.expires_at &&
            dayjs(account.expires_at).valueOf() <= Date.now() && (
              <div className="mt-1">
                <Tag color="orange">已到期</Tag>
              </div>
            )}
        </div>
      ),
    },
    {
      title: '最近登录',
      key: 'lastLogin',
      width: 190,
      render: (_, account) => formatTime(account.last_login_date),
    },
    {
      title: '到期执行情况',
      key: 'execution',
      width: 260,
      render: (_, account) => {
        if (account.last_error) {
          return (
            <div className="text-red-500">等待重试：{account.last_error}</div>
          );
        }
        if (account.disabled_at && account.is_disabled) {
          return (
            <div>
              已确认禁用
              <div className="text-xs text-neutral-400">
                {formatTime(account.disabled_at)}
              </div>
            </div>
          );
        }
        if (!account.expires_at) return '—';
        return dayjs(account.expires_at).valueOf() <= Date.now()
          ? '等待后台检查'
          : '等待到期';
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 130,
      fixed: 'right',
      render: (_, account) => (
        <Button
          type="link"
          disabled={!!loadError}
          onClick={() => {
            setEditing(account);
            setExpiresAt(account.expires_at ? dayjs(account.expires_at) : null);
          }}
        >
          设置到期时间
        </Button>
      ),
    },
  ];

  const keyword = search.trim().toLocaleLowerCase();
  const visibleAccounts = accounts.filter((account) =>
    `${account.name} ${account.emby_user_id}`
      .toLocaleLowerCase()
      .includes(keyword),
  );

  return (
    <ConsolePage
      eyebrow="Emby"
      title="账户管理"
      actions={
        <Button
          icon={<ReloadOutlined />}
          loading={loading}
          onClick={() => void loadAccounts()}
        >
          刷新用户
        </Button>
      }
    >
      <div className="mb-5 text-sm text-neutral-500 dark:text-white/50">
        到期后自动禁用 Emby 账户，后台每 30 秒检查，失败后自动重试。时间按{' '}
        {timezone} 显示。
      </div>
      {loadError && (
        <Alert className="mb-4" type="error" showIcon title={loadError} />
      )}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Input
          aria-label="搜索 Emby 账户"
          placeholder="搜索用户名或用户 ID"
          prefix={<SearchOutlined />}
          allowClear
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ maxWidth: 320 }}
        />
        <span className="text-sm text-neutral-400">
          共 {accounts.length} 个账户
        </span>
      </div>
      <Table<EmbyAccount>
        rowKey={(account) => `${account.server_id}/${account.emby_user_id}`}
        columns={columns}
        dataSource={visibleAccounts}
        loading={loading}
        scroll={{ x: 1130 }}
        pagination={{ defaultPageSize: 20, showSizeChanger: true }}
        locale={{
          emptyText: loadError ? '用户列表加载失败' : '暂无匹配的 Emby 用户',
        }}
      />
      <Modal
        title={`设置到期时间 · ${editing?.name || ''}`}
        open={editing !== null}
        onCancel={() => {
          if (!saving) setEditing(null);
        }}
        onOk={() => void save()}
        okText="保存"
        cancelText="取消"
        confirmLoading={saving}
        destroyOnHidden
      >
        <div className="py-3">
          <label htmlFor="emby-account-expiry" className="mb-2 block">
            到期时间（{timezone}）
          </label>
          <DatePicker
            id="emby-account-expiry"
            showTime
            format="YYYY-MM-DD HH:mm:ss"
            needConfirm={false}
            placeholder="不设置则永不过期"
            value={expiresAt}
            onChange={setExpiresAt}
            disabled={saving}
            style={{ width: '100%' }}
          />
          <div className="mt-2 flex items-center justify-between gap-2 text-xs text-neutral-500">
            <span>清空后保存，可取消自动到期。</span>
            <Button
              type="link"
              size="small"
              disabled={saving}
              onClick={() => setExpiresAt(null)}
            >
              设为永不过期
            </Button>
          </div>
          {expiresAt && expiresAt.valueOf() <= Date.now() && (
            <Alert
              className="mt-3"
              type="warning"
              showIcon
              title="该时间已到期，保存后后台将立即尝试禁用此账户。"
            />
          )}
          {editing?.is_disabled && (
            <Alert
              className="mt-3"
              type="info"
              showIcon
              title="此账户已被禁用。修改到期时间不会自动启用账户，可前往 Emby 恢复。"
            />
          )}
        </div>
      </Modal>
    </ConsolePage>
  );
}
