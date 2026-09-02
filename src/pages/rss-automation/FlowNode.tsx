import {
  Handle,
  type NodeProps,
  Position,
  useUpdateNodeInternals,
} from '@xyflow/react';
import {
  Bell,
  Binary,
  Braces,
  Calculator,
  CalendarClock,
  CircleStop,
  Clock,
  CloudDownload,
  CopyCheck,
  Download,
  FileJson2,
  FolderCog,
  Gauge,
  GitBranch,
  GitFork,
  HardDriveDownload,
  Library,
  Link2,
  ListChecks,
  ListFilter,
  PencilLine,
  RadioTower,
  RefreshCcwDot,
  RefreshCw,
  Repeat2,
  Replace,
  ReplaceAll,
  Route,
  ScanSearch,
  Search,
  ShieldCheck,
  Sparkles,
  TextQuote,
  TimerReset,
  Trash2,
  Variable,
  Webhook,
} from 'lucide-react';
import { useEffect } from 'react';
import type { RSSAutomationNodeType } from '@/services/film-fusion';
import {
  flowNodeHeight,
  flowPortTop,
  NODE_LABELS,
  nodeSourcePorts,
  type RSSFlowNode,
  type RSSFlowVariableView,
  sourcePortLabel,
} from './flow';
import styles from './index.module.less';

const icons: Record<RSSAutomationNodeType, React.ReactNode> = {
  trigger: <RadioTower size={17} />,
  delay: <Clock size={17} />,
  regex: <Braces size={17} />,
  keyword: <Search size={17} />,
  keyword_replace: <Replace size={17} />,
  regex_replace: <ReplaceAll size={17} />,
  convert: <Binary size={17} />,
  set_variable: <Variable size={17} />,
  template: <TextQuote size={17} />,
  json_extract: <FileJson2 size={17} />,
  math: <Calculator size={17} />,
  datetime_operation: <CalendarClock size={17} />,
  list_operation: <ListFilter size={17} />,
  switch: <Route size={17} />,
  coalesce: <ListChecks size={17} />,
  deduplicate: <CopyCheck size={17} />,
  rate_limit: <TimerReset size={17} />,
  foreach: <Repeat2 size={17} />,
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

const VariableChip = ({
  label,
  count,
  onOpen,
  tone,
}: {
  label: string;
  count: number;
  onOpen: () => void;
  tone: 'receive' | 'return';
}) => (
  <button
    aria-haspopup="dialog"
    aria-label={`${label}变量，共 ${count} 个`}
    className={`${styles.nodeVariableChip} ${styles[`nodeVariableChip_${tone}`]} nodrag nopan`}
    onClick={(event) => {
      event.stopPropagation();
      onOpen();
    }}
    onDoubleClick={(event) => event.stopPropagation()}
    onPointerDown={(event) => event.stopPropagation()}
    type="button"
  >
    <span>{label}</span>
    <b>{count}</b>
  </button>
);

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
    <span className={styles.portLabel} style={{ top }} title={label}>
      {label}
    </span>
    <Handle
      aria-label={`出口：${label}`}
      className={styles.portHandle}
      id={id}
      position={Position.Right}
      style={{ top }}
      type="source"
    />
  </>
);

const FlowNode = ({ data, id, selected }: NodeProps<RSSFlowNode>) => {
  const updateNodeInternals = useUpdateNodeInternals();
  const definition = data.definition;
  const type = definition.type;
  const preview = data.preview;
  const variableSummary = data.variableSummary || {
    protocolAvailable: false,
    received: [],
    configuredInputs: [],
    returned: [],
  };
  const sourcePorts = nodeSourcePorts(definition);
  const openVariablePanel = (view: RSSFlowVariableView) =>
    data.openVariablePanel?.(id, view);
  const targetHandles = data.targetHandles?.length
    ? data.targetHandles
    : type === 'trigger'
      ? []
      : [{ id: 'input', top: 50 }];

  useEffect(() => {
    updateNodeInternals(id);
  }, [
    id,
    sourcePorts.join('|'),
    targetHandles.map((handle) => `${handle.id}:${handle.top}`).join('|'),
    updateNodeInternals,
  ]);

  return (
    <div
      className={`${styles.flowNode} ${styles[`node_${type}`]} ${
        selected ? styles.flowNodeSelected : ''
      } ${data.status ? styles[`status_${data.status}`] : ''} ${
        preview && !preview.active ? styles.flowNodePreviewInactive : ''
      }`}
      style={{
        minHeight: flowNodeHeight(definition, data.targetHandles?.length || 0),
      }}
    >
      {targetHandles.map((handle) => (
        <Handle
          aria-label="入口"
          className={styles.portHandle}
          id={handle.id}
          key={handle.id}
          position={Position.Left}
          style={{ top: `${handle.top}%` }}
          type="target"
        />
      ))}
      <div className={styles.flowNodeIcon}>{icons[type]}</div>
      <div className={styles.flowNodeBody}>
        <div className={styles.flowNodeType}>{NODE_LABELS[type]}</div>
        <div
          className={styles.flowNodeName}
          title={definition.name || NODE_LABELS[type]}
        >
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
        <div className={styles.nodeVariableSummary}>
          <VariableChip
            count={variableSummary.received.length}
            label="接收"
            onOpen={() => openVariablePanel('received')}
            tone="receive"
          />
          <VariableChip
            count={variableSummary.returned.length}
            label="返回"
            onOpen={() => openVariablePanel('returned')}
            tone="return"
          />
        </div>
      </div>
      {data.status && (
        <span className={styles.nodeStatus}>
          {statusLabel[data.status] || data.status}
        </span>
      )}
      {sourcePorts.map((port, index) => (
        <SourceHandle
          id={port}
          key={port}
          label={sourcePortLabel(port, definition)}
          top={`${flowPortTop(index, sourcePorts.length)}%`}
        />
      ))}
    </div>
  );
};

export default FlowNode;
