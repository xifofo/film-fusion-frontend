import {
  Alert,
  App,
  Button,
  ConfigProvider,
  Empty,
  Input,
  Modal,
  Space,
  Table,
  Tag,
} from 'antd';
import { useCallback, useEffect, useState } from 'react';
import ConsolePage from '@/components/ConsolePage';
import UpgradePolicyEditor, {
  parseUpgradePolicy,
} from '@/pages/directories/components/UpgradePolicyEditor';
import {
  createUpgradeRuleGroup,
  deleteUpgradeRuleGroup,
  getUpgradeRuleGroups,
  type UpgradePolicy,
  type UpgradeRuleGroup,
  updateUpgradeRuleGroup,
} from '@/services/film-fusion/upgrade';

const emptyPolicy: UpgradePolicy = {
  enabled: true,
  name: '',
  rules: [],
  bonuses: [],
  exclude: [],
  max_size_mb: 0,
  same_tier: false,
  min_score_gain: 1,
};

type Draft = {
  id?: number;
  revision?: number;
  directoryCount: number;
  name: string;
  description: string;
  policy: string;
};

const errorText = (cause: unknown) => {
  const error = cause as {
    response?: { data?: { message?: string } };
    message?: string;
  };
  return error.response?.data?.message || error.message || '操作失败，请重试';
};

