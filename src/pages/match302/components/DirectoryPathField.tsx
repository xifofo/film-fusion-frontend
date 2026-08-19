import type { InputProps } from 'antd';
import { Button, Form, Input } from 'antd';
import { useState } from 'react';
import CloudDirectoryPicker from '@/components/CloudDirectoryPicker';

type DirectoryInputProps = Omit<InputProps, 'value' | 'onChange'> & {
  value?: string;
  onChange?: (value: string) => void;
  cloudStorageId?: number;
};

type DirectoryPathFieldProps = {
  name: string;
  label: string;
  cloudStorageId?: number;
  placeholder?: string;
  extra?: React.ReactNode;
  required?: boolean;
};

const DirectoryInput = ({
  value,
  onChange,
  cloudStorageId,
  placeholder,
  ...rest
}: DirectoryInputProps) => {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <>
      <Input
        {...rest}
        suffix={
          <Button
            disabled={!cloudStorageId}
            onClick={() => setPickerOpen(true)}
            size="small"
            type="link"
          >
            选择
          </Button>
        }
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
      <CloudDirectoryPicker
        cloudStorageId={cloudStorageId}
        onCancel={() => setPickerOpen(false)}
        onSelect={(selection) => {
          onChange?.(selection.path);
          setPickerOpen(false);
        }}
        open={pickerOpen}
        selectedPath={value}
      />
    </>
  );
};

const DirectoryPathField = ({
  name,
  label,
  cloudStorageId,
  placeholder,
  extra,
  required,
}: DirectoryPathFieldProps) => (
  <Form.Item
    extra={extra}
    label={label}
    name={name}
    rules={[
      ...(required ? [{ required: true, message: `请选择${label}` }] : []),
      { max: 500, message: `${label}最大长度为500字符` },
    ]}
  >
    <DirectoryInput cloudStorageId={cloudStorageId} placeholder={placeholder} />
  </Form.Item>
);

export default DirectoryPathField;
