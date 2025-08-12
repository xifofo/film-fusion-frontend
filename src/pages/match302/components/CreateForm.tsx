import { PlusOutlined } from '@ant-design/icons';
import {
  ModalForm,
  ProFormText,
  ProFormSelect,
} from '@ant-design/pro-components';
import { Button, message } from 'antd';
import type { FC } from 'react';
import { useState } from 'react';
import { useRequest } from '@umijs/max';
import { createMatch302, getCloudStorageList } from '@/services/film-fusion';

interface CreateFormProps {
  onSuccess?: () => void;
}

const CreateForm: FC<CreateFormProps> = (props) => {
  const { onSuccess } = props;
  const [open, setOpen] = useState(false);

  const { data: cloudStorageData, loading: cloudStorageLoading } = useRequest(() =>
    getCloudStorageList({ current: 1, pageSize: 1000 }), {
    formatResult: (res) => res.data?.list || []
  });

  return (
    <>
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={() => setOpen(true)}
      >
        新建
      </Button>

      <ModalForm<API.CreateMatch302Params>
        title="新建 Match302 重定向"
        open={open}
        onOpenChange={setOpen}
        modalProps={{
          destroyOnClose: true,
        }}
        onFinish={async (values) => {
          try {
            await createMatch302(values);
            message.success('创建成功');
            onSuccess?.();
            return true;
          } catch (error) {
            message.error('创建失败，请重试');
            return false;
          }
        }}
      >
        <ProFormText
          name="source_path"
          label="源路径"
          rules={[
            { required: true, message: '请输入源路径' },
            { max: 500, message: '源路径最大长度为500字符' },
          ]}
          placeholder="请输入源路径，例如：/source/path"
          extra="输入需要重定向的源路径"
        />

        <ProFormText
          name="target_path"
          label="目标路径"
          rules={[
            { max: 500, message: '目标路径最大长度为500字符' },
          ]}
          placeholder="请输入目标路径，例如：/target/path"
          extra="输入重定向的目标路径"
        />

        <ProFormSelect
          name="cloud_storage_id"
          label="云存储"
          rules={[{ required: true, message: '请选择云存储' }]}
          options={cloudStorageData?.map((item: API.CloudStorage) => ({
            label: `${item.storage_name} (${item.storage_type})`,
            value: item.id,
          }))}
          placeholder="请选择关联的云存储"
          showSearch
          fieldProps={{
            loading: cloudStorageLoading,
            filterOption: (input: string, option: any) =>
              option?.label?.toLowerCase().indexOf(input.toLowerCase()) >= 0,
          }}
        />
      </ModalForm>
    </>
  );
};

export default CreateForm;
