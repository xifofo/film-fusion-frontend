import {
  ProForm,
  ProFormDateTimePicker,
  ProFormItem,
  ProFormTextArea,
} from '@ant-design/pro-components';
import React from 'react';
import JsonEditor from './JsonEditor';
import {
  FULL_COL,
  HALF_COL,
  type StorageSectionFormProps,
} from './storageFormTypes';

/** 诊断信息分区：错误信息 / 最后错误时间 / 额外配置 */
const DiagnosticForm: React.FC<StorageSectionFormProps> = ({
  values,
  onSave,
}) => (
  <ProForm
    grid
    rowProps={{ gutter: [16, 0] }}
    layout="vertical"
    initialValues={values}
    submitter={{
      searchConfig: { submitText: '保存诊断信息', resetText: '重置' },
    }}
    onFinish={async (value) => onSave(value)}
  >
    <ProFormTextArea
      colProps={FULL_COL}
      name="error_message"
      label="错误信息"
      placeholder="错误信息"
    />
    <ProFormDateTimePicker
      colProps={HALF_COL}
      name="last_error_at"
      label="最后错误时间"
      placeholder="最后错误时间"
      disabled
    />
    <ProFormItem
      colProps={FULL_COL}
      name="config"
      label="额外配置"
      tooltip="JSON 格式的额外配置信息"
      rules={[
        {
          validator: async (_, val) => {
            if (!val || !String(val).trim()) return;
            try {
              JSON.parse(val);
            } catch {
              throw new Error('额外配置必须是合法的 JSON');
            }
          },
        },
      ]}
    >
      <JsonEditor />
    </ProFormItem>
  </ProForm>
);

export default DiagnosticForm;
