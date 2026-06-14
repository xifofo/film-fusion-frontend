import {
  ProFormText,
  ProFormTextArea,
  ProFormSelect,
  ProFormSwitch,
  ProFormDigit,
  ProFormDateTimePicker,
  ModalForm,
} from '@ant-design/pro-components';
import { useRequest } from '@umijs/max';
import { message } from 'antd';
import React, { cloneElement, useCallback, useState } from 'react';
import { updateCloudStorage } from '@/services/film-fusion';
import CookieField from './CookieField';

export type UpdateFormProps = {
  trigger?: React.ReactElement<any>;
  onOk?: () => void;
  values: API.CloudStorage;
};

const UpdateForm: React.FC<UpdateFormProps> = (props) => {
  const { onOk, values, trigger } = props;

  const [open, setOpen] = useState(false);

  const [messageApi, contextHolder] = message.useMessage();

  const { run, loading } = useRequest(updateCloudStorage, {
    manual: true,
    onSuccess: () => {
      messageApi.success('更新成功');
      onOk?.();
      setOpen(false);
    },
    onError: () => {
      messageApi.error('更新失败，请重试！');
    },
  });

  const onCancel = useCallback(() => {
    setOpen(false);
  }, []);

  const onOpen = useCallback(() => {
    setOpen(true);
  }, []);

  return (
    <>
      {contextHolder}
      {trigger
        ? cloneElement(trigger, {
            onClick: onOpen,
          })
        : null}
      <ModalForm
        title="编辑云存储"
        open={open}
        width="800px"
        modalProps={{
          okButtonProps: { loading },
          onCancel: onCancel,
        }}
        initialValues={values}
        onFinish={async (value) => {
          await run({ ...value, id: values.id } as API.UpdateCloudStorageParams);
          return true;
        }}
      >
        <ProFormText
          rules={[
            {
              required: true,
              message: '存储名称为必填项',
            },
          ]}
          width="md"
          name="storage_name"
          label="存储名称"
          placeholder="请输入存储名称"
        />
        <ProFormSelect
          rules={[
            {
              required: true,
              message: '存储类型为必填项',
            },
          ]}
          width="md"
          name="storage_type"
          label="存储类型"
          placeholder="请选择存储类型"
          disabled
          options={[
            { label: '115网盘 OpenAPI', value: '115open' },
            { label: '百度网盘', value: 'baidu' },
            { label: '阿里云盘', value: 'aliyun' },
            { label: '腾讯云', value: 'tencent' },
            { label: '天翼云盘', value: 'tianyi' },
            { label: '夸克网盘', value: 'quark' },
          ]}
        />
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
        <CookieField record={values} />
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
        <ProFormSwitch
          name="auto_refresh"
          label="自动刷新令牌"
        />
        <ProFormDigit
          width="md"
          name="refresh_before_min"
          label="刷新提前时间(分钟)"
          placeholder="提前多少分钟刷新令牌"
          min={1}
          max={1440}
        />
        <ProFormSelect
          width="md"
          name="status"
          label="状态"
          options={[
            { label: '启用', value: 'active' },
            { label: '禁用', value: 'disabled' },
            { label: '错误', value: 'error' },
          ]}
        />
        <ProFormTextArea
          width="md"
          name="error_message"
          label="错误信息"
          placeholder="错误信息"
        />
        <ProFormDateTimePicker
          width="md"
          name="last_error_at"
          label="最后错误时间"
          placeholder="最后错误时间"
          disabled
        />
        <ProFormTextArea
          width="md"
          name="config"
          label="额外配置"
          placeholder="请输入JSON格式的额外配置信息"
        />
        <ProFormDigit
          width="md"
          name="match302_max_active"
          label="Match302 最大同时播放"
          placeholder="0 表示不限制"
          min={0}
          max={100}
          fieldProps={{ precision: 0 }}
        />
        <ProFormDigit
          width="md"
          name="match302_cache_max_gb"
          label="Match302 子账号缓存空间上限(GB)"
          placeholder="0 表示不限制"
          min={0}
          max={1024}
          fieldProps={{ precision: 0 }}
          extra="仅统计 FilmFusion 秒传到该账号并记录的缓存文件；超出后会优先清理最早缓存。"
        />
        <ProFormDigit
          width="md"
          name="sort_order"
          label="排序"
          placeholder="排序值，数字越大排序越靠前"
        />
      </ModalForm>
    </>
  );
};

export default UpdateForm;
