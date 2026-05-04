import {
  ArrowLeftOutlined,
  CloseCircleOutlined,
  ExportOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import {
  PageContainer,
  ProDescriptions,
  ProTable,
} from '@ant-design/pro-components';
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
  message,
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
const FILENAME_REGEX_STORAGE_KEY = 'film-fusion.organize.filenameRegex';
const DEFAULT_FILENAME_REGEX_PATTERN = '.* - (.*)';
const DEFAULT_FILENAME_REGEX_REPLACEMENT = '$1';

type FilenameRegexConfig = {
  enabled: boolean;
  pattern: string;
  replacement: string;
};

const defaultFilenameRegexConfig: FilenameRegexConfig = {
  enabled: false,
  pattern: DEFAULT_FILENAME_REGEX_PATTERN,
  replacement: DEFAULT_FILENAME_REGEX_REPLACEMENT,
};

function loadFilenameRegexConfig(): FilenameRegexConfig {
  if (typeof window === 'undefined') {
    return defaultFilenameRegexConfig;
  }
  try {
    const raw = window.localStorage.getItem(FILENAME_REGEX_STORAGE_KEY);
    if (!raw) {
      return defaultFilenameRegexConfig;
    }
    const parsed = JSON.parse(raw) as Partial<FilenameRegexConfig>;
    return {
      enabled: !!parsed.enabled,
      pattern:
        typeof parsed.pattern === 'string'
          ? parsed.pattern
          : DEFAULT_FILENAME_REGEX_PATTERN,
      replacement:
        typeof parsed.replacement === 'string'
          ? parsed.replacement
          : DEFAULT_FILENAME_REGEX_REPLACEMENT,
    };
  } catch {
    return defaultFilenameRegexConfig;
  }
}

function saveFilenameRegexConfig(config: FilenameRegexConfig) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(
      FILENAME_REGEX_STORAGE_KEY,
      JSON.stringify(config),
    );
  } catch {
    return;
  }
}

type TreeItemMeta = {
  name: string;
  parentKey: string;
};

type OrganizeItem = NonNullable<API.Organize115CookieResult['items']>[number];
type OrganizeDirDebug = NonNullable<
  API.Organize115CookieResult['dir_debug']
>[number];

type OrganizeItemRow = OrganizeItem & { __folder_id?: string };
type OrganizeDirDebugRow = OrganizeDirDebug & { __folder_id?: string };

function getOrganizeItemRowKey(row: OrganizeItemRow): string {
  return `${row.__folder_id || ''}::${row.file_id}`;
}

function flattenOrganizeItems(
  result?: API.Organize115CookieResult,
): OrganizeItemRow[] {
  const groups = result?.groups;
  if (groups && groups.length > 0) {
    return groups.flatMap((g) =>
      (g.items || []).map((it) => ({ ...it, __folder_id: g.folder_id })),
    );
  }
  return (result?.items || []).map((it) => ({
    ...it,
    __folder_id: result?.folder_id,
  }));
}

const TV_MEDIA_TYPES = new Set([
  'tv',
  'tvshow',
  'series',
  '电视剧',
  '剧集',
  '动漫',
  '动画',
  '动画番剧',
  '番剧',
]);

function buildTmdbUrl(tmdbId?: string, mediaType?: string): string | undefined {
  const id = (tmdbId || '').trim();
  if (!id) return undefined;
  const type = (mediaType || '').trim().toLowerCase();
  const isTv = TV_MEDIA_TYPES.has(type);
  return `https://www.themoviedb.org/${isTv ? 'tv' : 'movie'}/${id}`;
}

