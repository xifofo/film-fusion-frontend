import {
  EnvironmentOutlined,
  ReloadOutlined,
  ScanOutlined,
  SettingOutlined,
  StopOutlined,
} from '@ant-design/icons';
import {
  ModalForm,
  PageContainer,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
} from '@ant-design/pro-components';
import {
  Alert,
  Button,
  Card,
  Col,
  Modal,
  message,
  Popconfirm,
  Row,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  addEmbyMissingBlacklist,
  getEmbyMissing,
  getEmbyMissingBlacklist,
  getEmbyMissingLibraries,
  removeEmbyMissingBlacklist,
  resolveEmbyMissingCloudPath,
  scanEmbyMissing,
  updateEmbyMissingSetting,
} from '@/services/film-fusion';
import RegenerateStrmModal from './components/RegenerateStrmModal';

const { Text } = Typography;

const POLL_MS = 3000;

const fmtEp = (s: number, e: number) =>
  `S${String(s).padStart(2, '0')}E${String(e).padStart(2, '0')}`;

const fmtDate = (v?: string) => {
  if (!v) return '-';
  const d = dayjs(v);
  return d.isValid() ? d.format('YYYY-MM-DD') : v;
};

const fmtDateTime = (v?: string | null) => {
  if (!v) return '-';
  const d = dayjs(v);
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm:ss') : v;
};

