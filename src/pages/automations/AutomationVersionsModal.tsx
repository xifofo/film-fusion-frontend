import {
  Alert,
  Button,
  Modal,
  Popconfirm,
  Select,
  Spin,
  Table,
  Tag,
} from 'antd';
import { useEffect, useState } from 'react';
import type {
  AutomationCreateInput,
  AutomationRevision,
} from '@/services/film-fusion';
import {
  getAutomationRevisions,
  restoreAutomationRevision,
} from '@/services/film-fusion';
import styles from './Management.module.less';
import { automationChanges } from './management';

export default function AutomationVersionsModal({
  sourceID,
  current,
  onCancel,
  onRestored,
}: {
  sourceID: number;
  current: AutomationCreateInput;
  onCancel: () => void;
  onRestored: () => Promise<void>;
}) {
  const [revisions, setRevisions] = useState<AutomationRevision[]>([]);
  const [selectedID, setSelectedID] = useState<number>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [visit, setVisit] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getAutomationRevisions(sourceID)
      .then((response) => {
        if (response.code !== 0 || !response.data)
          throw new Error(response.message || '读取版本失败');
        if (!active) return;
        setRevisions(response.data);
        setSelectedID((response.data[1] || response.data[0])?.id);
      })
      .catch((cause) => {
        if (active) setError(cause?.data || cause?.message || '读取版本失败');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [sourceID, visit]);
  const selected = revisions.find((item) => item.id === selectedID);
  const latest = revisions[0];
  const savedCurrent = latest
    ? (JSON.parse(latest.configuration_json) as AutomationCreateInput)
    : current;
  const changes = selected
    ? automationChanges(JSON.parse(selected.configuration_json), savedCurrent)
    : [];
  const restore = async () => {
    if (!selected || !latest) return;
    setSaving(true);
    setError('');
    try {
      const response = await restoreAutomationRevision(
        sourceID,
        selected.id,
        latest.version,
      );
      if (response.code !== 0 || !response.data)
        throw new Error(response.message || '恢复版本失败');
      await onRestored();
    } catch (cause: any) {
      setError(cause?.data || cause?.message || '恢复版本失败');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open
      width={1000}
      title="版本历史与回滚"
      onCancel={onCancel}
      footer={
        <Button onClick={onCancel} disabled={saving}>
          关闭
        </Button>
      }
    >
      <div className={styles.stack}>
        <Alert
          type="info"
          title="恢复会创建一个新版本，并将流程停用"
          description="已开始的运行继续使用启动时的版本。此功能启用前的修改无法追溯；首次保存会保留原有配置。"
          showIcon
        />
        {loading ? (
          <Spin />
        ) : (
          <>
            <div className={styles.row}>
              <Select
                aria-label="选择历史版本"
                style={{ flex: 1 }}
                value={selectedID}
                onChange={setSelectedID}
                options={revisions.map((revision) => ({
                  value: revision.id,
                  label: `v${revision.version} · ${new Date(revision.created_at).toLocaleString('zh-CN')}`,
                }))}
              />
              {latest && <Tag>当前 v{latest.version}</Tag>}
              <Button
                onClick={() => setVisit((value) => value + 1)}
                disabled={saving}
              >
                刷新
              </Button>
              <Popconfirm
                title={`恢复 v${selected?.version} 的来源和流程配置？`}
                description="恢复后检查参数和账号，再启用运行。"
                onConfirm={restore}
                okText="恢复为新版本"
                cancelText="取消"
              >
                <Button
                  disabled={!selected || selected.id === latest?.id}
                  loading={saving}
                >
                  恢复此版本
                </Button>
              </Popconfirm>
            </div>
            <Table
              size="small"
              rowKey="key"
              dataSource={changes}
              pagination={{ pageSize: 8 }}
              locale={{ emptyText: '与当前版本配置相同' }}
              columns={[
                { title: '改动项', dataIndex: 'label', width: 180 },
                {
                  title: '所选历史版本',
                  dataIndex: 'before',
                  render: (value) => (
                    <pre className={styles.code}>
                      {value === undefined
                        ? '未配置'
                        : JSON.stringify(value, null, 2)}
                    </pre>
                  ),
                },
                {
                  title: '当前版本',
                  dataIndex: 'after',
                  render: (value) => (
                    <pre className={styles.code}>
                      {value === undefined
                        ? '未配置'
                        : JSON.stringify(value, null, 2)}
                    </pre>
                  ),
                },
              ]}
            />
          </>
        )}
        {error && <Alert type="error" title={error} showIcon />}
      </div>
    </Modal>
  );
}
