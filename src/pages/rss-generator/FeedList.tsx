import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  KeyOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Empty,
  Popconfirm,
  Skeleton,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import type { RSSGeneratorFeed } from '@/services/film-fusion';
import styles from './index.module.less';

const { Paragraph, Text, Title } = Typography;

type FeedListProps = {
  feeds: RSSGeneratorFeed[];
  loading: boolean;
  onCreate: () => void;
  onDelete: (feed: RSSGeneratorFeed) => void;
  onEdit: (feed: RSSGeneratorFeed) => void;
  onPreview: (feed: RSSGeneratorFeed) => void;
  onReload: () => void;
  onTokens: (feed: RSSGeneratorFeed) => void;
  onToggle: (feed: RSSGeneratorFeed, enabled: boolean) => void;
  togglingId?: number;
};

const modeLabel: Record<RSSGeneratorFeed['route_kind'], string> = {
  http_json: 'JSON API',
  http_html: 'HTML',
  browser: '浏览器',
};

const FeedList = ({
  feeds,
  loading,
  onCreate,
  onDelete,
  onEdit,
  onPreview,
  onReload,
  onTokens,
  onToggle,
  togglingId,
}: FeedListProps) => {
  if (loading && feeds.length === 0) {
    return (
      <div className={styles.feedGrid}>
        {[1, 2, 3].map((item) => (
          <Card key={item}>
            <Skeleton active paragraph={{ rows: 4 }} />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className={styles.listShell}>
      <div className={styles.listToolbar}>
        <div>
          <Title level={4}>Feed 路由</Title>
          <Text type="secondary">从网页或 API 生成可授权对外使用的 RSS。</Text>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={onReload}
          >
            刷新
          </Button>
          <Button icon={<PlusOutlined />} onClick={onCreate} type="primary">
            创建 Feed
          </Button>
        </Space>
      </div>

      {feeds.length === 0 ? (
        <Card className={styles.emptyCard}>
          <Empty description="还没有 RSS 生成路由">
            <Button icon={<PlusOutlined />} onClick={onCreate} type="primary">
              创建第一个 Feed
            </Button>
          </Empty>
        </Card>
      ) : (
        <div className={styles.feedGrid}>
          {feeds.map((feed) => (
            <Card
              actions={[
                <Button
                  aria-label={`预览 ${feed.name}`}
                  className={styles.cardAction}
                  icon={<EyeOutlined />}
                  key="preview"
                  onClick={() => onPreview(feed)}
                  type="text"
                >
                  预览
                </Button>,
                <Button
                  aria-label={`管理订阅 ${feed.name}`}
                  className={styles.cardAction}
                  icon={<KeyOutlined />}
                  key="tokens"
                  onClick={() => onTokens(feed)}
                  type="text"
                >
                  订阅
                </Button>,
                <Button
                  aria-label={`编辑 ${feed.name}`}
                  className={styles.cardAction}
                  icon={<EditOutlined />}
                  key="edit"
                  onClick={() => onEdit(feed)}
                  type="text"
                >
                  编辑
                </Button>,
              ]}
              className={styles.feedCard}
              key={feed.id}
            >
              <div className={styles.feedHeading}>
                <div className={styles.feedTitle}>
                  <Title level={5}>{feed.name}</Title>
                  <Space size={5} wrap>
                    <Tag
                      color={feed.route_kind === 'browser' ? 'purple' : 'blue'}
                    >
                      {modeLabel[feed.route_kind]}
                    </Tag>
                    {feed.browser_fallback && feed.route_kind !== 'browser' && (
                      <Tag color="geekblue">浏览器回退</Tag>
                    )}
                  </Space>
                </div>
                <Tooltip
                  title={feed.enabled ? '停用后公开订阅不可用' : '启用 Feed'}
                >
                  <Switch
                    aria-label={`${feed.enabled ? '停用' : '启用'} ${feed.name}`}
                    checked={feed.enabled}
                    loading={togglingId === feed.id}
                    onChange={(checked) => onToggle(feed, checked)}
                  />
                </Tooltip>
              </div>

              <Paragraph
                className={styles.sourceURL}
                copyable
                ellipsis={{ rows: 2 }}
              >
                {feed.source_url_template}
              </Paragraph>

              <div className={styles.feedFacts}>
                <span>
                  <Text type="secondary">路由标识</Text>
                  <Text code>/{feed.slug}</Text>
                </span>
                <span>
                  <Text type="secondary">缓存</Text>
                  <Text>{feed.cache_ttl_seconds}s</Text>
                </span>
                <span>
                  <Text type="secondary">Token</Text>
                  <Text>{feed.token_count ?? '-'}</Text>
                </span>
              </div>

              {feed.last_error && (
                <Alert
                  className={styles.feedError}
                  message={feed.last_error}
                  showIcon
                  type="error"
                />
              )}

              <div className={styles.cardFooter}>
                <Text type="secondary">
                  更新于{' '}
                  {dayjs(feed.updated_at).isValid()
                    ? dayjs(feed.updated_at).format('YYYY-MM-DD HH:mm')
                    : '-'}
                </Text>
                <Popconfirm
                  description="现有订阅 Token 也将失效，此操作不可撤销。"
                  okButtonProps={{ danger: true }}
                  okText="删除"
                  onConfirm={() => onDelete(feed)}
                  title={`删除「${feed.name}」？`}
                >
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    size="small"
                    type="text"
                  >
                    删除
                  </Button>
                </Popconfirm>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default FeedList;
