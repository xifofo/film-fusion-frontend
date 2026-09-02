import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  ExportOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  MoreOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SyncOutlined,
  TagOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import type { TableColumnsType } from 'antd';
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Col,
  Dropdown,
  Empty,
  Input,
  InputNumber,
  Modal,
  message,
  Result,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Tree,
  Typography,
} from 'antd';
import type { DataNode } from 'antd/es/tree';
import { createStyles } from 'antd-style';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate, useParams } from 'react-router';
import ConsolePage from '@/components/ConsolePage';
import HDHiveResourcesButton from '@/components/HDHiveResourcesButton';
import { useApiRequest } from '@/hooks/useApiRequest';
import {
  assignOrganizePreviewTaskTMDB,
  clearOrganizePreviewTasks,
  createOrganizePreviewTasks,
  deleteOrganizePreviewTask,
  get115CookieDirs,
  getAppConfig,
  getCloudDirectoryDetail,
  getOrganizeCategoryConfig,
  getOrganizePreviewTask,
  getOrganizePreviewTasks,
  organize115Cookie,
  requeueOrganizePreviewTask,
  subscribeOrganizePreviewTaskEvents,
} from '@/services/film-fusion';

const ROOT_KEY = '0';
const PAGE_LIMIT = 1150;
const FILENAME_REGEX_STORAGE_KEY = 'film-fusion.organize.filenameRegex';
const EPISODE_FILENAME_REGEX_STORAGE_KEY =
  'film-fusion.episodeOrganize.filenameRegex';
const DIRECTORY_PANEL_VISIBLE_STORAGE_KEY =
  'film-fusion.organize.directoryPanelVisible';
const EPISODE_DIRECTORY_PANEL_VISIBLE_STORAGE_KEY =
  'film-fusion.episodeOrganize.directoryPanelVisible';
const DEFAULT_FILENAME_REGEX_PATTERN = '.* - (.*)';
const DEFAULT_FILENAME_REGEX_REPLACEMENT = '$1';
const EPISODE_FILENAME_REGEX_PATTERN = '.* - (.*)-.*';
const DEFAULT_PREVIEW_TASK_LIMIT = 100;
const MAX_PREVIEW_TASK_LIMIT = 1000;
type OrganizeMediaType = 'auto' | 'movie' | 'tv';
type RecognitionSource = 'moviepilot' | 'local' | 'shadow';
type PreviewQueueOptions = {
  mediaType: OrganizeMediaType;
  recognitionSource: RecognitionSource;
  category?: string;
  bestVersionEnabled: boolean;
  intervalSeconds: number;
  recursiveDepth: number;
  taskLimit: number;
};
const mediaTypeOptions: Array<{ label: string; value: OrganizeMediaType }> = [
  { label: '自动', value: 'auto' },
  { label: '电影', value: 'movie' },
  { label: '剧集', value: 'tv' },
];
const organizeMediaTypeText = (value?: string): string => {
  switch ((value || '').trim().toLowerCase()) {
    case 'movie':
    case '电影':
      return '电影';
    case 'tv':
    case '电视剧':
    case '剧集':
      return '电视剧';
    default:
      return (value || '').trim();
  }
};
const recognitionSourceOptions: Array<{
  label: string;
  value: RecognitionSource;
}> = [
  { label: '仅 MP2', value: 'moviepilot' },
  { label: '仅 FilmFusion', value: 'local' },
  { label: '影子模式', value: 'shadow' },
];
const recognitionSourcePresentation: Record<
  RecognitionSource,
  { label: string; color: string }
> = {
  moviepilot: { label: '仅 MP2', color: 'blue' },
  local: { label: '仅 FilmFusion', color: 'geekblue' },
  shadow: { label: '影子模式', color: 'purple' },
};
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

function loadDirectoryPanelVisible(storageKey: string): boolean {
  if (typeof window === 'undefined') {
    return true;
  }
  try {
    return window.localStorage.getItem(storageKey) !== 'false';
  } catch {
    return true;
  }
}

function saveDirectoryPanelVisible(storageKey: string, visible: boolean) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(storageKey, String(visible));
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
type OrganizeShadowFieldRow = {
  key: string;
  stage: string;
  label: string;
  moviepilot: string;
  local: string;
  status: 'matched' | 'different' | 'unavailable';
};
type OrganizeVersionGroup = NonNullable<
  API.Organize115CookieResult['version_groups']
>[number];

const ALL_VERSION_KEY = '__all_versions__';

const organizeRecognitionShadowFields: Array<{
  key: keyof API.OrganizeRecognitionShadowSnapshot;
  label: string;
}> = [
  { key: 'media_type', label: '媒体类型' },
  { key: 'title', label: '标题' },
  { key: 'original_title', label: '原始标题' },
  { key: 'year', label: '年份' },
  { key: 'title_year', label: '标题年份' },
  { key: 'tmdb_id', label: 'TMDB ID' },
  { key: 'category', label: '媒体分类' },
  { key: 'season_episode', label: '季集' },
  { key: 'resource_type', label: '资源类型' },
  { key: 'resource_pix', label: '分辨率' },
  { key: 'video_encode', label: '视频编码' },
  { key: 'begin_season', label: '起始季' },
];

function organizeShadowValue(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    return '-';
  }
  return String(value);
}

export function buildOrganizeShadowFieldRows(
  comparison?: API.Organize115ShadowComparison,
): OrganizeShadowFieldRow[] {
  if (!comparison) return [];
  const differenceKeys = new Set(
    (comparison.differences || []).map(
      (difference) => `${difference.stage}:${difference.field}`,
    ),
  );
  const rows: OrganizeShadowFieldRow[] = [];
  const moviePilotRecognition = comparison.recognition?.moviepilot;
  const localRecognition = comparison.recognition?.local;
  if (comparison.recognition) {
    for (const field of organizeRecognitionShadowFields) {
      const moviePilot = organizeShadowValue(
        moviePilotRecognition?.[field.key],
      );
      const local = organizeShadowValue(localRecognition?.[field.key]);
      if (moviePilot === '-' && local === '-') continue;
      rows.push({
        key: `recognition:${field.key}`,
        stage: '识别',
        label: field.label,
        moviepilot: moviePilot,
        local,
        status:
          !moviePilotRecognition || !localRecognition
            ? 'unavailable'
            : differenceKeys.has(`recognition:${field.key}`)
              ? 'different'
              : 'matched',
      });
    }
  }
  for (const variable of comparison.rename_variables || []) {
    rows.push({
      key: `variable:${variable.name}`,
      stage: '变量',
      label: `${variable.label} (${variable.name})`,
      moviepilot: organizeShadowValue(variable.moviepilot),
      local: organizeShadowValue(variable.local),
      status: differenceKeys.has(`variable:${variable.name}`)
        ? 'different'
        : 'matched',
    });
  }
  if (comparison.transfer) {
    rows.push({
      key: 'transfer:transfer_name',
      stage: '命名',
      label: '重命名',
      moviepilot: organizeShadowValue(comparison.transfer.moviepilot),
      local: organizeShadowValue(comparison.transfer.local),
      status:
        comparison.transfer.moviepilot_error || comparison.transfer.local_error
          ? 'unavailable'
          : differenceKeys.has('transfer:transfer_name')
            ? 'different'
            : 'matched',
    });
  }
  if (
    comparison.moviepilot_target_path ||
    comparison.local_target_path ||
    comparison.local_target_error
  ) {
    rows.push({
      key: 'target:target_path',
      stage: '路径',
      label: '目标路径',
      moviepilot: organizeShadowValue(comparison.moviepilot_target_path),
      local: organizeShadowValue(
        comparison.local_target_error || comparison.local_target_path,
      ),
      status: comparison.local_target_error
        ? 'unavailable'
        : differenceKeys.has('target:target_path')
          ? 'different'
          : 'matched',
    });
  }
  return rows;
}

function renderOrganizeShadowStatus(
  comparison?: API.Organize115ShadowComparison,
) {
  if (!comparison) {
    return <span style={{ color: 'rgba(0,0,0,0.25)' }}>-</span>;
  }
  if (comparison.status === 'matched') {
    return (
      <Tag color="success" icon={<CheckCircleOutlined />}>
        影子一致
      </Tag>
    );
  }
  if (comparison.status === 'different') {
    return (
      <Tag color="warning" icon={<WarningOutlined />}>
        差异 {comparison.differences?.length || 0}
      </Tag>
    );
  }
  const label =
    comparison.status === 'moviepilot_error'
      ? 'MP2 失败'
      : comparison.status === 'local_unavailable'
        ? '本地不可用'
        : '本地失败';
  return (
    <Tag color="error" icon={<CloseCircleOutlined />}>
      {label}
    </Tag>
  );
}

