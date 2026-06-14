import {
  ProForm,
  ProFormDateTimePicker,
  ProFormDigit,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import React from 'react';
import type { StorageSectionFormProps } from './storageFormTypes';

/** Token 凭据分区：应用 / 令牌 / 过期时间 / 自动刷新 */
const CredentialForm: React.FC<StorageSectionFormProps> = ({
  values,
  onSave,
}) => (
  <ProForm
    layout="vertical"
    initialValues={values}
    submitter={{ searchConfig: { submitText: '保存凭据', resetText: '重置' } }}
    onFinish={async (value) => onSave(value)}
  >
    <ProFormText
      width="md"
      name="app_id"
      label="应用ID"
      placeholder="请输入应用ID"
    />
    <ProFormText
      width="md"
      name="app_secret"
      label="应用密钥"
      placeholder="请输入应用密钥"
    />
    <ProFormTextArea
      width="md"
      name="access_token"
      label="访问令牌"
      placeholder="请输入访问令牌"
    />
    <ProFormTextArea
      width="md"
      name="refresh_token"
      label="刷新令牌"
      placeholder="请输入刷新令牌"
    />
    <ProFormDateTimePicker
      width="md"
      name="token_expires_at"
      label="令牌过期时间"
      placeholder="请选择令牌过期时间"
    />
    <ProFormDateTimePicker
      width="md"
      name="refresh_expires_at"
      label="刷新令牌过期时间"
      placeholder="请选择刷新令牌过期时间"
    />
    <ProFormDateTimePicker
      width="md"
      name="last_refresh_at"
      label="最后刷新时间"
      placeholder="最后刷新时间"
      disabled
    />
    <ProFormSwitch name="auto_refresh" label="自动刷新令牌" />
    <ProFormDigit
      width="md"
      name="refresh_before_min"
      label="刷新提前时间(分钟)"
      placeholder="提前多少分钟刷新令牌"
      min={1}
      max={1440}
    />
  </ProForm>
);

export default CredentialForm;
