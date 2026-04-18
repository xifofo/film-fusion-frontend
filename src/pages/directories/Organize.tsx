import {
  ArrowLeftOutlined,
  ExportOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProDescriptions, ProTable } from '@ant-design/pro-components';
import { history, useParams, useRequest } from '@umijs/max';
import {
  Alert,
  Breadcrumb,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Modal,
  Result,
  Row,
  Space,
  Spin,
  Switch,
  Tabs,
  Tag,
  Tooltip,
  Tree,
  Typography,
  message,
} from 'antd';
import type { DataNode } from 'antd/es/tree';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  get115CookieDirs,
  getCloudDirectoryDetail,
  organize115Cookie,
} from '@/services/film-fusion';

const ROOT_KEY = '0';
const PAGE_LIMIT = 1150;

type TreeItemMeta = {
  name: string;
  parentKey: string;
};

type OrganizeItem = NonNullable<API.Organize115CookieResult['items']>[number];
type OrganizeDirDebug = NonNullable<API.Organize115CookieResult['dir_debug']>[number];

const TV_MEDIA_TYPES = new Set(['tv', 'tvshow', 'series', '电视剧', '剧集', '动漫', '动画', '动画番剧', '番剧']);

function buildTmdbUrl(tmdbId?: string, mediaType?: string): string | undefined {
  const id = (tmdbId || '').trim();
  if (!id) return undefined;
  const type = (mediaType || '').trim().toLowerCase();
  const isTv = TV_MEDIA_TYPES.has(type);
  return `https://www.themoviedb.org/${isTv ? 'tv' : 'movie'}/${id}`;
}

function updateTreeData(list: DataNode[], key: string, children: DataNode[]): DataNode[] {
  return list.map((node) => {
    if (node.key === key) {
      return { ...node, children };
    }
    if (node.children) {
      return { ...node, children: updateTreeData(node.children, key, children) };
    }
    return node;
  });
}

function markLeaf(list: DataNode[], key: string): DataNode[] {
  return list.map((node) => {
    if (node.key === key) {
      return { ...node, isLeaf: true };
    }
    if (node.children) {
      return { ...node, children: markLeaf(node.children, key) };
    }
    return node;
  });
}

const renderBoolTag = (value?: boolean) => (
  <Tag color={value ? 'green' : 'default'}>{value ? '是' : '否'}</Tag>
);

const renderMissingDirs = (value?: string[] | string) => {
  if (Array.isArray(value)) {
    return value.length ? value.join(' / ') : '-';
  }
  if (typeof value === 'string') {
    return value || '-';
  }
  return '-';
};

