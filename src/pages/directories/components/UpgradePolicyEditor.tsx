import {
  Alert,
  Button,
  Collapse,
  Input,
  InputNumber,
  Select,
  Space,
  Switch,
  Tag,
} from 'antd';
import { useEffect, useState } from 'react';
import {
  getUpgradePresets,
  testUpgradePolicy,
  type UpgradePolicy,
  type UpgradeRule,
  upgradeActionLabels,
} from '@/services/film-fusion/upgrade';

const options = (values: string[]) =>
  values.map((value) => ({ label: value, value }));
const choices = {
  resolutions: ['4320p', '2160p', '1080p', '1080i', '720p', '576p', '480p'],
  sources: [
    'REMUX',
    'BluRay',
    'BDRip',
    'BRRip',
    'WEB-DL',
    'WEBRip',
    'WEB',
    'HDTV',
    'UHDTV',
    'DVD',
  ],
  codecs: ['H.264', 'H.265', 'AV1', 'VC-1'],
  effects: [
    'Dolby Vision',
    'HDR10+',
    'HDR10',
    'HDR',
    'SDR',
    'HLG',
    'Atmos',
    'PROPER',
    'REPACK',
    'IMAX',
    '3D',
  ],
};

export function parseUpgradePolicy(value?: string): UpgradePolicy | undefined {
  if (!value?.trim()) return undefined;
  const parsed = JSON.parse(value) as UpgradePolicy;
  if (!parsed || !Array.isArray(parsed.rules))
    throw new Error('洗版策略格式错误，请选择预设重新配置');
  return {
    ...parsed,
    bonuses: parsed.bonuses || [],
    exclude: parsed.exclude || [],
  };
}

