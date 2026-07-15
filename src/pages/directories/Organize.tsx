import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  ExportOutlined,
  EyeOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SyncOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import {
  FooterToolbar,
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
  Checkbox,
  Col,
  Empty,
  Input,
  InputNumber,
  Modal,
  message,
  Result,
  Row,
  Select,
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
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import HDHiveResourcesButton from '@/components/HDHiveResourcesButton';
import {
  clearOrganizePreviewTasks,
  createOrganizePreviewTasks,
  deleteOrganizePreviewTask,
  get115CookieDirs,
  getCloudDirectoryDetail,
  getOrganizeCategoryConfig,
  getOrganizePreviewTask,
  getOrganizePreviewTasks,
  organize115Cookie,
  requeueOrganizePreviewTask,
} from '@/services/film-fusion';

const ROOT_KEY = '0';
const PAGE_LIMIT = 1150;
const FILENAME_REGEX_STORAGE_KEY = 'film-fusion.organize.filenameRegex';
const EPISODE_FILENAME_REGEX_STORAGE_KEY =
  'film-fusion.episodeOrganize.filenameRegex';
const DEFAULT_FILENAME_REGEX_PATTERN = '.* - (.*)';
const DEFAULT_FILENAME_REGEX_REPLACEMENT = '$1';
const EPISODE_FILENAME_REGEX_PATTERN = '.* - (.*)-.*';
type OrganizeMediaType = 'auto' | 'movie' | 'tv';
type PreviewQueueOptions = {
  mediaType: OrganizeMediaType;
  category?: string;
  bestVersionEnabled: boolean;
  intervalSeconds: number;
  recursiveDepth: number;
};
const mediaTypeOptions: Array<{ label: string; value: OrganizeMediaType }> = [
  { label: '自动', value: 'auto' },
  { label: '电影', value: 'movie' },
  { label: '剧集', value: 'tv' },
];
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

const defaultEpisodeFilenameRegexConfig: FilenameRegexConfig = {
  enabled: true,
  pattern: EPISODE_FILENAME_REGEX_PATTERN,
  replacement: DEFAULT_FILENAME_REGEX_REPLACEMENT,
};

function loadFilenameRegexConfig(
  storageKey: string,
  defaults: FilenameRegexConfig,
): FilenameRegexConfig {
  if (typeof window === 'undefined') {
    return defaults;
  }
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return defaults;
    }
    const parsed = JSON.parse(raw) as Partial<FilenameRegexConfig>;
    return {
      enabled: !!parsed.enabled,
      pattern:
        typeof parsed.pattern === 'string' ? parsed.pattern : defaults.pattern,
      replacement:
        typeof parsed.replacement === 'string'
          ? parsed.replacement
          : defaults.replacement,
    };
  } catch {
    return defaults;
  }
}

function saveFilenameRegexConfig(
  storageKey: string,
  config: FilenameRegexConfig,
) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(config));
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

function getDefaultSelectedItemKeys(rows: OrganizeItemRow[]) {
  return rows.map(getOrganizeItemRowKey);
}

function unwrapResponseData<T>(response: T | API.Response<T>): T {
  if (
    response &&
    typeof response === 'object' &&
    'data' in response &&
    'code' in response
  ) {
    return (response as API.Response<T>).data as T;
  }
  return response as T;
}

function renderVersionTag(row: OrganizeItemRow) {
  const reasons = row.version_reasons || [];
  const detail = reasons.length > 0 ? reasons.join('；') : undefined;
  if (row.best_version) {
    return (
      <Tooltip title={detail}>
        <Tag color="success">最佳 {row.version_score ?? 0}</Tag>
      </Tooltip>
    );
  }
  if (row.alternate_version) {
    return (
      <Tooltip title={detail}>
        <Tag color="error">非最佳 {row.version_score ?? 0}</Tag>
      </Tooltip>
    );
  }
  if (typeof row.version_score === 'number' && row.version_score > 0) {
    return (
      <Tooltip title={detail}>
        <Tag>{row.version_score}</Tag>
      </Tooltip>
    );
  }
  return <Tag>无</Tag>;
}

function renderEpisodePair(row: OrganizeItemRow) {
  const source =
    row.source_episode && row.source_episode > 0
      ? `S${String(row.source_season || 0).padStart(2, '0')}E${String(
          row.source_episode,
        ).padStart(2, '0')}`
      : '-';
  const target =
    row.target_episode && row.target_episode > 0
      ? `S${String(row.target_season || 0).padStart(2, '0')}E${String(
          row.target_episode,
        ).padStart(2, '0')}`
      : '-';
  const color = row.episode_matched ? 'success' : 'warning';
  return (
    <Space size={4} wrap>
      <Tag color={color}>{source}</Tag>
      <Typography.Text type="secondary">→</Typography.Text>
      <Tag color={color}>{target}</Tag>
    </Space>
  );
}

function renderExternalSubtitleTag(row: OrganizeItemRow) {
  const files = row.external_subtitle_files || [];
  if (files.length === 0) {
    return <Tag>无</Tag>;
  }
  return (
    <Tooltip title={files.join('；')}>
      <Tag color="error">外挂字幕 {files.length}</Tag>
    </Tooltip>
  );
}

const previewStatusMeta: Record<
  API.OrganizePreviewTaskStatus,
  { text: string; color: string; icon: React.ReactNode }
> = {
  pending: {
    text: '排队中',
    color: 'default',
    icon: <ClockCircleOutlined />,
  },
  processing: {
    text: '预整理中',
    color: 'processing',
    icon: <SyncOutlined spin />,
  },
  completed: {
    text: '已预整理',
    color: 'success',
    icon: <CheckCircleOutlined />,
  },
  failed: {
    text: '失败',
    color: 'error',
    icon: <WarningOutlined />,
  },
};