const organizeShadowFieldColumns: TableColumnsType<OrganizeShadowFieldRow> = [
  { title: '阶段', dataIndex: 'stage', key: 'stage', width: 80 },
  { title: '字段', dataIndex: 'label', key: 'label', width: 190 },
  {
    title: 'MP2（主结果）',
    dataIndex: 'moviepilot',
    key: 'moviepilot',
    width: 320,
    render: (value: string) => (
      <Typography.Text
        style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
      >
        {value}
      </Typography.Text>
    ),
  },
  {
    title: 'FilmFusion（影子）',
    dataIndex: 'local',
    key: 'local',
    width: 320,
    render: (value: string) => (
      <Typography.Text
        style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
      >
        {value}
      </Typography.Text>
    ),
  },
  {
    title: '结果',
    dataIndex: 'status',
    key: 'status',
    width: 100,
    render: (status: OrganizeShadowFieldRow['status']) => {
      if (status === 'matched') return <Tag color="success">一致</Tag>;
      if (status === 'different') return <Tag color="warning">有差异</Tag>;
      return <Tag color="error">未完成</Tag>;
    },
  },
];

function renderOrganizeItemExpandedRow(row: OrganizeItemRow) {
  const comparison = row.shadow_comparison;
  if (!comparison) {
    return (
      <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
        {JSON.stringify(row, null, 2)}
      </pre>
    );
  }
  const errors = [
    comparison.recognition?.moviepilot_error,
    comparison.recognition?.local_error,
    comparison.transfer?.moviepilot_error,
    comparison.transfer?.local_error,
    comparison.local_target_error,
  ].filter((value): value is string => !!value);
  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      <Alert
        showIcon
        type={
          comparison.matched ? 'success' : errors.length ? 'error' : 'warning'
        }
        title={
          comparison.matched
            ? 'MP2 与 FilmFusion 的整理结果一致'
            : errors.length
              ? '影子对比未完整完成'
              : `发现 ${comparison.differences?.length || 0} 项差异`
        }
        description={
          errors.length
            ? errors.join('；')
            : 'MP2 始终作为主结果，FilmFusion 仅跟跑并记录差异。'
        }
      />
      <Table<OrganizeShadowFieldRow>
        bordered
        size="small"
        rowKey="key"
        pagination={false}
        scroll={{ x: 990 }}
        columns={organizeShadowFieldColumns}
        dataSource={buildOrganizeShadowFieldRows(comparison)}
      />
      <details>
        <summary style={{ cursor: 'pointer' }}>查看当前条目原始数据</summary>
        <pre style={{ margin: '12px 0 0', whiteSpace: 'pre-wrap' }}>
          {JSON.stringify(row, null, 2)}
        </pre>
      </details>
    </Space>
  );
}

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

function isOrganizeSubtitleItem(row: OrganizeItemRow): boolean {
  return !!row.is_subtitle;
}

function flattenOrganizeMediaItems(
  result?: API.Organize115CookieResult,
): OrganizeItemRow[] {
  return flattenOrganizeItems(result).filter(
    (row) => !isOrganizeSubtitleItem(row),
  );
}

