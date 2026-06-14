import {
  ProForm,
  ProFormDateTimePicker,
  ProFormTextArea,
} from '@ant-design/pro-components';
import React from 'react';
import type { StorageSectionFormProps } from './storageFormTypes';

/** 诊断信息分区：错误信息 / 最后错误时间 / 额外配置 */
const DiagnosticForm: React.FC<StorageSectionFormProps> = ({
  values,
  onSave,
}) => (
  <ProForm
    layout="vertical"
    initialValues={values}
    submitter={{ searchConfig: { submitText: '保存诊断信息', resetText: '重置' } }}
    onFinish={async (value) => onSave(value)}
  >
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
  </ProForm>
);

export default DiagnosticForm;
