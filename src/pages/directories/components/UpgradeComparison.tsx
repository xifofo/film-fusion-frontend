import { Alert, Space, Tag } from 'antd';
import {
  type UpgradeDecision,
  upgradeActionLabels,
} from '@/services/film-fusion/upgrade';

export default function UpgradeComparison({
  decision,
}: {
  decision: UpgradeDecision;
}) {
  return (
    <Space orientation="vertical" style={{ width: '100%' }}>
      <Alert
        showIcon
        type={decision.action === 'review' ? 'warning' : 'info'}
        title={
          <>
            <Tag>{upgradeActionLabels[decision.action]}</Tag>
            {decision.reason}
          </>
        }
      />
      <span>
        新资源：{decision.rank.label}
        {decision.rank.reasons?.length
          ? ` · ${decision.rank.reasons.join('、')}`
          : ''}
      </span>
      {decision.existing.map((old) => (
        <div key={old.file.file_id} style={{ overflowWrap: 'anywhere' }}>
          <strong>已有：{old.rank.label}</strong>
          <div>{old.cloud_path}</div>
          {old.bindings?.map((binding) => (
            <div key={binding.path}>旧 STRM：{binding.path}</div>
          ))}
        </div>
      ))}
      {decision.bindings?.map((binding) => (
        <div key={binding.path} style={{ overflowWrap: 'anywhere' }}>
          新 STRM：{binding.path}
          <div>指向：{binding.content}</div>
        </div>
      ))}
      {decision.changes
        ?.filter((change) => !change.write && change.before.exists)
        .map((change) => (
          <div key={change.before.path} style={{ overflowWrap: 'anywhere' }}>
            同步清理（保留恢复副本）：{change.before.path}
          </div>
        ))}
    </Space>
  );
}
