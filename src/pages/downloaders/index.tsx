import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { Button, message, Spin, Typography } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import ConsolePage from '@/components/ConsolePage';
import TargetPanel, {
  type TargetPanelHandle,
} from '@/pages/rss-automation/TargetPanel';
import type {
  RSSAutomationTarget,
  RSSAutomationTargetStatus,
} from '@/services/film-fusion';
import { getDownloaderStatuses, getDownloaders } from '@/services/film-fusion';

const STATUS_REFRESH_INTERVAL = 10_000;
const { Text } = Typography;

const DownloadersPage = () => {
  const [downloaders, setDownloaders] = useState<RSSAutomationTarget[]>([]);
  const [statuses, setStatuses] = useState<RSSAutomationTargetStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState('');
  const statusRequestRef = useRef<Promise<void> | undefined>(undefined);
  const targetPanelRef = useRef<TargetPanelHandle>(null);
  const [messageApi, contextHolder] = message.useMessage();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getDownloaders();
      if (response.code !== 0 || !response.data) {
        throw new Error(response.message || '获取下载器失败');
      }
      setDownloaders(response.data);
    } catch (error: any) {
      messageApi.error(error?.data || error?.message || '获取下载器失败');
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadStatuses = useCallback(() => {
    if (statusRequestRef.current) return statusRequestRef.current;
    setStatusLoading(true);
    const request = (async () => {
      try {
        const response = await getDownloaderStatuses();
        if (response.code !== 0 || !response.data) {
          throw new Error(response.message || '获取下载器实时状态失败');
        }
        setStatuses(response.data);
        setStatusError('');
      } catch (error: any) {
        setStatusError(
          error?.data || error?.message || '暂时无法获取下载器实时状态',
        );
      }
    })();
    const trackedRequest = request.finally(() => {
      statusRequestRef.current = undefined;
      setStatusLoading(false);
    });
    statusRequestRef.current = trackedRequest;
    return trackedRequest;
  }, []);

  useEffect(() => {
    let cancelled = false;
    let refreshTimer: number | undefined;
    const poll = async () => {
      await loadStatuses();
      if (!cancelled) {
        refreshTimer = window.setTimeout(poll, STATUS_REFRESH_INTERVAL);
      }
    };
    void poll();
    return () => {
      cancelled = true;
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer);
    };
  }, [loadStatuses]);

  const handleChanged = useCallback(async () => {
    await load();
    await loadStatuses();
  }, [load, loadStatuses]);

  return (
    <ConsolePage
      actions={
        <>
          <Text type="secondary">每 10 秒更新</Text>
          <Button
            icon={<ReloadOutlined />}
            loading={statusLoading}
            onClick={loadStatuses}
          >
            刷新状态
          </Button>
          <Button
            icon={<PlusOutlined />}
            onClick={() => targetPanelRef.current?.openCreate()}
            type="primary"
          >
            添加 qBittorrent
          </Button>
        </>
      }
      eyebrow="Download clients"
      title="下载器设置"
    >
      {contextHolder}
      <Spin spinning={loading}>
        <TargetPanel
          actionRef={targetPanelRef}
          onChanged={handleChanged}
          onRefreshStatuses={loadStatuses}
          statusError={statusError}
          statusLoading={statusLoading}
          statuses={statuses}
          targets={downloaders}
          unframed
        />
      </Spin>
    </ConsolePage>
  );
};

export default DownloadersPage;
