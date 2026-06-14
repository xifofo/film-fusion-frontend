import { ProForm } from '@ant-design/pro-components';
import React from 'react';
import CookieField from './CookieField';
import type { StorageSectionFormProps } from './storageFormTypes';

/** Cookie 分区：Cookie 输入 + 115 保活状态/续期 */
const CookieForm: React.FC<StorageSectionFormProps> = ({ values, onSave }) => (
  <ProForm
    layout="vertical"
    initialValues={values}
    submitter={{ searchConfig: { submitText: '保存 Cookie', resetText: '重置' } }}
    onFinish={async (value) => onSave(value)}
  >
    <CookieField record={values} />
  </ProForm>
);

export default CookieForm;
