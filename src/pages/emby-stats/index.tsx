import { getEmbyStats } from '@/services/film-fusion';
import {
  AppstoreOutlined,
  ClockCircleOutlined,
  DesktopOutlined,
  ReloadOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { useRequest } from '@umijs/max';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Progress,
  Row,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import React, { useMemo } from 'react';

const { Text, Title } = Typography;

/** 媒体库类型 → 中文标签 + 颜色 */
const collectionTypeMeta = (t: string): { color: string; label: string } => {
  const map: Record<string, { color: string; label: string }> = {
    movies: { color: 'blue', label: '电影' },
    tvshows: { color: 'purple', label: '剧集' },
    mixed: { color: 'geekblue', label: '混合' },
    homevideos: { color: 'gold', label: '家庭视频' },
    boxsets: { color: 'cyan', label: '合集' },
    music: { color: 'magenta', label: '音乐' },
  };
  return map[t] || { color: 'default', label: t || '未知' };
};

/** 顶部大数字概览卡 —— 渐变背景 + 大号数字 */
const SummaryCard: React.FC<{
  title: string;
  value: number;
  icon: React.ReactNode;
  /** 渐变起始 / 结束色 */
  gradient: [string, string];
  suffix?: string;
}> = ({ title, value, icon, gradient, suffix }) => {
  return (
    <Card
      variant="borderless"
      style={{
        borderRadius: 16,
        overflow: 'hidden',
        background: `linear-gradient(135deg, ${gradient[0]} 0%, ${gradient[1]} 100%)`,
        boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
      }}
      styles={{
        body: {
          padding: '24px 28px',
          color: '#fff',
          position: 'relative',
          minHeight: 132,
        },
      }}
    >
      <div
        style={{
          position: 'absolute',
          right: -20,
          top: -20,
          width: 140,
          height: 140,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.12)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: 22,
          top: 22,
          fontSize: 56,
          color: 'rgba(255,255,255,0.85)',
        }}
      >
        {icon}
      </div>
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div
          style={{
            fontSize: 14,
            opacity: 0.92,
            letterSpacing: 1,
            marginBottom: 12,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 44,
            fontWeight: 700,
            lineHeight: 1.1,
            fontVariantNumeric: 'tabular-nums',
            textShadow: '0 2px 8px rgba(0,0,0,0.12)',
          }}
        >
          {value.toLocaleString()}
          {suffix && (
            <span
              style={{
                fontSize: 16,
                fontWeight: 400,
                marginLeft: 6,
                opacity: 0.85,
              }}
            >
              {suffix}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
};

/** 单个媒体库的明细卡 */
const LibraryCard: React.FC<{
  stat: API.EmbyLibraryStat;
  totalMovies: number;
  totalSeries: number;
}> = ({ stat, totalMovies, totalSeries }) => {
  const meta = collectionTypeMeta(stat.collection_type);
  const total = stat.movie_count + stat.series_count;
  const moviePct = totalMovies > 0 ? (stat.movie_count / totalMovies) * 100 : 0;
  const seriesPct =
    totalSeries > 0 ? (stat.series_count / totalSeries) * 100 : 0;

  return (
    <Card
      hoverable
      variant="borderless"
      style={{
        borderRadius: 14,
        boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
        height: '100%',
      }}
      styles={{ body: { padding: 20 } }}
    >
      <Space
        direction="horizontal"
        align="start"
        style={{ width: '100%', justifyContent: 'space-between' }}
      >
        <Space direction="vertical" size={4} style={{ minWidth: 0 }}>
          <Tooltip title={stat.emby_name}>
            <Title level={5} style={{ margin: 0 }} ellipsis>
              {stat.emby_name}
            </Title>
          </Tooltip>
          <Space size={6}>
            <Tag color={meta.color} style={{ marginRight: 0 }}>
              {meta.label}
            </Tag>
            <Text type="secondary" style={{ fontSize: 12 }}>
              ID {stat.emby_library_id}
            </Text>
          </Space>
        </Space>
        <div
          style={{
            fontSize: 13,
            color: '#8c8c8c',
            textAlign: 'right',
            whiteSpace: 'nowrap',
          }}
        >
          合计 <Text strong>{total.toLocaleString()}</Text>
        </div>
      </Space>

      <Row gutter={12} style={{ marginTop: 16 }}>
        <Col span={12}>
          <div
            style={{
              padding: 12,
              borderRadius: 10,
              background:
                'linear-gradient(135deg, #e6f0ff 0%, #f5faff 100%)',
              border: '1px solid #d6e4ff',
            }}
          >
            <Space size={6} style={{ color: '#1d39c4', fontSize: 12 }}>
              <VideoCameraOutlined />
              <span>电影</span>
            </Space>
            <div
              style={{
                fontSize: 26,
                fontWeight: 700,
                color: '#1d39c4',
                lineHeight: 1.2,
                fontVariantNumeric: 'tabular-nums',
                marginTop: 4,
              }}
            >
              {stat.movie_count.toLocaleString()}
            </div>
            <Progress
              percent={Number(moviePct.toFixed(1))}
              size="small"
              strokeColor="#1d39c4"
              showInfo={false}
              style={{ marginTop: 4, marginBottom: 0 }}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>
              占总电影 {moviePct.toFixed(1)}%
            </Text>
          </div>
        </Col>
        <Col span={12}>
          <div
            style={{
              padding: 12,
              borderRadius: 10,
              background:
                'linear-gradient(135deg, #f5e8ff 0%, #fbf5ff 100%)',
              border: '1px solid #efdbff',
            }}
          >
            <Space size={6} style={{ color: '#722ed1', fontSize: 12 }}>
              <DesktopOutlined />
              <span>电视剧</span>
            </Space>
            <div
              style={{
                fontSize: 26,
                fontWeight: 700,
                color: '#722ed1',
                lineHeight: 1.2,
                fontVariantNumeric: 'tabular-nums',
                marginTop: 4,
              }}
            >
              {stat.series_count.toLocaleString()}
            </div>
            <Progress
              percent={Number(seriesPct.toFixed(1))}
              size="small"
              strokeColor="#722ed1"
              showInfo={false}
              style={{ marginTop: 4, marginBottom: 0 }}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>
              占总剧集 {seriesPct.toFixed(1)}%
            </Text>
          </div>
        </Col>
      </Row>
    </Card>
  );
};

const EmbyStatsPage: React.FC = () => {
  const {
    data,
    loading,
    refresh,
    error,
  } = useRequest(getEmbyStats, {
    formatResult: (res) => res?.data,
  });

  const stats = data as API.EmbyStats | undefined;

  const generatedText = useMemo(() => {
    if (!stats?.generated_at) return '';
    try {
      return new Date(stats.generated_at).toLocaleString();
    } catch {
      return stats.generated_at;
    }
  }, [stats?.generated_at]);

  return (
    <PageContainer
      header={{
        title: 'Emby 媒体统计',
        subTitle: '按媒体库统计电影与电视剧数量',
        extra: [
          <Space key="meta" size={12} align="center">
            {generatedText && (
              <Tooltip title="服务器实时拉取 Emby 计数">
                <Text type="secondary" style={{ fontSize: 12 }}>
                  <ClockCircleOutlined style={{ marginRight: 4 }} />
                  {generatedText}
                </Text>
              </Tooltip>
            )}
            <Button
              key="refresh"
              type="primary"
              icon={<ReloadOutlined />}
              loading={loading}
              onClick={refresh}
            >
              刷新
            </Button>
          </Space>,
        ],
      }}
    >
      {error && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="拉取统计失败"
          description={(error as Error)?.message || '请检查 Emby 服务连通性'}
        />
      )}

      {stats?.partial_errors && stats.partial_errors.length > 0 && (
        <Alert
          type="warning"
          showIcon
          closable
          style={{ marginBottom: 16 }}
          message={`部分媒体库统计失败（${stats.partial_errors.length} 项）`}
          description={
            <div style={{ maxHeight: 160, overflow: 'auto' }}>
              {stats.partial_errors.map((e, i) => (
                <div key={i} style={{ marginBottom: 2 }}>
                  <Text type="warning">· {e}</Text>
                </div>
              ))}
            </div>
          }
        />
      )}

      <Spin spinning={loading && !stats}>
        {/* 顶部三个大数字概览 */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={24} md={8}>
            <SummaryCard
              title="媒体库数量"
              value={stats?.total_libraries || 0}
              suffix="个"
              icon={<AppstoreOutlined />}
              gradient={['#3a7bd5', '#3a6073']}
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <SummaryCard
              title="电影总数"
              value={stats?.total_movies || 0}
              suffix="部"
              icon={<VideoCameraOutlined />}
              gradient={['#2980b9', '#6dd5fa']}
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <SummaryCard
              title="电视剧总数"
              value={stats?.total_series || 0}
              suffix="部"
              icon={<DesktopOutlined />}
              gradient={['#8e2de2', '#c471f5']}
            />
          </Col>
        </Row>

        {/* 各媒体库明细 */}
        <div style={{ marginTop: 24 }}>
          <Space
            align="baseline"
            style={{ marginBottom: 12, justifyContent: 'space-between', width: '100%' }}
          >
            <Title level={5} style={{ margin: 0 }}>
              媒体库明细
            </Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              按内容总量降序排序
            </Text>
          </Space>

          {!loading && (!stats?.libraries || stats.libraries.length === 0) ? (
            <Card variant="borderless" style={{ borderRadius: 14 }}>
              <Empty description="暂无 Emby 媒体库数据" />
            </Card>
          ) : (
            <Row gutter={[16, 16]}>
              {(stats?.libraries || []).map((lib) => (
                <Col key={lib.emby_library_id} xs={24} sm={12} lg={8} xxl={6}>
                  <LibraryCard
                    stat={lib}
                    totalMovies={stats?.total_movies || 0}
                    totalSeries={stats?.total_series || 0}
                  />
                </Col>
              ))}
            </Row>
          )}
        </div>
      </Spin>
    </PageContainer>
  );
};

export default EmbyStatsPage;