const renderPreviewStatus = (status?: API.OrganizePreviewTaskStatus) => {
  const meta = status ? previewStatusMeta[status] : undefined;
  if (!meta) return <Tag>-</Tag>;
  return (
    <Tag color={meta.color} icon={meta.icon}>
      {meta.text}
    </Tag>
  );
};

const formatDateTime = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

type OrganizePageProps = {
  episodeMode?: boolean;
};

const OrganizePage: React.FC<OrganizePageProps> = ({ episodeMode = false }) => {
  const params = useParams<{ id: string }>();
  const directoryId = Number(params.id);
  const filenameRegexStorageKey = episodeMode
    ? EPISODE_FILENAME_REGEX_STORAGE_KEY
    : FILENAME_REGEX_STORAGE_KEY;
  const defaultRegexConfig = episodeMode
    ? defaultEpisodeFilenameRegexConfig
    : defaultFilenameRegexConfig;

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
    useState<FilenameRegexConfig>(() =>
      loadFilenameRegexConfig(filenameRegexStorageKey, defaultRegexConfig),
    );
  const [organizeMediaType, setOrganizeMediaType] = useState<OrganizeMediaType>(
    episodeMode ? 'tv' : 'auto',
  );
  const [organizeCategory, setOrganizeCategory] = useState<string>();
  const [bestVersionEnabled, setBestVersionEnabled] = useState(episodeMode);
  const [previewOptionsOpen, setPreviewOptionsOpen] = useState(false);
  const [previewMediaTypeDraft, setPreviewMediaTypeDraft] =
    useState<OrganizeMediaType>(episodeMode ? 'tv' : 'auto');
  const [previewCategoryDraft, setPreviewCategoryDraft] = useState<string>();
  const [previewBestVersionDraft, setPreviewBestVersionDraft] =
    useState(episodeMode);
  const [previewIntervalDraft, setPreviewIntervalDraft] = useState(45);
  const [previewRecursiveDepthDraft, setPreviewRecursiveDepthDraft] =
    useState(1);
  const [categoryConfig, setCategoryConfig] =
    useState<API.OrganizeCategoryConfigResult>();
  const [previewIntervalSeconds, setPreviewIntervalSeconds] = useState(45);
  const [previewRecursiveDepth, setPreviewRecursiveDepth] = useState(1);
  const previewResultRef = useRef<HTMLDivElement>(null);
  const applyingPreviewTaskRef = useRef<API.OrganizePreviewTask | undefined>(
    undefined,
  );
  const deleteSourceFolderAfterApplyRef = useRef(false);
  const clearingPreviewTaskStatusRef = useRef<
    API.OrganizePreviewTaskStatus | undefined
  >(undefined);

  const [dryRun, setDryRun] = useState(true);
  const [resultData, setResultData] = useState<API.Organize115CookieResult>();
  const [activePreviewTask, setActivePreviewTask] =
    useState<API.OrganizePreviewTask>();
  const [rawResponse, setRawResponse] = useState<unknown>();
  const [selectedItemRowKeys, setSelectedItemRowKeys] = useState<React.Key[]>(
    [],
  );
  const effectiveMediaType: OrganizeMediaType = episodeMode
    ? 'tv'
    : organizeMediaType;

  useEffect(() => {
    if (episodeMode) {
      setOrganizeMediaType('tv');
      setBestVersionEnabled(true);
    }
  }, [episodeMode]);

  const previewCategoryOptions = useMemo(() => {
    const names =
      previewMediaTypeDraft === 'movie'
        ? categoryConfig?.movie
        : previewMediaTypeDraft === 'tv'
          ? categoryConfig?.tv
          : categoryConfig?.all;
    return (names || []).map((value) => ({ label: value, value }));
  }, [categoryConfig, previewMediaTypeDraft]);

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

  const { loading: categoryConfigLoading, refresh: refreshCategoryConfig } =
    useRequest(getOrganizeCategoryConfig, {
      onSuccess: (result) => {
        setCategoryConfig(
          unwrapResponseData<API.OrganizeCategoryConfigResult>(result),
        );
      },
      onError: (error: any) => {
        messageApi.warning(error?.message || '获取分类配置失败');
      },
    });

  const openPreviewOptions = useCallback(() => {
    if (checkedKeys.length === 0) {
      messageApi.warning('请先在左侧勾选至少一个 115 目录');
      return;
    }
    setPreviewMediaTypeDraft(effectiveMediaType);
    setPreviewCategoryDraft(organizeCategory);
    setPreviewBestVersionDraft(bestVersionEnabled);
    setPreviewIntervalDraft(previewIntervalSeconds);
    setPreviewRecursiveDepthDraft(previewRecursiveDepth);
    setPreviewOptionsOpen(true);
    refreshCategoryConfig();
  }, [
    bestVersionEnabled,
    checkedKeys.length,
    effectiveMediaType,
    messageApi,
    organizeCategory,
    previewIntervalSeconds,
    previewRecursiveDepth,
    refreshCategoryConfig,
  ]);

  const {
    data: previewTasks = [],
    loading: previewTasksLoading,
    refresh: refreshPreviewTasks,
  } = useRequest(
    () =>
      getOrganizePreviewTasks({
        cloud_directory_id: directoryId,
      }),
    {
      ready: Number.isFinite(directoryId) && directoryId > 0,
      refreshDeps: [directoryId],
      pollingInterval: 8000,
      formatResult: (res) => res.data?.list || [],
    },
  );

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
    setActivePreviewTask(undefined);
    setRawResponse(undefined);
    setSelectedItemRowKeys([]);
    setRootLoading(true);
    loadChildren(ROOT_KEY).finally(() => setRootLoading(false));
  }, [cloudStorageId, loadChildren]);

  useEffect(() => {
    saveFilenameRegexConfig(filenameRegexStorageKey, filenameRegexConfig);
  }, [filenameRegexConfig, filenameRegexStorageKey]);

  useEffect(() => {
    setResultData(undefined);
    setActivePreviewTask(undefined);
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

  const buildFolderContexts = useCallback(
    (folderIds: string[]) =>
      folderIds.map((folderId) => {
        if (activePreviewTask?.folder_id === folderId) {
          return {
            folder_id: folderId,
            folder_name: activePreviewTask.folder_name || folderId,
            folder_path:
              activePreviewTask.folder_path ||
              activePreviewTask.folder_name ||
              folderId,
          };
        }
        const path = buildPathByKey(folderId);
        const folderPath =
          path.length > 0 ? path.map((p) => p.name).join(' / ') : folderId;
        return {
          folder_id: folderId,
          folder_name: path[path.length - 1]?.name || folderId,
          folder_path: folderPath,
        };
      }),
    [activePreviewTask, buildPathByKey],
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
        const sourceFolderDeletedCount =
          typeof payload?.source_folder_deleted_count === 'number'
            ? payload.source_folder_deleted_count
            : payload?.source_folder_deleted
              ? 1
              : 0;
        const sourceFolderDeletedSuffix =
          !payload?.dry_run && sourceFolderDeletedCount > 0
            ? `，已删除原文件夹 ${sourceFolderDeletedCount} 个`
            : '';
        messageApi.success(
          `${text}${suffix}${payload?.dry_run ? '（演练）' : ''}${sourceFolderDeletedSuffix}`,
        );
        const sourceFolderDeleteErrors =
          payload?.source_folder_delete_errors || [];
        if (!payload?.dry_run && sourceFolderDeleteErrors.length > 0) {
          const visibleErrors = sourceFolderDeleteErrors.slice(0, 2).join('；');
          const more =
            sourceFolderDeleteErrors.length > 2
              ? `；另有 ${sourceFolderDeleteErrors.length - 2} 个错误`
              : '';
          messageApi.warning(
            `整理已完成，但原文件夹删除存在异常：${visibleErrors}${more}`,
          );
        }
        if (payload?.dry_run) {
          setResultData(payload);
          setActivePreviewTask(undefined);
          setRawResponse(response);
          setSelectedItemRowKeys(
            getDefaultSelectedItemKeys(flattenOrganizeItems(payload)),
          );
        } else {
          const appliedPreviewTask = applyingPreviewTaskRef.current;
          const shouldDeleteSourceFolder =
            deleteSourceFolderAfterApplyRef.current;
          applyingPreviewTaskRef.current = undefined;
          deleteSourceFolderAfterApplyRef.current = false;
          if (appliedPreviewTask) {
            deleteOrganizePreviewTask(
              appliedPreviewTask.id,
              shouldDeleteSourceFolder
                ? { delete_source_folder: true }
                : undefined,
            )
              .then((deleteResult) => {
                const deleteResponse = deleteResult as any;
                const deletePayload: API.DeleteOrganizePreviewTaskResult =
                  deleteResponse &&
                  typeof deleteResponse === 'object' &&
                  'data' in deleteResponse &&
                  'code' in deleteResponse
                    ? deleteResponse.data
                    : deleteResponse;
                messageApi.success(
                  deletePayload?.source_folder_deleted
                    ? '已从预整理队列移除，源文件夹已移入回收站'
                    : '已从预整理队列移除',
                );
                refreshPreviewTasks();
              })
              .catch((error: any) => {
                messageApi.warning(
                  error?.message || '整理已完成，但移除预整理队列失败',
                );
                refreshPreviewTasks();
              });
          }
          setResultData(undefined);
          setActivePreviewTask(undefined);
          setRawResponse(undefined);
          setSelectedItemRowKeys([]);
          setCheckedKeys([]);
        }
      },
      onError: (error: any) => {
        applyingPreviewTaskRef.current = undefined;
        deleteSourceFolderAfterApplyRef.current = false;
        messageApi.error(error?.message || '整理失败，请重试');
      },
    },
  );

  const { run: runCreatePreviewTasks, loading: createPreviewLoading } =
    useRequest(createOrganizePreviewTasks, {
      manual: true,
      onSuccess: (result) => {
        const response = result as any;
        const payload: API.OrganizePreviewTaskListResult =
          response &&
          typeof response === 'object' &&
          'data' in response &&
          'code' in response
            ? response.data
            : response;
        messageApi.success(
          `已加入预整理队列${payload?.total ? ` ${payload.total} 个目录` : ''}`,
        );
        refreshPreviewTasks();
      },
      onError: (error: any) => {
        messageApi.error(error?.message || '加入预整理队列失败');
      },
    });

  const { run: runLoadPreviewTask, loading: loadPreviewTaskLoading } =
    useRequest(getOrganizePreviewTask, {
      manual: true,
      onSuccess: (result) => {
        const response = result as any;
        const payload: API.OrganizePreviewTaskDetailResult =
          response &&
          typeof response === 'object' &&
          'data' in response &&
          'code' in response
            ? response.data
            : response;
        const previewResult = payload?.result;
        if (!previewResult) {
          messageApi.warning('这个预整理任务还没有可查看的结果');
          return;
        }
        setDryRun(true);
        setActivePreviewTask(payload.task);
        if (!episodeMode) {
          setOrganizeMediaType(payload.task?.media_type || 'auto');
        }
        setOrganizeCategory(payload.task?.category || undefined);
        setBestVersionEnabled(!!payload.task?.best_version_enabled);
        setResultData(previewResult);
        setRawResponse(response);
        setSelectedItemRowKeys(
          getDefaultSelectedItemKeys(flattenOrganizeItems(previewResult)),
        );
        window.setTimeout(() => {
          previewResultRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        }, 0);
        messageApi.success('已加载预整理结果');
      },
      onError: (error: any) => {
        messageApi.error(error?.message || '加载预整理结果失败');
      },
    });

  const { run: runRequeuePreviewTask, loading: requeuePreviewLoading } =
    useRequest(requeueOrganizePreviewTask, {
      manual: true,
      onSuccess: () => {
        messageApi.success('已重新加入预整理队列');
        refreshPreviewTasks();
      },
      onError: (error: any) => {
        messageApi.error(error?.message || '重新加入队列失败');
      },
    });

  const { run: runDeletePreviewTask, loading: deletePreviewLoading } =
    useRequest(deleteOrganizePreviewTask, {
      manual: true,
      onSuccess: (result) => {
        const response = result as any;
        const payload: API.DeleteOrganizePreviewTaskResult =
          response &&
          typeof response === 'object' &&
          'data' in response &&
          'code' in response
            ? response.data
            : response;
        messageApi.success(
          payload?.source_folder_deleted
            ? '已删除预整理任务，源文件夹已移入回收站'
            : '已删除预整理任务',
        );
        refreshPreviewTasks();
      },
      onError: (error: any) => {
        messageApi.error(error?.message || '删除预整理任务失败');
      },
    });

  const failedPreviewTaskCount = useMemo(
    () => previewTasks.filter((task) => task.status === 'failed').length,
    [previewTasks],
  );
  const clearablePreviewTaskCount = useMemo(
    () => previewTasks.filter((task) => task.status !== 'processing').length,
    [previewTasks],
  );

  const { run: runClearPreviewTasks, loading: clearPreviewTasksLoading } =
    useRequest(clearOrganizePreviewTasks, {
      manual: true,
      onSuccess: (result) => {
        const response = result as any;
        const payload: API.ClearOrganizePreviewTasksResult =
          response &&
          typeof response === 'object' &&
          'data' in response &&
          'code' in response
            ? response.data
            : response;
        const clearedStatus = clearingPreviewTaskStatusRef.current;
        clearingPreviewTaskStatusRef.current = undefined;
        const deletedCount = payload?.deleted_count || 0;
        messageApi.success(
          clearedStatus === 'failed'
            ? `已清理失败预整理任务 ${deletedCount} 个`
            : `已清理预整理任务 ${deletedCount} 个`,
        );
        refreshPreviewTasks();
        if (
          activePreviewTask &&
          (!clearedStatus || activePreviewTask.status === clearedStatus)
        ) {
          setActivePreviewTask(undefined);
          setResultData(undefined);
          setRawResponse(undefined);
          setSelectedItemRowKeys([]);
        }
      },
      onError: (error: any) => {
        clearingPreviewTaskStatusRef.current = undefined;
        messageApi.error(error?.message || '清理预整理队列失败');
      },
    });

  const confirmClearPreviewTasks = useCallback(
    (status?: API.OrganizePreviewTaskStatus) => {
      const isFailedOnly = status === 'failed';
      const count = isFailedOnly
        ? failedPreviewTaskCount
        : clearablePreviewTaskCount;
      if (count <= 0) {
        messageApi.info(isFailedOnly ? '没有失败任务可清理' : '没有任务可清理');
        return;
      }

      modalApi.confirm({
        title: isFailedOnly ? '清理失败预整理任务？' : '清理全部预整理任务？',
        content: isFailedOnly
          ? `将删除当前目录配置下 ${count} 个失败任务。`
          : `将删除当前目录配置下 ${count} 个非处理中任务，正在处理的任务会保留。`,
        okText: '清理',
        okButtonProps: { danger: true },
        cancelText: '取消',
        onOk: () => {
          clearingPreviewTaskStatusRef.current = status;
          runClearPreviewTasks({
            cloud_directory_id: directoryId,
            status,
          });
        },
      });
    },
    [
      clearablePreviewTaskCount,
      directoryId,
      failedPreviewTaskCount,
      messageApi,
      modalApi,
      runClearPreviewTasks,
    ],
  );

  const flatItemsForTable = useMemo<OrganizeItemRow[]>(
    () => flattenOrganizeItems(resultData),
    [resultData],
  );

  const itemFactSummary = useMemo(() => {
    return flatItemsForTable.reduce(
      (acc, row) => {
        if (row.episode_matched) acc.episodeMatched += 1;
        if ((row.external_subtitle_files || []).length > 0) {
          acc.externalSubtitle += 1;
        }
        if (row.best_version) acc.bestVersion += 1;
        if (row.alternate_version) acc.alternateVersion += 1;
        return acc;
      },
      {
        episodeMatched: 0,
        externalSubtitle: 0,
        bestVersion: 0,
        alternateVersion: 0,
      },
    );
  }, [flatItemsForTable]);

  const selectedItemRowsForApply = useMemo(() => {
    const selectedSet = new Set(selectedItemRowKeys.map((key) => String(key)));
    return flatItemsForTable.filter((row) =>
      selectedSet.has(getOrganizeItemRowKey(row)),
    );
  }, [flatItemsForTable, selectedItemRowKeys]);

  const confirmDeletePreviewTask = useCallback(
    (row: API.OrganizePreviewTask) => {
      const folderLabel = row.folder_path || row.folder_name || row.folder_id;
      let deleteSourceFolder = true;
      modalApi.confirm({
        title: '删除预整理任务？',
        content: (
          <Space direction="vertical" size={8}>
            <Typography.Text>{folderLabel}</Typography.Text>
            <Checkbox
              defaultChecked
              onChange={(event) => {
                deleteSourceFolder = event.target.checked;
              }}
            >
              同时删除源文件夹
            </Checkbox>
            <Typography.Text type="secondary">
              勾选后会将源文件夹移入 115 回收站，请确认整理后源目录已为空。
            </Typography.Text>
          </Space>
        ),
        okText: '删除',
        okButtonProps: { danger: true },
        cancelText: '取消',
        onOk: () =>
          runDeletePreviewTask(
            row.id,
            deleteSourceFolder ? { delete_source_folder: true } : undefined,
          ),
      });
    },
    [modalApi, runDeletePreviewTask],
  );

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
      const category = organizeCategory?.trim();
      return {
        cloud_directory_id: directoryId,
        folder_ids: folderIds,
        folder_contexts: buildFolderContexts(folderIds),
        ...(fileIds && fileIds.length > 0 ? { file_ids: fileIds } : {}),
        dry_run: dryRunValue,
        ...(effectiveMediaType !== 'auto'
          ? { media_type: effectiveMediaType }
          : {}),
        ...(category ? { category } : {}),
        ...(effectiveMediaType !== 'auto'
          ? { best_version_enabled: bestVersionEnabled }
          : {}),
        filename_regex_enabled: filenameRegexConfig.enabled,
        ...(filenameRegexConfig.enabled
          ? {
              filename_regex_pattern: pattern,
              filename_regex_replacement: filenameRegexConfig.replacement,
            }
          : {}),
      };
    },
    [
      bestVersionEnabled,
      buildFolderContexts,
      directoryId,
      effectiveMediaType,
      filenameRegexConfig,
      messageApi,
      organizeCategory,
    ],
  );

  const buildPreviewFolders = useCallback(() => {
    return buildFolderContexts(checkedKeys);
  }, [buildFolderContexts, checkedKeys]);

  const triggerPreviewQueue = useCallback(
    (options: PreviewQueueOptions) => {
      if (checkedKeys.length === 0) {
        messageApi.warning('请先在左侧勾选至少一个 115 目录');
        return false;
      }
      const pattern = filenameRegexConfig.pattern.trim();
      if (filenameRegexConfig.enabled && !pattern) {
        messageApi.warning('启用文件名处理时，正则不能为空');
        return false;
      }
      const category = options.category?.trim();
      runCreatePreviewTasks({
        cloud_directory_id: directoryId,
        folders: buildPreviewFolders(),
        interval_seconds: options.intervalSeconds,
        recursive_depth: options.recursiveDepth,
        ...(options.mediaType !== 'auto'
          ? { media_type: options.mediaType }
          : {}),
        ...(category ? { category } : {}),
        ...(options.mediaType !== 'auto'
          ? { best_version_enabled: options.bestVersionEnabled }
          : {}),
        filename_regex_enabled: filenameRegexConfig.enabled,
        ...(filenameRegexConfig.enabled
          ? {
              filename_regex_pattern: pattern,
              filename_regex_replacement: filenameRegexConfig.replacement,
            }
          : {}),
      });
      return true;
    },
    [
      buildPreviewFolders,
      checkedKeys.length,
      directoryId,
      filenameRegexConfig,
      messageApi,
      runCreatePreviewTasks,
    ],
  );

  const confirmPreviewOptions = useCallback(() => {
    const options: PreviewQueueOptions = {
      mediaType: previewMediaTypeDraft,
      category: previewCategoryDraft,
      bestVersionEnabled: previewBestVersionDraft,
      intervalSeconds: previewIntervalDraft,
      recursiveDepth: previewRecursiveDepthDraft,
    };
    if (triggerPreviewQueue(options)) {
      setOrganizeMediaType(previewMediaTypeDraft);
      setOrganizeCategory(previewCategoryDraft);
      setBestVersionEnabled(previewBestVersionDraft);
      setPreviewIntervalSeconds(previewIntervalDraft);
      setPreviewRecursiveDepth(previewRecursiveDepthDraft);
      setPreviewOptionsOpen(false);
    }
  }, [
    previewBestVersionDraft,
    previewCategoryDraft,
    previewIntervalDraft,
    previewMediaTypeDraft,
    previewRecursiveDepthDraft,
    triggerPreviewQueue,
  ]);

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
        applyingPreviewTaskRef.current = undefined;
        deleteSourceFolderAfterApplyRef.current = false;
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
        const activePreviewTaskLabel =
          activePreviewTask?.folder_path ||
          activePreviewTask?.folder_name ||
          activePreviewTask?.folder_id;
        let deleteSourceFolder = true;
        modalApi.confirm({
          title: activePreviewTask
            ? `确认整理此目录的 ${selectedItemRowsForApply.length} 条处理明细？`
            : `确认整理 ${selectedItemRowsForApply.length} 条处理明细？`,
          content: (
            <Space direction="vertical" size={8}>
              {activePreviewTaskLabel ? (
                <Typography.Text>
                  目录：
                  <Typography.Text strong>
                    {activePreviewTaskLabel}
                  </Typography.Text>
                </Typography.Text>
              ) : null}
              <Typography.Text>
                将只处理当前预览表格中已选择的记录（创建/重命名/移动/字幕下载）。
                单个目录失败不会阻断其它，错误会标注在对应分组上。
              </Typography.Text>
              <Space direction="vertical" size={4}>
                <Checkbox
                  defaultChecked
                  onChange={(event) => {
                    deleteSourceFolder = event.target.checked;
                  }}
                >
                  整理完成后删除原文件夹
                </Checkbox>
                <Typography.Text type="secondary">
                  仅在整理成功后执行，会将本次整理来源目录移入 115 回收站。
                </Typography.Text>
              </Space>
            </Space>
          ),
          okText: '执行整理',
          okButtonProps: { danger: true },
          cancelText: '取消',
          onOk: () => {
            applyingPreviewTaskRef.current = activePreviewTask;
            deleteSourceFolderAfterApplyRef.current =
              !!activePreviewTask && deleteSourceFolder;
            runOrganize(
              !activePreviewTask && deleteSourceFolder
                ? { ...organizeParams, delete_source_folder: true }
                : organizeParams,
            );
          },
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
      let deleteSourceFolder = true;
      modalApi.confirm({
        title: `确认整理 ${folderIds.length} 个 115 目录？`,
        content: (
          <Space direction="vertical" size={8}>
            <Typography.Text>
              将对这些 115 目录依次执行真实整理（创建/重命名/移动/字幕下载）。
              单个目录失败不会阻断其它，错误会标注在对应分组上。
            </Typography.Text>
            <Space direction="vertical" size={4}>
              <Checkbox
                defaultChecked
                onChange={(event) => {
                  deleteSourceFolder = event.target.checked;
                }}
              >
                整理完成后删除原文件夹
              </Checkbox>
              <Typography.Text type="secondary">
                仅在整理成功后执行，会将本次整理来源目录移入 115 回收站。
              </Typography.Text>
            </Space>
          </Space>
        ),
        okText: '执行整理',
        okButtonProps: { danger: true },
        cancelText: '取消',
        onOk: () => {
          applyingPreviewTaskRef.current = undefined;
          deleteSourceFolderAfterApplyRef.current = false;
          runOrganize(
            deleteSourceFolder
              ? { ...organizeParams, delete_source_folder: true }
              : organizeParams,
          );
        },
      });
    },
    [
      activePreviewTask,
      buildOrganizeParams,
      checkedKeys,
      episodeMode,
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
        title: '集数校验',
        dataIndex: 'episode_matched',
        width: 150,
        hideInTable: !episodeMode,
        render: (_, row) => renderEpisodePair(row),
      },
      {
        title: '外挂字幕',
        dataIndex: 'external_subtitle_files',
        width: 130,
        render: (_, row) => renderExternalSubtitleTag(row),
      },
      {
        title: '版本',
        dataIndex: 'best_version',
        width: 130,
        render: (_, row) => renderVersionTag(row),
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
        title: '重命名为',
        dataIndex: 'rename_to',
        width: 180,
        ellipsis: true,
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
        title: '识别输入',
        dataIndex: 'recognize_input',
        width: 260,
        ellipsis: true,
        hideInTable: !episodeMode,
        render: (_, row) =>
          row.recognize_input ? (
            <Tooltip title={row.recognize_input}>
              <span>{row.recognize_input}</span>
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
        fixed: 'left',
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
    [buildPathByKey, episodeMode],
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

  const previewTaskColumns = useMemo<ProColumns<API.OrganizePreviewTask>[]>(
    () => [
      {
        title: '状态',
        dataIndex: 'status',
        width: 120,
        fixed: 'left',
        render: (_, row) => renderPreviewStatus(row.status),
      },
      {
        title: '文件夹',
        dataIndex: 'folder_path',
        width: 260,
        ellipsis: true,
        render: (_, row) => {
          const label = row.folder_path || row.folder_name || row.folder_id;
          return (
            <Tooltip title={`folder_id: ${row.folder_id}`}>
              <span>{label}</span>
            </Tooltip>
          );
        },
      },
      {
        title: 'TMDB',
        dataIndex: 'tmdb_refs',
        width: 150,
        render: (_, row) =>
          row.tmdb_refs?.length ? (
            <Space size={[4, 4]} wrap>
              {row.tmdb_refs.map((ref) => {
                const url = buildTmdbUrl(ref.tmdb_id, ref.media_type);
                if (!url) return null;
                const title = ref.title
                  ? `${ref.title}${ref.year ? ` (${ref.year})` : ''}`
                  : `TMDB ${ref.tmdb_id}`;
                return (
                  <Tooltip
                    key={`${ref.media_type || 'media'}:${ref.tmdb_id}`}
                    title={`在 TMDB 打开：${title}`}
                  >
                    <Typography.Link
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {ref.tmdb_id} <ExportOutlined />
                    </Typography.Link>
                  </Tooltip>
                );
              })}
            </Space>
          ) : (
            <span style={{ color: 'rgba(0,0,0,0.25)' }}>-</span>
          ),
      },
      {
        title: '结果数',
        dataIndex: 'total',
        width: 120,
        render: (_, row) => {
          const tmdbEpisodeCount = (row.tmdb_refs || []).reduce(
            (sum, ref) => sum + (ref.episode_count || 0),
            0,
          );
          return (
            <Space direction="vertical" size={2}>
              <Typography.Text>{row.total || 0}</Typography.Text>
              {tmdbEpisodeCount > 0 ? (
                <Tag color="blue" style={{ marginInlineEnd: 0 }}>
                  TMDB {tmdbEpisodeCount} 集
                </Tag>
              ) : null}
            </Space>
          );
        },
      },
      {
        title: '类型/分类',
        dataIndex: 'media_type',
        width: 130,
        render: (_, row) => (
          <Space size={4} wrap>
            <Tag>
              {row.media_type === 'movie'
                ? '电影'
                : row.media_type === 'tv'
                  ? '剧集'
                  : '自动'}
            </Tag>
            {row.category ? <Tag>{row.category}</Tag> : null}
          </Space>
        ),
      },
      {
        title: '版本',
        dataIndex: 'best_version_count',
        width: 130,
        render: (_, row) =>
          row.best_version_enabled ? (
            <Space size={4} wrap>
              <Tag color="success">最佳 {row.best_version_count || 0}</Tag>
              <Tag color="error">非最佳 {row.alternate_version_count || 0}</Tag>
            </Space>
          ) : (
            '-'
          ),
      },
      {
        title: '外挂字幕',
        dataIndex: 'external_subtitle_count',
        width: 110,
        render: (_, row) => (
          <Tag
            color={(row.external_subtitle_count || 0) > 0 ? 'error' : 'default'}
          >
            {row.external_subtitle_count || 0}
          </Tag>
        ),
      },
      {
        title: '层级',
        dataIndex: 'depth',
        width: 90,
        render: (_, row) => `${row.depth ?? 0}/${row.max_depth ?? 0}`,
      },
      {
        title: '间隔',
        dataIndex: 'interval_seconds',
        width: 90,
        render: (_, row) => `${row.interval_seconds || 45}s`,
      },
      {
        title: '更新时间',
        dataIndex: 'updated_at',
        width: 180,
        render: (_, row) => formatDateTime(row.updated_at),
      },
      {
        title: '完成时间',
        dataIndex: 'completed_at',
        width: 180,
        render: (_, row) => formatDateTime(row.completed_at),
      },
      {
        title: '错误',
        dataIndex: 'error',
        width: 240,
        ellipsis: true,
        render: (_, row) =>
          row.error ? (
            <Tooltip title={row.error}>
              <Typography.Text type="danger">{row.error}</Typography.Text>
            </Tooltip>
          ) : (
            '-'
          ),
      },
      {
        title: '操作',
        valueType: 'option',
        width: 280,
        fixed: 'right',
        render: (_, row) => {
          const canView = row.status === 'completed' || row.status === 'failed';
          const isProcessing = row.status === 'processing';
          const refs = row.tmdb_refs || [];
          return (
            <Space size={4} wrap>
              <Button
                size="small"
                type="link"
                icon={<EyeOutlined />}
                disabled={!canView}
                loading={loadPreviewTaskLoading}
                onClick={() => runLoadPreviewTask(row.id)}
              >
                查看结果
              </Button>
              {refs.map((ref, index) => {
                const title = ref.title
                  ? `${ref.title}${ref.year ? ` (${ref.year})` : ''}`
                  : `TMDB ${ref.tmdb_id}`;
                return (
                  <HDHiveResourcesButton
                    key={`${ref.media_type || 'media'}:${ref.tmdb_id}`}
                    tmdbId={ref.tmdb_id}
                    mediaType={ref.media_type}
                    title={title}
                    buttonText={
                      refs.length > 1 ? `HDHive${index + 1}` : 'HDHive'
                    }
                  />
                );
              })}
              <Button
                size="small"
                type="link"
                icon={<ReloadOutlined />}
                disabled={isProcessing}
                loading={requeuePreviewLoading}
                onClick={() => runRequeuePreviewTask(row.id)}
              >
                重跑
              </Button>
              <Tooltip title="删除">
                <Button
                  size="small"
                  type="link"
                  danger
                  aria-label="删除预整理任务"
                  icon={<DeleteOutlined />}
                  disabled={isProcessing}
                  loading={deletePreviewLoading}
                  onClick={() => confirmDeletePreviewTask(row)}
                />
              </Tooltip>
            </Space>
          );
        },
      },
    ],
    [
      confirmDeletePreviewTask,
      deletePreviewLoading,
      loadPreviewTaskLoading,
      requeuePreviewLoading,
      runLoadPreviewTask,
      runRequeuePreviewTask,
    ],
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
          title: episodeMode ? '剧集预整理' : '整理目录',
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
  const activePreviewTaskLabel = activePreviewTask
    ? activePreviewTask.folder_path ||
      activePreviewTask.folder_name ||
      activePreviewTask.folder_id
    : undefined;
  const showEpisodeFacts =
    episodeMode ||
    resultData?.media_type === 'tv' ||
    effectiveMediaType === 'tv';
  const showVersionFacts =
    resultData?.media_type === 'movie' ||
    resultData?.media_type === 'tv' ||
    effectiveMediaType === 'movie' ||
    effectiveMediaType === 'tv';

  return (
    <PageContainer
      loading={directoryLoading && !directoryDetail}
      header={{
        title: `${episodeMode ? '剧集预整理' : '整理目录'}：${
          directoryDetail?.directory_name || ''
        }`,
        onBack: () => history.push('/directories'),
        backIcon: <ArrowLeftOutlined />,
        extra: headerExtra,
        breadcrumb: {
          routes: [
            { path: '/directories', breadcrumbName: '目录配置' },
            { path: '', breadcrumbName: episodeMode ? '剧集预整理' : '整理' },
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

            <ProTable<API.OrganizePreviewTask>
              rowKey="id"
              headerTitle="后台预整理队列"
              size="small"
              search={false}
              options={false}
              loading={previewTasksLoading}
              dataSource={previewTasks}
              columns={previewTaskColumns}
              pagination={{ pageSize: 5, showSizeChanger: true }}
              scroll={{ x: 'max-content' }}
              style={{ marginBottom: 12 }}
              locale={{
                emptyText:
                  '还没有预整理任务。勾选左侧目录后点“加入预整理”，后台会先展开子目录，再按间隔逐个生成预览结果。',
              }}
              toolBarRender={() => [
                <Button
                  key="clearFailed"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  disabled={failedPreviewTaskCount === 0}
                  loading={clearPreviewTasksLoading}
                  onClick={() => confirmClearPreviewTasks('failed')}
                >
                  清理失败 ({failedPreviewTaskCount})
                </Button>,
                <Button
                  key="clearAll"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  disabled={clearablePreviewTaskCount === 0}
                  loading={clearPreviewTasksLoading}
                  onClick={() => confirmClearPreviewTasks()}
                >
                  清理全部 ({clearablePreviewTaskCount})
                </Button>,
                <Button
                  key="refresh"
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={() => refreshPreviewTasks()}
                >
                  刷新
                </Button>,
              ]}
            />

            <div ref={previewResultRef}>
              {!resultData ? (
                <Alert
                  type="info"
                  showIcon
                  message={episodeMode ? '尚未生成剧集预览' : '尚未整理'}
                  description={
                    episodeMode
                      ? '勾选剧集目录后先预览，系统会用正则处理后的文件名识别；识别不到时再组合父级/祖父级目录名重试，并标记集数匹配、本地入库、外挂字幕和版本信息，方便手动检查。'
                      : '在左侧勾选目录后可以直接点“预览整理”；也可以点“加入预整理”，后台会先展开子目录并逐个生成预览结果。子目录预整理完成后，在队列里点“查看结果”会把该目录的预览明细加载到这里，再单独确认是否整理这个子目录。'
                  }
                />
              ) : (
                <>
                  {activePreviewTask ? (
                    <Alert
                      type="success"
                      showIcon
                      style={{ marginBottom: 12 }}
                      message="当前预整理结果"
                      description={
                        <Space size={8} wrap>
                          <Typography.Text strong>
                            {activePreviewTaskLabel}
                          </Typography.Text>
                          <Tag color="blue">
                            层级 {activePreviewTask.depth}/
                            {activePreviewTask.max_depth}
                          </Tag>
                          <Tag color="green">
                            可确认 {selectedItemRowsForApply.length} 条
                          </Tag>
                        </Space>
                      }
                    />
                  ) : null}

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
                      ...(showEpisodeFacts
                        ? [
                            {
                              title: '集数匹配',
                              render: () => (
                                <Tag color="blue">
                                  {itemFactSummary.episodeMatched}
                                </Tag>
                              ),
                            },
                          ]
                        : []),
                      {
                        title: '外挂字幕',
                        render: () => (
                          <Tag
                            color={
                              itemFactSummary.externalSubtitle > 0
                                ? 'error'
                                : 'default'
                            }
                          >
                            {itemFactSummary.externalSubtitle}
                          </Tag>
                        ),
                      },
                      ...(showVersionFacts
                        ? [
                            {
                              title: '最佳版本',
                              render: () => (
                                <Space size={4} wrap>
                                  <Tag color="success">
                                    {itemFactSummary.bestVersion}
                                  </Tag>
                                  <Tag color="error">
                                    {itemFactSummary.alternateVersion}
                                  </Tag>
                                </Space>
                              ),
                            },
                          ]
                        : []),
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
                                    style={{
                                      margin: 0,
                                      whiteSpace: 'pre-wrap',
                                    }}
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
                                    style={{
                                      margin: 0,
                                      whiteSpace: 'pre-wrap',
                                    }}
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
            </div>
          </Card>
        </Col>
      </Row>

      <Modal
        title="加入预整理"
        open={previewOptionsOpen}
        onCancel={() => setPreviewOptionsOpen(false)}
        onOk={confirmPreviewOptions}
        confirmLoading={createPreviewLoading}
        okText="加入队列"
        cancelText="取消"
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Row gutter={12}>
            <Col span={12}>
              <Typography.Text type="secondary">识别类型</Typography.Text>
              <Select<OrganizeMediaType>
                value={episodeMode ? 'tv' : previewMediaTypeDraft}
                options={mediaTypeOptions}
                disabled={episodeMode}
                onChange={(value) => {
                  setPreviewMediaTypeDraft(value);
                  setPreviewBestVersionDraft(value !== 'auto');
                  const nextNames =
                    value === 'movie'
                      ? categoryConfig?.movie
                      : value === 'tv'
                        ? categoryConfig?.tv
                        : categoryConfig?.all;
                  if (
                    previewCategoryDraft &&
                    !(nextNames || []).includes(previewCategoryDraft)
                  ) {
                    setPreviewCategoryDraft(undefined);
                  }
                }}
                style={{ width: '100%', marginTop: 6 }}
              />
            </Col>
            <Col span={12}>
              <Typography.Text type="secondary">目标分类</Typography.Text>
              <Select
                allowClear
                showSearch
                loading={categoryConfigLoading}
                placeholder="自动匹配"
                value={previewCategoryDraft}
                options={previewCategoryOptions}
                onChange={(value) => setPreviewCategoryDraft(value)}
                notFoundContent={
                  categoryConfigLoading ? '加载中' : '无分类配置'
                }
                optionFilterProp="label"
                style={{ width: '100%', marginTop: 6 }}
              />
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Typography.Text type="secondary">后台间隔</Typography.Text>
              <InputNumber
                min={10}
                max={300}
                step={5}
                addonAfter="秒"
                value={previewIntervalDraft}
                onChange={(value) =>
                  setPreviewIntervalDraft(
                    typeof value === 'number' ? value : 45,
                  )
                }
                style={{ width: '100%', marginTop: 6 }}
              />
            </Col>
            <Col span={12}>
              <Typography.Text type="secondary">递归层数</Typography.Text>
              <InputNumber
                min={1}
                max={5}
                step={1}
                value={previewRecursiveDepthDraft}
                onChange={(value) =>
                  setPreviewRecursiveDepthDraft(
                    typeof value === 'number' ? value : 1,
                  )
                }
                style={{ width: '100%', marginTop: 6 }}
              />
            </Col>
          </Row>
          <Space size={8}>
            <Typography.Text type="secondary">最佳版本</Typography.Text>
            <Switch
              checked={previewBestVersionDraft}
              disabled={previewMediaTypeDraft === 'auto'}
              checkedChildren="是"
              unCheckedChildren="否"
              onChange={(checked) => setPreviewBestVersionDraft(checked)}
            />
          </Space>
        </Space>
      </Modal>

      <div style={{ height: 72 }} />
      <FooterToolbar
        extra={
          <Space size={8} wrap>
            <Tag color={checkedKeys.length > 0 ? 'blue' : 'default'}>
              已选目录 {checkedKeys.length}
            </Tag>
            {activePreviewTaskLabel ? (
              <Typography.Text
                type="secondary"
                ellipsis={{ tooltip: activePreviewTaskLabel }}
                style={{ maxWidth: 420 }}
              >
                当前预整理：{activePreviewTaskLabel}
              </Typography.Text>
            ) : null}
          </Space>
        }
      >
        <Space size={8} wrap>
          <Space size={4}>
            <Typography.Text type="secondary">演练模式</Typography.Text>
            <Switch
              checked={dryRun}
              checkedChildren="是"
              unCheckedChildren="否"
              onChange={(checked) => setDryRun(checked)}
            />
          </Space>
          <Button
            icon={<PlayCircleOutlined />}
            onClick={() => triggerOrganize('dry')}
            loading={organizeLoading && dryRun}
            disabled={checkedKeys.length === 0}
          >
            预览整理 ({checkedKeys.length})
          </Button>
          <Button
            icon={<ClockCircleOutlined />}
            onClick={openPreviewOptions}
            loading={createPreviewLoading}
            disabled={checkedKeys.length === 0}
          >
            加入预整理 ({checkedKeys.length})
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
      </FooterToolbar>
    </PageContainer>
  );
};

export default OrganizePage;
