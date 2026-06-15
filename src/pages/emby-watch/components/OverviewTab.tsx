import {
  Card,
  Col,
  Empty,
  List,
  message,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Tag,
} from 'antd';
import React, { useCallback, useEffect, useState } from 'react';
import { getEmbyWatchSummary } from '@/services/film-fusion';
import { formatMinutes, MonthlyBars, Poster, TypeRatioDonut } from './shared';

type OverviewTabProps = {
  embyUserId: string;
  onSeriesClick?: (seriesId: string, seriesName?: string) => void;
};

const OverviewTab: React.FC<OverviewTabProps> = ({
  embyUserId,
  onSeriesClick,
}) => {
  const [loading, setLoading] = useState(false);
  const [year, setYear] = useState<number>(0);
  const [data, setData] = useState<API.EmbyWatchSummary>();
  const [messageApi, contextHolder] = message.useMessage();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getEmbyWatchSummary({
        emby_user_id: embyUserId,
        year: year || undefined,
      });
      if (res.code === 0) {
        setData(res.data);
      } else {
        messageApi.error(res.message || '获取总览失败');
      }
    } catch (error: any) {
      messageApi.error(error?.message || '获取总览失败');
    } finally {
      setLoading(false);
    }
  }, [embyUserId, year, messageApi]);

  useEffect(() => {
    load();
  }, [load]);

  const yearOptions = [
    { label: '全部', value: 0 },
    ...(data?.years || []).map((y) => ({ label: `${y} 年`, value: y })),
  ];

  return (
    <Spin spinning={loading}>
      {contextHolder}
      <div style={{ marginBottom: 16 }}>
        <span style={{ marginRight: 8 }}>统计范围：</span>
        <Select
          style={{ width: 160 }}
          value={year}
          onChange={setYear}
          options={yearOptions}
        />
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic
              title="看过电影"
              value={data?.movie_count ?? 0}
              suffix="部"
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic
              title="看过剧集"
              value={data?.episode_count ?? 0}
              suffix="集"
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic
              title="涉及剧目"
              value={data?.series_count ?? 0}
              suffix="部"
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card>
            <Statistic
              title="活跃天数"
              value={data?.active_days ?? 0}
              suffix="天"
            />
          </Card>
        </Col>
        <Col xs={24} sm={16} md={8}>
          <Card>
            <Statistic
              title="观看时长"
              value={formatMinutes(data?.total_minutes)}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} md={12}>
          <Card title="观看最多的剧集 Top 10">
            {data?.top_series && data.top_series.length > 0 ? (
              <List
                size="small"
                dataSource={data.top_series}
                renderItem={(item, idx) => (
                  <List.Item
                    style={{ cursor: onSeriesClick ? 'pointer' : 'default' }}
                    onClick={() =>
                      onSeriesClick?.(item.series_id, item.series_name)
                    }
                  >
                    <Space>
                      <Tag color={idx < 3 ? 'gold' : 'default'}>{idx + 1}</Tag>
                      <Poster itemId={item.series_id} width={34} height={50} />
                      <a>{item.series_name || item.series_id}</a>
                    </Space>
                    <Tag color="blue">{item.episode_count} 集</Tag>
                  </List.Item>
                )}
              />
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无数据"
              />
            )}
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="电影 / 剧集 占比">
            <TypeRatioDonut
              movie={data?.movie_count ?? 0}
              episode={data?.episode_count ?? 0}
            />
          </Card>
          <Card title="月度观看趋势" style={{ marginTop: 16 }}>
            <MonthlyBars data={data?.monthly || []} />
          </Card>
        </Col>
      </Row>
    </Spin>
  );
};

export default OverviewTab;
