import { ProFormTextArea } from '@ant-design/pro-components';
import { useRequest } from '@umijs/max';
import { Space } from 'antd';
import React from 'react';
import { getWeb115KeepaliveStatus } from '@/services/film-fusion';
import CookieKeepAlive from './CookieKeepAlive';

interface CookieFieldProps {
  record: API.CloudStorage;
}

/** 云存储编辑表单中的 Cookie 字段：Cookie 输入 + 115 Cookie 保活状态/续期操作 */
const CookieField: React.FC<CookieFieldProps> = ({ record }) => {
  // 仅 115open 存储有 cookie 保活能力
  const is115 = record.storage_type === '115open';

  const { data, refresh } = useRequest(getWeb115KeepaliveStatus, {
    ready: is115,
  });

  const status =
    data?.code === 0
      ? data.data?.list?.find((s) => s.storage_id === record.id)
      : undefined;

  return (
    <ProFormTextArea
      width="md"
      name="cookie"
      label={
        is115 ? (
          <Space size={8}>
            <span>Cookie</span>
            <CookieKeepAlive
              record={record}
              status={status}
              onChanged={refresh}
            />
          </Space>
        ) : (
          'Cookie'
        )
      }
      placeholder="请输入Cookie"
    />
  );
};

export default CookieField;