function updateTreeData(
  list: DataNode[],
  key: string,
  children: DataNode[],
): DataNode[] {
  return list.map((node) => {
    if (node.key === key) {
      return { ...node, children };
    }
    if (node.children) {
      return {
        ...node,
        children: updateTreeData(node.children, key, children),
      };
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

const renderFileSize = (value?: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return '-';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  const text =
    unitIndex === 0
      ? `${size} ${units[unitIndex]}`
      : `${size.toFixed(size >= 100 ? 0 : size >= 10 ? 1 : 2)} ${
          units[unitIndex]
        }`;
  return (
    <Tooltip title={`${value} B`}>
      <span>{text}</span>
    </Tooltip>
  );
};

const OrganizePage: React.FC = () => {
  const params = useParams<{ id: string }>();
  const directoryId = Number(params.id);

  const [messageApi, contextHolder] = message.useMessage();
  const [modalApi, modalContextHolder] = Modal.useModal();

  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [nodeMeta, setNodeMeta] = useState<Map<string, TreeItemMeta>>(
    new Map(),
  );
  const [rootLoading, setRootLoading] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>();
  const [checkedKeys, setCheckedKeys] = useState<string[]>([]);
  const [keyword, setKeyword] = useState('');
  const [filenameRegexConfig, setFilenameRegexConfig] =
    useState<FilenameRegexConfig>(() => loadFilenameRegexConfig());

  const [dryRun, setDryRun] = useState(true);
  const [resultData, setResultData] = useState<API.Organize115CookieResult>();
  const [rawResponse, setRawResponse] = useState<unknown>();
  const [selectedItemRowKeys, setSelectedItemRowKeys] = useState<React.Key[]>(
    [],
  );

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
    setCheckedKeys([]);
    setExpandedKeys([]);
    setResultData(undefined);
    setRawResponse(undefined);
    setSelectedItemRowKeys([]);
    setRootLoading(true);
    loadChildren(ROOT_KEY).finally(() => setRootLoading(false));
  }, [cloudStorageId, loadChildren]);

  useEffect(() => {
    saveFilenameRegexConfig(filenameRegexConfig);
  }, [filenameRegexConfig]);

  useEffect(() => {
    setResultData(undefined);
    setRawResponse(undefined);
    setSelectedItemRowKeys([]);
  }, [checkedKeys]);

  const updateFilenameRegexConfig = useCallback(
    (patch: Partial<FilenameRegexConfig>) => {
      setFilenameRegexConfig((prev) => ({ ...prev, ...patch }));
    },
    [],
  );

  const onLoadData = useCallback(
    async (node: DataNode) => {
      await loadChildren(String(node.key));
    },
    [loadChildren],
  );

  const buildPathByKey = useCallback(
    (key: string): { key: string; name: string }[] => {
      const path: { key: string; name: string }[] = [];
      let cursor: string | undefined = key;
      const guard = new Set<string>();
      while (cursor && cursor !== ROOT_KEY && !guard.has(cursor)) {
        guard.add(cursor);
        const meta = nodeMeta.get(cursor);
        if (!meta) break;
        path.unshift({ key: cursor, name: meta.name });
        cursor = meta.parentKey;
      }
      return path;
    },
    [nodeMeta],
  );

  const selectedPath = useMemo(
    () => (selectedKey ? buildPathByKey(selectedKey) : []),
    [selectedKey, buildPathByKey],
  );

  const checkedFolders = useMemo(
    () =>
      checkedKeys.map((key) => {
        const path = buildPathByKey(key);
        const label =
          path.length > 0
            ? path.map((p) => p.name).join(' / ')
            : `(未加载 ${key})`;
        return { key, label };
      }),
    [checkedKeys, buildPathByKey],
  );

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

  const { run: runOrganize, loading: organizeLoading } = useRequest(
    organize115Cookie,
    {
      manual: true,
      onSuccess: (result) => {
        const response = result as any;
        const payload: API.Organize115CookieResult =
          response &&
          typeof response === 'object' &&
          'data' in response &&
          'code' in response
            ? response.data
            : response;
        const total = payload?.total;
        const suffix = typeof total === 'number' ? `，共 ${total} 项` : '';
        const text = response?.message || '整理完成';
        messageApi.success(
          `${text}${suffix}${payload?.dry_run ? '（演练）' : ''}`,
        );
        if (payload?.dry_run) {
          setResultData(payload);
          setRawResponse(response);
          setSelectedItemRowKeys(
            flattenOrganizeItems(payload).map(getOrganizeItemRowKey),
          );
        } else {
          setResultData(undefined);
          setRawResponse(undefined);
          setSelectedItemRowKeys([]);
          setCheckedKeys([]);
        }
      },
      onError: (error: any) => {
        messageApi.error(error?.message || '整理失败，请重试');
      },
    },
  );

  const flatItemsForTable = useMemo<OrganizeItemRow[]>(
    () => flattenOrganizeItems(resultData),
    [resultData],
  );

  const selectedItemRowsForApply = useMemo(() => {
    const selectedSet = new Set(selectedItemRowKeys.map((key) => String(key)));
    return flatItemsForTable.filter((row) =>
      selectedSet.has(getOrganizeItemRowKey(row)),
    );
  }, [flatItemsForTable, selectedItemRowKeys]);

  const buildOrganizeParams = useCallback(
    (
      folderIds: string[],
      dryRunValue: boolean,
      fileIds?: string[],
    ): API.Organize115CookieParams | undefined => {
      const pattern = filenameRegexConfig.pattern.trim();
      if (filenameRegexConfig.enabled && !pattern) {
        messageApi.warning('启用文件名处理时，正则不能为空');
        return undefined;
      }
      return {
        cloud_directory_id: directoryId,
        folder_ids: folderIds,
        ...(fileIds && fileIds.length > 0 ? { file_ids: fileIds } : {}),
        dry_run: dryRunValue,
        filename_regex_enabled: filenameRegexConfig.enabled,
        ...(filenameRegexConfig.enabled
          ? {
              filename_regex_pattern: pattern,
              filename_regex_replacement: filenameRegexConfig.replacement,
            }
          : {}),
      };
    },
    [directoryId, filenameRegexConfig, messageApi],
  );

  const triggerOrganize = useCallback(
    (mode: 'dry' | 'apply') => {
      if (mode === 'dry') {
        if (checkedKeys.length === 0) {
          messageApi.warning('请先在左侧勾选至少一个 115 目录');
          return;
        }
        const folderIds = [...checkedKeys];
        const organizeParams = buildOrganizeParams(folderIds, true);
        if (!organizeParams) {
          return;
        }
        runOrganize(organizeParams);
        return;
      }

      if (resultData?.dry_run) {
        if (selectedItemRowsForApply.length === 0) {
          messageApi.warning('请先在处理明细表格中选择至少一条记录');
          return;
        }
        const folderIds = Array.from(
          new Set(
            selectedItemRowsForApply
              .map((row) => row.__folder_id)
              .filter((id): id is string => !!id),
          ),
        );
        const fileIds = Array.from(
          new Set(
            selectedItemRowsForApply
              .map((row) => row.file_id)
              .filter((id): id is string => !!id),
          ),
        );
        if (folderIds.length === 0 || fileIds.length === 0) {
          messageApi.warning('预览结果缺少来源目录或文件 ID，无法按明细整理');
          return;
        }
        const organizeParams = buildOrganizeParams(folderIds, false, fileIds);
        if (!organizeParams) {
          return;
        }
        modalApi.confirm({
          title: `确认整理 ${selectedItemRowsForApply.length} 条处理明细？`,
          content:
            '将只处理当前预览表格中已选择的记录（创建/重命名/移动/字幕下载）。' +
            '单个目录失败不会阻断其它，错误会标注在对应分组上。',
          okText: '执行整理',
          okButtonProps: { danger: true },
          cancelText: '取消',
          onOk: () => runOrganize(organizeParams),
        });
        return;
      }

      if (checkedKeys.length === 0) {
        messageApi.warning('请先在左侧勾选至少一个 115 目录');
        return;
      }
      const folderIds = [...checkedKeys];
      const organizeParams = buildOrganizeParams(folderIds, false);
      if (!organizeParams) {
        return;
      }
      modalApi.confirm({
        title: `确认整理 ${folderIds.length} 个 115 目录？`,
        content:
          '将对这些 115 目录依次执行真实整理（创建/重命名/移动/字幕下载）。' +
          '单个目录失败不会阻断其它，错误会标注在对应分组上。',
        okText: '执行整理',
        okButtonProps: { danger: true },
        cancelText: '取消',
        onOk: () => runOrganize(organizeParams),
      });
    },
    [
      buildOrganizeParams,
      checkedKeys,
      messageApi,
      modalApi,
      resultData?.dry_run,
      runOrganize,
      selectedItemRowsForApply,
    ],
  );

  const itemColumns = useMemo<ProColumns<OrganizeItemRow>[]>(
    () => [
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
              <Typography.Link
                href={url}
                target="_blank"
                rel="noopener noreferrer"
              >
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
        title: '文件大小',
        dataIndex: 'file_size',
        width: 110,
        render: (_, row) => renderFileSize(row.file_size),
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
        title: '识别名',
        dataIndex: 'recognize_name',
        width: 240,
        ellipsis: true,
        render: (_, row) =>
          row.recognize_name ? (
            <Tooltip title={row.recognize_name}>
              <span>{row.recognize_name}</span>
            </Tooltip>
          ) : (
            <span style={{ color: 'rgba(0,0,0,0.25)' }}>-</span>
          ),
      },
      {
        title: 'Pickcode',
        dataIndex: 'pickcode',
        width: 140,
        ellipsis: true,
      },
      {
        title: '本地入库',
        dataIndex: 'local_exists',
        width: 110,
        render: (_, row) => {
          if (!row.local_dir) {
            return <span style={{ color: 'rgba(0,0,0,0.25)' }}>-</span>;
          }
          return (
            <Tooltip title={row.local_dir}>
              <Tag color={row.local_exists ? 'success' : 'default'}>
                {row.local_exists ? '已入库' : '未入库'}
              </Tag>
            </Tooltip>
          );
        },
      },
      {
        title: '来源目录',
        dataIndex: '__folder_id',
        width: 180,
        ellipsis: true,
        render: (_, row) => {
          const fid = row.__folder_id;
          if (!fid) return <span style={{ color: 'rgba(0,0,0,0.25)' }}>-</span>;
          const path = buildPathByKey(fid);
          const label =
            path.length > 0 ? path.map((p) => p.name).join(' / ') : fid;
          return (
            <Tooltip title={`folder_id: ${fid}`}>
              <Tag color="blue">{label}</Tag>
            </Tooltip>
          );
        },
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
    [buildPathByKey],
  );

  const dirDebugColumns = useMemo<ProColumns<OrganizeDirDebugRow>[]>(
    () => [
      {
        title: '来源目录',
        dataIndex: '__folder_id',
        width: 180,
        fixed: 'left',
        ellipsis: true,
        render: (_, row) => {
          const fid = row.__folder_id;
          if (!fid) return <span style={{ color: 'rgba(0,0,0,0.25)' }}>-</span>;
          const path = buildPathByKey(fid);
          const label =
            path.length > 0 ? path.map((p) => p.name).join(' / ') : fid;
          return (
            <Tooltip title={`folder_id: ${fid}`}>
              <Tag color="blue">{label}</Tag>
            </Tooltip>
          );
        },
      },
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
            <Tooltip
              title={row.lookups
                .map((item) => `${item.path} => ${item.id}`)
                .join('\n')}
            >
              <span>{row.lookups.length} 条</span>
            </Tooltip>
          ) : (
            '-'
          ),
      },
    ],
    [buildPathByKey],
  );

  const flatDirDebugForTable = useMemo<OrganizeDirDebugRow[]>(() => {
    const groups = resultData?.groups;
    if (groups && groups.length > 0) {
      return groups.flatMap((g) =>
        (g.dir_debug || []).map((d) => ({ ...d, __folder_id: g.folder_id })),
      );
    }
    return (resultData?.dir_debug as OrganizeDirDebugRow[]) || [];
  }, [resultData]);

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
            <Button
              key="retry"
              type="primary"
              onClick={() => refreshDirectory()}
            >
              重试
            </Button>,
          ]}
        />
      </PageContainer>
    );
  }

  const headerExtra = directoryDetail ? (
    <Space size={8} wrap>
      <Tag color="blue">
        {directoryDetail.cloud_storage?.storage_name ||
          `存储 #${cloudStorageId}`}
      </Tag>
      {directoryDetail.cloud_storage?.storage_type ? (
        <Tag color="geekblue">{directoryDetail.cloud_storage.storage_type}</Tag>
      ) : null}
      <Tag>目录 ID: {directoryDetail.directory_id}</Tag>
    </Space>
  ) : null;
  const hasPreviewResult = !!resultData?.dry_run;
  const applyDisabled = hasPreviewResult
    ? selectedItemRowsForApply.length === 0
    : checkedKeys.length === 0;
  const applyButtonText = hasPreviewResult
    ? `确认整理 (${selectedItemRowsForApply.length}/${flatItemsForTable.length})`
    : `确认整理 (${checkedKeys.length})`;

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
            {
              title: '云存储',
              render: () => directoryDetail.cloud_storage?.storage_name || '-',
            },
            { title: '保存路径', dataIndex: 'save_path', copyable: true },
            { title: '内容前缀', dataIndex: 'content_prefix', copyable: true },
            {
              title: '按分类',
              render: () => renderBoolTag(directoryDetail.classify_by_category),
            },
            {
              title: 'URI 编码',
              render: () => renderBoolTag(directoryDetail.content_encode_uri),
            },
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
                    setCheckedKeys([]);
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
                <Empty
                  description="暂无目录"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ) : (
                <Tree
                  showIcon
                  blockNode
                  checkable
                  checkStrictly
                  treeData={filteredTreeData}
                  loadData={onLoadData}
                  expandedKeys={expandedKeys}
                  onExpand={(keys) => setExpandedKeys(keys)}
                  selectedKeys={selectedKey ? [selectedKey] : []}
                  onSelect={(keys) => {
                    const key = keys[0];
                    setSelectedKey(key ? String(key) : undefined);
                  }}
                  checkedKeys={{ checked: checkedKeys, halfChecked: [] }}
                  onCheck={(checked) => {
                    const next = Array.isArray(checked)
                      ? checked
                      : checked.checked;
                    setCheckedKeys(next.map((k) => String(k)));
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
                <span style={{ color: 'rgba(0,0,0,0.45)' }}>当前查看：</span>
                {selectedPath.length > 0 ? (
                  <Breadcrumb
                    items={selectedPath.map((item) => ({ title: item.name }))}
                  />
                ) : (
                  <Typography.Text type="secondary">
                    点击左侧目录预览路径，勾选 ☑ 多选目录后点击整理
                  </Typography.Text>
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
                  disabled={checkedKeys.length === 0}
                >
                  预览整理 ({checkedKeys.length})
                </Button>
                <Button
                  type="primary"
                  danger
                  icon={<ThunderboltOutlined />}
                  onClick={() => triggerOrganize('apply')}
                  loading={organizeLoading && !dryRun}
                  disabled={applyDisabled}
                >
                  {applyButtonText}
                </Button>
              </Space>
            }
          >
            <Alert
              type={filenameRegexConfig.enabled ? 'warning' : 'info'}
              showIcon={false}
              style={{ marginBottom: 12 }}
              message={
                <Space size={[8, 8]} wrap>
                  <Button
                    size="small"
                    type={filenameRegexConfig.enabled ? 'primary' : 'default'}
                    onClick={() =>
                      updateFilenameRegexConfig({
                        enabled: !filenameRegexConfig.enabled,
                      })
                    }
                  >
                    文件名处理：
                    {filenameRegexConfig.enabled ? '已开启' : '未开启'}
                  </Button>
                  <Input
                    size="small"
                    addonBefore="正则"
                    value={filenameRegexConfig.pattern}
                    onChange={(e) =>
                      updateFilenameRegexConfig({ pattern: e.target.value })
                    }
                    style={{ width: 320 }}
                  />
                  <Input
                    size="small"
                    addonBefore="替换为"
                    value={filenameRegexConfig.replacement}
                    onChange={(e) =>
                      updateFilenameRegexConfig({
                        replacement: e.target.value,
                      })
                    }
                    style={{ width: 200 }}
                  />
                  <Button
                    size="small"
                    onClick={() =>
                      setFilenameRegexConfig((prev) => ({
                        ...prev,
                        pattern: DEFAULT_FILENAME_REGEX_PATTERN,
                        replacement: DEFAULT_FILENAME_REGEX_REPLACEMENT,
                      }))
                    }
                  >
                    恢复默认
                  </Button>
                  <Typography.Text type="secondary">
                    开启后用替换结果调用 MoviePilot 识别/转名。
                  </Typography.Text>
                </Space>
              }
            />

            {checkedFolders.length > 0 ? (
              <Alert
                type="info"
                showIcon={false}
                style={{ marginBottom: 12 }}
                message={
                  <Space size={[4, 4]} wrap>
                    <Typography.Text
                      type="secondary"
                      style={{ marginRight: 4 }}
                    >
                      已勾选 {checkedFolders.length} 个目录：
                    </Typography.Text>
                    {checkedFolders.map((f) => (
                      <Tag
                        key={f.key}
                        closable
                        closeIcon={<CloseCircleOutlined />}
                        onClose={(e) => {
                          e.preventDefault();
                          setCheckedKeys((prev) =>
                            prev.filter((k) => k !== f.key),
                          );
                        }}
                      >
                        <Tooltip title={`folder_id: ${f.key}`}>
                          {f.label}
                        </Tooltip>
                      </Tag>
                    ))}
                    <Button
                      size="small"
                      type="link"
                      onClick={() => setCheckedKeys([])}
                    >
                      清空
                    </Button>
                  </Space>
                }
              />
            ) : null}

            {!resultData ? (
              <Alert
                type="info"
                showIcon
                message="尚未整理"
                description="在左侧勾选一个或多个 115 目录后，点击“预览整理”查看结果；确认无误后点击“确认整理”执行。多个目录会按勾选顺序逐个独立整理，单个失败不影响其它。"
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
                    {
                      title: '整理目录数',
                      render: () =>
                        resultData.groups?.length ??
                        (resultData.folder_id ? 1 : 0),
                    },
                    { title: '文件总数', dataIndex: 'total' },
                    {
                      title: '演练模式',
                      render: () => renderBoolTag(resultData.dry_run),
                    },
                  ]}
                />

                {(() => {
                  const errored = (resultData.groups || []).filter(
                    (g) => !!g?.error,
                  );
                  if (errored.length === 0) return null;
                  return (
                    <Alert
                      type="warning"
                      showIcon
                      icon={<WarningOutlined />}
                      style={{ marginBottom: 12 }}
                      message={`有 ${errored.length} 个目录整理失败`}
                      description={
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          {errored.map((g) => {
                            const path = buildPathByKey(g.folder_id);
                            const label =
                              path.length > 0
                                ? path.map((p) => p.name).join(' / ')
                                : g.folder_id;
                            return (
                              <li key={g.folder_id}>
                                <Typography.Text strong>
                                  {label}
                                </Typography.Text>
                                <Typography.Text type="secondary">
                                  {' '}
                                  ({g.folder_id}):{' '}
                                </Typography.Text>
                                <Typography.Text type="danger">
                                  {g.error}
                                </Typography.Text>
                              </li>
                            );
                          })}
                        </ul>
                      }
                    />
                  );
                })()}

                <Tabs
                  items={[
                    {
                      key: 'items',
                      label: `处理明细 (${flatItemsForTable.length})`,
                      children: (
                        <ProTable<OrganizeItemRow>
                          rowKey={getOrganizeItemRowKey}
                          rowSelection={{
                            selectedRowKeys: selectedItemRowKeys,
                            onChange: (keys) => setSelectedItemRowKeys(keys),
                            preserveSelectedRowKeys: true,
                          }}
                          search={false}
                          options={false}
                          pagination={{ pageSize: 10, showSizeChanger: true }}
                          scroll={{ x: 'max-content', y: 420 }}
                          dataSource={flatItemsForTable}
                          columns={itemColumns}
                          expandable={{
                            expandedRowRender: (row) => (
                              <Typography.Paragraph style={{ margin: 0 }}>
                                <pre
                                  style={{ margin: 0, whiteSpace: 'pre-wrap' }}
                                >
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
                      label: `目录调试 (${flatDirDebugForTable.length})`,
                      children: (
                        <ProTable<OrganizeDirDebugRow>
                          rowKey={(row) =>
                            `${row.__folder_id || ''}::${row.target_dir}`
                          }
                          search={false}
                          options={false}
                          pagination={{ pageSize: 10, showSizeChanger: true }}
                          scroll={{ x: 'max-content', y: 420 }}
                          dataSource={flatDirDebugForTable}
                          columns={dirDebugColumns}
                          expandable={{
                            expandedRowRender: (row) => (
                              <Typography.Paragraph style={{ margin: 0 }}>
                                <pre
                                  style={{ margin: 0, whiteSpace: 'pre-wrap' }}
                                >
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
                            {JSON.stringify(
                              rawResponse ?? resultData ?? {},
                              null,
                              2,
                            )}
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
