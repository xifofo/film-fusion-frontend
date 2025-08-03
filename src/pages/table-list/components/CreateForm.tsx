import { PlusOutlined } from '@ant-design/icons';
import {
  type ActionType,
  ModalForm,
  ProFormText,
  ProFormTextArea,
  ProFormSelect,
  ProFormSwitch,
  ProFormDigit,
  ProFormDateTimePicker,
} from '@ant-design/pro-components';
import { FormattedMessage, useIntl, useRequest } from '@umijs/max';
import { Button, message } from 'antd';
import type { FC } from 'react';
import { createCloudStorage } from '@/services/film-fusion';

interface CreateFormProps {
  reload?: ActionType['reload'];
}

const CreateForm: FC<CreateFormProps> = (props) => {
  const { reload } = props;

  const [messageApi, contextHolder] = message.useMessage();
  /**
   * @en-US International configuration
   * @zh-CN 国际化配置
   * */
  const intl = useIntl();

  const { run, loading } = useRequest(createCloudStorage, {
    manual: true,
    onSuccess: () => {
      messageApi.success('云存储添加成功');
      reload?.();
    },
    onError: () => {
      messageApi.error('添加失败，请重试！');
    },
  });

  return (
    <>
      {contextHolder}
      <ModalForm
        title="新建云存储"
        trigger={
          <Button type="primary" icon={<PlusOutlined />}>
            新建
          </Button>
        }
        width="800px"
        modalProps={{ okButtonProps: { loading } }}
        onFinish={async (value) => {
          await run(value as API.CreateCloudStorageParams);
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
          options={[
            { label: '115网盘', value: '115' },
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
        <ProFormText.Password
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
        <ProFormSwitch
          name="auto_refresh"
          label="自动刷新令牌"
          initialValue={true}
        />
        <ProFormDigit
          width="md"
          name="refresh_before_min"
          label="刷新提前时间(分钟)"
          placeholder="提前多少分钟刷新令牌"
          initialValue={30}
          min={1}
          max={1440}
        />
        <ProFormTextArea
          width="md"
          name="config"
          label="额外配置"
          placeholder="请输入JSON格式的额外配置信息"
        />
        <ProFormSwitch
          name="is_default"
          label="设为默认存储"
          initialValue={false}
        />
        <ProFormDigit
          width="md"
          name="sort_order"
          label="排序"
          placeholder="排序值，数字越大排序越靠前"
          initialValue={0}
        />
      </ModalForm>
    </>
  );
};

export default CreateForm;
