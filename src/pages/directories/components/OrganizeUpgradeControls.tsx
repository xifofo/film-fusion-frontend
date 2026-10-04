import { Alert, Button, Card, Modal, message, Space, Tag } from 'antd';
import { useState } from 'react';
import { updateCloudDirectory } from '@/services/film-fusion/directory';
import {
  getUpgradeJobs,
  refreshUpgradeLibrary,
  retryUpgradeJob,
  type UpgradeJob,
} from '@/services/film-fusion/upgrade';
import UpgradePolicyEditor, { parseUpgradePolicy } from './UpgradePolicyEditor';

const labels: Record<UpgradeJob['status'], string> = {
  pending: '待执行',
  running: '执行中',
  failed: '待恢复',
  completed: '已完成',
  rolled_back: '已恢复旧版',
};

export default function OrganizeUpgradeControls({
  directory,
  onSaved,
}: {
  directory: API.CloudDirectory;
  onSaved: () => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [jobsOpen, setJobsOpen] = useState(false);
  const [value, setValue] = useState(directory.upgrade_policy || '');
  const [jobs, setJobs] = useState<UpgradeJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [messageApi, holder] = message.useMessage();
  const [modalApi, modalHolder] = Modal.useModal();
  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getUpgradeJobs(directory.id);
      setJobs(response.data || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  const retry = (job: UpgradeJob, restore: boolean) =>
    modalApi.confirm({
      title:
        restore || job.restoring
          ? '恢复此次洗版前的文件与 STRM？'
          : '继续完成此次洗版？',
      content:
        restore || job.restoring
          ? '会把新文件移回原目录，恢复旧文件及原 STRM。其他操作已修改的文件会停止处理并显示原因。'
          : '会核对文件的实际位置，只继续未完成的步骤。',
      okText: restore || job.restoring ? '恢复旧版' : '继续执行',
      cancelText: '取消',
      onOk: async () => {
        try {
          const response = await retryUpgradeJob(job.id, restore);
          await load();
          if (response.data.error) messageApi.error(response.data.error);
          else
            messageApi.success(
              restore || job.restoring ? '旧版已恢复' : '任务已处理',
            );
        } catch (e) {
          await load();
          setError((e as Error).message);
          messageApi.error((e as Error).message);
        }
      },
    });
  return (
    <>
      {holder}
      {modalHolder}
      <Space>
        <Button
          onClick={() => {
            setValue(directory.upgrade_policy || '');
            setError('');
            setEditOpen(true);
          }}
        >
          洗版策略
        </Button>
        <Button
          onClick={() => {
            setJobsOpen(true);
            void load();
          }}
        >
          洗版记录
        </Button>
      </Space>
      <Modal
        title="整理洗版策略"
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        width={760}
        destroyOnHidden
        confirmLoading={saving}
        styles={{
          body: { maxHeight: '65vh', overflowY: 'auto', paddingInlineEnd: 8 },
        }}
        okText="保存策略"
        cancelText="取消"
        onOk={async () => {
          setSaving(true);
          setError('');
          try {
            parseUpgradePolicy(value);
            await updateCloudDirectory({
              id: directory.id,
              upgrade_policy: value,
            });
            setEditOpen(false);
            onSaved();
            messageApi.success('策略已保存，请重新预览');
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setSaving(false);
          }
        }}
      >
        {error && <Alert type="error" title={error} />}
        {editOpen && <UpgradePolicyEditor value={value} onChange={setValue} />}
      </Modal>
      <Modal
        title="整理洗版记录"
        open={jobsOpen}
        onCancel={() => setJobsOpen(false)}
        width={820}
        footer={null}
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
      >
        <Space orientation="vertical" style={{ width: '100%' }}>
          <Button loading={loading} onClick={() => void load()}>
            刷新记录
          </Button>
          {error && <Alert type="error" title={error} />}
          {!loading && !jobs.length && (
            <Alert
              type="info"
              title="暂无洗版执行记录"
              description="启用策略后，在整理预览中选择可新增或可替换的文件并执行。"
            />
          )}
          {jobs.map((job) => {
            const leased =
              !!job.lease_until &&
              new Date(job.lease_until).getTime() > Date.now();
            const unfinished =
              job.status !== 'completed' && job.status !== 'rolled_back';
            return (
              <Card
                key={job.id}
                size="small"
                title={
                  <Space>
                    <Tag
                      color={
                        job.status === 'failed'
                          ? 'error'
                          : job.status === 'completed'
                            ? 'success'
                            : 'default'
                      }
                    >
                      {labels[job.status]}
                    </Tag>
                    {new Date(job.created_at).toLocaleString()}
                  </Space>
                }
              >
                <Space orientation="vertical" style={{ width: '100%' }}>
                  <span>任务：{job.id}</span>
                  <span style={{ overflowWrap: 'anywhere' }}>
                    旧文件恢复位置：{job.recovery_path}
                  </span>
                  {job.error && <Alert type="error" title={job.error} />}
                  {job.refresh_error && (
                    <Alert
                      type="warning"
                      title="替换已完成，Emby 刷新失败"
                      description={job.refresh_error}
                    />
                  )}
                  {job.status === 'completed' && job.refresh_error && (
                    <Button
                      onClick={async () => {
                        try {
                          const response = await refreshUpgradeLibrary(job.id);
                          await load();
                          if (response.data.refresh_error)
                            messageApi.error(response.data.refresh_error);
                          else messageApi.success('已提交 Emby 媒体库刷新');
                        } catch (e) {
                          messageApi.error((e as Error).message);
                        }
                      }}
                    >
                      重试 Emby 刷新
                    </Button>
                  )}
                  {unfinished && (
                    <Space>
                      <Button
                        disabled={leased}
                        onClick={() => retry(job, false)}
                      >
                        {job.restoring ? '继续恢复' : '继续执行'}
                      </Button>
                      {!job.restoring && (
                        <Button
                          disabled={leased}
                          onClick={() => retry(job, true)}
                        >
                          恢复旧版
                        </Button>
                      )}
                      {leased && <span>正在执行；中断后最多等待 5 分钟</span>}
                    </Space>
                  )}
                </Space>
              </Card>
            );
          })}
        </Space>
      </Modal>
    </>
  );
}
