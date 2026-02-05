import {
  ModalForm,
  ProFormDigit,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { PlusOutlined } from '@ant-design/icons';
import { Button, message } from 'antd';
import React, { useMemo, useState } from 'react';
import { useRequest } from '@umijs/max';
import { createCloudDirectory } from '@/services/film-fusion';

export type CreateFormProps = {
  onSuccess?: () => void;
  storageOptions: { label: string; value: number }[];
  storageLoading?: boolean;
};

const CreateForm: React.FC<CreateFormProps> = ({
  onSuccess,
  storageOptions,
  storageLoading,
}) => {
  const [open, setOpen] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const { run, loading } = useRequest(createCloudDirectory, {
    manual: true,
    onSuccess: () => {
      messageApi.success('创建成功');
      onSuccess?.();
      setOpen(false);
    },
    onError: () => {
      messageApi.error('创建失败，请重试');
    },
  });

  const jsonValidator = useMemo(
    () => (_: any, value: string) => {
      if (!value) return Promise.resolve();
      try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) {
          return Promise.reject(new Error('请输入 JSON 数组格式'));
        }
      } catch (error) {
        return Promise.reject(new Error('请输入有效的 JSON 格式'));
      }
      return Promise.resolve();
    },
    [],
  );

  return (
    <>
      {contextHolder}
      <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
        新建目录配置
      </Button>
      <ModalForm<API.CreateCloudDirectoryParams>
        title="新建目录配置"
        open={open}
        onOpenChange={setOpen}
        modalProps={{
          destroyOnClose: true,
        }}
        submitter={{
          submitButtonProps: { loading },
        }}
        initialValues={{
          content_encode_uri: false,
          include_extensions: '[]',
          exclude_extensions: '[]',
          classify_by_category: false,
        }}
        onFinish={async (values) => {
          await run(values);
          return true;
        }}
      >
        <ProFormSelect
          name="cloud_storage_id"
          label="云存储"
          rules={[{ required: true, message: '请选择云存储' }]}
          options={storageOptions}
          placeholder="请选择关联的云存储"
          showSearch
          fieldProps={{
            loading: storageLoading,
            filterOption: (input: string, option: any) =>
              option?.label?.toLowerCase().includes(input.toLowerCase()),
          }}
        />
        <ProFormText
          name="directory_name"
          label="目录名称"
          rules={[{ required: true, message: '请输入目录名称' }]}
          placeholder="例如：电影"
        />
        <ProFormText
          name="directory_id"
          label="云盘目录 ID"
          rules={[{ required: true, message: '请输入云盘目录 ID' }]}
          placeholder="例如：123456789"
        />
        <ProFormText
          name="content_prefix"
          label="内容前缀"
          placeholder="例如：http://example.com/"
          tooltip="STRM 内容前缀"
        />
        <ProFormSwitch
          name="content_encode_uri"
          label="内容 URI 编码"
          tooltip="是否对内容进行 URI 编码"
          fieldProps={{
            checkedChildren: '开启',
            unCheckedChildren: '关闭',
          }}
        />
        <ProFormSwitch
          name="classify_by_category"
          label="按分类目录"
          tooltip="是否按分类目录进行归类"
          fieldProps={{
            checkedChildren: '开启',
            unCheckedChildren: '关闭',
          }}
        />
        <ProFormText
          name="save_path"
          label="保存路径"
          placeholder="例如：/mnt/media"
          tooltip="保存文件地址"
        />
        <ProFormTextArea
          name="include_extensions"
          label="包含后缀"
          placeholder='例如：["mp4","mkv","avi"]'
          tooltip="JSON 字符串，仅处理包含的文件后缀"
          fieldProps={{ rows: 3 }}
          rules={[{ validator: jsonValidator }]}
        />
        <ProFormTextArea
          name="exclude_extensions"
          label="排除后缀"
          placeholder='例如：["txt","nfo"]'
          tooltip="JSON 字符串，排除的文件后缀"
          fieldProps={{ rows: 3 }}
          rules={[{ validator: jsonValidator }]}
        />
        <ProFormDigit
          name="exclude_smaller_than_mb"
          label="排除小于 (MB)"
          tooltip="排除小于该大小的文件"
          min={0}
          fieldProps={{ precision: 0 }}
        />
      </ModalForm>
    </>
  );
};

export default CreateForm;
