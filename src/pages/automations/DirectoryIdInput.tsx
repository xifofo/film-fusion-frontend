import { FolderOpenOutlined } from '@ant-design/icons';
import { Button, Input } from 'antd';
import { useState } from 'react';
import CloudDirectoryPicker, {
  CLOUD_DIRECTORY_ROOT_ID,
} from '@/components/CloudDirectoryPicker';

type DirectoryIdInputProps = {
  value?: string;
  onChange?: (value: string) => void;
  accessMethod?: 'cookie' | 'openapi';
  cloudStorageId?: number;
  selectedPath?: string;
  onSelectedPathChange?: (path: string) => void;
};

const DirectoryIdInput = ({
  value,
  onChange,
  accessMethod = 'cookie',
  cloudStorageId,
  selectedPath,
  onSelectedPathChange,
}: DirectoryIdInputProps) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const directoryID = String(value || CLOUD_DIRECTORY_ROOT_ID);
  const displayValue =
    selectedPath && selectedPath !== '/'
      ? selectedPath
      : directoryID === CLOUD_DIRECTORY_ROOT_ID
        ? '根目录'
        : `已选目录（ID ${directoryID}）`;

  return (
    <>
      <Input
        suffix={
          <Button
            disabled={!cloudStorageId}
            onClick={() => setPickerOpen(true)}
            size="small"
            type="link"
          >
            选择目录
          </Button>
        }
        aria-label="保存目录"
        onClick={() => {
          if (cloudStorageId) setPickerOpen(true);
        }}
        placeholder={cloudStorageId ? '选择保存目录' : '请先选择 115 账号'}
        prefix={<FolderOpenOutlined />}
        readOnly
        value={displayValue}
      />
      <CloudDirectoryPicker
        accessMethod={accessMethod}
        cloudStorageId={cloudStorageId}
        onCancel={() => setPickerOpen(false)}
        onSelect={(selection) => {
          onChange?.(selection.id);
          onSelectedPathChange?.(selection.path);
          setPickerOpen(false);
        }}
        open={pickerOpen}
        selectedId={directoryID}
        selectedPath={selectedPath}
      />
    </>
  );
};

export default DirectoryIdInput;
