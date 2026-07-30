import { CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';
import {
  Button,
  message,
  Popconfirm,
  Popover,
  Space,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import React, { useState } from 'react';
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
    <Space direction="vertical" size={4} style={{ maxWidth: 300 }}>
      <Text>
        绑定设备端：<Text strong>{status.app || '—'}</Text>
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
  const [loading, setLoading] = useState(false);

  if (record.storage_type !== '115open') {
    return null;
  }

  const unavailableReason = !status
    ? 'Cookie 保活状态尚未加载，请稍后重试'
    : !status.has_cookie
      ? '请先配置 Cookie'
      : undefined;

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const resp = await refreshWeb115Cookie({ cloud_storage_id: record.id });
      if (resp.code === 0) {
        message.success('Cookie 续期成功');
      } else {
        message.error(resp.message || 'Cookie 续期失败');
      }
    } catch (e: any) {
      message.error(`Cookie 续期失败：${e?.message || '请重试'}`);
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
    <Popconfirm
      title="立即换端续期？"
      description="用当前在线 Cookie 免扫码换发一份新 Cookie（绑定独立设备端，不影响日常登录）。"
      onConfirm={handleRefresh}
      okText="续期"
      cancelText="取消"
    >
      <Button type="link" size="small" loading={loading} style={{ padding: 0 }}>
        立即续期
      </Button>
    </Popconfirm>
  );
};

export default CookieKeepAlive;
