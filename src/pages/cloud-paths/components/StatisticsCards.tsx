import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic } from 'antd';
import { useRequest } from '@umijs/max';
import { getCloudPathStatistics } from '@/services/film-fusion';

const StatisticsCards: React.FC = () => {
  const [statistics, setStatistics] = useState<API.CloudPathStatistics | null>(null);

  const { run, loading } = useRequest(getCloudPathStatistics, {
    manual: true,
    onSuccess: (data) => {
      setStatistics(data);
    },
  });

  useEffect(() => {
    run();
  }, [run]);

  if (!statistics) {
    return null;
  }

  return (
    <Row gutter={16} style={{ marginBottom: 16 }}>
      <Col span={6}>
        <Card loading={loading}>
          <Statistic
            title="总路径数"
            value={statistics.total_paths}
            valueStyle={{ color: '#1890ff' }}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card loading={loading}>
          <Statistic
            title="STRM路径"
            value={statistics.strm_paths}
            valueStyle={{ color: '#52c41a' }}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card loading={loading}>
          <Statistic
            title="软链接路径"
            value={statistics.symlink_paths}
            valueStyle={{ color: '#722ed1' }}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card loading={loading}>
          <Statistic
            title="存储类型"
            value={statistics.by_storage_type?.length || 0}
            valueStyle={{ color: '#eb2f96' }}
          />
        </Card>
      </Col>
    </Row>
  );
};

export default StatisticsCards;
