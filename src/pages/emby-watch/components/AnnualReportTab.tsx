import { ShareAltOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Empty,
  List,
  Modal,
  message,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Tag,
} from 'antd';
import React, { useCallback, useEffect, useState } from 'react';
import {
  embyWatchShareImageUrl,
  getEmbyWatchAnnualReport,
} from '@/services/film-fusion';
import {
  formatMinutes,
  HourlyBars,
  MonthlyBars,
  Poster,
  WeekdayBars,
} from './shared';

type AnnualReportTabProps = {
  embyUserId: string;
  onSeriesClick?: (seriesId: string, seriesName?: string) => void;
};

const AnnualReportTab: React.FC<AnnualReportTabProps> = ({
  embyUserId,
  onSeriesClick,
}) => {
  const [loading, setLoading] = useState(false);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [data, setData] = useState<API.EmbyWatchAnnualReport>();
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [shareError, setShareError] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getEmbyWatchAnnualReport({
        emby_user_id: embyUserId,
        year,
      });
      if (res.code === 0) {
        setData(res.data);
      } else {
        messageApi.error(res.message || '获取年度报告失败');
      }
    } catch (error: any) {
      messageApi.error(error?.message || '获取年度报告失败');
    } finally {
      setLoading(false);
    }
  }, [embyUserId, year, messageApi]);

  useEffect(() => {
    load();
  }, [load]);

  const yearOptions = (
    data?.years && data.years.length > 0 ? data.years : [year]
  ).map((y) => ({ label: `${y} 年`, value: y }));

  const empty = data && data.movie_count === 0 && data.episode_count === 0;

  const openShare = () => {
    setShareError(false);
    setShareUrl(`${embyWatchShareImageUrl(embyUserId, year)}&_t=${Date.now()}`);
    setShareOpen(true);
  };

  return (
    <Spin spinning={loading}>
      {contextHolder}
      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <span>报告年份：</span>
        <Select
          style={{ width: 160 }}
          value={year}
          onChange={setYear}
          options={yearOptions}
        />
        <Button
          type="primary"
          icon={<ShareAltOutlined />}
          onClick={openShare}
          disabled={empty}
        >
          生成分享图
        </Button>
      </div>

      {empty ? (
        <Card>
          <Empty description={`${year} 年暂无观看记录`} />
        </Card>
      ) : (
        <>
          <Card style={{ marginBottom: 16 }}>
            <Row gutter={[16, 16]}>
              <Col xs={12} md={6}>
                <Statistic
                  title="全年观看时长"
                  value={formatMinutes(data?.total_minutes)}
                />
              </Col>
              <Col xs={12} md={6}>
                <Statistic
                  title="活跃天数"
                  value={data?.active_days ?? 0}
                  suffix="天"
                />
              </Col>
              <Col xs={12} md={6}>
                <Statistic
                  title="看过电影"
                  value={data?.movie_count ?? 0}
                  suffix="部"
                />
              </Col>
              <Col xs={12} md={6}>
                <Statistic
                  title="看过剧集"
                  value={data?.episode_count ?? 0}
                  suffix="集"
                />
              </Col>
            </Row>
            <Row gutter={[16, 16]} style={{ marginTop: 8 }}>
              <Col xs={12} md={6}>
                <Statistic
                  title="涉及剧目"
                  value={data?.series_count ?? 0}
                  suffix="部"
                />
              </Col>
              <Col xs={12} md={6}>
                <Statistic
                  title="活跃日均"
                  value={data?.avg_minutes_per_day ?? 0}
                  suffix="分/天"
                />
              </Col>
              <Col xs={12} md={6}>
                <Statistic
                  title="最长连续观看"
                  value={data?.longest_streak ?? 0}
                  suffix="天"
                />
              </Col>
              <Col xs={12} md={6}>
                <div className="ant-statistic">
                  <div className="ant-statistic-title">最忙的一天</div>
                  <div style={{ fontSize: 20 }}>
                    {data?.busiest_day?.date || '-'}
                    {data?.busiest_day?.total ? (
                      <Tag color="red" style={{ marginLeft: 8 }}>
                        {data.busiest_day.total} 次
                      </Tag>
                    ) : null}
                  </div>
                </div>
              </Col>
            </Row>
            <Row gutter={[16, 16]} style={{ marginTop: 8 }}>
              <Col xs={12} md={6}>
                <div className="ant-statistic">
                  <div className="ant-statistic-title">首次观看</div>
                  <div style={{ fontSize: 20 }}>{data?.first_watch || '-'}</div>
                </div>
              </Col>
              <Col xs={12} md={6}>
                <div className="ant-statistic">
                  <div className="ant-statistic-title">最近观看</div>
                  <div style={{ fontSize: 20 }}>{data?.last_watch || '-'}</div>
                </div>
              </Col>
            </Row>
          </Card>

          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Card title="年度最爱剧集 Top 10">
                {data?.top_series && data.top_series.length > 0 ? (
                  <List
                    size="small"
                    dataSource={data.top_series}
                    renderItem={(item, idx) => (
                      <List.Item
                        style={{
                          cursor: onSeriesClick ? 'pointer' : 'default',
                        }}
                        onClick={() =>
                          onSeriesClick?.(item.series_id, item.series_name)
                        }
                      >
                        <Space>
                          <Tag color={idx < 3 ? 'gold' : 'default'}>
                            {idx + 1}
                          </Tag>
                          <Poster
                            itemId={item.series_id}
                            width={34}
                            height={50}
                          />
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
              <Card title="月度观看趋势">
                <MonthlyBars data={data?.monthly || []} />
              </Card>
              <Card title="星期观看分布" style={{ marginTop: 16 }}>
                <WeekdayBars data={data?.weekday || []} />
              </Card>
              <Card title="时段观看分布" style={{ marginTop: 16 }}>
                <HourlyBars data={data?.hourly || []} />
              </Card>
            </Col>
          </Row>
        </>
      )}

      <Modal
        open={shareOpen}
        onCancel={() => setShareOpen(false)}
        title={`${year} 年度观看报告`}
        footer={[
          <Button key="close" onClick={() => setShareOpen(false)}>
            关闭
          </Button>,
          <Button
            key="download"
            type="primary"
            href={shareUrl}
            download={`emby-watch-${year}.png`}
            disabled={shareError}
          >
            下载分享图
          </Button>,
        ]}
        width={420}
      >
        {shareError ? (
          <Empty description="分享图生成失败：请确认后端已配置中文字体(emby.cover.font_cn)" />
        ) : shareUrl ? (
          <img
            src={shareUrl}
            alt="年度报告分享图"
            style={{ width: '100%', borderRadius: 8 }}
            onError={() => setShareError(true)}
          />
        ) : (
          <Empty description="生成中…" />
        )}
      </Modal>
    </Spin>
  );
};

export default AnnualReportTab;
