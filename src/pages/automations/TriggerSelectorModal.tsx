import { DownloadOutlined, FolderOpenOutlined } from '@ant-design/icons';
import { Button, Card, Col, Modal, Radio, Row, Space, Typography } from 'antd';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import type { AutomationTriggerType } from '@/services/film-fusion';
import styles from './index.module.less';

const { Paragraph, Text, Title } = Typography;

type TriggerSelectorModalProps = {
  open: boolean;
  onCancel: () => void;
  onSelect: (trigger: AutomationTriggerType) => void;
};

const triggerOptions: Array<{
  value: AutomationTriggerType;
  title: string;
  description: string;
  detail: string;
  icon: ReactNode;
}> = [
  {
    value: 'rss',
    title: 'RSS / Atom',
    description: '发现订阅里的新下载条目',
    detail: '适合 qBittorrent、115 离线下载以及后续识别整理。',
    icon: <DownloadOutlined />,
  },
  {
    value: '115_directory',
    title: '115 目录',
    description: '发现目录里新增且已稳定的媒体',
    detail: '按目录保存增量游标，适合入库后的识别、整理与通知。',
    icon: <FolderOpenOutlined />,
  },
];

const TriggerSelectorModal = ({
  open,
  onCancel,
  onSelect,
}: TriggerSelectorModalProps) => {
  const [selected, setSelected] = useState<AutomationTriggerType>('rss');

  useEffect(() => {
    if (open) setSelected('rss');
  }, [open]);

  return (
    <Modal
      destroyOnHidden
      footer={
        <Space>
          <Button onClick={onCancel}>取消</Button>
          <Button onClick={() => onSelect(selected)} type="primary">
            下一步：配置触发器
          </Button>
        </Space>
      }
      onCancel={onCancel}
      open={open}
      title="选择触发器"
      width={760}
    >
      <Paragraph type="secondary">
        每条自动化绑定一个触发器。触发器只负责发现事件，下载、识别、整理和通知由后续流程节点完成。
      </Paragraph>
      <Radio.Group
        aria-label="自动化触发器"
        className={styles.triggerRadioGroup}
        onChange={(event) => setSelected(event.target.value)}
        value={selected}
      >
        <Row gutter={[16, 16]}>
          {triggerOptions.map((option) => (
            <Col key={option.value} sm={12} xs={24}>
              <Card
                className={
                  selected === option.value
                    ? styles.triggerCardSelected
                    : styles.triggerCard
                }
                hoverable
                onClick={() => setSelected(option.value)}
              >
                <div className={styles.triggerChoice}>
                  <span className={styles.triggerIcon}>{option.icon}</span>
                  <div className={styles.triggerContent}>
                    <div className={styles.triggerHeader}>
                      <Radio aria-label={option.title} value={option.value} />
                      <Title className={styles.triggerTitle} level={5}>
                        {option.title}
                      </Title>
                    </div>
                    <Text className={styles.triggerDescription} strong>
                      {option.description}
                    </Text>
                    <Paragraph
                      className={styles.triggerDetail}
                      type="secondary"
                    >
                      {option.detail}
                    </Paragraph>
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </Radio.Group>
    </Modal>
  );
};

export default TriggerSelectorModal;
