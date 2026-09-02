import { Drawer } from 'antd';
import type { RSSAutomationNodeDefinition } from '@/services/film-fusion';
import {
  NODE_LABELS,
  type RSSFlowNodeVariableSummary,
  type RSSFlowVariableInfo,
  type RSSFlowVariableView,
} from './flow';
import styles from './index.module.less';

type NodeVariableDrawerProps = {
  node?: RSSAutomationNodeDefinition;
  onClose: () => void;
  open: boolean;
  summary?: RSSFlowNodeVariableSummary;
  view: RSSFlowVariableView;
};

const variableValueText = (value: unknown) => {
  if (value === undefined) return '';
  if (value === null) return 'null';
  let text: string;
  try {
    text = typeof value === 'string' ? value : JSON.stringify(value);
  } catch {
    text = String(value);
  }
  return text.length > 160 ? `${text.slice(0, 160)}…` : text;
};

const VariableSection = ({
  emptyText,
  hint,
  title,
  variables,
}: {
  emptyText: string;
  hint: string;
  title: string;
  variables: RSSFlowVariableInfo[];
}) => (
  <section className={styles.nodeVariableDrawerSection}>
    <div className={styles.nodeVariableDrawerHeading}>
      <div>
        <strong>{title}</strong>
        <span>{variables.length}</span>
      </div>
      <p>{hint}</p>
    </div>
    {variables.length > 0 ? (
      <div className={styles.nodeVariableDrawerList}>
        {variables.map((variable) => {
          const valueText = variableValueText(variable.value);
          return (
            <article
              className={styles.nodeVariableDrawerItem}
              key={variable.key}
            >
              <div className={styles.nodeVariableDrawerKey}>
                <code title={variable.reference}>{variable.reference}</code>
                <span>{variable.type}</span>
              </div>
              <div className={styles.nodeVariableDrawerMeta}>
                <strong>{variable.label}</strong>
                {variable.required && <i>必填</i>}
                {variable.source && <em>来自 {variable.source}</em>}
              </div>
              <p>{variable.description}</p>
              {variable.valueKind === 'configured' && valueText && (
                <div className={styles.nodeVariableDrawerValue}>
                  <span>配置值</span>
                  <code title={valueText}>{valueText}</code>
                </div>
              )}
            </article>
          );
        })}
      </div>
    ) : (
      <div className={styles.nodeVariableDrawerEmpty}>{emptyText}</div>
    )}
  </section>
);

const NodeVariableDrawer = ({
  node,
  onClose,
  open,
  summary,
  view,
}: NodeVariableDrawerProps) => {
  const nodeName = node?.name || (node ? NODE_LABELS[node.type] : '节点变量');
  const count =
    view === 'received'
      ? summary?.received.length || 0
      : summary?.returned.length || 0;

  return (
    <Drawer
      classNames={{
        body: styles.nodeVariableDrawerBody,
        header: styles.nodeVariableDrawerHeader,
      }}
      destroyOnHidden
      focusable={{ focusTriggerAfterClose: true, trap: false }}
      mask={false}
      onClose={onClose}
      open={open && Boolean(node && summary)}
      placement="right"
      push={false}
      rootClassName={styles.nodeVariableDrawer}
      size="min(420px, 100vw)"
      title={
        <div className={styles.nodeVariableDrawerTitle}>
          <span>节点变量</span>
          <div>
            <strong>{nodeName}</strong>
            <b
              className={
                view === 'received'
                  ? styles.nodeVariableDrawerTitleReceive
                  : styles.nodeVariableDrawerTitleReturn
              }
            >
              {view === 'received' ? '接收' : '返回'} {count}
            </b>
          </div>
        </div>
      }
    >
      {summary && node && view === 'received' && (
        <>
          <VariableSection
            emptyText={
              summary.protocolAvailable
                ? node.type === 'trigger'
                  ? '当前触发事件没有可展示的字段'
                  : '尚未连接带有返回变量的上游节点'
                : '节点变量协议尚未加载'
            }
            hint={node.type === 'trigger' ? '外部事件字段' : '直接上游输出'}
            title="接收变量"
            variables={summary.received}
          />
          {summary.configuredInputs.length > 0 && (
            <VariableSection
              emptyText=""
              hint="该节点实际读取的配置项"
              title="节点输入"
              variables={summary.configuredInputs}
            />
          )}
        </>
      )}
      {summary && view === 'returned' && (
        <VariableSection
          emptyText={
            summary.protocolAvailable
              ? '该节点不返回业务变量'
              : '节点变量协议尚未加载'
          }
          hint="可供后续节点引用"
          title="返回变量"
          variables={summary.returned}
        />
      )}
    </Drawer>
  );
};

export default NodeVariableDrawer;
