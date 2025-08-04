import React from 'react';
import { Modal, Card, Row, Col, Typography } from 'antd';
import { CloudOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

interface StorageTypeSelectorProps {
  open: boolean;
  onCancel: () => void;
  onSelect: (type: string) => void;
}

const StorageTypeSelector: React.FC<StorageTypeSelectorProps> = ({
  open,
  onCancel,
  onSelect,
}) => {
  const storageTypes = [
    {
      key: '115',
      title: '115网盘',
      description: '115云存储服务',
      icon: <CloudOutlined style={{ fontSize: 32, color: '#1890ff' }} />,
      available: true,
    },
    // 预留其他存储类型
    {
      key: 'aliyun',
      title: '阿里云盘',
      description: '暂未支持',
      icon: <CloudOutlined style={{ fontSize: 32, color: '#ccc' }} />,
      available: false,
    },
  ];

  return (
    <Modal
      title="选择云存储类型"
      open={open}
      onCancel={onCancel}
      footer={null}
      width={800}
      destroyOnHidden
    >
      <div style={{ padding: '20px 0' }}>
        <Row gutter={[16, 16]}>
          {storageTypes.map((type) => (
            <Col span={12} key={type.key}>
              <Card
                hoverable={type.available}
                onClick={() => type.available && onSelect(type.key)}
                style={{
                  height: 120,
                  cursor: type.available ? 'pointer' : 'not-allowed',
                  opacity: type.available ? 1 : 0.5,
                }}
                bodyStyle={{
                  display: 'flex',
                  alignItems: 'center',
                  height: '100%',
                  padding: '16px',
                }}
              >
                <div style={{ marginRight: 16 }}>
                  {type.icon}
                </div>
                <div>
                  <Title level={5} style={{ margin: 0, marginBottom: 4 }}>
                    {type.title}
                  </Title>
                  <Text type="secondary" style={{ color: type.available ? undefined : '#ccc' }}>
                    {type.description}
                  </Text>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    </Modal>
  );
};

export default StorageTypeSelector;
