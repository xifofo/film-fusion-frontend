import { ModalForm, ProFormText, ProFormDigit } from '@ant-design/pro-components';
import { useRequest } from '@umijs/max';
import { message } from 'antd';
import React, { useEffect } from 'react';
import { updatePickcodeCache } from '@/services/film-fusion';

interface UpdateFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  values?: API.PickcodeCache;
}

const UpdateForm: React.FC<UpdateFormProps> = ({ open, onClose, onSuccess, values }) => {
  const [messageApi, contextHolder] = message.useMessage();

  const { run: updateRun, loading } = useRequest(updatePickcodeCache, {
    manual: true,
    onSuccess: () => {
      messageApi.success('更新成功');
      onClose();
      onSuccess();
    },
    onError: (error) => {
      messageApi.error(`更新失败：${error.message}`);
    },
  });

  return (
    <>
      {contextHolder}
      <ModalForm
        title="编辑 Pickcode 缓存"
        open={open}
        onOpenChange={(visible) => {
          if (!visible) {
            onClose();
          }
        }}
        onFinish={async (formValues: any) => {
          if (!values?.id) return;
          updateRun({
            id: values.id,
            ...formValues,
          });
        }}
        loading={loading}
        modalProps={{
          destroyOnClose: true,
          maskClosable: false,
        }}
        layout="vertical"
        width={600}
        initialValues={{
          file_path: values?.file_path,
          pickcode: values?.pickcode,
          file_size: values?.file_size,
          mime_type: values?.mime_type,
        }}
        key={values?.id} // 使用 key 确保表单在 values 变化时重新渲染
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

export default UpdateForm;
