import { Handle, type NodeProps, Position } from '@xyflow/react';
import {
  Bell,
  Binary,
  Braces,
  CircleStop,
  CloudDownload,
  Download,
  GitBranch,
  GitFork,
  RadioTower,
  RefreshCcwDot,
  Search,
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
  convert: <Binary size={17} />,
  if: <GitBranch size={17} />,
  parallel: <GitFork size={17} />,
  join: <RefreshCcwDot size={17} />,
  qbittorrent: <Download size={17} />,
  offline115: <CloudDownload size={17} />,
  offline115_openapi: <CloudDownload size={17} />,
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