export default function UpgradePolicyEditor({
  value,
  onChange,
}: {
  value?: string;
  onChange?: (value: string) => void;
}) {
  const [presets, setPresets] = useState<Record<string, UpgradePolicy>>();
  const [error, setError] = useState('');
  const [oldName, setOldName] = useState('Example.2024.1080p.WEB-DL.H264.mkv');
  const [newName, setNewName] = useState('Example.2024.2160p.WEB-DL.H265.mkv');
  const [oldSize, setOldSize] = useState<number>();
  const [newSize, setNewSize] = useState<number>();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] =
    useState<Awaited<ReturnType<typeof testUpgradePolicy>>['data']>();
  useEffect(() => {
    let active = true;
    getUpgradePresets()
      .then((response) => {
        if (active) setPresets(response.data);
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  let policy: UpgradePolicy | undefined;
  let parseError = '';
  try {
    policy = parseUpgradePolicy(value) || presets?.quality;
  } catch (e) {
    parseError = (e as Error).message;
  }
  const update = (next: UpgradePolicy) => {
    onChange?.(JSON.stringify(next));
    setTestResult(undefined);
    setError('');
  };
  const patch = (next: Partial<UpgradePolicy>) => {
    if (policy) update({ ...policy, ...next });
  };
  const rulesEditor = (field: 'rules' | 'bonuses') => {
    const rules = policy?.[field] || [];
    const updateRule = (index: number, next: Partial<UpgradeRule>) =>
      patch({
        [field]: rules.map((rule, i) =>
          i === index ? { ...rule, ...next } : rule,
        ),
      });
    const move = (from: number, to: number) => {
      if (to < 0 || to >= rules.length || from < 0 || from >= rules.length)
        return;
      const next = [...rules];
      const [rule] = next.splice(from, 1);
      next.splice(to, 0, rule);
      patch({ [field]: next });
    };
    return (
      <Space orientation="vertical" style={{ width: '100%' }}>
        <Collapse
          size="small"
          items={rules.map((rule, index) => ({
            key: String(index),
            label: (
              <span
                draggable
                onDragStart={(event) =>
                  event.dataTransfer.setData('text/plain', String(index))
                }
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const from = Number(event.dataTransfer.getData('text/plain'));
                  if (Number.isInteger(from)) move(from, index);
                }}
              >
                {field === 'rules' ? `${index + 1}. ` : ''}
                {rule.name || '未命名规则'}
                {field === 'bonuses' ? ` (${rule.score ?? 0} 分)` : ''}
              </span>
            ),
            extra: (
              <Space size={4} onClick={(event) => event.stopPropagation()}>
                <Button
                  size="small"
                  aria-label={`${rule.name}上移`}
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                >
                  ↑
                </Button>
                <Button
                  size="small"
                  aria-label={`${rule.name}下移`}
                  disabled={index === rules.length - 1}
                  onClick={() => move(index, index + 1)}
                >
                  ↓
                </Button>
                <Button
                  size="small"
                  danger
                  onClick={() =>
                    patch({ [field]: rules.filter((_, i) => i !== index) })
                  }
                >
                  删除
                </Button>
              </Space>
            ),
            children: (
              <Space orientation="vertical" style={{ width: '100%' }}>
                <Input
                  aria-label="规则名称"
                  placeholder="规则名称"
                  value={rule.name}
                  maxLength={60}
                  onChange={(e) => updateRule(index, { name: e.target.value })}
                />
                {(['resolutions', 'sources', 'codecs', 'effects'] as const).map(
                  (key) => (
                    <Select
                      key={key}
                      aria-label={
                        {
                          resolutions: '分辨率',
                          sources: '片源',
                          codecs: '编码',
                          effects: '特效',
                        }[key]
                      }
                      style={{ width: '100%' }}
                      mode="multiple"
                      allowClear
                      placeholder={
                        {
                          resolutions: '分辨率，不选则不限',
                          sources: '片源，不选则不限',
                          codecs: '编码，不选则不限',
                          effects: '特效，不选则不限',
                        }[key]
                      }
                      options={options(choices[key])}
                      value={rule[key] || []}
                      onChange={(values) =>
                        updateRule(index, { [key]: values })
                      }
                    />
                  ),
                )}
                <Select
                  aria-label="制作组"
                  mode="tags"
                  style={{ width: '100%' }}
                  placeholder="制作组，可输入多个"
                  value={rule.groups || []}
                  onChange={(groups) => updateRule(index, { groups })}
                />
                <Input
                  aria-label="名称包含"
                  placeholder="名称包含，例如：中字（按名称声明匹配）"
                  value={rule.include || ''}
                  maxLength={100}
                  onChange={(e) =>
                    updateRule(index, { include: e.target.value })
                  }
                />
                {field === 'bonuses' && (
                  <InputNumber
                    aria-label="权重分数"
                    min={-1000}
                    max={1000}
                    value={rule.score ?? 10}
                    onChange={(score) =>
                      updateRule(index, { score: score ?? 0 })
                    }
                  />
                )}
              </Space>
            ),
          }))}
        />
        <Button
          block
          onClick={() =>
            patch({
              [field]: [
                ...rules,
                {
                  name: field === 'rules' ? '新档位' : '新偏好',
                  ...(field === 'bonuses' ? { score: 10 } : {}),
                },
              ],
            })
          }
        >
          添加{field === 'rules' ? '优先级档位' : '加分偏好'}
        </Button>
      </Space>
    );
  };
  return (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      {(error || parseError) && (
        <Alert type="error" title={parseError || error} showIcon />
      )}
      <Space wrap>
        {presets &&
          Object.entries(presets).map(([key, preset]) => (
            <Button
              key={key}
              onClick={() =>
                update({ ...preset, enabled: policy?.enabled ?? false })
              }
            >
              {preset.name}
            </Button>
          ))}
      </Space>
      <Space>
        <Switch
          aria-label="启用洗版"
          checked={policy?.enabled ?? false}
          disabled={!policy}
          onChange={(enabled) => patch({ enabled })}
        />
        <strong>在此目录的整理中启用洗版</strong>
      </Space>
      {policy && (
        <>
          <Input
            aria-label="策略名称"
            value={policy.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="策略名称"
          />
          <Alert
            type="info"
            title="从上往下匹配，第一个命中决定档位"
            description="较高档位替换较低档位。同档默认保留已有；信息不足会列出待确认原因。保存策略后重新预览，才会应用新规则。"
            showIcon
          />
          {rulesEditor('rules')}
          <Collapse
            items={[
              {
                key: 'limits',
                label: '排除与大小限制',
                children: (
                  <Space orientation="vertical" style={{ width: '100%' }}>
                    <Select
                      aria-label="全局排除"
                      mode="multiple"
                      style={{ width: '100%' }}
                      options={options(
                        [
                          'CAM',
                          'TS',
                          'DVDScr',
                          ...choices.sources,
                          ...choices.codecs,
                          ...choices.effects,
                        ].filter((v, i, a) => a.indexOf(v) === i),
                      )}
                      value={policy.exclude}
                      onChange={(exclude) => patch({ exclude })}
                      placeholder="全局排除"
                    />
                    <Space>
                      单文件上限 (MB)
                      <InputNumber
                        aria-label="单文件上限"
                        min={0}
                        max={104857600}
                        value={policy.max_size_mb || 0}
                        onChange={(max_size_mb) =>
                          patch({ max_size_mb: max_size_mb ?? 0 })
                        }
                      />
                      0 表示不限
                    </Space>
                  </Space>
                ),
              },
              {
                key: 'weights',
                label: '同档位权重',
                children: (
                  <Space orientation="vertical" style={{ width: '100%' }}>
                    <Space>
                      <Switch
                        aria-label="允许同档升级"
                        checked={policy.same_tier}
                        onChange={(same_tier) => patch({ same_tier })}
                      />
                      允许同档升级
                    </Space>
                    <Space>
                      最低提升分数
                      <InputNumber
                        aria-label="最低提升分数"
                        min={1}
                        max={10000}
                        value={policy.min_score_gain || 1}
                        onChange={(min_score_gain) =>
                          patch({ min_score_gain: min_score_gain ?? 1 })
                        }
                      />
                    </Space>
                    {rulesEditor('bonuses')}
                  </Space>
                ),
              },
              {
                key: 'test',
                label: '试一试：比较两个版本',
                children: (
                  <Space orientation="vertical" style={{ width: '100%' }}>
                    <Input
                      aria-label="已有文件名"
                      value={oldName}
                      onChange={(e) => setOldName(e.target.value)}
                      placeholder="已有文件名"
                    />
                    <InputNumber
                      aria-label="已有文件大小 MB"
                      value={oldSize}
                      min={0}
                      placeholder="已有大小 MB（可选）"
                      onChange={(v) => setOldSize(v ?? undefined)}
                      style={{ width: '100%' }}
                    />
                    <Input
                      aria-label="新文件名"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="新文件名"
                    />
                    <InputNumber
                      aria-label="新文件大小 MB"
                      value={newSize}
                      min={0}
                      placeholder="新资源大小 MB（可选）"
                      onChange={(v) => setNewSize(v ?? undefined)}
                      style={{ width: '100%' }}
                    />
                    <Button
                      loading={testing}
                      onClick={async () => {
                        setTesting(true);
                        setError('');
                        try {
                          const res = await testUpgradePolicy({
                            policy,
                            incoming: newName,
                            existing: oldName,
                            incoming_size_mb: newSize,
                            existing_size_mb: oldSize,
                          });
                          setTestResult(res.data);
                        } catch (e) {
                          setError((e as Error).message);
                        } finally {
                          setTesting(false);
                        }
                      }}
                    >
                      比较质量
                    </Button>
                    {testResult && (
                      <Alert
                        type="info"
                        title={
                          <>
                            <Tag>{upgradeActionLabels[testResult.action]}</Tag>
                            {testResult.reason}
                          </>
                        }
                        description={`${testResult.existing.label} → ${testResult.incoming.label}。这里只测试质量规则；整理时还会校验 TMDB、季集和文件归属。`}
                      />
                    )}
                  </Space>
                ),
              },
            ]}
          />
          <Alert
            type="info"
            title="旧文件保留在恢复目录，STRM 与播放缓存随替换同步"
            description="名称中的编码、字幕等标签仅表示资源声明。洗版不会探测视频内容；多集文件会进入待确认。"
          />
        </>
      )}
    </Space>
  );
}
