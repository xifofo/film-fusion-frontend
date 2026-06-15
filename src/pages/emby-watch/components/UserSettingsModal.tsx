import { CloudDownloadOutlined } from '@ant-design/icons';
import {
  Button,
  Divider,
  Modal,
  message,
  Progress,
  Slider,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  backfillEmbyWatch,
  getEmbyWatchBackfillStatus,
  getEmbyWatchSetting,
  saveEmbyWatchSetting,
  saveEmbyWatchUsers,
} from '@/services/film-fusion';

type UserSettingsModalProps = {
  open: boolean;
  users: API.EmbyWatchUserView[];
  onClose: () => void;
  onChanged: () => void;
};

const fmtDateTime = (v?: string | null) => {
  if (!v) return '从未';
  const d = dayjs(v);
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm') : v;
};

const DEFAULT_SETTING: API.EmbyWatchSetting = {
  completion_threshold: 0.9,
  count_playback_stop: true,
  count_mark_played: true,
};

const UserSettingsModal: React.FC<UserSettingsModalProps> = ({
  open,
  users,
  onClose,
  onChanged,
}) => {
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const [saving, setSaving] = useState(false);
  const [backfillingId, setBackfillingId] = useState<string>();
  const [setting, setSetting] = useState<API.EmbyWatchSetting>(DEFAULT_SETTING);
  const [settingSaving, setSettingSaving] = useState(false);
  const [progress, setProgress] = useState<
    Record<string, API.EmbyWatchBackfillStatus>
  >({});
  const timersRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const usersRef = useRef(users);
  usersRef.current = users;
  const [messageApi, contextHolder] = message.useMessage();

  const clearTimers = useCallback(() => {
    Object.values(timersRef.current).forEach((t) => clearInterval(t));
    timersRef.current = {};
  }, []);

  const pollUser = useCallback(
    (id: string) => {
      if (timersRef.current[id]) return;
      const tick = async () => {
        try {
          const res = await getEmbyWatchBackfillStatus(id);
          if (res.code === 0 && res.data) {
            const status = res.data;
            setProgress((p) => ({ ...p, [id]: status }));
            if (!status.running) {
              clearInterval(timersRef.current[id]);
              delete timersRef.current[id];
              onChanged();
            }
          }
        } catch {
          // 轮询失败忽略，下一次继续
        }
      };
      tick();
      timersRef.current[id] = setInterval(tick, 1500);
    },
    [onChanged],
  );

  // 仅在弹窗「打开」时初始化勾选/加载设置/对正在回填的用户开始轮询；
  // 通过 usersRef 读取最新用户，避免轮询触发的 users 刷新把未保存的勾选重置掉。
  useEffect(() => {
    if (!open) {
      clearTimers();
      return;
    }
    const current = usersRef.current;
    setSelectedKeys(
      current.filter((u) => u.tracked).map((u) => u.emby_user_id),
    );
    current.forEach((u) => {
      if (u.backfilling) pollUser(u.emby_user_id);
    });
    (async () => {
      try {
        const res = await getEmbyWatchSetting();
        if (res.code === 0 && res.data) setSetting(res.data);
      } catch {
        // 忽略，使用默认值
      }
    })();
  }, [open, pollUser, clearTimers]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await saveEmbyWatchUsers(selectedKeys.map((k) => String(k)));
      if (res.code === 0) {
        messageApi.success('已保存统计用户');
        onChanged();
        onClose();
      } else {
        messageApi.error(res.message || '保存失败');
      }
    } catch (error: any) {
      messageApi.error(error?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSetting = async () => {
    setSettingSaving(true);
    try {
      const res = await saveEmbyWatchSetting(setting);
      if (res.code === 0) {
        if (res.data) setSetting(res.data);
        messageApi.success('已保存采集规则');
      } else {
        messageApi.error(res.message || '保存采集规则失败');
      }
    } catch (error: any) {
      messageApi.error(error?.message || '保存采集规则失败');
    } finally {
      setSettingSaving(false);
    }
  };

  const handleBackfill = async (embyUserId: string) => {
    setBackfillingId(embyUserId);
    try {
      const res = await backfillEmbyWatch(embyUserId);
      if (res.code === 0) {
        messageApi.success('历史回填已开始');
        setProgress((p) => ({
          ...p,
          [embyUserId]: { running: true, scanned: 0, inserted: 0, total: 0 },
        }));
        pollUser(embyUserId);
      } else {
        messageApi.error(res.message || '回填失败');
      }
    } catch (error: any) {
      messageApi.error(error?.message || '回填失败');
    } finally {
      setBackfillingId(undefined);
    }
  };

  const renderProgress = (id: string) => {
    const p = progress[id];
    if (!p) return <span style={{ color: '#bbb' }}>—</span>;
    if (p.running) {
      const percent =
        p.total > 0 ? Math.min(99, Math.round((p.scanned / p.total) * 100)) : 0;
      return (
        <Tooltip
          title={`已扫描 ${p.scanned}/${p.total || '?'}，新增 ${p.inserted}`}
        >
          <Progress percent={percent} size="small" status="active" />
        </Tooltip>
      );
    }
    if (p.error) {
      return (
        <Tooltip title={p.error}>
          <Tag color="error">失败</Tag>
        </Tooltip>
      );
    }
    if (p.finished_at) {
      return (
        <Tooltip title={`扫描 ${p.scanned}，新增 ${p.inserted}`}>
          <Tag color="success">完成 +{p.inserted}</Tag>
        </Tooltip>
      );
    }
    return <span style={{ color: '#bbb' }}>—</span>;
  };

  const columns: ColumnsType<API.EmbyWatchUserView> = [
    {
      title: 'Emby 用户',
      dataIndex: 'emby_user_name',
      render: (v: string, record) => v || record.emby_user_id,
    },
    {
      title: '记录数',
      dataIndex: 'record_count',
      width: 80,
      render: (v: number) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: '最近回填',
      dataIndex: 'last_backfill_at',
      width: 150,
      render: (v?: string | null) => fmtDateTime(v),
    },
    {
      title: '进度',
      key: 'progress',
      width: 140,
      render: (_, record) => renderProgress(record.emby_user_id),
    },
    {
      title: '操作',
      key: 'option',
      width: 130,
      render: (_, record) => (
        <Tooltip title="从 Emby「已观看」拉取历史记录（按最后观看日期落库）">
          <Button
            size="small"
            icon={<CloudDownloadOutlined />}
            loading={
              backfillingId === record.emby_user_id ||
              progress[record.emby_user_id]?.running ||
              record.backfilling
            }
            onClick={() => handleBackfill(record.emby_user_id)}
          >
            {progress[record.emby_user_id]?.running || record.backfilling
              ? '回填中…'
              : '回填历史'}
          </Button>
        </Tooltip>
      ),
    },
  ];

  return (
    <>
      {contextHolder}
      <Modal
        title="观看统计设置"
        open={open}
        onCancel={onClose}
        onOk={handleSave}
        okText="保存勾选用户"
        confirmLoading={saving}
        width={780}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <span style={{ color: '#888' }}>
            勾选需要统计观看数据的 Emby 用户并保存；可对单个用户「回填历史」拉取
            Emby 已观看记录。新增观看会由播放 webhook 自动记录。
          </span>
          <Table<API.EmbyWatchUserView>
            rowKey="emby_user_id"
            size="small"
            columns={columns}
            dataSource={users}
            pagination={false}
            rowSelection={{
              selectedRowKeys: selectedKeys,
              onChange: setSelectedKeys,
            }}
          />

          <Divider style={{ margin: '8px 0' }} orientation="left">
            采集规则
          </Divider>
          <div style={{ color: '#888' }}>
            控制 Emby 播放 webhook 如何「计为已看」，可按你的 Emby/Jellyfin
            推送行为调整。
          </div>
          <div style={{ maxWidth: 420 }}>
            <div style={{ marginBottom: 4 }}>
              playback.stop 完成度阈值：
              <b>{Math.round((setting.completion_threshold ?? 0.9) * 100)}%</b>
            </div>
            <Slider
              min={50}
              max={100}
              step={5}
              value={Math.round((setting.completion_threshold ?? 0.9) * 100)}
              onChange={(v) =>
                setSetting((s) => ({ ...s, completion_threshold: v / 100 }))
              }
            />
          </div>
          <Space size={24} wrap>
            <Space>
              <Switch
                checked={setting.count_playback_stop}
                onChange={(v) =>
                  setSetting((s) => ({ ...s, count_playback_stop: v }))
                }
              />
              <span>采集 playback.stop（播放结束达标）</span>
            </Space>
            <Space>
              <Switch
                checked={setting.count_mark_played}
                onChange={(v) =>
                  setSetting((s) => ({ ...s, count_mark_played: v }))
                }
              />
              <span>采集 item.markplayed（标记已看）</span>
            </Space>
          </Space>
          <div>
            <Button
              type="primary"
              ghost
              loading={settingSaving}
              onClick={handleSaveSetting}
            >
              保存采集规则
            </Button>
          </div>
        </Space>
      </Modal>
    </>
  );
};

export default UserSettingsModal;
