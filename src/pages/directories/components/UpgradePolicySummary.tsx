import { Collapse, Tag } from 'antd';
import type {
  UpgradeCondition,
  UpgradePolicy,
  UpgradeRule,
} from '@/services/film-fusion/upgrade';

const fieldLabels: Record<string, string> = {
  resolution: '分辨率',
  source: '片源',
  codec: '编码',
  effect: '特效',
  group: '制作组',
  name: '文件名',
  audio_codec: '音频编码',
  audio_channels: '声道',
  audio_language: '音轨语言',
  subtitle: '字幕语言',
};

export function describeUpgradeCondition(condition: UpgradeCondition): string {
  if (condition.op === 'match') {
    const method = { equals: '等于', contains: '包含', regex: '匹配正则' }[
      condition.match || 'equals'
    ];
    return `${fieldLabels[condition.field || 'name']} ${method} ${(condition.values || []).join(' / ')}`;
  }
  const children = (condition.children || []).map(describeUpgradeCondition);
  if (condition.op === 'not') return `不满足（${children.join('')}）`;
  return `（${children.join(condition.op === 'all' ? ' 且 ' : ' 或 ')}）`;
}

function describeRule(rule: UpgradeRule) {
  const fields: Array<[keyof UpgradeRule, string]> = [
    ['resolutions', '分辨率'],
    ['sources', '片源'],
    ['codecs', '编码'],
    ['effects', '特效'],
    ['groups', '制作组'],
    ['audio_codecs', '音频编码'],
    ['audio_channels', '声道'],
    ['audio_languages', '音轨语言'],
    ['subtitles', '字幕语言'],
  ];
  const descriptions = fields.flatMap(([key, label]) => {
    const values = rule[key];
    return Array.isArray(values) && values.length
      ? [`${label}：${values.join(' / ')}`]
      : [];
  });
  if (rule.include) descriptions.push(`名称包含：${rule.include}`);
  if (rule.exclude) descriptions.push(`名称排除：${rule.exclude}`);
  if (rule.include_regex) descriptions.push(`包含正则：${rule.include_regex}`);
  if (rule.exclude_regex) descriptions.push(`排除正则：${rule.exclude_regex}`);
  if (rule.condition)
    descriptions.push(describeUpgradeCondition(rule.condition));
  return descriptions.join('；') || '匹配所有已识别版本';
}

export default function UpgradePolicySummary({
  policy,
}: {
  policy: UpgradePolicy;
}) {
  return (
    <Collapse
      items={[
        {
          key: 'preview',
          label: '规则组预览（只读）',
          children: (
            <div className="space-y-4 text-sm">
              <div>按顺序匹配，首个命中决定档位：</div>
              <ol className="space-y-3 pl-5">
                {policy.rules.map((rule, index) => (
                  <li key={`${index}-${rule.name}`}>
                    <strong>{rule.name}</strong>
                    <p className="m-0 mt-1 break-words text-neutral-500">
                      {describeRule(rule)}
                    </p>
                  </li>
                ))}
              </ol>
              <div>
                同档位：
                {policy.same_tier
                  ? `至少提升 ${Math.max(1, policy.min_score_gain || 0)} 分才替换`
                  : '保留已有'}
              </div>
              {!!policy.bonuses?.length && (
                <div>
                  加分偏好：
                  {policy.bonuses.map((rule, index) => (
                    <div key={`${index}-${rule.name}`}>
                      <Tag>
                        {rule.name} {rule.score ?? 0} 分
                      </Tag>
                      {describeRule(rule)}
                    </div>
                  ))}
                </div>
              )}
              {!!policy.exclude?.length && (
                <div>全局排除：{policy.exclude.join(' / ')}</div>
              )}
              {policy.exclude_condition && (
                <div>
                  全局排除条件：
                  {describeUpgradeCondition(policy.exclude_condition)}
                </div>
              )}
              <div>
                单文件大小：
                {policy.max_size_mb
                  ? `不超过 ${policy.max_size_mb} MB`
                  : '不限'}
              </div>
            </div>
          ),
        },
      ]}
    />
  );
}
