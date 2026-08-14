import { PageContainer } from '@ant-design/pro-components';
import { Alert, message, Spin } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import TargetPanel from '@/pages/rss-automation/TargetPanel';
import type { RSSAutomationTarget } from '@/services/film-fusion';
import { getDownloaders } from '@/services/film-fusion';

const DownloadersPage = () => {
  const [downloaders, setDownloaders] = useState<RSSAutomationTarget[]>([]);
  const [loading, setLoading] = useState(true);
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

  return (
    <PageContainer
      header={{
        title: '下载器设置',
        subTitle: '集中管理 RSS 自动化使用的下载器账号',
      }}
    >
      {contextHolder}
      <Alert
        description="可添加多个 qBittorrent WebUI 账号；工作流节点按账号选择。密码只在后端保存，页面不会回显。"
        message="下载器账号与 RSS 流程分离管理"
        showIcon
        style={{ marginBottom: 16 }}
        type="info"
      />
      <Spin spinning={loading}>
        <TargetPanel onChanged={load} targets={downloaders} />
      </Spin>
    </PageContainer>
  );
};

export default DownloadersPage;
