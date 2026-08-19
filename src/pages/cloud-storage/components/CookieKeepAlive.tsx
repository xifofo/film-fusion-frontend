import { CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';
import {
  Alert,
  App,
  Button,
  Modal,
  Popover,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import React, { useState } from 'react';
import {
  DEFAULT_WEB115_RELOGIN_APP,
  WEB115_RELOGIN_APP_OPTIONS,
  WEB115_USE_DEFAULT_APP,
} from '@/constants/web115';
import { refreshWeb115Cookie } from '@/services/film-fusion';

const { Text } = Typography;

interface CookieKeepAliveProps {
  record: API.CloudStorage;
  status?: API.Web115CookieStatus;
  onChanged?: () => void;
}

const fmtTime = (s?: string) => (s ? new Date(s).toLocaleString() : '—');

/** 单个 115 存储的 cookie 保活状态展示 */
const CookieKeepAlive: React.FC<CookieKeepAliveProps> = ({
  record,
  status,
}) => {
  // 仅 115open 存储有 cookie 保活；无状态说明非 115 存储
  if (record.storage_type !== '115open' || !status) {
    return <Text type="secondary">—</Text>;
  }

  if (!status.has_cookie) {
    return <Tag color="default">未配置 Cookie</Tag>;
  }

  const detail = (
    <Space orientation="vertical" size={4} style={{ maxWidth: 300 }}>
      <Text>
        自动续期端：<Text strong>{status.app || '—'}</Text>
      </Text>
      <Text type="secondary">
        续期策略：{status.use_default ? '跟随系统默认' : '该存储单独设置'}
      </Text>
      <Text type="secondary">上次续期：{fmtTime(status.last_refresh_at)}</Text>
      <Text type="secondary">上次检查：{fmtTime(status.last_check_at)}</Text>
      {status.last_result && <Text type="secondary">{status.last_result}</Text>}
      {!status.healthy && status.last_error && (
        <Text type="danger">错误：{status.last_error}</Text>
      )}
    </Space>
  );

  const tag = status.healthy ? (
    <Tag icon={<CheckCircleOutlined />} color="success">
      正常
    </Tag>
  ) : (
    <Tag icon={<WarningOutlined />} color="error">
      异常
    </Tag>
  );

  return (
    <Popover content={detail} title="Cookie 保活" trigger="click">
      <a>{tag}</a>
    </Popover>
  );
};

/** 操作列中的 115 Cookie 手动换端续期入口 */
export const CookieRefreshAction: React.FC<CookieKeepAliveProps> = ({
  record,
  status,
  onChanged,
}) => {
  const { message: messageApi } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<
    API.Web115ReloginApp | typeof WEB115_USE_DEFAULT_APP
  >(WEB115_USE_DEFAULT_APP);

  if (record.storage_type !== '115open') {
    return null;
  }

  const unavailableReason = !status
    ? 'Cookie 保活状态尚未加载，请稍后重试'
    : !status.has_cookie
      ? '请先配置 Cookie'
      : undefined;

  const handleOpen = () => {
    setSelectedApp(
      status?.use_default
        ? WEB115_USE_DEFAULT_APP
        : status?.app || DEFAULT_WEB115_RELOGIN_APP,
    );
    setOpen(true);
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const resp = await refreshWeb115Cookie({
        cloud_storage_id: record.id,
        app: selectedApp,
      });
      if (resp.code === 0) {
        messageApi.success(
          selectedApp === WEB115_USE_DEFAULT_APP
            ? 'Cookie 续期成功，后续自动续期将跟随系统默认'
            : `Cookie 续期成功，自动续期端已设为 ${selectedApp}`,
        );
        setOpen(false);
      } else {
        messageApi.error(resp.message || 'Cookie 续期失败');
      }
    } catch (e: any) {
      messageApi.error(`Cookie 续期失败：${e?.message || '请重试'}`);
    } finally {
      setLoading(false);
      onChanged?.();
    }
  };

  if (unavailableReason) {
    return (
      <Tooltip title={unavailableReason}>
        <span>
          <Button type="link" size="small" disabled style={{ padding: 0 }}>
            立即续期
          </Button>
        </span>
      </Tooltip>
    );
  }

  return (
    <>
      <Button
        type="link"
        size="small"
        loading={loading}
        style={{ padding: 0 }}
        onClick={handleOpen}
      >
        立即续期
      </Button>
      <Modal
        title={`Cookie 续期 - ${record.storage_name}`}
        open={open}
        okText="续期并保存"
        cancelText="取消"
        confirmLoading={loading}
        mask={{ closable: !loading }}
        keyboard={!loading}
        destroyOnHidden
        onOk={handleRefresh}
        onCancel={() => {
          if (!loading) setOpen(false);
        }}
      >
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <div>
            <Text strong>自动续期设备端</Text>
            <Select
              aria-label="自动续期设备端"
              value={selectedApp}
              options={[
                {
                  label: `跟随系统默认（当前：${status?.app || DEFAULT_WEB115_RELOGIN_APP}）`,
                  value: WEB115_USE_DEFAULT_APP,
                },
                ...WEB115_RELOGIN_APP_OPTIONS,
              ]}
              style={{ width: '100%', marginTop: 8 }}
              onChange={setSelectedApp}
            />
          </div>
          <Alert
            type="info"
            showIcon
            title="该选择同时用于本次和后续自动续期"
            description="选择“跟随系统默认”时使用系统设置中的默认设备端；选择具体设备端则保存为此存储的独立设置。确认后系统会立即换发一份新 Cookie。"
          />
        </Space>
      </Modal>
    </>
  );
};

export default CookieKeepAlive;
