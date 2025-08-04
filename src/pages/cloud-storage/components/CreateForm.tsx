import { PlusOutlined } from '@ant-design/icons';
import {
  type ActionType,
} from '@ant-design/pro-components';
import { Button } from 'antd';
import type { FC } from 'react';
import { useState } from 'react';
import StorageTypeSelector from './StorageTypeSelector';
import Storage115Config from './Storage115Config';

interface CreateFormProps {
  reload?: ActionType['reload'];
}

const CreateForm: FC<CreateFormProps> = (props) => {
  const { reload } = props;
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [show115Config, setShow115Config] = useState(false);

  const handleTypeSelect = (type: string) => {
    setShowTypeSelector(false);
    if (type === '115') {
      setShow115Config(true);
    }
    // 其他类型暂不支持
  };

  const handleSuccess = () => {
    reload?.();
  };

  return (
    <>
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={() => setShowTypeSelector(true)}
      >
        新建
      </Button>

      <StorageTypeSelector
        open={showTypeSelector}
        onCancel={() => setShowTypeSelector(false)}
        onSelect={handleTypeSelect}
      />

      <Storage115Config
        open={show115Config}
        onCancel={() => setShow115Config(false)}
        onSuccess={handleSuccess}
      />
    </>
  );
};

export default CreateForm;
