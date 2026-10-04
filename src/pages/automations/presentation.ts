import { NODE_LABELS } from '@/pages/rss-automation/flow';
import type {
  AutomationDefinition,
  AutomationNodeDefinition,
  AutomationRun,
  AutomationRunStatus,
  AutomationSource,
  AutomationWorkflow,
} from '@/services/film-fusion';

export const runStatusMeta: Record<
  AutomationRunStatus,
  { color: string; label: string }
> = {
  pending: { color: 'default', label: '等待执行' },
  running: { color: 'processing', label: '执行中' },
  succeeded: { color: 'success', label: '成功' },
  partial: { color: 'warning', label: '部分成功' },
  failed: { color: 'error', label: '失败' },
  cancelled: { color: 'default', label: '已取消' },
};

export const formatAutomationTime = (value?: string) => {
  if (!value || Number.isNaN(new Date(value).getTime())) return '尚无记录';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
};

export const automationNeedsAttention = (
  source: AutomationSource,
  workflow?: AutomationWorkflow,
  run?: AutomationRun,
) =>
  Boolean(
    source.last_error ||
      !workflow ||
      run?.status === 'failed' ||
      run?.status === 'partial',
  );

export const automationStatus = (
  source: AutomationSource,
  workflow?: AutomationWorkflow,
  run?: AutomationRun,
) => {
  if (!source.enabled) return { tone: 'muted', label: '已停用' };
  if (!workflow) return { tone: 'error', label: '流程缺失' };
  if (source.last_error) return { tone: 'error', label: '检查失败' };
  if (run?.status === 'failed' || run?.status === 'partial')
    return { tone: 'error', label: '最近运行异常' };
  if (run?.status === 'running') return { tone: 'active', label: '正在执行' };
  if (!source.initialized) return { tone: 'pending', label: '等待首次基线' };
  return { tone: 'success', label: '增量监听中' };
};

export const automationNodeLabel = (node: AutomationNodeDefinition) => {
  if (node.type === 'organize_strm' && node.config?.dry_run === true)
    return '整理预览';
  if (node.type === 'moviepilot_recognize') {
    if (node.config?.recognition_source === 'medianame')
      return 'medianame 识别';
    if (node.config?.recognition_source === 'shadow') return '影子识别';
  }
  return node.name || NODE_LABELS[node.type] || node.type;
};

// Only draw an ordered chain when the edges prove the workflow is linear.
// A branched workflow is shown as a node overview, never as a made-up sequence.
export const workflowPreview = (definitionJSON?: string) => {
  try {
    const definition = JSON.parse(definitionJSON || '') as AutomationDefinition;
    if (
      !Array.isArray(definition?.nodes) ||
      !definition.nodes.every((node) => node && typeof node.type === 'string')
    ) {
      return { nodes: [], linear: false, invalid: true };
    }
    const nodes = definition.nodes;
    const edges = Array.isArray(definition.edges) ? definition.edges : [];
    const ordered: AutomationNodeDefinition[] = [];
    const visited = new Set<string>();
    let current = nodes.find((node) => node.type === 'trigger');
    while (current && !visited.has(current.id)) {
      ordered.push(current);
      visited.add(current.id);
      const next = edges.filter((edge) => edge.source === current?.id);
      if (next.length !== 1) break;
      current = nodes.find((node) => node.id === next[0].target);
    }
    const linear =
      ordered.length === nodes.length && edges.length === nodes.length - 1;
    return {
      nodes: (linear ? ordered : nodes).filter(
        (node) => node.type !== 'trigger' && node.type !== 'end',
      ),
      linear,
      invalid: false,
    };
  } catch {
    return { nodes: [], linear: false, invalid: true };
  }
};