const EmbyMissingPage: React.FC = () => {
  const [data, setData] = useState<API.EmbyMissingListResult>();
  const [loading, setLoading] = useState(false);
  const [blacklistOpen, setBlacklistOpen] = useState(false);
  const [blacklist, setBlacklist] = useState<API.EmbyMissingBlacklist[]>([]);
  const [pathModal, setPathModal] = useState<{
    open: boolean;
    loading: boolean;
    seriesName: string;
    embyPath: string;
    matched: boolean;
    cloudDir: string;
    storageName: string;
  }>({
    open: false,
    loading: false,
    seriesName: '',
    embyPath: '',
    matched: false,
    cloudDir: '',
    storageName: '',
  });
  const [messageApi, contextHolder] = message.useMessage();
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getEmbyMissing();
      if (res.code === 0) {
        setData(res.data);
      }
    } catch (error: any) {
      messageApi.error(error?.message || '获取缺集列表失败');
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  useEffect(() => {
    load();
  }, [load]);

  // 扫描进行中时轮询刷新
  useEffect(() => {
    if (data?.setting?.scanning) {
      timerRef.current = setTimeout(load, POLL_MS);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [data?.setting?.scanning, load]);

  const handleScan = async () => {
    try {
      const res = await scanEmbyMissing();
      if (res.code === 0) {
        messageApi.success('扫描已开始');
        load();
      } else {
        messageApi.error(res.message || '触发扫描失败');
      }
    } catch (error: any) {
      messageApi.error(error?.message || '触发扫描失败');
    }
  };

  const handleAddBlacklist = async (record: API.EmbyMissingSeriesGroup) => {
    try {
      const res = await addEmbyMissingBlacklist({
        series_id: record.series_id,
        series_name: record.series_name,
      });
      if (res.code === 0) {
        messageApi.success('已加入黑名单并从列表移除');
        load();
      } else {
        messageApi.error(res.message || '加入黑名单失败');
      }
    } catch (error: any) {
      messageApi.error(error?.message || '加入黑名单失败');
    }
  };

  const handleViewPath = async (record: API.EmbyMissingSeriesGroup) => {
    setPathModal({
      open: true,
      loading: true,
      seriesName: record.series_name,
      embyPath: '',
      matched: false,
      cloudDir: '',
      storageName: '',
    });
    try {
      const res = await resolveEmbyMissingCloudPath({
        series_id: record.series_id,
      });
      if (res.code === 0 && res.data) {
        const data = res.data;
        const matchedOpt = (data.options || []).find(
          (o) => o.id === data.cloud_path_id,
        );
        setPathModal((s) => ({
          ...s,
          loading: false,
          embyPath: data.emby_path || '',
          matched: !!data.matched,
          cloudDir: data.cloud_dir || '',
          storageName:
            matchedOpt?.storage_name ||
            (matchedOpt ? `存储#${matchedOpt.cloud_storage_id}` : ''),
        }));
      } else {
        messageApi.error(res.message || '获取位置失败');
        setPathModal((s) => ({ ...s, loading: false }));
      }
    } catch (error: any) {
      messageApi.error(error?.message || '获取位置失败');
      setPathModal((s) => ({ ...s, loading: false }));
    }
  };

  const openBlacklist = async () => {
    setBlacklistOpen(true);
    try {
      const res = await getEmbyMissingBlacklist();
      if (res.code === 0) setBlacklist(res.data || []);
    } catch (error: any) {
      messageApi.error(error?.message || '获取黑名单失败');
    }
  };

  const handleRemoveBlacklist = async (id: number) => {
    try {
      const res = await removeEmbyMissingBlacklist(id);
      if (res.code === 0) {
        messageApi.success('已移除，下次扫描重新纳入');
        const list = await getEmbyMissingBlacklist();
        if (list.code === 0) setBlacklist(list.data || []);
      } else {
        messageApi.error(res.message || '移除失败');
      }
    } catch (error: any) {
      messageApi.error(error?.message || '移除失败');
    }
  };

  const setting = data?.setting;
  const scanning = !!setting?.scanning;

  const columns: ColumnsType<API.EmbyMissingSeriesGroup> = [
    {
      title: '剧名',
      dataIndex: 'series_name',
      ellipsis: true,
      render: (v: string) => <Text strong>{v || '-'}</Text>,
    },
    {
      title: '媒体库',
      dataIndex: 'library_name',
      width: 160,
      ellipsis: true,
      render: (v: string) => <Tag color="geekblue">{v || '-'}</Tag>,
    },
    {
      title: '缺集数',
      dataIndex: 'missing_count',
      width: 100,
      sorter: (a, b) => a.missing_count - b.missing_count,
      render: (v: number) => <Tag color="red">{v}</Tag>,
    },
    {
      title: '缺失明细',
      key: 'preview',
      render: (_, record) => {
        const items = record.episodes || [];
        const head = items
          .slice(0, 8)
          .map((e) => fmtEp(e.season_number, e.episode_number));
        return (
          <Space size={[4, 4]} wrap>
            {head.map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
            {items.length > 8 && (
              <Text type="secondary">等 {items.length} 集</Text>
            )}
          </Space>
        );
      },
    },
    {
      title: '操作',
      key: 'option',
      width: 320,
      render: (_, record) => (
        <Space size={0} wrap>
          <Button
            type="link"
            size="small"
            icon={<EnvironmentOutlined />}
            onClick={() => handleViewPath(record)}
          >
            查看位置
          </Button>
          <RegenerateStrmModal record={record} />
          <Popconfirm
            title="加入黑名单后将跳过该剧的缺集检查"
            onConfirm={() => handleAddBlacklist(record)}
          >
            <Button type="link" size="small" danger icon={<StopOutlined />}>
              加入黑名单
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const episodeColumns: ColumnsType<API.EmbyMissingEpisode> = [
    {
      title: '剧集',
      key: 'ep',
      width: 120,
      render: (_, e) => fmtEp(e.season_number, e.episode_number),
    },
    {
      title: '集名',
      dataIndex: 'episode_name',
      ellipsis: true,
      render: (v) => v || '-',
    },
    {
      title: '首播日期',
      dataIndex: 'premiere_date',
      width: 140,
      render: (v) => fmtDate(v),
    },
  ];

  return (
    <PageContainer header={{ title: '缺集扫描' }}>
      {contextHolder}
      <Alert
        style={{ marginBottom: 16 }}
        type="info"
        showIcon
        message="基于 Emby /Shows/Missing 扫描电视剧缺失的剧集。可手动或定时扫描，结果会持久化；把某部剧加入黑名单后将跳过它的缺集检查。"
      />

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col xs={12} sm={6}>
            <Statistic
              title="缺集剧数"
              value={setting?.last_series_count ?? 0}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title="缺集总数"
              value={setting?.last_missing_count ?? 0}
            />
          </Col>
          <Col xs={24} sm={6}>
            <div className="ant-statistic">
              <div className="ant-statistic-title">最近扫描</div>
              <div style={{ fontSize: 16 }}>
                {fmtDateTime(setting?.last_scan_at)}
              </div>
            </div>
            {setting?.last_status === 'failed' && (
              <Text type="danger" style={{ fontSize: 12 }}>
                失败：{setting?.last_error}
              </Text>
            )}
          </Col>
          <Col xs={24} sm={6}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Space wrap>
                <Tag color={setting?.schedule_enabled ? 'green' : 'default'}>
                  定时
                  {setting?.schedule_enabled ? `开启 ${setting?.cron}` : '关闭'}
                </Tag>
                {scanning && <Tag color="processing">扫描中…</Tag>}
              </Space>
            </Space>
          </Col>
        </Row>
        <Space style={{ marginTop: 16 }} wrap>
          <Button
            type="primary"
            icon={<ScanOutlined />}
            loading={scanning}
            onClick={handleScan}
          >
            {scanning ? '扫描中…' : '立即扫描'}
          </Button>
          <Button icon={<ReloadOutlined />} onClick={load}>
            刷新
          </Button>
          <ScheduleSettingForm setting={setting} onSaved={load} />
          <Button icon={<StopOutlined />} onClick={openBlacklist}>
            黑名单管理
          </Button>
        </Space>
      </Card>

      <Table<API.EmbyMissingSeriesGroup>
        rowKey="series_id"
        loading={loading}
        columns={columns}
        dataSource={data?.groups || []}
        pagination={{ pageSize: 20, showSizeChanger: true }}
        expandable={{
          expandedRowRender: (record) => (
            <Table<API.EmbyMissingEpisode>
              size="small"
              rowKey={(e) =>
                `${record.series_id}-${e.season_number}-${e.episode_number}`
              }
              columns={episodeColumns}
              dataSource={record.episodes || []}
              pagination={false}
            />
          ),
        }}
      />

      <Modal
        title={`剧集位置 - ${pathModal.seriesName || ''}`}
        open={pathModal.open}
        onCancel={() => setPathModal((s) => ({ ...s, open: false }))}
        footer={null}
        width={640}
      >
        <Spin spinning={pathModal.loading}>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Emby 本地路径（媒体服务器视角）：
            </Text>
            <div style={{ marginTop: 4, marginBottom: 16 }}>
              {pathModal.loading ? (
                <Text type="secondary">加载中…</Text>
              ) : (
                <Text
                  code
                  copyable={
                    pathModal.embyPath ? { text: pathModal.embyPath } : false
                  }
                >
                  {pathModal.embyPath || '未获取到路径（可能为虚拟/合集条目）'}
                </Text>
              )}
            </div>

            <Text type="secondary" style={{ fontSize: 12 }}>
              反推云端目录
              {pathModal.storageName ? `（${pathModal.storageName}）` : ''}：
            </Text>
            <div style={{ marginTop: 4 }}>
              {pathModal.loading ? (
                <Text type="secondary">加载中…</Text>
              ) : pathModal.matched && pathModal.cloudDir ? (
                <Text code copyable={{ text: pathModal.cloudDir }}>
                  {pathModal.cloudDir}
                </Text>
              ) : (
                <Text type="warning">
                  未匹配到云路径映射（无法反推云端目录）
                </Text>
              )}
            </div>
          </div>
        </Spin>
      </Modal>

      <Modal
        title="缺集检查黑名单"
        open={blacklistOpen}
        onCancel={() => setBlacklistOpen(false)}
        footer={null}
        width={680}
      >
        <Table<API.EmbyMissingBlacklist>
          rowKey="id"
          size="small"
          dataSource={blacklist}
          pagination={false}
          columns={[
            {
              title: '剧名',
              dataIndex: 'series_name',
              render: (v) => v || '-',
            },
            {
              title: '剧集ID',
              dataIndex: 'series_id',
              width: 220,
              ellipsis: true,
            },
            { title: '备注', dataIndex: 'remark', render: (v) => v || '-' },
            {
              title: '操作',
              key: 'option',
              width: 90,
              render: (_, record) => (
                <Popconfirm
                  title="移除后下次扫描会重新纳入"
                  onConfirm={() => handleRemoveBlacklist(record.id)}
                >
                  <Button type="link" size="small" danger>
                    移除
                  </Button>
                </Popconfirm>
              ),
            },
          ]}
        />
      </Modal>
    </PageContainer>
  );
};

type ScheduleSettingFormProps = {
  setting?: API.EmbyMissingSetting;
  onSaved: () => void;
};

const ScheduleSettingForm: React.FC<ScheduleSettingFormProps> = ({
  setting,
  onSaved,
}) => {
  const [messageApi, contextHolder] = message.useMessage();
  return (
    <>
      {contextHolder}
      <ModalForm
        title="定时扫描设置"
        width={520}
        trigger={<Button icon={<SettingOutlined />}>定时设置</Button>}
        modalProps={{ destroyOnClose: true }}
        initialValues={{
          schedule_enabled: setting?.schedule_enabled ?? false,
          cron: setting?.cron ?? '0 4 * * *',
          library_id: setting?.library_id || '',
          include_specials: setting?.include_specials ?? false,
          include_unaired: setting?.include_unaired ?? false,
        }}
        onFinish={async (values) => {
          try {
            const res = await updateEmbyMissingSetting({
              schedule_enabled: values.schedule_enabled,
              cron: values.cron,
              library_id: values.library_id || '',
              include_specials: values.include_specials,
              include_unaired: values.include_unaired,
            });
            if (res.code === 0) {
              messageApi.success('已保存');
              onSaved();
              return true;
            }
            messageApi.error(res.message || '保存失败');
            return false;
          } catch (error: any) {
            messageApi.error(error?.message || '保存失败');
            return false;
          }
        }}
      >
        <ProFormSwitch name="schedule_enabled" label="开启定时扫描" />
        <ProFormText
          name="cron"
          label="cron 表达式"
          placeholder="如 0 4 * * * 每天 4 点；支持 5/6 段"
          tooltip="开启定时后必填。例：0 4 * * * (每天4点)，0 0 */6 * * * (每6小时)"
        />
        <ProFormSelect
          name="library_id"
          label="扫描范围"
          placeholder="默认全部电视剧库"
          allowClear
          fieldProps={{ showSearch: true, optionFilterProp: 'label' }}
          request={async () => {
            const res = await getEmbyMissingLibraries();
            const list = res?.data || [];
            return [
              { label: '全部电视剧库', value: '' },
              ...list.map((l) => ({ label: l.name, value: l.id })),
            ];
          }}
        />
        <ProFormSwitch name="include_specials" label="统计特别篇(Specials)" />
        <ProFormSwitch name="include_unaired" label="统计未播出集" />
      </ModalForm>
    </>
  );
};

export default EmbyMissingPage;
