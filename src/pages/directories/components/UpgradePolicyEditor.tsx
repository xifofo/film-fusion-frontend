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
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getUpgradePresets,
  getUpgradeRuleGroups,
  testUpgradePolicy,
  type UpgradePolicy,
  type UpgradePolicyInput,
  type UpgradeRule,
  type UpgradeRuleGroup,
  upgradeActionLabels,
  upgradeAudioLanguageLabels,
  upgradeSubtitleLabels,
} from '@/services/film-fusion/upgrade';
import UpgradeConditionEditor from './UpgradeConditionEditor';
import UpgradePolicySummary from './UpgradePolicySummary';

const options = (values: string[], labels?: Record<string, string>) =>
  values.map((value) => ({ label: labels?.[value] || value, value }));
const policyError = (cause: unknown) => {
  const error = cause as {
    response?: { data?: { message?: string } };
    message?: string;
  };
  return error.response?.data?.message || error.message || '操作失败，请重试';
};
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
  audio_codecs: [
    'TrueHD',
    'DTS-HD MA',
    'DTS-HD HRA',
    'DTS-HD',
    'DTS:X',
    'DTS',
    'E-AC-3',
    'AC-3',
    'DDP',
    'DD+',
    'DD',
    'AAC',
    'FLAC',
    'LPCM',
    'PCM',
    'MP3',
    'Opus',
    'Vorbis',
  ],
  audio_channels: ['7.1', '5.1', '2.0', '1.0'],
  audio_languages: ['zh', 'en', 'ja', 'ko', 'yue'],
  subtitles: ['zh-Hans', 'zh-Hant', 'zh', 'en', 'ja', 'ko'],
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

