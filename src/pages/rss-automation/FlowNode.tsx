import { Handle, type NodeProps, Position } from '@xyflow/react';
import {
  Bell,
  Binary,
  Braces,
  CircleStop,
  Clock,
  CloudDownload,
  Download,
  FolderCog,
  Gauge,
  GitBranch,
  GitFork,
  HardDriveDownload,
  Library,
  Link2,
  PencilLine,
  RadioTower,
  RefreshCcwDot,
  RefreshCw,
  Replace,
  ReplaceAll,
  ScanSearch,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Webhook,
} from 'lucide-react';
import type { RSSAutomationNodeType } from '@/services/film-fusion';
import {
  joinHasConditionalOutcome,
  NODE_LABELS,
  nodeBranches,
  type RSSFlowNode,
} from './flow';
import styles from './index.module.less';

const icons: Record<RSSAutomationNodeType, React.ReactNode> = {
  trigger: <RadioTower size={17} />,
  regex: <Braces size={17} />,
  keyword: <Search size={17} />,
  keyword_replace: <Replace size={17} />,
  regex_replace: <ReplaceAll size={17} />,
  convert: <Binary size={17} />,
  if: <GitBranch size={17} />,
  parallel: <GitFork size={17} />,
  join: <RefreshCcwDot size={17} />,
  qbittorrent: <Download size={17} />,
  wait_qbittorrent: <Gauge size={17} />,
  moviepilot_transfer: <FolderCog size={17} />,
  delete_qbittorrent: <Trash2 size={17} />,
  offline115: <CloudDownload size={17} />,
  offline115_openapi: <CloudDownload size={17} />,
  wait115: <Clock size={17} />,
  rename115_openapi: <PencilLine size={17} />,
  moviepilot_title_recognize: <ScanSearch size={17} />,
  filmfusion_recognize: <Sparkles size={17} />,
  media_exists: <Library size={17} />,
  hdhive_query: <Search size={17} />,
  hdhive_unlock: <Link2 size={17} />,
  moviepilot_recognize: <ScanSearch size={17} />,
  organize_strm: <FolderCog size={17} />,
  strm_verify: <ShieldCheck size={17} />,
  strm_regenerate: <RefreshCw size={17} />,
  emby_refresh_wait: <HardDriveDownload size={17} />,
  http_request: <Webhook size={17} />,
  notification: <Bell size={17} />,
  end: <CircleStop size={17} />,
};

const statusLabel: Record<string, string> = {
  pending: '等待',
  running: '执行中',
  succeeded: '成功',
  failed: '失败',
  skipped: '未进入',
  cancelled: '已取消',
};

const SourceHandle = ({
  id,
  label,
  top,
}: {
  id: string;
  label: string;
  top: string;
}) => (
  <>
    <span className={styles.portLabel} style={{ top }}>
      {label}
    </span>
    <Handle
      className={styles.portHandle}
      id={id}
      position={Position.Right}
      style={{ top }}
      type="source"
    />
  </>
);

const FlowNode = ({ data, selected }: NodeProps<RSSFlowNode>) => {
  const definition = data.definition;
  const type = definition.type;
  const branches = nodeBranches(definition);
  const preview = data.preview;

  const handles = (() => {
    if (type === 'end') return null;
    if (type === 'trigger') {
      return <SourceHandle id="next" label="继续" top="50%" />;
    }
    if (type === 'if') {
      return (
        <>
          <SourceHandle id="true" label="是" top="31%" />
          <SourceHandle id="false" label="否" top="60%" />
          <SourceHandle id="failure" label="异常" top="84%" />
        </>
      );
    }
    if (type === 'keyword') {
      return (
        <>
          <SourceHandle id="matched" label="匹配" top="31%" />
          <SourceHandle id="unmatched" label="不匹配" top="60%" />
          <SourceHandle id="failure" label="异常" top="84%" />
        </>
      );
    }
    if (type === 'media_exists') {
      return (
        <>
          <SourceHandle id="exists" label="已存在" top="31%" />
          <SourceHandle id="missing" label="不存在" top="60%" />
          <SourceHandle id="failure" label="异常" top="84%" />
        </>
      );
    }
    if (type === 'hdhive_query') {
      return (
        <>
          <SourceHandle id="found" label="找到" top="31%" />
          <SourceHandle id="not_found" label="没有" top="60%" />
          <SourceHandle id="failure" label="异常" top="84%" />
        </>
      );
    }
    if (type === 'strm_verify') {
      return (
        <>
          <SourceHandle id="valid" label="有效" top="31%" />
          <SourceHandle id="invalid" label="无效" top="60%" />
          <SourceHandle id="failure" label="异常" top="84%" />
        </>
      );
    }
    if (type === 'parallel') {
      return branches.map((branch, index) => (
        <SourceHandle
          id={branch}
          key={branch}
          label={branch.replace(/^branch-/, '')}
          top={`${((index + 1) / (branches.length + 1)) * 100}%`}
        />
      ));
    }
    if (type === 'join') {
      if (joinHasConditionalOutcome(definition)) {
        return (
          <>
            <SourceHandle id="success" label="满足" top="36%" />
            <SourceHandle id="failure" label="未满足" top="72%" />
          </>
        );
      }
      return <SourceHandle id="success" label="继续" top="50%" />;
    }
    return (
      <>
        <SourceHandle id="success" label="成功" top="36%" />
        <SourceHandle id="failure" label="失败" top="72%" />
      </>
    );
  })();

  return (
    <div
      className={`${styles.flowNode} ${styles[`node_${type}`]} ${
        selected ? styles.flowNodeSelected : ''
      } ${data.status ? styles[`status_${data.status}`] : ''} ${
        preview && !preview.active ? styles.flowNodePreviewInactive : ''
      }`}
    >
      {type !== 'trigger' && (
        <Handle
          className={styles.portHandle}
          id="input"
          position={Position.Left}
          type="target"
        />
      )}
      <div className={styles.flowNodeIcon}>{icons[type]}</div>
      <div className={styles.flowNodeBody}>
        <div className={styles.flowNodeType}>{NODE_LABELS[type]}</div>
        <div className={styles.flowNodeName}>
          {definition.name || NODE_LABELS[type]}
        </div>
        {preview && (
          <div
            className={`${styles.nodePreview} ${styles[`nodePreview_${preview.tone}`]}`}
            title={preview.detail}
          >
            {preview.label}
          </div>
        )}
      </div>
      {data.status && (
        <span className={styles.nodeStatus}>
          {statusLabel[data.status] || data.status}
        </span>
      )}
      {handles}
    </div>
  );
};

export default FlowNode;
