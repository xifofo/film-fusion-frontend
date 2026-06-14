import {
  ProForm,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
} from '@ant-design/pro-components';
import React from 'react';
import type { StorageSectionFormProps } from './storageFormTypes';

/** 基本信息分区：名称 / 类型 / 状态 / 排序 */
const BasicInfoForm: React.FC<StorageSectionFormProps> = ({
  values,
  onSave,
}) => (
  <ProForm
    layout="vertical"
    initialValues={values}
    submitter={{ searchConfig: { submitText: '保存基本信息', resetText: '重置' } }}
    onFinish={async (value) => onSave(value)}
  >
    <ProFormText
      rules={[{ required: true, message: '存储名称为必填项' }]}
      width="md"
      name="storage_name"
      label="存储名称"
      placeholder="请输入存储名称"
    />
    <ProFormSelect
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
    <ProFormDigit
      width="md"
      name="sort_order"
      label="排序"
      placeholder="排序值，数字越大排序越靠前"
    />
  </ProForm>
);

export default BasicInfoForm;
