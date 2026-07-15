import {
  BranchesOutlined,
  DesktopOutlined,
  FileSearchOutlined,
  FolderOpenOutlined,
  ReloadOutlined,
  VideoCameraOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { useRequest } from '@umijs/max';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  message,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React, { useEffect, useMemo, useState } from 'react';
import { getCloudPaths, scanEmbyVersionCheck } from '@/services/film-fusion';

const { Text, Title } = Typography;

const cardStyle: React.CSSProperties = {
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)',
};

const formatBytes = (value?: number) => {
  const size = Number(value || 0);
  if (size <= 0) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let current = size;
  let unitIndex = 0;
  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024;
    unitIndex += 1;
  }
  return `${current.toFixed(current >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const formatDateTime = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const formatEpisode = (item: API.EmbyVersionDuplicateItem) => {
  if (item.media_type !== 'episode') return '';
  const season = String(item.season || 0).padStart(2, '0');
  const episode = String(item.episode || 0).padStart(2, '0');
  return `S${season}E${episode}`;
};

const cloudPathLabel = (path: API.CloudPath) => {
  const storage = path.cloud_storage?.storage_name;
  const source = path.source_path || `映射 #${path.id}`;
  return storage
    ? `#${path.id} ${storage} / ${source}`
    : `#${path.id} ${source}`;
};

const SummaryTile: React.FC<{
  title: string;
  value: number;
  suffix?: string;
  icon: React.ReactNode;
  tone: 'blue' | 'green' | 'orange' | 'slate';
}> = ({ title, value, suffix, icon, tone }) => {
  const palette = {
    blue: ['#eff6ff', '#2563eb'],
    green: ['#ecfdf5', '#059669'],
    orange: ['#fff7ed', '#ea580c'],
    slate: ['#f8fafc', '#475569'],
  }[tone];

  return (
    <Card
      variant="borderless"
      style={cardStyle}
      styles={{ body: { padding: 18 } }}
    >
      <Space
        align="center"
        style={{ justifyContent: 'space-between', width: '100%' }}
      >
        <Space direction="vertical" size={2}>
          <Text type="secondary">{title}</Text>
          <Title
            level={3}
            style={{ margin: 0, fontVariantNumeric: 'tabular-nums' }}
          >
            {value.toLocaleString()}
            {suffix && (
              <Text type="secondary" style={{ marginLeft: 6, fontSize: 13 }}>
                {suffix}
              </Text>
            )}
          </Title>
        </Space>
        <span
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: palette[0],
            color: palette[1],
            fontSize: 20,
          }}
        >
          {icon}
        </span>
      </Space>
    </Card>
  );
};

const fileColumns: ColumnsType<API.EmbyVersionFile> = [
  {
    title: '文件',
    dataIndex: 'relative_path',
    ellipsis: true,
    render: (_, file) => (
      <Space direction="vertical" size={0} style={{ maxWidth: 560 }}>
        <Typography.Text copyable ellipsis={{ tooltip: file.relative_path }}>
          {file.relative_path}
        </Typography.Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          映射 #{file.cloud_path_id}
          {file.storage_name ? ` / ${file.storage_name}` : ''}
        </Text>
      </Space>
    ),
  },
  {
    title: '版本',
    dataIndex: 'version_signature',
    width: 180,
    render: (value: string, file) => (
      <Space size={4} wrap>
        <Tag color="blue">{value || file.extension || '-'}</Tag>
        {typeof file.version_score === 'number' && file.version_score > 0 && (
          <Tag color="green">{file.version_score}</Tag>
        )}
      </Space>
    ),
  },
  {
    title: '大小',
    dataIndex: 'file_size',
    width: 100,
    align: 'right',
    render: (value: number) => formatBytes(value),
  },
  {
    title: '修改时间',
    dataIndex: 'modified_at',
    width: 180,
    render: (value: string) => formatDateTime(value),
  },
];