export default function UpgradeRulesPage() {
  const { message, modal } = App.useApp();
  const [groups, setGroups] = useState<UpgradeRuleGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<Draft>();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getUpgradeRuleGroups();
      if (result.code !== 0)
        throw new Error(result.message || '读取洗版规则失败');
      setGroups(result.data || []);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const open = (group?: UpgradeRuleGroup, copy = false) => {
    const {
      group_id: _groupId,
      group_revision: _groupRevision,
      ...policy
    } = group?.policy || emptyPolicy;
    setSaveError('');
    setDraft({
      id: copy ? undefined : group?.id,
      revision: copy ? undefined : group?.revision,
      directoryCount: copy ? 0 : group?.directory_count || 0,
      name: group ? `${group.name}${copy ? ' 副本' : ''}` : '',
      description: group?.description || '',
      policy: JSON.stringify({ ...policy, enabled: true }),
    });
  };
  const save = async () => {
    if (!draft) return;
    setSaveError('');
    if (!draft.name.trim()) {
      setSaveError('请填写规则组名称');
      return;
    }
    setSaving(true);
    try {
      const parsed = parseUpgradePolicy(draft.policy);
      if (!parsed || parsed.group_id)
        throw new Error('规则组需要独立策略，不能引用其他规则组');
      const policy = parsed as UpgradePolicy;
      if (!policy.rules.length)
        throw new Error('请先选择预设，或添加至少一个优先级档位');
      const input = {
        name: draft.name.trim(),
        description: draft.description.trim(),
        policy: { ...policy, enabled: true, name: draft.name.trim() },
      };
      let result: Awaited<ReturnType<typeof createUpgradeRuleGroup>>;
      if (draft.id) {
        if (!draft.revision) throw new Error('缺少规则组版本，请重新打开编辑');
        result = await updateUpgradeRuleGroup(draft.id, {
          ...input,
          expected_revision: draft.revision,
        });
      } else {
        result = await createUpgradeRuleGroup(input);
      }
      if (result.code !== 0) throw new Error(result.message || '保存失败');
      setDraft(undefined);
      message.success(
        draft.id
          ? '规则组已更新，引用目录请重新预览'
          : '规则组已创建，可在目录洗版策略中引用',
      );
      await load();
    } catch (cause) {
      setSaveError(errorText(cause));
    } finally {
      setSaving(false);
    }
  };
  const remove = (group: UpgradeRuleGroup) =>
    modal.confirm({
      title: `删除规则组“${group.name}”？`,
      content: '仅允许删除未被目录引用的规则组。',
      okText: '删除规则组',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const result = await deleteUpgradeRuleGroup(group.id, group.revision);
          if (result.code !== 0) throw new Error(result.message || '删除失败');
          message.success('规则组已删除');
          await load();
        } catch (cause) {
          setError(errorText(cause));
        }
      },
    });

  const visibleGroups = groups.filter((group) =>
    `${group.name} ${group.description}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  return (
    <ConsolePage
      eyebrow="Upgrade rules"
      title="洗版规则"
      actions={
        <>
          <Button onClick={() => void load()} loading={loading}>
            刷新
          </Button>
          <Button type="primary" onClick={() => open()}>
            新建规则组
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Alert
          type="info"
          showIcon
          title="一份规则组，可供多个目录使用"
          description="按优先级档位、音轨和字幕标签决定是否替换已有版本。在目录的洗版策略中选择“引用规则组”；已有独立策略保持原样。规则依据文件名标签，不是媒体内容实测。"
          action={<Button href="/directories">配置目录</Button>}
        />
        {error && (
          <Alert type="error" showIcon title="操作未完成" description={error} />
        )}
        <Input
          aria-label="搜索规则组"
          placeholder="搜索规则组名称或说明"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          allowClear
          style={{ maxWidth: 420 }}
        />
        <Table<UpgradeRuleGroup>
          rowKey="id"
          loading={loading}
          dataSource={visibleGroups}
          scroll={{ x: 760 }}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          locale={{
            emptyText: (
              <Empty
                description={
                  search
                    ? '没有匹配的规则组'
                    : '还没有规则组，点击“新建规则组”开始配置'
                }
              />
            ),
          }}
          columns={[
            {
              title: '规则组',
              key: 'name',
              render: (_, group) => (
                <div className="min-w-48">
                  <strong>{group.name}</strong>
                  <p className="m-0 mt-1 text-xs text-neutral-500">
                    {group.description || '暂无说明'}
                  </p>
                </div>
              ),
            },
            {
              title: '配置',
              key: 'rules',
              width: 170,
              render: (_, group) => (
                <span>
                  {group.policy.rules.length} 个档位 ·{' '}
                  {group.policy.bonuses?.length || 0} 个偏好
                </span>
              ),
            },
            {
              title: '版本',
              dataIndex: 'revision',
              width: 80,
              render: (revision) => <Tag>v{revision}</Tag>,
            },
            {
              title: '引用目录',
              dataIndex: 'directory_count',
              width: 100,
              render: (count) => `${count} 个`,
            },
            {
              title: '操作',
              key: 'actions',
              width: 240,
              render: (_, group) => (
                <Space wrap size={4}>
                  <Button
                    size="small"
                    aria-label={`编辑${group.name}`}
                    onClick={() => open(group)}
                  >
                    编辑
                  </Button>
                  <Button
                    size="small"
                    aria-label={`复制${group.name}`}
                    onClick={() => open(group, true)}
                  >
                    复制
                  </Button>
                  <Button
                    size="small"
                    danger
                    aria-label={`删除${group.name}`}
                    disabled={group.directory_count > 0}
                    title={
                      group.directory_count
                        ? '请先在引用目录中解除关联'
                        : undefined
                    }
                    onClick={() => remove(group)}
                  >
                    删除
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </div>
      <Modal
        title={draft?.id ? `编辑规则组 · v${draft.revision}` : '新建规则组'}
        open={!!draft}
        onCancel={() => !saving && setDraft(undefined)}
        onOk={() => void save()}
        okText="保存规则组"
        cancelText="取消"
        confirmLoading={saving}
        cancelButtonProps={{ disabled: saving }}
        closable={!saving}
        keyboard={!saving}
        mask={{ closable: false }}
        width={900}
        style={{ top: 24 }}
        destroyOnHidden
        styles={{
          body: {
            maxHeight: 'calc(100dvh - 180px)',
            overflowY: 'auto',
            paddingInlineEnd: 8,
          },
        }}
      >
        {draft && (
          <ConfigProvider componentDisabled={saving}>
            <Space
              orientation="vertical"
              size="middle"
              style={{ width: '100%' }}
            >
              {saveError && (
                <Alert
                  type="error"
                  showIcon
                  title="保存失败，编辑内容已保留"
                  description={saveError}
                />
              )}
              {draft.directoryCount > 0 && (
                <Alert
                  type="warning"
                  title={`此规则组被 ${draft.directoryCount} 个目录引用`}
                  description="保存后会用于这些目录的新预览；旧预览需要重新生成。"
                />
              )}
              <label htmlFor="upgrade-group-name" className="block w-full">
                规则组名称
                <Input
                  id="upgrade-group-name"
                  aria-label="规则组名称"
                  value={draft.name}
                  maxLength={120}
                  onChange={(event) =>
                    !saving && setDraft({ ...draft, name: event.target.value })
                  }
                  placeholder="例如：4K 国语优先"
                />
              </label>
              <label
                htmlFor="upgrade-group-description"
                className="block w-full"
              >
                说明
                <Input.TextArea
                  id="upgrade-group-description"
                  aria-label="规则组说明"
                  value={draft.description}
                  maxLength={1000}
                  onChange={(event) =>
                    !saving &&
                    setDraft({ ...draft, description: event.target.value })
                  }
                  placeholder="说明适用的目录或收藏偏好"
                  rows={2}
                />
              </label>
              <UpgradePolicyEditor
                groupEditing
                value={draft.policy}
                onChange={(policy) => !saving && setDraft({ ...draft, policy })}
              />
            </Space>
          </ConfigProvider>
        )}
      </Modal>
    </ConsolePage>
  );
}
