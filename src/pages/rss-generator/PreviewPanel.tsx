import { Alert, Empty, List, Skeleton, Space, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import type { ReactNode } from 'react';
import type { RSSGeneratorPreview } from '@/services/film-fusion';
import styles from './index.module.less';

const { Link, Paragraph, Text, Title } = Typography;

type PreviewPanelProps = {
  preview?: RSSGeneratorPreview;
  loading: boolean;
  error?: string;
  emptyIcon?: ReactNode;
};

const PreviewPanel = ({ preview, loading, error }: PreviewPanelProps) => {
  if (loading) {
    return (
      <Skeleton
        active
        className={styles.previewState}
        paragraph={{ rows: 6 }}
      />
    );
  }
  if (error) {
    return (
      <Alert
        className={styles.previewState}
        description={error}
        message="无法生成预览"
        showIcon
        type="error"
      />
    );
  }
  if (!preview) {
    return (
      <Empty
        className={styles.previewState}
        description="生成后会在这里显示 RSS 标题和条目"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  return (
    <div className={styles.previewResult}>
      <div className={styles.previewFeedHeader}>
        <div>
          <Title level={5}>{preview.title || '未命名 Feed'}</Title>
          {preview.description && (
            <Paragraph type="secondary">{preview.description}</Paragraph>
          )}
        </div>
        <Tag color="success">{preview.items.length} 条</Tag>
      </div>
      <List
        dataSource={preview.items.slice(0, 20)}
        locale={{ emptyText: '抓取成功，但没有提取到条目' }}
        renderItem={(item) => (
          <List.Item>
            <List.Item.Meta
              description={
                <Space direction="vertical" size={3}>
                  <Space size={6} wrap>
                    {item.author && <Text type="secondary">{item.author}</Text>}
                    {(item.published_at || item.date) && (
                      <Text type="secondary">
                        {dayjs(item.published_at || item.date).isValid()
                          ? dayjs(item.published_at || item.date).format(
                              'YYYY-MM-DD HH:mm',
                            )
                          : item.published_at || item.date}
                      </Text>
                    )}
                    {item.categories?.map((category) => (
                      <Tag key={category}>{category}</Tag>
                    ))}
                  </Space>
                  {(item.description || item.content) && (
                    <Text
                      className={styles.previewDescription}
                      type="secondary"
                    >
                      {item.description || item.content}
                    </Text>
                  )}
                </Space>
              }
              title={
                item.link ? (
                  <Link href={item.link} rel="noreferrer" target="_blank">
                    {item.title || '无标题'}
                  </Link>
                ) : (
                  item.title || '无标题'
                )
              }
            />
          </List.Item>
        )}
      />
    </div>
  );
};

export default PreviewPanel;
