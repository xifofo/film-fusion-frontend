import {
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  MoreOutlined,
  PlayCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Dropdown,
  Empty,
  Modal,
  Switch,
  Tag,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import type {
  RSSAutomationDashboard,
  RSSAutomationRunStatus,
} from '@/services/film-fusion';
import { ACTION_NODE_TYPES, parseWorkflowDefinition } from './flow';
import styles from './index.module.less';

const { Paragraph, Text, Title } = Typography;

type AutomationOverviewProps = {
  data: RSSAutomationDashboard;
  loading: boolean;
  onCreate: () => void;
  onDelete: (sourceId: number) => Promise<void> | void;
  onEdit: (workflowId: number) => void;
  onManualRun: (workflowId: number) => void;
  onToggle: (sourceId: number, enabled: boolean) => Promise<void> | void;
  onViewLogs: (workflowId: number) => void;
  togglingSourceId?: number;
};

const runStatus: Record<
  RSSAutomationRunStatus,
  { color: string; label: string }
> = {
  pending: { color: 'default', label: '等待中' },
  running: { color: 'processing', label: '运行中' },
  succeeded: { color: 'success', label: '成功' },
  partial: { color: 'warning', label: '部分成功' },
  failed: { color: 'error', label: '失败' },
  cancelled: { color: 'default', label: '已取消' },
};

const formatRunTime = (value: string) =>
  dayjs(value).format('YYYY-MM-DD HH:mm');

const AutomationOverview = ({
  data,
  loading,
  onCreate,
  onDelete,
  onEdit,
  onManualRun,
  onToggle,
  onViewLogs,
  togglingSourceId,
}: AutomationOverviewProps) => {
  const [deleteTarget, setDeleteTarget] = useState<{
    sourceId: number;
    sourceName: string;
    workflowName: string;
  }>();
  const [deleting, setDeleting] = useState(false);
  const sourceByID = new Map(data.sources.map((source) => [source.id, source]));
  const latestRunByWorkflow = new Map<
    number,
    (typeof data.recent_runs)[number]
  >();
  for (const run of data.recent_runs) {
    if (!latestRunByWorkflow.has(run.workflow_id)) {
      latestRunByWorkflow.set(run.workflow_id, run);
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await onDelete(deleteTarget.sourceId);
      setDeleteTarget(undefined);
    } catch {
      // The page-level handler reports the API error; keep the dialog open.
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={styles.overviewShell}>
      {data.workflows.length > 0 && (
        <div className={styles.overviewToolbar}>
          <Text type="secondary">
            {data.workflows.length} 个自动化，
            {
              data.workflows.filter(
                (workflow) =>
                  workflow.enabled &&
                  sourceByID.get(workflow.source_id)?.enabled,
              ).length
            }{' '}
            个正在监听
          </Text>
          <Button icon={<PlusOutlined />} onClick={onCreate} type="primary">
            新建自动化
          </Button>
        </div>
      )}

      {loading && data.workflows.length === 0 ? (
        <Card className={styles.overviewEmpty} loading>
          <div />
        </Card>
      ) : data.workflows.length === 0 ? (
        <Card className={styles.overviewEmpty}>
          <Empty
            description="还没有 RSS 自动化"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button icon={<PlusOutlined />} onClick={onCreate} type="primary">
              创建第一个自动化
            </Button>
          </Empty>
        </Card>
      ) : (
        <div className={styles.automationCardGrid}>
          {data.workflows.map((workflow) => {
            const source = sourceByID.get(workflow.source_id);
            const enabled = Boolean(workflow.enabled && source?.enabled);
            const definition = parseWorkflowDefinition(
              workflow.definition_json,
            );
            const actionCount =
              definition?.nodes.filter((node) =>
                ACTION_NODE_TYPES.includes(node.type),
              ).length || 0;
            const latestRun = latestRunByWorkflow.get(workflow.id);
            const latestStatus = latestRun
              ? runStatus[latestRun.status]
              : undefined;
            const latestRunTime =
              latestRun?.started_at || latestRun?.created_at;
            const sourceError =
              latestRun?.status === 'succeeded' ? '' : source?.last_error;
            return (
              <Card
                actions={[
                  <Button
                    aria-label={`手动运行已有条目 ${workflow.name}`}
                    className={styles.automationCardAction}
                    disabled={!source}
                    icon={<PlayCircleOutlined />}
                    key="manual-run"
                    onClick={() => onManualRun(workflow.id)}
                    size="small"
                    type="text"
                  >
                    手动运行
                  </Button>,
                  <Button
                    aria-label={`查看运行日志 ${workflow.name}`}
                    className={styles.automationCardAction}
                    icon={<FileTextOutlined />}
                    key="run-logs"
                    onClick={() => onViewLogs(workflow.id)}
                    size="small"
                    type="text"
                  >
                    运行日志
                  </Button>,
                  <Button
                    aria-label={`编辑自动化 ${workflow.name}`}
                    className={styles.automationCardAction}
                    disabled={!source}
                    icon={<EditOutlined />}
                    key="edit"
                    onClick={() => onEdit(workflow.id)}
                    size="small"
                    type="text"
                  >
                    编辑
                  </Button>,
                  <Dropdown
                    key="more"
                    menu={{
                      items: [
                        {
                          danger: true,
                          icon: <DeleteOutlined />,
                          key: 'delete',
                          label: '删除自动化',
                        },
                      ],
                      onClick: ({ key }) => {
                        if (key === 'delete' && source) {
                          setDeleteTarget({
                            sourceId: source.id,
                            sourceName: source.name,
                            workflowName: workflow.name,
                          });
                        }
                      },
                    }}
                    placement="bottomRight"
                    trigger={['click']}
                  >
                    <Button
                      aria-label={`更多操作 ${workflow.name}`}
                      className={styles.automationCardAction}
                      disabled={!source}
                      icon={<MoreOutlined />}
                      size="small"
                      type="text"
                    >
                      更多
                    </Button>
                  </Dropdown>,
                ]}
                className={styles.automationCard}
                key={workflow.id}
                loading={loading}
              >
                <div className={styles.automationCardHeading}>
                  <div>
                    <Title level={5}>{workflow.name}</Title>
                    <Text type="secondary">
                      {source?.name || 'RSS 源已不存在'}
                    </Text>
                  </div>
                  <Switch
                    aria-label={`${enabled ? '停用' : '启动'}自动化 ${workflow.name}`}
                    checked={enabled}
                    checkedChildren="已启动"
                    disabled={!source}
                    loading={
                      source !== undefined && togglingSourceId === source.id
                    }
                    onChange={(checked) => {
                      if (source) void onToggle(source.id, checked);
                    }}
                    unCheckedChildren="已停用"
                  />
                </div>
                <Paragraph
                  className={styles.automationDescription}
                  ellipsis={{ rows: 2 }}
                  type="secondary"
                >
                  {workflow.description || '尚未添加说明'}
                </Paragraph>
                <div className={styles.automationFacts}>
                  <span>
                    <Text type="secondary">节点</Text>
                    <Text strong>{definition?.nodes.length || 0}</Text>
                  </span>
                  <span>
                    <Text type="secondary">动作</Text>
                    <Text strong>{actionCount}</Text>
                  </span>
                  <span>
                    <Text type="secondary">最近运行</Text>
                    {latestStatus ? (
                      <div className={styles.automationLatestRun}>
                        <Tag color={latestStatus.color}>
                          {latestStatus.label}
                        </Tag>
                        {latestRunTime && (
                          <Text
                            className={styles.automationRunTime}
                            type="secondary"
                          >
                            {formatRunTime(latestRunTime)}
                          </Text>
                        )}
                      </div>
                    ) : (
                      <Text>暂无</Text>
                    )}
                  </span>
                </div>
                {sourceError && (
                  <div className={styles.automationError}>{sourceError}</div>
                )}
                <div className={styles.automationCardFooter}>
                  <Text type="secondary">
                    {source
                      ? enabled
                        ? `每 ${source.interval_minutes} 分钟检查一次`
                        : '已停用，不再检查 RSS 源'
                      : 'RSS 源已不存在'}
                  </Text>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <Modal
        cancelButtonProps={{ disabled: deleting }}
        cancelText="取消"
        closable={!deleting}
        confirmLoading={deleting}
        destroyOnHidden
        mask={{ closable: !deleting }}
        okButtonProps={{ danger: true }}
        okText="确认删除"
        onCancel={() => {
          if (!deleting) setDeleteTarget(undefined);
        }}
        onOk={() => void confirmDelete()}
        open={Boolean(deleteTarget)}
        title="删除这个 RSS 自动化？"
      >
        <Paragraph>
          {deleteTarget
            ? `将删除 RSS 源“${deleteTarget.sourceName}”和自动化流程“${deleteTarget.workflowName}”。历史运行记录仍会保留。`
            : ''}
        </Paragraph>
      </Modal>
    </div>
  );
};

export default AutomationOverview;
