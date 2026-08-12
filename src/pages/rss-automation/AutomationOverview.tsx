import { PlusOutlined } from '@ant-design/icons';
import { Button, Card, Empty, Tag, Typography } from 'antd';
import type {
  RSSAutomationDashboard,
  RSSAutomationRunStatus,
} from '@/services/film-fusion';
import { parseWorkflowDefinition } from './flow';
import styles from './index.module.less';

const { Paragraph, Text, Title } = Typography;

type AutomationOverviewProps = {
  data: RSSAutomationDashboard;
  loading: boolean;
  onCreate: () => void;
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

const AutomationOverview = ({
  data,
  loading,
  onCreate,
}: AutomationOverviewProps) => {
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

  return (
    <div className={styles.overviewShell}>
      {data.workflows.length > 0 && (
        <div className={styles.overviewToolbar}>
          <Text type="secondary">
            {data.workflows.length} 个自动化，
            {data.workflows.filter((workflow) => workflow.enabled).length}{' '}
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
            const definition = parseWorkflowDefinition(
              workflow.definition_json,
            );
            const actionCount =
              definition?.nodes.filter((node) =>
                [
                  'qbittorrent',
                  'offline115',
                  'offline115_openapi',
                  'notification',
                ].includes(node.type),
              ).length || 0;
            const latestRun = latestRunByWorkflow.get(workflow.id);
            const latestStatus = latestRun
              ? runStatus[latestRun.status]
              : undefined;
            return (
              <Card
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
                  <Tag color={workflow.enabled ? 'success' : 'default'}>
                    {workflow.enabled ? '正在监听' : '草稿'}
                  </Tag>
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
                      <Tag color={latestStatus.color}>{latestStatus.label}</Tag>
                    ) : (
                      <Text>暂无</Text>
                    )}
                  </span>
                </div>
                {source?.last_error && (
                  <div className={styles.automationError}>
                    {source.last_error}
                  </div>
                )}
                <div className={styles.automationCardFooter}>
                  <Text type="secondary">
                    {source
                      ? `每 ${source.interval_minutes} 分钟检查一次`
                      : 'RSS 源已不存在'}
                  </Text>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AutomationOverview;