function getInitialPreviewSelection(result: API.Organize115CookieResult) {
  const rows = flattenOrganizeMediaItems(result);
  const versionGroups = result.version_groups || [];
  if (versionGroups.length < 2) {
    return {
      activeVersionKey: ALL_VERSION_KEY,
      selectedRowKeys: getDefaultSelectedItemKeys(rows),
    };
  }
  const preferred =
    versionGroups.find((group) => group.recommended) || versionGroups[0];
  const fileIDs = new Set(preferred.file_ids);
  return {
    activeVersionKey: preferred.key,
    selectedRowKeys: rows
      .filter((row) => fileIDs.has(row.file_id))
      .map(getOrganizeItemRowKey),
  };
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

const renderPreviewStatus = (
  status?: API.OrganizePreviewTaskStatus,
  queuePosition?: number,
) => {
  const meta = status ? previewStatusMeta[status] : undefined;
  if (!meta) return <Tag>-</Tag>;
  const text =
    status === 'pending' && queuePosition
      ? `${meta.text} · 第 ${queuePosition} 位`
      : meta.text;
  return (
    <Tag color={meta.color} icon={meta.icon}>
      {text}
    </Tag>
  );
};

type PreviewRealtimeStatus =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'offline';

const previewRealtimeMeta: Record<
  PreviewRealtimeStatus,
  { text: string; status: 'success' | 'processing' | 'warning' | 'error' }
> = {
  connecting: { text: '实时连接中', status: 'processing' },
  connected: { text: '实时同步', status: 'success' },
  reconnecting: { text: '实时重连中', status: 'warning' },
  offline: { text: '网络离线', status: 'error' },
};

function formatElapsedSeconds(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;
  if (hours > 0) {
    return `${hours}小时${minutes}分${remainingSeconds}秒`;
  }
  if (minutes > 0) {
    return `${minutes}分${remainingSeconds}秒`;
  }
  return `${remainingSeconds}秒`;
}

const formatDateTime = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const useStyles = createStyles(({ css, token }) => ({
  page: css`
    max-width: 1920px;
    margin-inline: auto;
  `,
  workspace: css`
    display: grid;
    grid-template-columns: minmax(280px, 336px) minmax(0, 1fr);
    align-items: start;
    gap: 16px;

    @media (max-width: 991px) {
      grid-template-columns: minmax(0, 1fr);
    }
  `,
  workspaceWithoutDirectory: css`
    grid-template-columns: minmax(0, 1fr);
  `,
  directoryColumn: css`
    position: sticky;
    top: 24px;
    min-width: 0;

    &[hidden] {
      display: none;
    }

    @media (max-width: 991px) {
      position: static;
    }
  `,
  directoryPanelHeader: css`
    display: flex;
    min-height: 48px;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    border-bottom: 1px solid ${token.colorBorderSecondary};
  `,
  directoryPanelTitle: css`
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 8px;
    color: ${token.colorTextHeading};
    font-size: 14px;
    font-weight: 600;
    line-height: 22px;
  `,
  directoryPanelIcon: css`
    color: ${token.colorTextSecondary};
    font-size: 15px;
  `,
  mainColumn: css`
    display: grid;
    min-width: 0;
    gap: 16px;
  `,
  resultSection: css`
    min-width: 0;
  `,
  section: css`
    min-width: 0;
    overflow: hidden;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 12px;
    background: ${token.colorBgContainer};
  `,
  sectionHeader: css`
    box-sizing: border-box;
    display: flex;
    min-height: 48px;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 16px;
    padding: 10px 12px;
    border-bottom: 1px solid ${token.colorBorderSecondary};
  `,
  sectionTitle: css`
    min-width: 0;
    flex: 0 1 auto;
    margin: 0;
    color: ${token.colorTextHeading};
    font-size: 14px;
    font-weight: 600;
    line-height: 22px;
  `,
  sectionExtra: css`
    display: flex;
    min-width: 0;
    max-width: 100%;
    flex: 0 1 auto;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
  `,
  sectionBody: css`
    padding: 16px 20px 20px;

    @media (max-width: 600px) {
      padding: 16px;
    }
  `,
  directoryBody: css`
    padding: 12px;
  `,
  directorySearch: css`
    margin-bottom: 12px;
  `,
  directoryTree: css`
    max-height: calc(100vh - 380px);
    overflow: auto;
    padding: 2px;

    .ant-tree-treenode {
      min-height: 28px;
      padding-block: 0;
    }

    .ant-tree-node-content-wrapper {
      min-width: 0;
      min-height: 28px;
      line-height: 28px;
    }

    @media (max-width: 991px) {
      max-height: 360px;
    }
  `,
  rulesBody: css`
    padding: 12px;
  `,
  rulesToolbar: css`
    display: flex;
    min-width: 0;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px 24px;
  `,
  compactRule: css`
    display: flex;
    min-width: 0;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  `,
  filenameRule: css`
    flex: 1 1 640px;

    @media (max-width: 767px) {
      flex-basis: 100%;
    }
  `,
  compactRuleLabel: css`
    flex: 0 0 auto;
    color: ${token.colorTextHeading};
    font-size: 12px;
    font-weight: 600;
    line-height: 20px;
  `,
  regexPatternInput: css`
    width: min(100%, 260px);
  `,
  regexReplacementInput: css`
    width: min(100%, 160px);
  `,
  selectedSourceStrip: css`
    display: flex;
    min-width: 0;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 6px 8px;
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid ${token.colorBorderSecondary};
  `,
  selectedSourceLabel: css`
    flex: 0 0 auto;
    color: ${token.colorTextHeading};
    font-size: 12px;
    font-weight: 600;
    line-height: 22px;
  `,
  selectionTags: css`
    display: flex;
    min-width: 0;
    flex: 1 1 auto;
    flex-wrap: wrap;
    gap: 6px;

    .ant-tag {
      max-width: 100%;
      margin-inline-end: 0;
    }
  `,
  queueHeaderTitle: css`
    display: inline-flex;
    min-width: 0;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 12px;

    .ant-typography {
      font-size: 12px;
      font-weight: 400;
    }
  `,
  queueSectionBody: css`
    padding: 12px;
  `,
  tableSurface: css`
    .ant-pro-card {
      border: 0;
      background: transparent;
      box-shadow: none;
    }

    .ant-pro-card-body {
      padding: 0;
    }

    .ant-pro-table-list-toolbar-container {
      padding-block: 0 12px;
    }

    .ant-table-container {
      overflow: hidden;
      border: 1px solid ${token.colorBorderSecondary};
      border-radius: 8px;
    }
  `,
  resultTabs: css`
    .ant-tabs-nav {
      margin-bottom: 16px;
    }
  `,
  resultEmpty: css`
    display: grid;
    min-height: 220px;
    place-items: center;
  `,
  rawResponse: css`
    max-height: 480px;
    margin: 0;
    overflow: auto;
    padding: 16px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 8px;
    background: ${token.colorFillQuaternary};
    color: ${token.colorText};
    font-family: ${token.fontFamilyCode};
    font-size: 12px;
    line-height: 20px;
    white-space: pre-wrap;
  `,
  actionDockSpacer: css`
    height: 96px;

    @media (max-width: 639px) {
      height: 148px;
    }
  `,
  actionDock: css`
    position: fixed;
    right: 12px;
    bottom: 12px;
    left: 12px;
    z-index: 99;
    display: flex;
    box-sizing: border-box;
    width: auto;
    max-width: max-content;
    flex-direction: column;
    gap: 8px;
    padding: 10px 12px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 12px;
    background: color-mix(in srgb, ${token.colorBgElevated} 92%, transparent);
    box-shadow: ${token.boxShadowSecondary};
    backdrop-filter: blur(20px);

    @media (min-width: 640px) {
      left: auto;
    }

    @media (min-width: 1024px) {
      right: 24px;
      bottom: 20px;
      max-width: calc(100vw - var(--app-sidebar-offset) - 48px);
    }

    @media (min-width: 1280px) {
      flex-direction: row;
      align-items: center;
    }
  `,
  actionDockMeta: css`
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 8px;
    padding-inline: 2px;
  `,
  actionDockDivider: css`
    width: 100%;
    height: 1px;
    flex: 0 0 auto;
    background: ${token.colorBorderSecondary};

    @media (min-width: 1280px) {
      width: 1px;
      height: 24px;
    }
  `,
  actionDockControls: css`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;

    @media (max-width: 479px) {
      .ant-btn {
        flex: 1 1 auto;
      }
    }
  `,
}));

type WorkspaceSectionProps = {
  bodyClassName?: string;
  children: React.ReactNode;
  extra?: React.ReactNode;
  title: React.ReactNode;
};

const WorkspaceSection: React.FC<WorkspaceSectionProps> = ({
  bodyClassName,
  children,
  extra,
  title,
}) => {
  const { styles } = useStyles();

  return (
    <section className={styles.section}>
      <header className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        {extra ? <div className={styles.sectionExtra}>{extra}</div> : null}
      </header>
      <div
        className={`${styles.sectionBody}${bodyClassName ? ` ${bodyClassName}` : ''}`}
      >
        {children}
      </div>
    </section>
  );
};

type OrganizePageProps = {
  episodeMode?: boolean;
};

const OrganizePage: React.FC<OrganizePageProps> = ({ episodeMode = false }) => {
  const { styles } = useStyles();
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const directoryId = Number(params.id);
  const filenameRegexStorageKey = episodeMode
    ? EPISODE_FILENAME_REGEX_STORAGE_KEY
    : FILENAME_REGEX_STORAGE_KEY;
  const directoryPanelVisibleStorageKey = episodeMode
    ? EPISODE_DIRECTORY_PANEL_VISIBLE_STORAGE_KEY
    : DIRECTORY_PANEL_VISIBLE_STORAGE_KEY;
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
  const [directoryPanelVisible, setDirectoryPanelVisible] = useState(() =>
    loadDirectoryPanelVisible(directoryPanelVisibleStorageKey),
  );
  const [filenameRegexConfig, setFilenameRegexConfig] =
    useState<FilenameRegexConfig>(() =>
      loadFilenameRegexConfig(filenameRegexStorageKey, defaultRegexConfig),
    );
  const [organizeMediaType, setOrganizeMediaType] = useState<OrganizeMediaType>(
    episodeMode ? 'tv' : 'auto',
  );
  const [organizeRecognitionSource, setOrganizeRecognitionSource] =
    useState<RecognitionSource>('shadow');
  const [organizeCategory, setOrganizeCategory] = useState<string>();
  const [bestVersionEnabled, setBestVersionEnabled] = useState(episodeMode);
  const [previewOptionsOpen, setPreviewOptionsOpen] = useState(false);
  const [previewMediaTypeDraft, setPreviewMediaTypeDraft] =
    useState<OrganizeMediaType>(episodeMode ? 'tv' : 'auto');
  const [previewRecognitionSourceDraft, setPreviewRecognitionSourceDraft] =
    useState<RecognitionSource>('shadow');
  const recognitionSourceOverriddenRef = useRef(false);
  const [previewCategoryDraft, setPreviewCategoryDraft] = useState<string>();
  const [previewBestVersionDraft, setPreviewBestVersionDraft] =
    useState(episodeMode);
  const [previewIntervalDraft, setPreviewIntervalDraft] = useState(45);
  const [previewRecursiveDepthDraft, setPreviewRecursiveDepthDraft] =
    useState(1);
  const [previewTaskLimitDraft, setPreviewTaskLimitDraft] = useState(
    DEFAULT_PREVIEW_TASK_LIMIT,
  );
  const [categoryConfig, setCategoryConfig] =
    useState<API.OrganizeCategoryConfigResult>();
  const [previewIntervalSeconds, setPreviewIntervalSeconds] = useState(45);
  const [previewRecursiveDepth, setPreviewRecursiveDepth] = useState(1);
  const [previewTaskLimit, setPreviewTaskLimit] = useState(
    DEFAULT_PREVIEW_TASK_LIMIT,
  );
  const previewResultRef = useRef<HTMLDivElement>(null);
  const applyingPreviewTaskRef = useRef<API.OrganizePreviewTask | undefined>(
    undefined,
  );
  const requeuePreviewTaskAfterApplyRef = useRef(false);
  const clearingPreviewTaskStatusRef = useRef<
    API.OrganizePreviewTaskStatus | undefined
  >(undefined);

  const [dryRun, setDryRun] = useState(true);
  const [organizeRequestMode, setOrganizeRequestMode] = useState<
    'dry' | 'apply'
  >();
  const [resultData, setResultData] = useState<API.Organize115CookieResult>();
  const [activePreviewTask, setActivePreviewTask] =
    useState<API.OrganizePreviewTask>();
  const [assignTMDBTask, setAssignTMDBTask] =
    useState<API.OrganizePreviewTask>();
  const [assignTMDBID, setAssignTMDBID] = useState('');
  const [assignTMDBLoading, setAssignTMDBLoading] = useState(false);
  const [rawResponse, setRawResponse] = useState<unknown>();
  const [selectedItemRowKeys, setSelectedItemRowKeys] = useState<React.Key[]>(
    [],
  );
  const [activeVersionKey, setActiveVersionKey] = useState(ALL_VERSION_KEY);
  const effectiveMediaType: OrganizeMediaType = episodeMode
    ? 'tv'
    : organizeMediaType;

  useEffect(() => {
    let cancelled = false;
    void getAppConfig()
      .then((response) => {
        const source = response.data?.config?.media_recognition?.source;
        if (
          cancelled ||
          recognitionSourceOverriddenRef.current ||
          (source !== 'moviepilot' && source !== 'local' && source !== 'shadow')
        ) {
          return;
        }
        setOrganizeRecognitionSource(source);
        setPreviewRecognitionSourceDraft(source);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (episodeMode) {
      setOrganizeMediaType('tv');
      setBestVersionEnabled(true);
    }
  }, [episodeMode]);

  useEffect(() => {
    saveDirectoryPanelVisible(
      directoryPanelVisibleStorageKey,
      directoryPanelVisible,
    );
  }, [directoryPanelVisible, directoryPanelVisibleStorageKey]);

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
  } = useApiRequest(
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
    useApiRequest(getOrganizeCategoryConfig, {
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
    setPreviewRecognitionSourceDraft(organizeRecognitionSource);
    setPreviewCategoryDraft(organizeCategory);
    setPreviewBestVersionDraft(bestVersionEnabled);
    setPreviewIntervalDraft(previewIntervalSeconds);
    setPreviewRecursiveDepthDraft(previewRecursiveDepth);
    setPreviewTaskLimitDraft(previewTaskLimit);
    setPreviewOptionsOpen(true);
    refreshCategoryConfig();
  }, [
    bestVersionEnabled,
    checkedKeys.length,
    effectiveMediaType,
    messageApi,
    organizeCategory,
    organizeRecognitionSource,
    previewIntervalSeconds,
    previewRecursiveDepth,
    previewTaskLimit,
    refreshCategoryConfig,
  ]);

  const [previewTasksResolvedDirectoryId, setPreviewTasksResolvedDirectoryId] =
    useState<number>();
  const [previewRealtimeStatus, setPreviewRealtimeStatus] =
    useState<PreviewRealtimeStatus>('connecting');
  const [previewClockMs, setPreviewClockMs] = useState(() => Date.now());
  const previewRealtimeRefreshTimerRef = useRef<
    ReturnType<typeof setTimeout> | undefined
  >(undefined);
  const {
    data: previewTasksData,
    loading: previewTasksLoading,
    refresh: refreshPreviewTasks,
  } = useApiRequest(
    () =>
      getOrganizePreviewTasks({
        cloud_directory_id: directoryId,
      }),
    {
      ready: Number.isFinite(directoryId) && directoryId > 0,
      refreshDeps: [directoryId],
      formatResult: (res) => res.data?.list || [],
      onSuccess: () => setPreviewTasksResolvedDirectoryId(directoryId),
      onError: () => setPreviewTasksResolvedDirectoryId(directoryId),
    },
  );
  const previewTasksResolved = previewTasksResolvedDirectoryId === directoryId;
  const previewTasks = previewTasksResolved ? previewTasksData || [] : [];
  const processingPreviewTask = previewTasks.find(
    (task) => task.status === 'processing',
  );
  const queuedPreviewTaskCount = previewTasks.filter(
    (task) => task.status === 'pending',
  ).length;
  const previewTasksInitialLoading =
    previewTasksLoading && !previewTasksResolved;
  const [previewTasksManualRefreshing, setPreviewTasksManualRefreshing] =
    useState(false);
  const handleRefreshPreviewTasks = useCallback(async () => {
    setPreviewTasksManualRefreshing(true);
    try {
      await refreshPreviewTasks();
    } catch (error: any) {
      messageApi.error(error?.message || '刷新预整理队列失败');
    } finally {
      setPreviewTasksManualRefreshing(false);
    }
  }, [messageApi, refreshPreviewTasks]);

  useEffect(() => {
    if (!Number.isFinite(directoryId) || directoryId <= 0) {
      setPreviewRealtimeStatus('offline');
      return;
    }

    let stopped = false;
    let connectedOnce = false;
    let retryDelay = 1000;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;

    const scheduleRefresh = () => {
      if (stopped || previewRealtimeRefreshTimerRef.current) return;
      previewRealtimeRefreshTimerRef.current = setTimeout(() => {
        previewRealtimeRefreshTimerRef.current = undefined;
        void refreshPreviewTasks().catch(() => undefined);
      }, 120);
    };

    const connect = async () => {
      if (stopped) return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setPreviewRealtimeStatus('offline');
        reconnectTimer = setTimeout(() => void connect(), 3000);
        return;
      }

      setPreviewRealtimeStatus(connectedOnce ? 'reconnecting' : 'connecting');
      controller = new AbortController();
      try {
        await subscribeOrganizePreviewTaskEvents(
          { cloud_directory_id: directoryId },
          {
            signal: controller.signal,
            onOpen: () => {
              if (stopped) return;
              connectedOnce = true;
              retryDelay = 1000;
              setPreviewRealtimeStatus('connected');
              scheduleRefresh();
            },
            onEvent: () => {
              if (stopped) return;
              setPreviewRealtimeStatus('connected');
              scheduleRefresh();
            },
          },
        );
      } catch {
        if (stopped || controller.signal.aborted) return;
      }

      if (stopped) return;
      setPreviewRealtimeStatus(
        typeof navigator !== 'undefined' && !navigator.onLine
          ? 'offline'
          : 'reconnecting',
      );
      reconnectTimer = setTimeout(() => void connect(), retryDelay);
      retryDelay = Math.min(retryDelay * 2, 15000);
    };

    void connect();
    return () => {
      stopped = true;
      controller?.abort();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (previewRealtimeRefreshTimerRef.current) {
        clearTimeout(previewRealtimeRefreshTimerRef.current);
        previewRealtimeRefreshTimerRef.current = undefined;
      }
    };
  }, [directoryId, refreshPreviewTasks]);

  useEffect(() => {
    if (!processingPreviewTask) return;
    setPreviewClockMs(Date.now());
    const timer = setInterval(() => setPreviewClockMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [processingPreviewTask]);

  const processingElapsedSeconds = processingPreviewTask?.started_at
    ? (previewClockMs - new Date(processingPreviewTask.started_at).getTime()) /
      1000
    : 0;

  useEffect(() => {
    if (previewRealtimeStatus === 'connected') return;
    const timer = setInterval(() => {
      void refreshPreviewTasks().catch(() => undefined);
    }, 8000);
    return () => clearInterval(timer);
  }, [previewRealtimeStatus, refreshPreviewTasks]);

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
    setActiveVersionKey(ALL_VERSION_KEY);
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
    setActiveVersionKey(ALL_VERSION_KEY);
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

  const { runAsync: runOrganize, loading: organizeLoading } = useApiRequest(
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
        const sourceFolderDeletePendingCount =
          typeof payload?.source_folder_delete_pending_count === 'number'
            ? payload.source_folder_delete_pending_count
            : payload?.source_folder_delete_pending
              ? 1
              : 0;
        const sourceFolderDeletePendingSuffix =
          !payload?.dry_run && sourceFolderDeletePendingCount > 0
            ? `，${sourceFolderDeletePendingCount} 个原文件夹将在字幕全部下载完成后自动删除`
            : '';
        messageApi.success(
          `${text}${suffix}${payload?.dry_run ? '（演练）' : ''}${sourceFolderDeletedSuffix}${sourceFolderDeletePendingSuffix}`,
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
          const selection = getInitialPreviewSelection(payload);
          setResultData(payload);
          setActivePreviewTask(undefined);
          setRawResponse(response);
          setActiveVersionKey(selection.activeVersionKey);
          setSelectedItemRowKeys(selection.selectedRowKeys);
        } else {
          const appliedPreviewTask = applyingPreviewTaskRef.current;
          const shouldRequeuePreviewTask =
            requeuePreviewTaskAfterApplyRef.current;
          const failedApplyGroups = (payload?.groups || []).filter(
            (group) => !!group.error,
          );
          applyingPreviewTaskRef.current = undefined;
          requeuePreviewTaskAfterApplyRef.current = false;
          if (appliedPreviewTask && failedApplyGroups.length > 0) {
            messageApi.warning(
              `有 ${failedApplyGroups.length} 个分组整理失败，已保留源目录和预整理任务，未删除其他版本`,
            );
            refreshPreviewTasks();
          } else if (appliedPreviewTask && shouldRequeuePreviewTask) {
            requeueOrganizePreviewTask(appliedPreviewTask.id)
              .then(() => {
                messageApi.success(
                  '所选版本整理完成，已保留其他版本并重新加入预整理队列',
                );
                refreshPreviewTasks();
              })
              .catch((error: any) => {
                messageApi.warning(
                  error?.message ||
                    '所选版本整理完成，但重新生成预整理任务失败，请在队列中手动重试',
                );
                refreshPreviewTasks();
              });
          } else if (appliedPreviewTask) {
            deleteOrganizePreviewTask(appliedPreviewTask.id)
              .then(() => {
                messageApi.success('已从预整理队列移除');
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
          setActiveVersionKey(ALL_VERSION_KEY);
          setCheckedKeys([]);
        }
      },
      onError: (error: any) => {
        applyingPreviewTaskRef.current = undefined;
        requeuePreviewTaskAfterApplyRef.current = false;
        messageApi.error(error?.message || '整理失败，请重试');
      },
    },
  );

  const runOrganizeWithMode = useCallback(
    (params: API.Organize115CookieParams) => {
      setOrganizeRequestMode(params.dry_run ? 'dry' : 'apply');
      return runOrganize(params).finally(() => {
        setOrganizeRequestMode(undefined);
      });
    },
    [runOrganize],
  );

  const { run: runCreatePreviewTasks, loading: createPreviewLoading } =
    useApiRequest(createOrganizePreviewTasks, {
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
          `已加入预整理队列${payload?.total ? ` ${payload.total} 个目录` : ''}${
            payload?.task_limit ? `（第一层最多 ${payload.task_limit} 个）` : ''
          }`,
        );
        refreshPreviewTasks();
      },
      onError: (error: any) => {
        messageApi.error(error?.message || '加入预整理队列失败');
      },
    });

  const { run: runLoadPreviewTask, loading: loadPreviewTaskLoading } =
    useApiRequest(getOrganizePreviewTask, {
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
        recognitionSourceOverriddenRef.current = true;
        setOrganizeRecognitionSource(
          payload.task?.recognition_source || 'shadow',
        );
        setOrganizeCategory(payload.task?.category || undefined);
        setBestVersionEnabled(!!payload.task?.best_version_enabled);
        const selection = getInitialPreviewSelection(previewResult);
        setResultData(previewResult);
        setRawResponse(response);
        setActiveVersionKey(selection.activeVersionKey);
        setSelectedItemRowKeys(selection.selectedRowKeys);
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
    useApiRequest(requeueOrganizePreviewTask, {
      manual: true,
      onSuccess: () => {
        messageApi.success('已重新加入预整理队列');
        refreshPreviewTasks();
      },
      onError: (error: any) => {
        messageApi.error(error?.message || '重新加入队列失败');
      },
    });

  const openAssignTMDB = useCallback((task: API.OrganizePreviewTask) => {
    setAssignTMDBTask(task);
    setAssignTMDBID('');
  }, []);

  const closeAssignTMDB = useCallback(() => {
    if (assignTMDBLoading) return;
    setAssignTMDBTask(undefined);
    setAssignTMDBID('');
  }, [assignTMDBLoading]);

  const confirmAssignTMDB = useCallback(async () => {
    const tmdbID = assignTMDBID.trim();
    if (!assignTMDBTask || !/^[1-9]\d{0,19}$/.test(tmdbID)) {
      messageApi.warning('请输入有效的 TMDB ID');
      return;
    }
    setAssignTMDBLoading(true);
    try {
      await assignOrganizePreviewTaskTMDB(assignTMDBTask.id, {
        tmdb_id: tmdbID,
      });
      messageApi.success('已为文件夹内全部文件指定 TMDB，并重新加入预整理队列');
      setAssignTMDBTask(undefined);
      setAssignTMDBID('');
      refreshPreviewTasks();
    } catch (error: any) {
      messageApi.error(error?.message || '指定 TMDB ID 失败');
    } finally {
      setAssignTMDBLoading(false);
    }
  }, [assignTMDBID, assignTMDBTask, messageApi, refreshPreviewTasks]);

  const { run: runDeletePreviewTask, loading: deletePreviewLoading } =
    useApiRequest(deleteOrganizePreviewTask, {
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
  const pendingPreviewTaskCount = useMemo(
    () => previewTasks.filter((task) => task.status === 'pending').length,
    [previewTasks],
  );
  const clearablePreviewTaskCount = useMemo(
    () => previewTasks.filter((task) => task.status !== 'processing').length,
    [previewTasks],
  );

  const { run: runClearPreviewTasks, loading: clearPreviewTasksLoading } =
    useApiRequest(clearOrganizePreviewTasks, {
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
          clearedStatus === 'pending'
            ? `已移除排队中任务 ${deletedCount} 个`
            : clearedStatus === 'failed'
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
          setActiveVersionKey(ALL_VERSION_KEY);
        }
      },
      onError: (error: any) => {
        clearingPreviewTaskStatusRef.current = undefined;
        messageApi.error(error?.message || '清理预整理队列失败');
      },
    });

  const confirmClearPreviewTasks = useCallback(
    (status?: API.OrganizePreviewTaskStatus) => {
      const isPendingOnly = status === 'pending';
      const isFailedOnly = status === 'failed';
      const count = isPendingOnly
        ? pendingPreviewTaskCount
        : isFailedOnly
          ? failedPreviewTaskCount
          : clearablePreviewTaskCount;
      if (count <= 0) {
        messageApi.info(
          isPendingOnly
            ? '没有排队中任务可移除'
            : isFailedOnly
              ? '没有失败任务可清理'
              : '没有任务可清理',
        );
        return;
      }

      modalApi.confirm({
        title: isPendingOnly
          ? '移除排队中预整理任务？'
          : isFailedOnly
            ? '清理失败预整理任务？'
            : '清理全部预整理任务？',
        content: isPendingOnly
          ? `将移除当前目录配置下 ${count} 个排队中任务，不影响正在处理的任务。`
          : isFailedOnly
            ? `将删除当前目录配置下 ${count} 个失败任务。`
            : `将删除当前目录配置下 ${count} 个非处理中任务，正在处理的任务会保留。`,
        okText: isPendingOnly ? '移除' : '清理',
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
      pendingPreviewTaskCount,
      runClearPreviewTasks,
    ],
  );

  const flatItemsForTable = useMemo<OrganizeItemRow[]>(
    () => flattenOrganizeMediaItems(resultData),
    [resultData],
  );

  const versionGroups = useMemo<OrganizeVersionGroup[]>(
    () => resultData?.version_groups || [],
    [resultData?.version_groups],
  );

  const activeVersionGroup = useMemo(
    () => versionGroups.find((group) => group.key === activeVersionKey),
    [activeVersionKey, versionGroups],
  );

  const visibleItemsForTable = useMemo(() => {
    if (!activeVersionGroup) {
      return flatItemsForTable;
    }
    const fileIDs = new Set(activeVersionGroup.file_ids);
    return flatItemsForTable.filter((row) => fileIDs.has(row.file_id));
  }, [activeVersionGroup, flatItemsForTable]);

  const handleVersionTabChange = useCallback(
    (key: string) => {
      setActiveVersionKey(key);
      if (key === ALL_VERSION_KEY) {
        setSelectedItemRowKeys(getDefaultSelectedItemKeys(flatItemsForTable));
        return;
      }
      const group = versionGroups.find((item) => item.key === key);
      if (!group) {
        return;
      }
      const fileIDs = new Set(group.file_ids);
      setSelectedItemRowKeys(
        flatItemsForTable
          .filter((row) => fileIDs.has(row.file_id))
          .map(getOrganizeItemRowKey),
      );
    },
    [flatItemsForTable, versionGroups],
  );

  const selectedItemRowsForApply = useMemo(() => {
    const selectedSet = new Set(selectedItemRowKeys.map((key) => String(key)));
    return flatItemsForTable.filter((row) =>
      selectedSet.has(getOrganizeItemRowKey(row)),
    );
  }, [flatItemsForTable, selectedItemRowKeys]);

  const unselectedItemCount = Math.max(
    0,
    flatItemsForTable.length - selectedItemRowsForApply.length,
  );

  const confirmDeletePreviewTask = useCallback(
    (row: API.OrganizePreviewTask) => {
      const folderLabel = row.folder_path || row.folder_name || row.folder_id;
      let deleteSourceFolder = true;
      modalApi.confirm({
        title: '删除预整理任务？',
        content: (
          <Space orientation="vertical" size={8}>
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
        recognition_source: organizeRecognitionSource,
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
      organizeRecognitionSource,
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
        task_limit: options.taskLimit,
        recognition_source: options.recognitionSource,
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
      recognitionSource: previewRecognitionSourceDraft,
      category: previewCategoryDraft,
      bestVersionEnabled: previewBestVersionDraft,
      intervalSeconds: previewIntervalDraft,
      recursiveDepth: previewRecursiveDepthDraft,
      taskLimit: previewTaskLimitDraft,
    };
    if (triggerPreviewQueue(options)) {
      setOrganizeMediaType(previewMediaTypeDraft);
      setOrganizeRecognitionSource(previewRecognitionSourceDraft);
      setOrganizeCategory(previewCategoryDraft);
      setBestVersionEnabled(previewBestVersionDraft);
      setPreviewIntervalSeconds(previewIntervalDraft);
      setPreviewRecursiveDepth(previewRecursiveDepthDraft);
      setPreviewTaskLimit(previewTaskLimitDraft);
      setPreviewOptionsOpen(false);
    }
  }, [
    previewBestVersionDraft,
    previewCategoryDraft,
    previewIntervalDraft,
    previewMediaTypeDraft,
    previewRecognitionSourceDraft,
    previewRecursiveDepthDraft,
    previewTaskLimitDraft,
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
        requeuePreviewTaskAfterApplyRef.current = false;
        runOrganizeWithMode(organizeParams);
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
            ? activeVersionGroup
              ? `确认只整理“${activeVersionGroup.label}”版本？`
              : `确认整理此目录的 ${selectedItemRowsForApply.length} 条处理明细？`
            : `确认整理 ${selectedItemRowsForApply.length} 条处理明细？`,
          content: (
            <Space orientation="vertical" size={8}>
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
              {activeVersionGroup ? (
                <Alert
                  type="info"
                  showIcon
                  title={`${activeVersionGroup.label}：${
                    activeVersionGroup.episode_count > 0
                      ? `${activeVersionGroup.episode_count} 集`
                      : `${activeVersionGroup.file_count} 个文件`
                  }`}
                  description={`本次选择 ${selectedItemRowsForApply.length} 个文件，原目录另有 ${unselectedItemCount} 个未选文件。`}
                />
              ) : null}
              <Space orientation="vertical" size={4}>
                <Checkbox
                  defaultChecked
                  onChange={(event) => {
                    deleteSourceFolder = event.target.checked;
                  }}
                >
                  {activeVersionGroup
                    ? '只保留此版本，整理后删除其他版本'
                    : '整理完成后删除原文件夹'}
                </Checkbox>
                <Typography.Text type="secondary">
                  {activeVersionGroup
                    ? `勾选后仅在所选版本整理成功且相关字幕全部下载完成后删除原文件夹，其中 ${unselectedItemCount} 个未选文件也会一并移入 115 回收站；下载失败时保留原文件夹。取消勾选则保留其他版本，并重新生成预整理任务。`
                    : '仅在整理成功且本次字幕全部下载完成后执行；下载失败时会保留原文件夹。'}
                </Typography.Text>
              </Space>
            </Space>
          ),
          okText: '执行整理',
          okButtonProps: { danger: true },
          cancelText: '取消',
          onOk: () => {
            applyingPreviewTaskRef.current = activePreviewTask;
            requeuePreviewTaskAfterApplyRef.current =
              !!activePreviewTask &&
              !!activeVersionGroup &&
              !deleteSourceFolder;
            runOrganizeWithMode(
              deleteSourceFolder
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
          <Space orientation="vertical" size={8}>
            <Typography.Text>
              将对这些 115 目录依次执行真实整理（创建/重命名/移动/字幕下载）。
              单个目录失败不会阻断其它，错误会标注在对应分组上。
            </Typography.Text>
            <Space orientation="vertical" size={4}>
              <Checkbox
                defaultChecked
                onChange={(event) => {
                  deleteSourceFolder = event.target.checked;
                }}
              >
                整理完成后删除原文件夹
              </Checkbox>
              <Typography.Text type="secondary">
                仅在整理成功且本次字幕全部下载完成后执行；下载失败时会保留原文件夹。
              </Typography.Text>
            </Space>
          </Space>
        ),
        okText: '执行整理',
        okButtonProps: { danger: true },
        cancelText: '取消',
        onOk: () => {
          applyingPreviewTaskRef.current = undefined;
          requeuePreviewTaskAfterApplyRef.current = false;
          runOrganizeWithMode(
            deleteSourceFolder
              ? { ...organizeParams, delete_source_folder: true }
              : organizeParams,
          );
        },
      });
    },
    [
      activePreviewTask,
      activeVersionGroup,
      buildOrganizeParams,
      checkedKeys,
      episodeMode,
      messageApi,
      modalApi,
      resultData?.dry_run,
      runOrganizeWithMode,
      selectedItemRowsForApply,
      unselectedItemCount,
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
        title: '类型/分类',
        dataIndex: 'media_type',
        width: 180,
        ellipsis: true,
        render: (_, row) =>
          [organizeMediaTypeText(row.media_type), row.category]
            .map((value) => value?.trim())
            .filter(Boolean)
            .join(' / ') || '-',
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
        title: '影子对比',
        dataIndex: 'shadow_comparison',
        width: 140,
        hideInTable: resultData?.recognition_source !== 'shadow',
        render: (_, row) => renderOrganizeShadowStatus(row.shadow_comparison),
      },
      {
        title: '重命名为',
        dataIndex: 'rename_to',
        width: 180,
        ellipsis: true,
        sorter: (left, right) =>
          (left.rename_to || '').localeCompare(right.rename_to || '', 'zh-CN', {
            numeric: true,
            sensitivity: 'base',
          }),
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
      {
        title: '版本',
        dataIndex: 'best_version',
        width: 130,
        render: (_, row) => renderVersionTag(row),
      },
    ],
    [buildPathByKey, episodeMode, resultData?.recognition_source],
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
        width: 180,
        fixed: 'left',
        render: (_, row) => {
          const multiEpisodeCount = row.multi_episode_count || 0;
          const multiEpisodeExamples = row.multi_episode_examples || [];
          return (
            <Space size={[4, 4]} wrap>
              {renderPreviewStatus(row.status, row.queue_position)}
              {row.all_episodes_exist ? (
                <Tooltip title="预整理结果中的每一集都已在本地媒体库中存在">
                  <Tag
                    color="cyan"
                    icon={<CheckCircleOutlined />}
                    style={{ marginInlineEnd: 0, whiteSpace: 'nowrap' }}
                  >
                    已存在全集
                  </Tag>
                </Tooltip>
              ) : null}
              {multiEpisodeCount > 0 ? (
                <Tooltip
                  title={`“重命名为”检测到 ${multiEpisodeCount} 个多集命名${
                    multiEpisodeExamples.length
                      ? `：${multiEpisodeExamples.join('、')}`
                      : ''
                  }`}
                >
                  <Tag
                    color="warning"
                    icon={<WarningOutlined />}
                    style={{ marginInlineEnd: 0, whiteSpace: 'nowrap' }}
                  >
                    {multiEpisodeExamples[0]
                      ? `含 ${multiEpisodeExamples[0]}`
                      : `多集命名 ${multiEpisodeCount}`}
                  </Tag>
                </Tooltip>
              ) : null}
            </Space>
          );
        },
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
        title: '识别方式',
        dataIndex: 'recognition_source',
        width: 130,
        render: (_, row) => {
          const mode = recognitionSourcePresentation[row.recognition_source];
          return (
            <Tag color={mode.color} style={{ marginInlineEnd: 0 }}>
              {mode.label}
            </Tag>
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
        width: 170,
        render: (_, row) => {
          const tmdbSeasons = (row.tmdb_refs || []).flatMap((ref) =>
            (ref.seasons || [])
              .filter((season) => season.episode_count !== undefined)
              .map((season) => ({ ...season, tmdbId: ref.tmdb_id })),
          );
          return (
            <Space orientation="vertical" size={2}>
              <Tag style={{ marginInlineEnd: 0 }}>本地 {row.total || 0}</Tag>
              {tmdbSeasons.map((season) => (
                <Tag
                  key={`${season.tmdbId}:${season.season_number}`}
                  color="blue"
                  style={{ marginInlineEnd: 0, whiteSpace: 'nowrap' }}
                >
                  TMDB 第{season.season_number}季 {season.episode_count} 集
                </Tag>
              ))}
            </Space>
          );
        },
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
        width: 360,
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
              <Button
                size="small"
                type="link"
                icon={<TagOutlined />}
                disabled={isProcessing}
                loading={assignTMDBLoading && assignTMDBTask?.id === row.id}
                onClick={() => openAssignTMDB(row)}
              >
                指定 TMDB
              </Button>
              {refs.length > 0 ? (
                <Dropdown
                  trigger={['click']}
                  placement="bottomRight"
                  destroyOnHidden={false}
                  menu={{
                    items: refs.map((ref, index) => {
                      const title = ref.title
                        ? `${ref.title}${ref.year ? ` (${ref.year})` : ''}`
                        : `TMDB ${ref.tmdb_id}`;
                      return {
                        key: `${ref.media_type || 'media'}:${ref.tmdb_id}`,
                        label: (
                          <HDHiveResourcesButton
                            tmdbId={ref.tmdb_id}
                            mediaType={ref.media_type}
                            title={title}
                            buttonText={
                              refs.length > 1 ? `HDHive ${index + 1}` : 'HDHive'
                            }
                          />
                        ),
                      };
                    }),
                  }}
                >
                  <Button
                    size="small"
                    type="link"
                    title="更多"
                    aria-label="更多操作"
                    icon={<MoreOutlined />}
                  />
                </Dropdown>
              ) : null}
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
      assignTMDBLoading,
      assignTMDBTask,
      loadPreviewTaskLoading,
      openAssignTMDB,
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
      <ConsolePage
        eyebrow="Media organize"
        title={episodeMode ? '剧集预整理' : '整理目录'}
      >
        <Result
          status="error"
          title="加载目录配置失败"
          subTitle={(directoryError as Error)?.message || '请返回列表重试'}
          extra={[
            <Button key="back" onClick={() => navigate('/directories')}>
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
      </ConsolePage>
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
    ? activeVersionGroup
      ? `整理此版本 (${selectedItemRowsForApply.length}/${visibleItemsForTable.length})`
      : `确认整理 (${selectedItemRowsForApply.length}/${flatItemsForTable.length})`
    : `确认整理 (${checkedKeys.length})`;
  const activePreviewTaskLabel = activePreviewTask
    ? activePreviewTask.folder_path ||
      activePreviewTask.folder_name ||
      activePreviewTask.folder_id
    : undefined;

  return (
    <ConsolePage
      actions={headerExtra}
      className={styles.page}
      eyebrow="Media organize"
      title={`${episodeMode ? '剧集预整理' : '整理目录'}：${
        directoryDetail?.directory_name || ''
      }`}
      titlePrefix={
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/directories')}
        >
          返回目录
        </Button>
      }
    >
      {contextHolder}
      {modalContextHolder}
      <Spin fullscreen spinning={directoryLoading && !directoryDetail} />

      <div
        className={`${styles.workspace}${
          directoryPanelVisible ? '' : ` ${styles.workspaceWithoutDirectory}`
        }`}
      >
        <aside
          className={styles.directoryColumn}
          hidden={!directoryPanelVisible}
        >
          <section className={styles.section}>
            <header className={styles.directoryPanelHeader}>
              <div className={styles.directoryPanelTitle}>
                <FolderOpenOutlined
                  aria-hidden="true"
                  className={styles.directoryPanelIcon}
                />
                <span>115 目录</span>
              </div>
              <Space size={4}>
                <Tag
                  color={checkedKeys.length > 0 ? 'blue' : 'default'}
                  style={{ marginInlineEnd: 0 }}
                >
                  已选 {checkedKeys.length}
                </Tag>
                <Button
                  aria-label="隐藏 115 目录栏"
                  icon={<EyeInvisibleOutlined />}
                  onClick={() => setDirectoryPanelVisible(false)}
                  size="small"
                  type="text"
                >
                  隐藏
                </Button>
              </Space>
            </header>
            <div className={`${styles.sectionBody} ${styles.directoryBody}`}>
              <Input.Search
                allowClear
                className={styles.directorySearch}
                placeholder="搜索目录"
                size="small"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
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
                    className={styles.directoryTree}
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
                  />
                )}
              </Spin>
            </div>
          </section>
        </aside>

        <div className={styles.mainColumn}>
          <section className={styles.section}>
            <div className={styles.rulesBody}>
              <div className={styles.rulesToolbar}>
                {!directoryPanelVisible ? (
                  <Button
                    aria-label="显示 115 目录栏"
                    icon={<EyeOutlined />}
                    onClick={() => setDirectoryPanelVisible(true)}
                    size="small"
                    type="text"
                  >
                    显示 115 目录
                  </Button>
                ) : null}
                <div className={styles.compactRule}>
                  <span className={styles.compactRuleLabel}>识别方式</span>
                  <Segmented<RecognitionSource>
                    name="organize-recognition-source"
                    size="small"
                    value={organizeRecognitionSource}
                    options={recognitionSourceOptions}
                    disabled={organizeLoading || createPreviewLoading}
                    onChange={(value) => {
                      recognitionSourceOverriddenRef.current = true;
                      setOrganizeRecognitionSource(value);
                    }}
                  />
                </div>

                <div className={`${styles.compactRule} ${styles.filenameRule}`}>
                  <span className={styles.compactRuleLabel}>文件名处理</span>
                  <Button
                    size="small"
                    type={filenameRegexConfig.enabled ? 'primary' : 'default'}
                    onClick={() =>
                      updateFilenameRegexConfig({
                        enabled: !filenameRegexConfig.enabled,
                      })
                    }
                  >
                    {filenameRegexConfig.enabled ? '已开启' : '未开启'}
                  </Button>
                  <Input
                    className={styles.regexPatternInput}
                    size="small"
                    prefix="正则"
                    value={filenameRegexConfig.pattern}
                    onChange={(e) =>
                      updateFilenameRegexConfig({ pattern: e.target.value })
                    }
                  />
                  <Input
                    className={styles.regexReplacementInput}
                    size="small"
                    prefix="替换为"
                    value={filenameRegexConfig.replacement}
                    onChange={(e) =>
                      updateFilenameRegexConfig({
                        replacement: e.target.value,
                      })
                    }
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
                </div>
              </div>

              {checkedFolders.length > 0 ? (
                <div className={styles.selectedSourceStrip}>
                  <span className={styles.selectedSourceLabel}>
                    来源 · {checkedFolders.length}
                  </span>
                  <div className={styles.selectionTags}>
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
                  </div>
                  <Button
                    size="small"
                    type="link"
                    onClick={() => setCheckedKeys([])}
                  >
                    清空
                  </Button>
                </div>
              ) : null}
            </div>
          </section>

          <WorkspaceSection
            bodyClassName={styles.queueSectionBody}
            extra={
              <>
                <Badge
                  status={previewRealtimeMeta[previewRealtimeStatus].status}
                  text={previewRealtimeMeta[previewRealtimeStatus].text}
                />
                <Button
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  disabled={pendingPreviewTaskCount === 0}
                  loading={clearPreviewTasksLoading}
                  onClick={() => confirmClearPreviewTasks('pending')}
                >
                  移除排队中 ({pendingPreviewTaskCount})
                </Button>
                <Button
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  disabled={failedPreviewTaskCount === 0}
                  loading={clearPreviewTasksLoading}
                  onClick={() => confirmClearPreviewTasks('failed')}
                >
                  清理失败 ({failedPreviewTaskCount})
                </Button>
                <Button
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  disabled={clearablePreviewTaskCount === 0}
                  loading={clearPreviewTasksLoading}
                  onClick={() => confirmClearPreviewTasks()}
                >
                  清理全部 ({clearablePreviewTaskCount})
                </Button>
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  loading={previewTasksManualRefreshing}
                  onClick={handleRefreshPreviewTasks}
                >
                  刷新
                </Button>
              </>
            }
            title={
              <span className={styles.queueHeaderTitle}>
                <span>后台预整理队列</span>
                {processingPreviewTask ? (
                  <Typography.Text
                    type="secondary"
                    ellipsis={{
                      tooltip:
                        processingPreviewTask.folder_path ||
                        processingPreviewTask.folder_name ||
                        processingPreviewTask.folder_id,
                    }}
                    style={{ maxWidth: 460 }}
                  >
                    正在处理：
                    {processingPreviewTask.folder_name ||
                      processingPreviewTask.folder_id}
                    {' · '}
                    已用时 {formatElapsedSeconds(processingElapsedSeconds)}
                  </Typography.Text>
                ) : queuedPreviewTaskCount > 0 ? (
                  <Typography.Text type="secondary">
                    等待处理 {queuedPreviewTaskCount} 项
                  </Typography.Text>
                ) : null}
              </span>
            }
          >
            <ProTable<API.OrganizePreviewTask>
              className={styles.tableSurface}
              rowKey="id"
              size="small"
              search={false}
              options={false}
              loading={previewTasksInitialLoading}
              dataSource={previewTasks}
              columns={previewTaskColumns}
              pagination={{ defaultPageSize: 5, showSizeChanger: true }}
              scroll={{ x: 'max-content' }}
              locale={{
                emptyText:
                  '还没有预整理任务。勾选左侧目录后点“加入预整理”，后台会先展开子目录，再按间隔逐个生成预览结果。',
              }}
              toolBarRender={false}
            />
          </WorkspaceSection>

          <div className={styles.resultSection} ref={previewResultRef}>
            <WorkspaceSection
              extra={
                resultData ? (
                  <>
                    <Tag color="blue">明细 {visibleItemsForTable.length}</Tag>
                    <Tag
                      color={
                        selectedItemRowsForApply.length > 0
                          ? 'success'
                          : 'default'
                      }
                    >
                      已选 {selectedItemRowsForApply.length}
                    </Tag>
                  </>
                ) : (
                  <Tag>尚无预览</Tag>
                )
              }
              title="核对整理结果"
            >
              {resultData ? (
                <>
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
                        title={`有 ${errored.length} 个目录整理失败`}
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
                    className={styles.resultTabs}
                    items={[
                      {
                        key: 'items',
                        label: `处理明细 (${visibleItemsForTable.length})`,
                        children: (
                          <>
                            {versionGroups.length > 1 ? (
                              <div style={{ marginBottom: 12 }}>
                                <Space
                                  size={8}
                                  wrap
                                  style={{ marginBottom: 8 }}
                                >
                                  <Typography.Text strong>
                                    版本轨道
                                  </Typography.Text>
                                  <Typography.Text type="secondary">
                                    切换版本会同步选择该版本的全部文件
                                  </Typography.Text>
                                </Space>
                                <Tabs
                                  type="card"
                                  size="small"
                                  activeKey={activeVersionKey}
                                  onChange={handleVersionTabChange}
                                  items={[
                                    ...versionGroups.map((group) => ({
                                      key: group.key,
                                      label: (
                                        <Space size={4}>
                                          <span>{group.label}</span>
                                          <Tag
                                            variant="filled"
                                            color={
                                              group.recommended
                                                ? 'success'
                                                : 'blue'
                                            }
                                            style={{ marginInlineEnd: 0 }}
                                          >
                                            {group.episode_count > 0
                                              ? `${group.episode_count} 集`
                                              : `${group.file_count} 个文件`}
                                          </Tag>
                                          {group.recommended ? (
                                            <Tag
                                              variant="filled"
                                              color="gold"
                                              style={{ marginInlineEnd: 0 }}
                                            >
                                              推荐
                                            </Tag>
                                          ) : null}
                                        </Space>
                                      ),
                                    })),
                                    {
                                      key: ALL_VERSION_KEY,
                                      label: `全部版本 (${flatItemsForTable.length})`,
                                    },
                                  ]}
                                />
                              </div>
                            ) : null}
                            <ProTable<OrganizeItemRow>
                              className={styles.tableSurface}
                              key={activeVersionKey}
                              rowKey={getOrganizeItemRowKey}
                              rowSelection={{
                                selectedRowKeys: selectedItemRowKeys,
                                onChange: (keys) =>
                                  setSelectedItemRowKeys(keys),
                                preserveSelectedRowKeys: false,
                              }}
                              search={false}
                              options={false}
                              pagination={{
                                defaultPageSize: 10,
                                showSizeChanger: true,
                              }}
                              scroll={{ x: 'max-content', y: 420 }}
                              dataSource={visibleItemsForTable}
                              columns={itemColumns}
                              expandable={{
                                columnTitle:
                                  resultData.recognition_source === 'shadow'
                                    ? '影子详情'
                                    : undefined,
                                expandedRowRender:
                                  renderOrganizeItemExpandedRow,
                              }}
                            />
                          </>
                        ),
                      },
                      {
                        key: 'dir-debug',
                        label: `目录调试 (${flatDirDebugForTable.length})`,
                        children: (
                          <ProTable<OrganizeDirDebugRow>
                            className={styles.tableSurface}
                            rowKey={(row) =>
                              `${row.__folder_id || ''}::${row.target_dir}`
                            }
                            search={false}
                            options={false}
                            pagination={{
                              defaultPageSize: 10,
                              showSizeChanger: true,
                            }}
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
                          <pre className={styles.rawResponse}>
                            {JSON.stringify(
                              rawResponse ?? resultData ?? {},
                              null,
                              2,
                            )}
                          </pre>
                        ),
                      },
                    ]}
                  />
                </>
              ) : (
                <div className={styles.resultEmpty}>
                  <Empty
                    description="先选择目录并生成整理预览，再在这里核对文件、版本与目标路径"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  >
                    <Button
                      disabled={checkedKeys.length === 0}
                      icon={<PlayCircleOutlined />}
                      loading={organizeLoading && organizeRequestMode === 'dry'}
                      onClick={() => triggerOrganize('dry')}
                    >
                      生成整理预览
                    </Button>
                  </Empty>
                </div>
              )}
            </WorkspaceSection>
          </div>
        </div>
      </div>

      <Modal
        title="指定 TMDB ID"
        open={!!assignTMDBTask}
        onCancel={closeAssignTMDB}
        onOk={confirmAssignTMDB}
        confirmLoading={assignTMDBLoading}
        okText="批量重命名并重跑"
        cancelText="取消"
        okButtonProps={{
          disabled: !/^[1-9]\d{0,19}$/.test(assignTMDBID.trim()),
        }}
        destroyOnHidden
      >
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            title="确认后会批量重命名该文件夹内的全部文件，并重新运行预整理"
            description="只需填写数字 ID；系统会在每个文件的扩展名前添加 {tmdb-ID} 标记。已有 TMDB 标记时会替换，文件夹名称不会改变。"
          />
          <div>
            <Typography.Text type="secondary">TMDB ID</Typography.Text>
            <Input
              autoFocus
              inputMode="numeric"
              maxLength={20}
              prefix="TMDB"
              placeholder="例如 603"
              value={assignTMDBID}
              onChange={(event) =>
                setAssignTMDBID(event.target.value.replace(/\D/g, ''))
              }
              onPressEnter={() => {
                if (/^[1-9]\d{0,19}$/.test(assignTMDBID.trim())) {
                  void confirmAssignTMDB();
                }
              }}
              style={{ marginTop: 6 }}
            />
          </div>
          <div>
            <Typography.Text type="secondary">文件名规则预览</Typography.Text>
            <Typography.Paragraph
              code
              copyable={!!assignTMDBID}
              style={{ marginTop: 6, marginBottom: 0 }}
            >
              {`原文件名.{tmdb-${assignTMDBID || 'ID'}}.扩展名`}
            </Typography.Paragraph>
          </div>
        </Space>
      </Modal>

      <Modal
        title="加入预整理"
        open={previewOptionsOpen}
        onCancel={() => setPreviewOptionsOpen(false)}
        onOk={confirmPreviewOptions}
        confirmLoading={createPreviewLoading}
        okText="加入队列"
        cancelText="取消"
      >
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <div>
            <Typography.Text type="secondary">识别方式</Typography.Text>
            <Segmented<RecognitionSource>
              block
              name="preview-recognition-source"
              value={previewRecognitionSourceDraft}
              options={recognitionSourceOptions}
              onChange={(value) => {
                recognitionSourceOverriddenRef.current = true;
                setPreviewRecognitionSourceDraft(value);
              }}
              style={{ marginTop: 6 }}
            />
            <Typography.Text
              type="secondary"
              style={{ display: 'block', marginTop: 6, fontSize: 12 }}
            >
              {previewRecognitionSourceDraft === 'shadow'
                ? '先运行 MP2 主识别，再用相同输入运行 FilmFusion 本地影子；本地结果只参与差异记录。'
                : previewRecognitionSourceDraft === 'moviepilot'
                  ? '只运行 MP2 识别与 MoviePilot 转名，不执行 FilmFusion 本地识别。'
                  : '只使用 FilmFusion 本地规则与 TMDB 识别，并在本地转名。'}
            </Typography.Text>
          </div>
          <Row gutter={12}>
            <Col span={12}>
              <Typography.Text type="secondary">媒体类型</Typography.Text>
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
                showSearch={{ optionFilterProp: 'label' }}
                loading={categoryConfigLoading}
                placeholder="自动匹配"
                value={previewCategoryDraft}
                options={previewCategoryOptions}
                onChange={(value) => setPreviewCategoryDraft(value)}
                notFoundContent={
                  categoryConfigLoading ? '加载中' : '无分类配置'
                }
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
                suffix="秒"
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
          <div>
            <Typography.Text type="secondary">第一层目录上限</Typography.Text>
            <InputNumber
              min={1}
              max={MAX_PREVIEW_TASK_LIMIT}
              step={10}
              precision={0}
              suffix="个目录"
              value={previewTaskLimitDraft}
              onChange={(value) =>
                setPreviewTaskLimitDraft(
                  typeof value === 'number'
                    ? value
                    : DEFAULT_PREVIEW_TASK_LIMIT,
                )
              }
              style={{ width: '100%', marginTop: 6 }}
            />
            <Typography.Text
              type="secondary"
              style={{ display: 'block', marginTop: 6, fontSize: 12 }}
            >
              只限制第一层直接加入队列的目录，后续递归子目录不计入此上限。
            </Typography.Text>
          </div>
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

      <div aria-hidden="true" className={styles.actionDockSpacer} />
      <section aria-label="整理操作" className={styles.actionDock}>
        <div className={styles.actionDockMeta}>
          <Tag
            color={checkedKeys.length > 0 ? 'blue' : 'default'}
            style={{ marginInlineEnd: 0 }}
          >
            已选 {checkedKeys.length} 个目录
          </Tag>
          {activePreviewTaskLabel ? (
            <Typography.Text
              className="min-w-0"
              type="secondary"
              ellipsis={{ tooltip: activePreviewTaskLabel }}
              style={{ maxWidth: 320 }}
            >
              当前预整理：{activePreviewTaskLabel}
            </Typography.Text>
          ) : null}
        </div>

        <div aria-hidden="true" className={styles.actionDockDivider} />

        <div className={styles.actionDockControls}>
          <div className="flex items-center gap-1">
            <Typography.Text type="secondary">演练模式</Typography.Text>
            <Switch
              checked={dryRun}
              checkedChildren="是"
              unCheckedChildren="否"
              onChange={(checked) => setDryRun(checked)}
            />
          </div>
          <Button
            icon={<PlayCircleOutlined />}
            onClick={() => triggerOrganize('dry')}
            loading={organizeLoading && organizeRequestMode === 'dry'}
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
            loading={organizeLoading && organizeRequestMode === 'apply'}
            disabled={applyDisabled}
          >
            {applyButtonText}
          </Button>
        </div>
      </section>
    </ConsolePage>
  );
};

export default OrganizePage;
