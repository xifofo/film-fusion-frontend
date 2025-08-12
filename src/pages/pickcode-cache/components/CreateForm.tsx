import { ModalForm, ProFormText, ProFormDigit } from '@ant-design/pro-components';
import { useRequest } from '@umijs/max';
import { message } from 'antd';
import React from 'react';
import { createPickcodeCache } from '@/services/film-fusion';

interface CreateFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateForm: React.FC<CreateFormProps> = ({ open, onClose, onSuccess }) => {
  const [messageApi, contextHolder] = message.useMessage();

  const { run: createRun, loading } = useRequest(createPickcodeCache, {
    manual: true,
    onSuccess: () => {
      messageApi.success('创建成功');
      onClose();
      onSuccess();
    },
    onError: (error) => {
      messageApi.error(`创建失败：${error.message}`);
    },
  });

  return (
    <>
      {contextHolder}
      <ModalForm
        title="新建 Pickcode 缓存"
        open={open}
        onOpenChange={(visible) => {
          if (!visible) {
            onClose();
          }
        }}
        onFinish={async (values: API.CreatePickcodeCacheParams) => {
          createRun(values);
        }}
        loading={loading}
        modalProps={{
          destroyOnClose: true,
          maskClosable: false,
        }}
        layout="vertical"
        width={600}
      >
        <ProFormText
          name="file_path"
          label="文件路径"
          placeholder="请输入文件路径"
          rules={[
            {
              required: true,
              message: '请输入文件路径',
            },
            {
              max: 1000,
              message: '文件路径不能超过1000个字符',
            },
          ]}
          fieldProps={{
            showCount: true,
            maxLength: 1000,
          }}
        />

        <ProFormText
          name="pickcode"
          label="Pickcode"
          placeholder="请输入 Pickcode"
          rules={[
            {
              required: true,
              message: '请输入 Pickcode',
            },
            {
              max: 50,
              message: 'Pickcode 不能超过50个字符',
            },
          ]}
          fieldProps={{
            showCount: true,
            maxLength: 50,
          }}
        />
      </ModalForm>
    </>
  );
};

export default CreateForm;