const OrganizePage: React.FC = () => {
  const params = useParams<{ id: string }>();
  const directoryId = Number(params.id);

  const [messageApi, contextHolder] = message.useMessage();
  const [modalApi, modalContextHolder] = Modal.useModal();

  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [nodeMeta, setNodeMeta] = useState<Map<string, TreeItemMeta>>(new Map());
  const [rootLoading, setRootLoading] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>();
  const [keyword, setKeyword] = useState('');

  const [dryRun, setDryRun] = useState(true);
  const [resultData, setResultData] = useState<API.Organize115CookieResult>();
  const [rawResponse, setRawResponse] = useState<unknown>();

  const {
    data: directoryDetail,
    loading: directoryLoading,
    error: directoryError,
    refresh: refreshDirectory,
  } = useRequest(
    () => {
      if (!Number.isFinite(directoryId) || directoryId <= 0) {
        return Promise.reject(new Error('目录配置 ID 无效'));
      }
      return getCloudDirectoryDetail(directoryId);
    },
    {
      refreshDeps: [directoryId],
      formatResult: (res) => res.data,
    },
  );

  const cloudStorageId = directoryDetail?.cloud_storage_id;

  const registerMeta = useCallback(
    (entries: Array<{ key: string; name: string; parentKey: string }>) => {
      setNodeMeta((prev) => {
        const next = new Map(prev);
        entries.forEach(({ key, name, parentKey }) => {
          next.set(key, { name, parentKey });
        });
        return next;
      });
    },
    [],
  );

  const loadChildren = useCallback(
    async (parentKey: string) => {
      if (!cloudStorageId) return { success: false, count: 0 };
      try {
        const res = await get115CookieDirs({
          cloud_storage_id: cloudStorageId,
          cid: parentKey,
          offset: 0,
          limit: PAGE_LIMIT,
        });
        if (res.code !== 0) {
          messageApi.error(res.message || '获取目录失败');
          return { success: false, count: 0 };
        }
        const items = res.data?.items || [];
        const children: DataNode[] = items.map((item) => ({
          key: item.file_id,
          title: item.name,
          isLeaf: false,
          icon: <FolderOutlined />,
        }));
        registerMeta(
          items.map((item) => ({
            key: item.file_id,
            name: item.name,
            parentKey,
          })),
        );
        if (parentKey === ROOT_KEY) {
          setTreeData(children);
        } else if (children.length === 0) {
          setTreeData((prev) => markLeaf(prev, parentKey));
        } else {
          setTreeData((prev) => updateTreeData(prev, parentKey, children));
        }
        return { success: true, count: children.length };
      } catch (err: any) {
        messageApi.error(err?.message || '获取目录失败');
        return { success: false, count: 0 };
      }
    },
    [cloudStorageId, messageApi, registerMeta],
  );

  useEffect(() => {
    if (!cloudStorageId) return;
    setTreeData([]);
    setNodeMeta(new Map());
    setSelectedKey(undefined);
    setExpandedKeys([]);
    setResultData(undefined);
    setRawResponse(undefined);
    setRootLoading(true);
    loadChildren(ROOT_KEY).finally(() => setRootLoading(false));
  }, [cloudStorageId, loadChildren]);

  const onLoadData = useCallback(
    async (node: DataNode) => {
      await loadChildren(String(node.key));
    },
    [loadChildren],
  );

  const selectedPath = useMemo(() => {
    if (!selectedKey) return [] as { key: string; name: string }[];
    const path: { key: string; name: string }[] = [];
    let cursor: string | undefined = selectedKey;
    const guard = new Set<string>();
    while (cursor && cursor !== ROOT_KEY && !guard.has(cursor)) {
      guard.add(cursor);
      const meta = nodeMeta.get(cursor);
      if (!meta) break;
      path.unshift({ key: cursor, name: meta.name });
      cursor = meta.parentKey;
    }
    return path;
  }, [selectedKey, nodeMeta]);

  const filteredTreeData = useMemo(() => {
    const keyWord = keyword.trim().toLowerCase();
    if (!keyWord) return treeData;
    const filter = (nodes: DataNode[]): DataNode[] => {
      const result: DataNode[] = [];
      nodes.forEach((node) => {
        const title = String(node.title ?? '').toLowerCase();
        const matched = title.includes(keyWord);
        const children = node.children ? filter(node.children) : undefined;
        if (matched || (children && children.length > 0)) {
          result.push({ ...node, children });
        }
      });
      return result;
    };
    return filter(treeData);
  }, [keyword, treeData]);

  const { run: runOrganize, loading: organizeLoading } = useRequest(organize115Cookie, {
    manual: true,
    onSuccess: (result) => {
      const response = result as any;
      const payload: API.Organize115CookieResult =
        response && typeof response === 'object' && 'data' in response && 'code' in response
          ? response.data
          : response;
      const total = payload?.total;
      const suffix = typeof total === 'number' ? `，共 ${total} 项` : '';
      const text = response?.message || '整理完成';
      messageApi.success(`${text}${suffix}${payload?.dry_run ? '（演练）' : ''}`);
      if (payload?.dry_run) {
        setResultData(payload);
        setRawResponse(response);
      } else {
        setResultData(undefined);
        setRawResponse(undefined);
      }
    },
    onError: (error: any) => {
      messageApi.error(error?.message || '整理失败，请重试');
    },
  });

  const triggerOrganize = useCallback(
    (mode: 'dry' | 'apply') => {
      if (!selectedKey) {
        messageApi.warning('请先在左侧选择 115 目录');
        return;
      }
      if (mode === 'apply') {
        modalApi.confirm({
          title: '确认整理？',
          content: '将对该 115 目录执行真实整理（创建/重命名/移动/字幕下载），请确认。',
          okText: '执行整理',
          okButtonProps: { danger: true },
          cancelText: '取消',
          onOk: () =>
            runOrganize({
              cloud_directory_id: directoryId,
              folder_id: selectedKey,
              dry_run: false,
            }),
        });
        return;
      }
      runOrganize({
        cloud_directory_id: directoryId,
        folder_id: selectedKey,
        dry_run: true,
      });
    },
    [directoryId, messageApi, modalApi, runOrganize, selectedKey],
  );

  const itemColumns = useMemo<ProColumns<OrganizeItem>[]>(
    () => [
      {
        title: '文件 ID',
        dataIndex: 'file_id',
        width: 160,
        ellipsis: true,
      },
      {
        title: '文件名',
        dataIndex: 'file_name',
        width: 240,
        ellipsis: true,
        render: (_, row) => (
          <Tooltip title={row.file_name}>
            <span>{row.file_name}</span>
          </Tooltip>
        ),
      },
      {
        title: 'Pickcode',
        dataIndex: 'pickcode',
        width: 140,
        ellipsis: true,
      },
      {
        title: '类型',
        dataIndex: 'media_type',
        width: 80,
      },
      {
        title: '分类',
        dataIndex: 'category',
        width: 120,
        ellipsis: true,
      },
      {
        title: 'TMDB',
        dataIndex: 'tmdb_id',
        width: 110,
        render: (_, row) => {
          const url = buildTmdbUrl(row.tmdb_id, row.media_type);
          if (!url) return <span style={{ color: 'rgba(0,0,0,0.25)' }}>-</span>;
          return (
            <Tooltip title={`在 TMDB 打开：${url}`}>
              <Typography.Link href={url} target="_blank" rel="noopener noreferrer">
                {row.tmdb_id} <ExportOutlined />
              </Typography.Link>
            </Tooltip>
          );
        },
      },
      {
        title: '标题年份',
        dataIndex: 'title_year',
        width: 160,
        ellipsis: true,
      },
      {
        title: '转名',
        dataIndex: 'transfer_name',
        width: 200,
        ellipsis: true,
        render: (_, row) => (
          <Tooltip title={row.transfer_name}>
            <span>{row.transfer_name}</span>
          </Tooltip>
        ),
      },
      {
        title: '目标路径',
        dataIndex: 'target_path',
        width: 260,
        ellipsis: true,
        render: (_, row) => (
          <Tooltip title={row.target_path}>
            <span>{row.target_path}</span>
          </Tooltip>
        ),
      },
      {
        title: '重命名为',
        dataIndex: 'rename_to',
        width: 180,
        ellipsis: true,
      },
      {
        title: '目标目录 ID',
        dataIndex: 'target_dir_id',
        width: 160,
        ellipsis: true,
      },
      {
        title: '需创建',
        dataIndex: 'need_create',
        width: 100,
        render: (_, row) => renderBoolTag(row.need_create),
      },
      {
        title: '缺失目录',
        dataIndex: 'missing_dirs',
        width: 200,
        render: (_, row) => renderMissingDirs(row.missing_dirs),
      },
      {
        title: 'STRM 路径',
        dataIndex: 'strm_path',
        width: 260,
        ellipsis: true,
        render: (_, row) => (
          <Tooltip title={row.strm_path}>
            <span>{row.strm_path}</span>
          </Tooltip>
        ),
      },
      {
        title: '字幕入队',
        dataIndex: 'subtitle_queued',
        width: 100,
        render: (_, row) => renderBoolTag(row.subtitle_queued),
      },
      {
        title: '字幕错误',
        dataIndex: 'subtitle_error',
        width: 200,
        ellipsis: true,
      },
    ],
    [],
  );

  const dirDebugColumns = useMemo<ProColumns<OrganizeDirDebug>[]>(
    () => [
      {
        title: '目标目录',
        dataIndex: 'target_dir',
        width: 240,
        ellipsis: true,
        render: (_, row) => (
          <Tooltip title={row.target_dir}>
            <span>{row.target_dir}</span>
          </Tooltip>
        ),
      },
      {
        title: '已存在目录',
        dataIndex: 'existing_dir',
        width: 220,
        ellipsis: true,
      },
      {
        title: '已存在 ID',
        dataIndex: 'existing_id',
        width: 180,
        ellipsis: true,
      },
      {
        title: '缺失目录',
        dataIndex: 'missing_dirs',
        width: 200,
        render: (_, row) => renderMissingDirs(row.missing_dirs),
      },
      {
        title: '需创建',
        dataIndex: 'need_create',
        width: 100,
        render: (_, row) => renderBoolTag(row.need_create),
      },
      {
        title: '最终 ID',
        dataIndex: 'final_id',
        width: 180,
        ellipsis: true,
      },
      {
        title: '查找记录',
        dataIndex: 'lookups',
        width: 240,
        render: (_, row) =>
          row.lookups?.length ? (
            <Tooltip title={row.lookups.map((item) => `${item.path} => ${item.id}`).join('\n')}>
              <span>{row.lookups.length} 条</span>
            </Tooltip>
          ) : (
            '-'
          ),
      },
    ],
    [],
  );

  if (directoryError) {
    return (
      <PageContainer
        header={{
          title: '整理目录',
          onBack: () => history.push('/directories'),
        }}
      >
        <Result
          status="error"
          title="加载目录配置失败"
          subTitle={(directoryError as Error)?.message || '请返回列表重试'}
          extra={[
            <Button key="back" onClick={() => history.push('/directories')}>
              返回列表
            </Button>,
            <Button key="retry" type="primary" onClick={() => refreshDirectory()}>
              重试
            </Button>,
          ]}
        />
      </PageContainer>
    );
  }

  const headerExtra = directoryDetail ? (
    <Space size={8} wrap>
      <Tag color="blue">{directoryDetail.cloud_storage?.storage_name || `存储 #${cloudStorageId}`}</Tag>
      {directoryDetail.cloud_storage?.storage_type ? (
        <Tag color="geekblue">{directoryDetail.cloud_storage.storage_type}</Tag>
      ) : null}
      <Tag>目录 ID: {directoryDetail.directory_id}</Tag>
    </Space>
  ) : null;

  return (
    <PageContainer
      loading={directoryLoading && !directoryDetail}
      header={{
        title: `整理目录：${directoryDetail?.directory_name || ''}`,
        onBack: () => history.push('/directories'),
        backIcon: <ArrowLeftOutlined />,
        extra: headerExtra,
        breadcrumb: {
          routes: [
            { path: '/directories', breadcrumbName: '目录配置' },
            { path: '', breadcrumbName: '整理' },
          ],
        },
      }}
    >
      {contextHolder}
      {modalContextHolder}

      {directoryDetail ? (
        <ProDescriptions<API.CloudDirectory>
          column={3}
          dataSource={directoryDetail}
          style={{ marginBottom: 16 }}
          columns={[
            { title: '目录名称', dataIndex: 'directory_name' },
            { title: '云存储', render: () => directoryDetail.cloud_storage?.storage_name || '-' },
            { title: '保存路径', dataIndex: 'save_path', copyable: true },
            { title: '内容前缀', dataIndex: 'content_prefix', copyable: true },
            { title: '按分类', render: () => renderBoolTag(directoryDetail.classify_by_category) },
            { title: 'URI 编码', render: () => renderBoolTag(directoryDetail.content_encode_uri) },
          ]}
        />
      ) : null}

      <Row gutter={16} style={{ alignItems: 'stretch' }}>
        <Col xs={24} md={9} lg={8} xl={7}>
          <Card
            title={
              <Space>
                <FolderOpenOutlined />
                <span>115 目录</span>
              </Space>
            }
            size="small"
            styles={{ body: { padding: 12 } }}
            extra={
              <Tooltip title="刷新根目录">
                <Button
                  size="small"
                  type="text"
                  icon={<ReloadOutlined />}
                  loading={rootLoading}
                  onClick={() => {
                    setTreeData([]);
                    setNodeMeta(new Map());
                    setSelectedKey(undefined);
                    setExpandedKeys([]);
                    setRootLoading(true);
                    loadChildren(ROOT_KEY).finally(() => setRootLoading(false));
                  }}
                />
              </Tooltip>
            }
          >
            <Input.Search
              allowClear
              placeholder="搜索已加载目录"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              style={{ marginBottom: 12 }}
            />
            <Spin spinning={rootLoading}>
              {filteredTreeData.length === 0 && !rootLoading ? (
                <Empty description="暂无目录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <Tree
                  showIcon
                  blockNode
                  treeData={filteredTreeData}
                  loadData={onLoadData}
                  expandedKeys={expandedKeys}
                  onExpand={(keys) => setExpandedKeys(keys)}
                  selectedKeys={selectedKey ? [selectedKey] : []}
                  onSelect={(keys) => {
                    const key = keys[0];
                    setSelectedKey(key ? String(key) : undefined);
                  }}
                  style={{ maxHeight: 'calc(100vh - 360px)', overflow: 'auto' }}
                />
              )}
            </Spin>
          </Card>
        </Col>

        <Col xs={24} md={15} lg={16} xl={17}>
          <Card
            size="small"
            title={
              <Space size={8} wrap>
                <span style={{ color: 'rgba(0,0,0,0.45)' }}>当前选中：</span>
                {selectedPath.length > 0 ? (
                  <Breadcrumb
                    items={selectedPath.map((item) => ({ title: item.name }))}
                  />
                ) : (
                  <Typography.Text type="secondary">请选择 115 目录</Typography.Text>
                )}
              </Space>
            }
            extra={
              <Space size={8} wrap>
                <span>
                  演练模式：
                  <Switch
                    checked={dryRun}
                    checkedChildren="是"
                    unCheckedChildren="否"
                    onChange={(checked) => setDryRun(checked)}
                    style={{ marginLeft: 4 }}
                  />
                </span>
                <Button
                  icon={<PlayCircleOutlined />}
                  onClick={() => triggerOrganize('dry')}
                  loading={organizeLoading && dryRun}
                  disabled={!selectedKey}
                >
                  预览整理
                </Button>
                <Button
                  type="primary"
                  danger
                  icon={<ThunderboltOutlined />}
                  onClick={() => triggerOrganize('apply')}
                  loading={organizeLoading && !dryRun}
                  disabled={!selectedKey}
                >
                  确认整理
                </Button>
              </Space>
            }
          >
            {!resultData ? (
              <Alert
                type="info"
                showIcon
                message="尚未整理"
                description="在左侧选择一个 115 目录后，点击“预览整理”查看结果；确认无误后点击“确认整理”执行。"
              />
            ) : (
              <>
                <ProDescriptions<API.Organize115CookieResult>
                  column={4}
                  dataSource={resultData}
                  style={{ marginBottom: 12 }}
                  columns={[
                    { title: '目录配置 ID', dataIndex: 'cloud_directory_id' },
                    { title: '云存储 ID', dataIndex: 'cloud_storage_id' },
                    { title: '目录 ID', dataIndex: 'folder_id' },
                    { title: '总数', dataIndex: 'total' },
                    {
                      title: '演练模式',
                      render: () => renderBoolTag(resultData.dry_run),
                    },
                  ]}
                />

                <Tabs
                  items={[
                    {
                      key: 'items',
                      label: `处理明细 (${resultData.items?.length || 0})`,
                      children: (
                        <ProTable
                          rowKey="file_id"
                          search={false}
                          options={false}
                          pagination={{ pageSize: 10, showSizeChanger: true }}
                          scroll={{ x: 'max-content', y: 420 }}
                          dataSource={resultData.items || []}
                          columns={itemColumns}
                          expandable={{
                            expandedRowRender: (row) => (
                              <Typography.Paragraph style={{ margin: 0 }}>
                                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                                  {JSON.stringify(row, null, 2)}
                                </pre>
                              </Typography.Paragraph>
                            ),
                          }}
                        />
                      ),
                    },
                    {
                      key: 'dir-debug',
                      label: `目录调试 (${resultData.dir_debug?.length || 0})`,
                      children: (
                        <ProTable
                          rowKey={(row) => row.target_dir}
                          search={false}
                          options={false}
                          pagination={{ pageSize: 10, showSizeChanger: true }}
                          scroll={{ x: 'max-content', y: 420 }}
                          dataSource={resultData.dir_debug || []}
                          columns={dirDebugColumns}
                          expandable={{
                            expandedRowRender: (row) => (
                              <Typography.Paragraph style={{ margin: 0 }}>
                                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                                  {JSON.stringify(row, null, 2)}
                                </pre>
                              </Typography.Paragraph>
                            ),
                          }}
                        />
                      ),
                    },
                    {
                      key: 'raw',
                      label: '原始响应',
                      children: (
                        <Typography.Paragraph style={{ margin: 0 }}>
                          <pre
                            style={{
                              margin: 0,
                              whiteSpace: 'pre-wrap',
                              maxHeight: 480,
                              overflow: 'auto',
                            }}
                          >
                            {JSON.stringify(rawResponse ?? resultData ?? {}, null, 2)}
                          </pre>
                        </Typography.Paragraph>
                      ),
                    },
                  ]}
                />
              </>
            )}
          </Card>
        </Col>
      </Row>
    </PageContainer>
  );
};

export default OrganizePage;
