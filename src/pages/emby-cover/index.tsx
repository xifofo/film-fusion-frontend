import {
  batchGenerateEmbyCovers,
  listEmbyCoverLibraries,
  listEmbyCoverTemplates,
} from '@/services/film-fusion';
import {
  CloudUploadOutlined,
  EditOutlined,
  EyeOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { useRequest } from '@umijs/max';
import {
  Alert,
  Button,
  Modal,
  Popconfirm,
  Space,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import React, { useMemo, useRef, useState } from 'react';
import EditConfigForm from './components/EditConfigForm';
import PreviewModal from './components/PreviewModal';

const { Text } = Typography;

/** 媒体库类型标签 */
const collectionTypeTag = (t: string) => {
  const map: Record<string, { color: string; label: string }> = {
    movies: { color: 'blue', label: '电影' },
    tvshows: { color: 'purple', label: '剧集' },
    boxsets: { color: 'geekblue', label: '合集' },
    music: { color: 'cyan', label: '音乐' },
    homevideos: { color: 'gold', label: '家庭视频' },
    mixed: { color: 'default', label: '混合' },
  };
  const item = map[t] || { color: 'default', label: t || '未知' };
  return <Tag color={item.color}>{item.label}</Tag>;
};

const EmbyCoverPage: React.FC = () => {
  const actionRef = useRef<ActionType | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRow, setPreviewRow] = useState<API.EmbyCoverLibraryView>();

  // 模板列表（全局拉一次）
  const { data: templates = [] } = useRequest(listEmbyCoverTemplates, {
    formatResult: (res) => res?.data || [],
  });

  const templateMap = useMemo(() => {
    const m: Record<string, string> = {};
    templates.forEach((t) => (m[t.id] = t.name));
    return m;
  }, [templates]);

  // 批量生成
  const { run: batchRun, loading: batchLoading } = useRequest(batchGenerateEmbyCovers, {
    manual: true,
    onSuccess: (res) => {
      // umi useRequest 默认已解到内层 data（{ success, failed, errors }）
      if (!res) {
        message.success('批量任务完成');
      } else {
        const { success, failed, errors } = res as {
          success: number;
          failed: number;
          errors: string[];
        };
        if (failed === 0) {
          message.success(`批量生成完成：成功 ${success}`);
        } else {
          Modal.warning({
            title: `批量生成完成（成功 ${success} / 失败 ${failed}）`,
            width: 640,
            content: (
              <div style={{ maxHeight: 320, overflow: 'auto' }}>
                {errors?.length ? (
                  errors.map((e: string, i: number) => (
                    <div key={i} style={{ marginBottom: 4 }}>
                      <Text type="danger">· {e}</Text>
                    </div>
                  ))
                ) : (
                  <Text type="secondary">无详细错误信息</Text>
                )}
              </div>
            ),
          });
        }
      }
      actionRef.current?.reload?.();
    },
    onError: (e) => {
      message.error(e?.message || '批量生成失败');
    },
  });

  const openPreview = (row: API.EmbyCoverLibraryView) => {
    setPreviewRow(row);
    setPreviewOpen(true);
  };

  const columns: ProColumns<API.EmbyCoverLibraryView>[] = [
    {
      title: 'Emby ID',
      dataIndex: 'emby_library_id',
      width: 90,
      search: false,
      render: (_, r) => <Text type="secondary">{r.emby_library_id}</Text>,
    },
    {
      title: '媒体库',
      dataIndex: 'emby_name',
      width: 180,
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Text strong>{r.emby_name}</Text>
          {collectionTypeTag(r.collection_type)}
        </Space>
      ),
    },
    {
      title: '中文主标',
      dataIndex: 'cn_title',
      width: 140,
      render: (_, r) =>
        r.cn_title ? (
          <Text>{r.cn_title}</Text>
        ) : (
          <Tooltip title="未配置，将使用 Emby 库名">
            <Text type="secondary">{r.emby_name}</Text>
          </Tooltip>
        ),
    },
    {
      title: '英文副标',
      dataIndex: 'en_subtitle',
      width: 140,
      render: (_, r) => r.en_subtitle || <Text type="secondary">—</Text>,
    },
    {
      title: '模板',
      dataIndex: 'template_id',
      width: 180,
      render: (_, r) => (
        <Tag color="geekblue">{templateMap[r.template_id] || r.template_id}</Tag>
      ),
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      width: 80,
      render: (_, r) =>
        r.enabled ? <Tag color="green">启用</Tag> : <Tag color="default">禁用</Tag>,
    },
    {
      title: '上次生成',
      dataIndex: 'last_generated_at',
      width: 160,
      valueType: 'dateTime',
      search: false,
      render: (_, r) =>
        r.last_generated_at ? (
          <Text>{new Date(r.last_generated_at).toLocaleString()}</Text>
        ) : (
          <Text type="secondary">未生成</Text>
        ),
    },
    {
      title: '最近错误',
      dataIndex: 'last_error',
      width: 200,
      search: false,
      ellipsis: true,
      render: (_, r) =>
        r.last_error ? (
          <Tooltip title={r.last_error}>
            <Text type="danger" ellipsis>
              {r.last_error}
            </Text>
          </Tooltip>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: '操作',
      valueType: 'option',
      width: 220,
      fixed: 'right',
      render: (_, record) => [
        <Button
          key="preview"
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => openPreview(record)}
        >
          预览
        </Button>,
        <EditConfigForm
          key="edit"
          record={record}
          templates={templates}
          trigger={
            <Button type="link" size="small" icon={<EditOutlined />}>
              编辑
            </Button>
          }
          onSuccess={() => actionRef.current?.reload?.()}
        />,
      ],
    },
  ];

  return (
    <PageContainer
      header={{
        title: 'Emby 媒体库封面生成',
        subTitle: '根据媒体库内的最新海报，自动合成带中英文标题的封面图并上传到 Emby',
      }}
    >
      <Alert
        type="info"
        showIcon
        closable
        style={{ marginBottom: 16 }}
        message="使用说明"
        description={
          <div>
            <div>1. 列表展示 Emby 后台所有媒体库；点「编辑」配置中英文标题和模板。</div>
            <div>2. 点「预览」会用最新海报合成一张大图但不上传；确认效果好后在预览页点「上传到 Emby」。</div>
            <div>
              3. 点右上「批量生成」会为所有<Text code>启用</Text>的媒体库生成并上传封面，用于一次更新全部。
            </div>
            <div>4. 可在后端 <Text code>emby.cover.cron</Text> 配置定时任务自动执行批量生成。</div>
          </div>
        }
      />

      <ProTable<API.EmbyCoverLibraryView>
        headerTitle="媒体库列表"
        actionRef={actionRef}
        rowKey="emby_library_id"
        search={false}
        pagination={false}
        scroll={{ x: 'max-content' }}
        options={{
          reload: true,
          density: false,
          setting: false,
        }}
        toolBarRender={() => [
          <Popconfirm
            key="batch"
            title="批量生成所有启用的媒体库封面？"
            description="将用最新海报为所有启用的库生成并上传，过程可能持续几十秒到几分钟。"
            okText="开始"
            cancelText="取消"
            onConfirm={() => batchRun()}
            okButtonProps={{ loading: batchLoading }}
          >
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              loading={batchLoading}
            >
              批量生成
            </Button>
          </Popconfirm>,
        ]}
        request={async () => {
          const resp = await listEmbyCoverLibraries();
          return {
            data: resp.data || [],
            success: resp.code === 0,
            total: resp.data?.length || 0,
          };
        }}
        columns={columns}
      />

      <PreviewModal
        open={previewOpen}
        record={previewRow}
        onClose={() => setPreviewOpen(false)}
        onUploaded={() => actionRef.current?.reload?.()}
      />
    </PageContainer>
  );
};

export default EmbyCoverPage;
