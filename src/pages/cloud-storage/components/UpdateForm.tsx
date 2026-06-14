import { message, Modal, Tabs } from 'antd';
import React, { cloneElement, useCallback, useState } from 'react';
import { updateCloudStorage } from '@/services/film-fusion';
import BasicInfoForm from './BasicInfoForm';
import CookieForm from './CookieForm';
import CredentialForm from './CredentialForm';
import DiagnosticForm from './DiagnosticForm';
import Match302Form from './Match302Form';

export type UpdateFormProps = {
  trigger?: React.ReactElement<any>;
  onOk?: () => void;
  values: API.CloudStorage;
};

/**
 * 云存储编辑：弹窗内按分区拆成多个独立表单（Tabs），每个分区各自保存（部分更新）。
 */
const UpdateForm: React.FC<UpdateFormProps> = (props) => {
  const { onOk, values, trigger } = props;

  const [open, setOpen] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const onCancel = useCallback(() => {
    setOpen(false);
  }, []);

  const onOpen = useCallback(() => {
    setOpen(true);
  }, []);

  // 各分区共用：保存当前分区字段，合并 id 做部分更新
  const handleSave = useCallback(
    async (patch: Record<string, any>) => {
      try {
        const resp = await updateCloudStorage({
          ...patch,
          id: values.id,
        } as API.UpdateCloudStorageParams);
        if (resp.code === 0) {
          messageApi.success('保存成功');
          onOk?.();
          return true;
        }
        messageApi.error(resp.message || '保存失败，请重试！');
        return false;
      } catch {
        messageApi.error('保存失败，请重试！');
        return false;
      }
    },
    [messageApi, onOk, values.id],
  );

  const sectionProps = { values, onSave: handleSave };

  return (
    <>
      {contextHolder}
      {trigger
        ? cloneElement(trigger, {
            onClick: onOpen,
          })
        : null}
      <Modal
        title="编辑云存储"
        open={open}
        width="800px"
        footer={null}
        onCancel={onCancel}
        destroyOnHidden
      >
        <Tabs
          defaultActiveKey="basic"
          items={[
            {
              key: 'basic',
              label: '基本信息',
              children: <BasicInfoForm {...sectionProps} />,
            },
            {
              key: 'credential',
              label: 'Token 凭据',
              children: <CredentialForm {...sectionProps} />,
            },
            {
              key: 'cookie',
              label: 'Cookie',
              children: <CookieForm {...sectionProps} />,
            },
            {
              key: 'match302',
              label: 'Match302',
              children: <Match302Form {...sectionProps} />,
            },
            {
              key: 'diagnostic',
              label: '诊断信息',
              children: <DiagnosticForm {...sectionProps} />,
            },
          ]}
        />
      </Modal>
    </>
  );
};

export default UpdateForm;
