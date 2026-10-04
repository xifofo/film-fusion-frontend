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
    detail: '从订阅发现新资源，交给 qBittorrent 或 115 下载，再继续后续处理。',
    icon: <DownloadOutlined />,
  },
  {
    value: '115_directory',
    title: '115 目录',
    description: '发现目录里新增且已稳定的媒体',
    detail: '关注下载或上传后的新媒体，等待内容稳定，再完成识别、整理与通知。',
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
        自动化从哪里开始？选择一种内容来源，接下来配置它的处理流程。
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
                    <div className={styles.triggerExample}>
                      {option.value === 'rss'
                        ? '订阅更新 → 下载 → 后续处理'
                        : '目录新增 → 媒体识别 → 整理入库'}
                    </div>
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
