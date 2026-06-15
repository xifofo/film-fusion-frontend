import {
  Badge,
  Calendar,
  Card,
  Col,
  Empty,
  List,
  message,
  Row,
  Space,
  Spin,
  Tag,
} from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useState } from 'react';
import {
  getEmbyWatchCalendar,
  getEmbyWatchRecords,
} from '@/services/film-fusion';
import { Poster } from './shared';

type CalendarTabProps = {
  embyUserId: string;
};

const epLabel = (r: API.EmbyWatchRecord) => {
  if (r.item_type === 'Episode') {
    const s = r.season_number ?? 0;
    const e = r.episode_number ?? 0;
    const code = `S${String(s).padStart(2, '0')}E${String(e).padStart(2, '0')}`;
    return `${r.series_name || ''} ${code}`.trim();
  }
  return r.title;
};

const CalendarTab: React.FC<CalendarTabProps> = ({ embyUserId }) => {
  const [panel, setPanel] = useState<Dayjs>(dayjs());
  const [dayMap, setDayMap] = useState<
    Record<string, API.EmbyWatchCalendarDay>
  >({});
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>();
  const [dayRecords, setDayRecords] = useState<API.EmbyWatchRecord[]>([]);
  const [dayLoading, setDayLoading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const loadMonth = useCallback(
    async (date: Dayjs) => {
      setLoading(true);
      try {
        const res = await getEmbyWatchCalendar({
          emby_user_id: embyUserId,
          year: date.year(),
          month: date.month() + 1,
        });
        if (res.code === 0) {
          const map: Record<string, API.EmbyWatchCalendarDay> = {};
          (res.data || []).forEach((d) => {
            map[d.date] = d;
          });
          setDayMap(map);
        } else {
          messageApi.error(res.message || '获取日历失败');
        }
      } catch (error: any) {
        messageApi.error(error?.message || '获取日历失败');
      } finally {
        setLoading(false);
      }
    },
    [embyUserId, messageApi],
  );

  useEffect(() => {
    loadMonth(panel);
  }, [loadMonth, panel]);

  const loadDay = useCallback(
    async (date: string) => {
      setSelectedDate(date);
      setDayLoading(true);
      try {
        const res = await getEmbyWatchRecords({
          emby_user_id: embyUserId,
          start_date: date,
          end_date: date,
          page: 1,
          page_size: 200,
        });
        if (res.code === 0) {
          setDayRecords(res.data?.list || []);
        } else {
          messageApi.error(res.message || '获取当日记录失败');
        }
      } catch (error: any) {
        messageApi.error(error?.message || '获取当日记录失败');
      } finally {
        setDayLoading(false);
      }
    },
    [embyUserId, messageApi],
  );

  const cellRender = (current: Dayjs, info: { type: string }) => {
    if (info.type !== 'date') return null;
    const key = current.format('YYYY-MM-DD');
    const day = dayMap[key];
    if (!day || day.total <= 0) return null;
    return (
      <div style={{ lineHeight: 1.4 }}>
        {day.movie_count > 0 && (
          <div>
            <Badge color="#1677ff" text={`电影 ${day.movie_count}`} />
          </div>
        )}
        {day.episode_count > 0 && (
          <div>
            <Badge color="#52c41a" text={`剧集 ${day.episode_count}`} />
          </div>
        )}
      </div>
    );
  };

  return (
    <Spin spinning={loading}>
      {contextHolder}
      <Row gutter={16}>
        <Col xs={24} md={16}>
          <Card styles={{ body: { padding: 8 } }}>
            <Calendar
              value={panel}
              onChange={setPanel}
              onPanelChange={setPanel}
              cellRender={cellRender}
              onSelect={(d) => loadDay(d.format('YYYY-MM-DD'))}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card
            title={
              selectedDate ? `${selectedDate} 的观看` : '点击日期查看当日记录'
            }
          >
            <Spin spinning={dayLoading}>
              {dayRecords.length > 0 ? (
                <List
                  size="small"
                  dataSource={dayRecords}
                  renderItem={(r) => (
                    <List.Item>
                      <Space size={8} align="start">
                        <Poster itemId={r.item_id} width={32} height={48} />
                        <Space size={6} wrap>
                          <Tag
                            color={r.item_type === 'Movie' ? 'blue' : 'green'}
                          >
                            {r.item_type === 'Movie' ? '电影' : '剧集'}
                          </Tag>
                          <span>{epLabel(r)}</span>
                        </Space>
                      </Space>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={selectedDate ? '当日无记录' : '尚未选择日期'}
                />
              )}
            </Spin>
          </Card>
        </Col>
      </Row>
    </Spin>
  );
};

export default CalendarTab;