const EmbyVersionCheckPage: React.FC = () => {
  const [messageApi, contextHolder] = message.useMessage();
  const [mediaType, setMediaType] =
    useState<API.EmbyVersionCheckMediaType>('all');
  const [selectedPathIds, setSelectedPathIds] = useState<number[]>([]);
  const [selectionReady, setSelectionReady] = useState(false);
  const [result, setResult] = useState<API.EmbyVersionCheckResult>();

  const {
    data: cloudPathPage,
    loading: cloudPathLoading,
    refresh: refreshCloudPaths,
  } = useRequest(
    () =>
      getCloudPaths({
        page: 1,
        page_size: 500,
        order_by: 'id',
        order_dir: 'asc',
      }),
    {
      formatResult: (res) => res?.data,
    },
  );

  const cloudPaths = useMemo(
    () => (cloudPathPage?.list || []).filter((item) => item.local_path),
    [cloudPathPage?.list],
  );

  useEffect(() => {
    if (selectionReady || cloudPaths.length === 0) {
      return;
    }
    setSelectedPathIds(cloudPaths.map((item) => item.id));
    setSelectionReady(true);
  }, [cloudPaths, selectionReady]);

  const { run: runScan, loading: scanLoading } = useRequest(
    scanEmbyVersionCheck,
    {
      manual: true,
      formatResult: (res) => res?.data,
      onSuccess: (data) => {
        setResult(data);
        messageApi.success('检查完成');
      },
      onError: (error) => {
        messageApi.error(error?.message || '检查失败');
      },
    },
  );

  const pathOptions = useMemo(
    () =>
      cloudPaths.map((path) => ({
        label: cloudPathLabel(path),
        value: path.id,
        title: path.local_path || path.source_path,
      })),
    [cloudPaths],
  );

  const itemColumns: ColumnsType<API.EmbyVersionDuplicateItem> = [
    {
      title: '媒体',
      dataIndex: 'title',
      render: (_, item) => (
        <Space direction="vertical" size={2} style={{ minWidth: 0 }}>
          <Space size={6} wrap>
            <Tag color={item.media_type === 'movie' ? 'blue' : 'geekblue'}>
              {item.media_type === 'movie' ? '电影' : '剧集'}
            </Tag>
            {item.media_type === 'episode' && (
              <Tag color="purple">{formatEpisode(item)}</Tag>
            )}
            {item.tmdb_id && <Tag>TMDB {item.tmdb_id}</Tag>}
          </Space>
          <Text strong ellipsis={{ tooltip: item.title }}>
            {item.title || '-'}
          </Text>
        </Space>
      ),
    },
    {
      title: '版本数',
      dataIndex: 'version_count',
      width: 100,
      align: 'right',
      render: (value: number) => <Text strong>{value}</Text>,
    },
    {
      title: '版本标签',
      dataIndex: 'version_labels',
      render: (labels?: string[]) => (
        <Space size={4} wrap>
          {(labels || []).slice(0, 6).map((label) => (
            <Tag key={label} color="cyan">
              {label}
            </Tag>
          ))}
          {(labels || []).length > 6 && <Tag>+{(labels || []).length - 6}</Tag>}
        </Space>
      ),
    },
    {
      title: '映射',
      dataIndex: 'cloud_path_ids',
      width: 150,
      render: (ids?: number[]) => (
        <Space size={4} wrap>
          {(ids || []).map((id) => (
            <Tag key={id}>#{id}</Tag>
          ))}
        </Space>
      ),
    },
  ];

  const scanDisabled = selectedPathIds.length === 0 || cloudPathLoading;

  const handleScan = async () => {
    if (selectedPathIds.length === 0) {
      messageApi.warning('请选择云路径映射');
      return;
    }
    await runScan({
      cloud_path_ids: selectedPathIds,
      media_type: mediaType,
    });
  };

  const handleSelectAll = () => {
    setSelectedPathIds(cloudPaths.map((item) => item.id));
  };

  const items = result?.items || [];

  return (
    <PageContainer
      header={{
        title: '本地多版本检查',
        subTitle: '电影与剧集单集版本巡检',
        extra: [
          <Button
            key="reload"
            icon={<ReloadOutlined />}
            loading={cloudPathLoading}
            onClick={refreshCloudPaths}
          >
            刷新映射
          </Button>,
          <Button
            key="scan"
            type="primary"
            icon={<FileSearchOutlined />}
            loading={scanLoading}
            disabled={scanDisabled}
            onClick={handleScan}
          >
            开始检查
          </Button>,
        ],
      }}
    >
      {contextHolder}

      <Card variant="borderless" style={{ ...cardStyle, marginBottom: 16 }}>
        <Space size={12} wrap style={{ width: '100%' }}>
          <Segmented
            value={mediaType}
            onChange={(value) =>
              setMediaType(value as API.EmbyVersionCheckMediaType)
            }
            options={[
              { label: '全部', value: 'all' },
              { label: '电影', value: 'movie' },
              { label: '剧集', value: 'tv' },
            ]}
          />
          <Select
            mode="multiple"
            allowClear
            showSearch
            optionFilterProp="label"
            maxTagCount="responsive"
            placeholder="选择云路径映射"
            value={selectedPathIds}
            options={pathOptions}
            loading={cloudPathLoading}
            onChange={setSelectedPathIds}
            style={{ minWidth: 360, flex: 1 }}
          />
          <Button icon={<FolderOpenOutlined />} onClick={handleSelectAll}>
            全选
          </Button>
        </Space>
      </Card>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={6}>
          <SummaryTile
            title="已扫文件"
            value={result?.total_files || 0}
            suffix="个"
            tone="slate"
            icon={<FileSearchOutlined />}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <SummaryTile
            title="电影多版本"
            value={result?.duplicate_movie_count || 0}
            suffix="部"
            tone="blue"
            icon={<VideoCameraOutlined />}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <SummaryTile
            title="单集多版本"
            value={result?.duplicate_episode_count || 0}
            suffix="集"
            tone="green"
            icon={<DesktopOutlined />}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <SummaryTile
            title="扫描映射"
            value={result?.scanned_paths?.length || selectedPathIds.length}
            suffix="条"
            tone="orange"
            icon={<BranchesOutlined />}
          />
        </Col>
      </Row>

      {result?.errors && result.errors.length > 0 && (
        <Alert
          showIcon
          type="warning"
          style={{ marginBottom: 16 }}
          icon={<WarningOutlined />}
          message={`有 ${result.errors.length} 条扫描提示`}
          description={
            <Space direction="vertical" size={2}>
              {result.errors.slice(0, 8).map((item) => (
                <Text key={item} type="warning">
                  {item}
                </Text>
              ))}
              {result.errors.length > 8 && (
                <Text type="secondary">还有 {result.errors.length - 8} 条</Text>
              )}
            </Space>
          }
        />
      )}

      <Spin spinning={scanLoading}>
        <Card
          variant="borderless"
          style={cardStyle}
          title={
            <Space>
              <BranchesOutlined />
              <span>多版本结果</span>
            </Space>
          }
          extra={
            result?.scanned_at ? (
              <Tooltip title="服务器扫描完成时间">
                <Text type="secondary">
                  {formatDateTime(result.scanned_at)}
                </Text>
              </Tooltip>
            ) : null
          }
        >
          {items.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={result ? '没有发现多版本内容' : '尚未开始检查'}
            />
          ) : (
            <Table<API.EmbyVersionDuplicateItem>
              rowKey="key"
              columns={itemColumns}
              dataSource={items}
              pagination={{ pageSize: 20, showSizeChanger: true }}
              expandable={{
                expandedRowRender: (record) => (
                  <Table<API.EmbyVersionFile>
                    rowKey={(file) => `${file.cloud_path_id}:${file.path}`}
                    columns={fileColumns}
                    dataSource={record.files || []}
                    pagination={false}
                    size="small"
                  />
                ),
              }}
            />
          )}
        </Card>
      </Spin>
    </PageContainer>
  );
};

export default EmbyVersionCheckPage;