export function parseUpgradePolicy(
  value?: string,
): UpgradePolicyInput | undefined {
  if (!value?.trim()) return undefined;
  const parsed = JSON.parse(value) as UpgradePolicy;
  if (parsed?.group_id !== undefined) {
    if (!Number.isSafeInteger(parsed.group_id) || parsed.group_id <= 0)
      throw new Error('请选择有效的洗版规则组');
    return { enabled: !!parsed.enabled, group_id: parsed.group_id };
  }
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
  groupEditing = false,
}: {
  value?: string;
  onChange?: (value: string) => void;
  groupEditing?: boolean;
}) {
  const [presets, setPresets] = useState<Record<string, UpgradePolicy>>();
  const [error, setError] = useState('');
  const [groups, setGroups] = useState<UpgradeRuleGroup[]>([]);
  const [groupError, setGroupError] = useState('');
  const [groupsLoading, setGroupsLoading] = useState(false);
  const independentDraft = useRef<string | undefined>(undefined);
  const previousGroup = useRef<number | undefined>(undefined);
  const [oldName, setOldName] = useState('Example.2024.1080p.WEB-DL.H264.mkv');
  const [newName, setNewName] = useState('Example.2024.2160p.WEB-DL.H265.mkv');
  const [oldSize, setOldSize] = useState<number>();
  const [newSize, setNewSize] = useState<number>();
  const [testing, setTesting] = useState(false);
  const comparisonVersion = useRef(0);
  const [testResult, setTestResult] =
    useState<Awaited<ReturnType<typeof testUpgradePolicy>>['data']>();
  useEffect(() => {
    let active = true;
    getUpgradePresets()
      .then((response) => {
        if (response.code !== 0)
          throw new Error(response.message || '读取预设失败');
        if (active) setPresets(response.data);
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  const loadGroups = useCallback(async () => {
    setGroupsLoading(true);
    setGroupError('');
    try {
      const response = await getUpgradeRuleGroups();
      if (response.code !== 0)
        throw new Error(response.message || '读取规则组失败');
      setGroups(response.data || []);
    } catch (cause) {
      setGroupError(policyError(cause));
    } finally {
      setGroupsLoading(false);
    }
  }, []);
  useEffect(() => {
    if (!groupEditing) void loadGroups();
  }, [groupEditing, loadGroups]);
  let parsed: UpgradePolicyInput | undefined;
  let parseError = '';
  try {
    parsed = parseUpgradePolicy(value);
  } catch (e) {
    parseError = (e as Error).message;
  }
  const groupId = parsed?.group_id;
  const selectedGroup = groups.find((group) => group.id === groupId);
  useEffect(() => {
    comparisonVersion.current += 1;
    setTestResult(undefined);
  }, [value, selectedGroup?.revision, oldName, newName, oldSize, newSize]);
  const policy = groupId
    ? selectedGroup?.policy
    : (parsed as UpgradePolicy | undefined) || presets?.quality;
  const enabled = parsed?.enabled ?? groupEditing;
  useEffect(() => {
    if (groupId) previousGroup.current = groupId;
    else if (value && !parseError) independentDraft.current = value;
  }, [value, groupId, parseError]);
  const update = (next: UpgradePolicyInput) => {
    onChange?.(JSON.stringify(next));
    setTestResult(undefined);
    setError('');
  };
  const patch = (next: Partial<UpgradePolicy>) => {
    if (policy && !groupId) update({ ...policy, ...next });
  };
  const copyGroup = () => {
    if (!selectedGroup) return;
    const {
      group_id: _id,
      group_revision: _revision,
      ...independent
    } = selectedGroup.policy;
    update({ ...independent, enabled });
  };
  const switchSource = (source: string) => {
    if (source === 'group') {
      if (value && !groupId && !parseError) independentDraft.current = value;
      const id =
        groups.find((group) => group.id === previousGroup.current)?.id ||
        groups[0]?.id;
      if (id) update({ enabled, group_id: id });
    } else if (independentDraft.current) {
      const saved = parseUpgradePolicy(
        independentDraft.current,
      ) as UpgradePolicy;
      update({ ...saved, enabled });
    } else copyGroup();
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
                {(
                  [
                    'resolutions',
                    'sources',
                    'codecs',
                    'effects',
                    'audio_codecs',
                    'audio_channels',
                    'audio_languages',
                    'subtitles',
                  ] as const
                ).map((key) => (
                  <Select
                    key={key}
                    aria-label={
                      {
                        resolutions: '分辨率',
                        sources: '片源',
                        codecs: '编码',
                        effects: '特效',
                        audio_codecs: '音频编码',
                        audio_channels: '声道',
                        audio_languages: '音轨语言',
                        subtitles: '字幕语言',
                      }[key]
                    }
                    style={{ width: '100%' }}
                    mode="multiple"
                    showSearch={{ optionFilterProp: 'label' }}
                    allowClear
                    placeholder={
                      {
                        resolutions: '分辨率，不选则不限',
                        sources: '片源，不选则不限',
                        codecs: '编码，不选则不限',
                        effects: '特效，不选则不限',
                        audio_codecs: '音频编码，不选则不限',
                        audio_channels: '声道，不选则不限',
                        audio_languages:
                          '音轨语言（zh 国语 / yue 粤语），不选则不限',
                        subtitles:
                          '字幕语言（zh-Hans 简中 / zh-Hant 繁中），不选则不限',
                      }[key]
                    }
                    options={options(
                      choices[key],
                      key === 'audio_languages'
                        ? upgradeAudioLanguageLabels
                        : key === 'subtitles'
                          ? upgradeSubtitleLabels
                          : undefined,
                    )}
                    value={rule[key] || []}
                    onChange={(values) => updateRule(index, { [key]: values })}
                  />
                ))}
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
                <Input
                  aria-label="名称排除"
                  placeholder="名称排除（字面文本，不是正则）"
                  value={rule.exclude || ''}
                  maxLength={100}
                  onChange={(event) =>
                    updateRule(index, { exclude: event.target.value })
                  }
                />
                <Collapse
                  size="small"
                  items={[
                    {
                      key: 'advanced',
                      label: '组合条件与正则',
                      children: (
                        <Space orientation="vertical" style={{ width: '100%' }}>
                          <Alert
                            type="info"
                            title="基础字段与组合条件需要同时满足"
                            description="同一字段的多个值满足任意一个即可。未识别的音轨、字幕等标签属于未知，可能进入待确认；不等于不包含。"
                          />
                          <UpgradeConditionEditor
                            value={rule.condition}
                            onChange={(condition) =>
                              updateRule(index, { condition })
                            }
                          />
                          <Input
                            aria-label="包含正则"
                            placeholder="包含正则（可选）"
                            value={rule.include_regex || ''}
                            maxLength={200}
                            onChange={(event) =>
                              updateRule(index, {
                                include_regex: event.target.value,
                              })
                            }
                          />
                          <Input
                            aria-label="排除正则"
                            placeholder="排除正则（可选）"
                            value={rule.exclude_regex || ''}
                            maxLength={200}
                            onChange={(event) =>
                              updateRule(index, {
                                exclude_regex: event.target.value,
                              })
                            }
                          />
                          <span className="text-xs text-neutral-500">
                            正则采用 RE2，默认区分大小写；可用 (?i)
                            忽略大小写。不支持回溯引用和前后查找。
                          </span>
                        </Space>
                      ),
                    },
                  ]}
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
      {!groupEditing && (
        <>
          <Space wrap style={{ width: '100%' }}>
            <Select
              aria-label="策略来源"
              style={{ width: 170 }}
              value={groupId ? 'group' : 'independent'}
              onChange={switchSource}
              options={[
                {
                  value: 'independent',
                  label: '独立配置',
                  disabled:
                    !!groupId && !selectedGroup && !independentDraft.current,
                },
                {
                  value: 'group',
                  label: '引用规则组',
                  disabled: !groups.length,
                },
              ]}
            />
            <Button href="/upgrade-rules" target="_blank">
              管理洗版规则组
            </Button>
            <Button
              size="small"
              loading={groupsLoading}
              onClick={() => void loadGroups()}
            >
              刷新规则组
            </Button>
          </Space>
          {groupError && (
            <Alert
              type="warning"
              title="规则组读取失败，独立配置仍可使用"
              description={groupError}
            />
          )}
          {!groupsLoading && !groups.length && !groupError && (
            <span className="text-xs text-neutral-500">
              还没有规则组，可先到“洗版规则”创建；现有独立配置不受影响。
            </span>
          )}
          {groupId && (
            <>
              <Select
                aria-label="选择洗版规则组"
                value={groupId}
                style={{ width: '100%' }}
                loading={groupsLoading}
                options={groups.map((group) => ({
                  value: group.id,
                  label: `${group.name} · v${group.revision}`,
                }))}
                onChange={(id) => update({ enabled, group_id: id })}
              />
              {selectedGroup ? (
                <>
                  <Alert
                    type="info"
                    title={`引用 ${selectedGroup.name} · v${selectedGroup.revision}`}
                    description={
                      selectedGroup.description ||
                      '此目录会使用规则组的最新版本。'
                    }
                  />
                  <span className="text-xs text-neutral-500">
                    规则组更新后请重新预览，才可执行整理。独立配置草稿在本次编辑中保留。
                  </span>
                  <Button onClick={copyGroup}>复制规则组为独立配置</Button>
                </>
              ) : (
                !groupsLoading && (
                  <Alert
                    type="error"
                    title="引用的规则组无法读取"
                    description="请刷新规则组或重新选择；不会自动替换成默认策略。"
                  />
                )
              )}
            </>
          )}
          <Space>
            <Switch
              aria-label="启用洗版"
              checked={enabled}
              disabled={!policy && !groupId}
              onChange={(checked) =>
                groupId
                  ? update({ enabled: checked, group_id: groupId })
                  : patch({ enabled: checked })
              }
            />
            <strong>在此目录的整理中启用洗版</strong>
          </Space>
        </>
      )}
      {groupEditing && (
        <Alert
          type="info"
          title="集中维护规则，启用状态由各目录控制"
          description="保存会更新所有引用目录后续预览所用的规则；已开始的任务继续使用原快照。"
        />
      )}
      {!groupId && (
        <Space wrap>
          {presets &&
            Object.entries(presets).map(([key, preset]) => (
              <Button
                key={key}
                onClick={() =>
                  update({ ...preset, enabled: groupEditing || enabled })
                }
              >
                {preset.name}
              </Button>
            ))}
        </Space>
      )}
      {policy && (
        <>
          {groupId ? (
            <UpgradePolicySummary policy={policy} />
          ) : (
            <>
              {!groupEditing && (
                <Input
                  aria-label="策略名称"
                  value={policy.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  placeholder="策略名称"
                />
              )}
              <Alert
                type="info"
                title="从上往下匹配，第一个命中决定档位"
                description="较高档位替换较低档位。同档默认保留已有；信息不足会列出待确认原因。保存策略后重新预览，才会应用新规则。"
                showIcon
              />
              {rulesEditor('rules')}
            </>
          )}
          <Collapse
            items={[
              ...(!groupId
                ? [
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
                          <UpgradeConditionEditor
                            label="全局排除条件"
                            value={policy.exclude_condition}
                            onChange={(exclude_condition) =>
                              patch({ exclude_condition })
                            }
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
                  ]
                : []),
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
                        const requestVersion = comparisonVersion.current;
                        try {
                          const res = await testUpgradePolicy({
                            policy: groupId
                              ? { enabled, group_id: groupId }
                              : policy,
                            incoming: newName,
                            existing: oldName,
                            incoming_size_mb: newSize,
                            existing_size_mb: oldSize,
                          });
                          if (res.code !== 0)
                            throw new Error(res.message || '比较失败');
                          if (requestVersion === comparisonVersion.current)
                            setTestResult(res.data);
                        } catch (e) {
                          if (requestVersion === comparisonVersion.current)
                            setError(policyError(e));
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
            description="规则依据文件名中的画质、音轨和字幕标签，不探测媒体内容。未标注的信息属于未知；多集文件会进入待确认。"
          />
        </>
      )}
    </Space>
  );
}
