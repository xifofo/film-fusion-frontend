import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  ChromeOutlined,
  GlobalOutlined,
  KeyOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import {
  Alert,
  Button,
  Card,
  Col,
  Input,
  Modal,
  message,
  Row,
  Space,
  Statistic,
} from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  RSSGeneratorDashboard,
  RSSGeneratorFeed,
  RSSGeneratorFeedInput,
  RSSGeneratorPreview,
  RSSGeneratorToken,
  RSSGeneratorTokenInput,
  RSSGeneratorTokenSecret,
} from '@/services/film-fusion';
import {
  createRSSGeneratorFeed,
  createRSSGeneratorToken,
  deleteRSSGeneratorFeed,
  deleteRSSGeneratorToken,
  getRSSGeneratorDashboard,
  listRSSGeneratorFeeds,
  listRSSGeneratorTokens,
  previewRSSGeneratorDefinition,
  previewRSSGeneratorFeed,
  rotateRSSGeneratorToken,
  updateRSSGeneratorFeed,
} from '@/services/film-fusion';
import FeedEditor from './FeedEditor';
import FeedList from './FeedList';
import styles from './index.module.less';
import PreviewPanel from './PreviewPanel';
import TokenManager from './TokenManager';

type PageView = 'overview' | 'editor' | 'tokens';

const errorText = (error: any, fallback: string) =>
  error?.response?.data?.message || error?.data || error?.message || fallback;

const definitionFromFeed = (feed: RSSGeneratorFeed): RSSGeneratorFeedInput => ({
  name: feed.name,
  slug: feed.slug,
  description: feed.description,
  home_page_url: feed.home_page_url,
  language: feed.language,
  author: feed.author,
  image_url: feed.image_url,
  route_kind: feed.route_kind,
  source_url_template: feed.source_url_template,
  method: feed.method,
  request_body_template: feed.request_body_template,
  parameters: feed.parameters || [],
  headers: feed.headers || {},
  selectors: feed.selectors || {},
  mapping: feed.mapping || {},
  cookie: feed.cookie,
  proxy_url: feed.proxy_url,
  proxy_allow_private: feed.proxy_allow_private || false,
  secret_query_params: feed.secret_query_params || {},
  browser_storage_state: feed.browser_storage_state,
  wait_until: feed.wait_until,
  wait_for_selector: feed.wait_for_selector,
  render_delay_ms: feed.render_delay_ms,
  item_limit: feed.item_limit,
  browser_fallback: feed.browser_fallback,
  cache_ttl_seconds: feed.cache_ttl_seconds,
  stale_ttl_seconds: feed.stale_ttl_seconds,
  enabled: feed.enabled,
});

const RSSGeneratorPage = () => {
  const [messageApi, contextHolder] = message.useMessage();
  const [view, setView] = useState<PageView>('overview');
  const [feeds, setFeeds] = useState<RSSGeneratorFeed[]>([]);
  const [dashboard, setDashboard] = useState<RSSGeneratorDashboard>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<number>();
  const [selectedFeed, setSelectedFeed] = useState<RSSGeneratorFeed>();
  const [tokens, setTokens] = useState<RSSGeneratorToken[]>([]);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [autoOpenTokenCreate, setAutoOpenTokenCreate] = useState(false);
  const [previewFeed, setPreviewFeed] = useState<RSSGeneratorFeed>();
  const [preview, setPreview] = useState<RSSGeneratorPreview>();
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string>();
  const [previewParams, setPreviewParams] = useState<Record<string, string>>(
    {},
  );

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [dashboardResponse, feedsResponse] = await Promise.all([
          getRSSGeneratorDashboard(),
          listRSSGeneratorFeeds(),
        ]);
        if (dashboardResponse.code !== 0 || !dashboardResponse.data) {
          throw new Error(
            dashboardResponse.message || '获取 RSS 生成器状态失败',
          );
        }
        if (feedsResponse.code !== 0 || !feedsResponse.data) {
          throw new Error(feedsResponse.message || '获取 Feed 列表失败');
        }
        setDashboard(dashboardResponse.data);
        setFeeds(feedsResponse.data);
        setSelectedFeed((current) =>
          current
            ? feedsResponse.data?.find((feed) => feed.id === current.id) ||
              current
            : current,
        );
      } catch (error: any) {
        if (!silent) {
          messageApi.error(errorText(error, '获取 RSS 生成器信息失败'));
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [messageApi],
  );

  useEffect(() => {
    load();
  }, [load]);

  const loadTokens = useCallback(
    async (feed: RSSGeneratorFeed, silent = false) => {
      if (!silent) setTokensLoading(true);
      try {
        const response = await listRSSGeneratorTokens(feed.id);
        if (response.code !== 0 || !response.data) {
          throw new Error(response.message || '获取 Token 列表失败');
        }
        setTokens(response.data);
      } catch (error: any) {
        messageApi.error(errorText(error, '获取 Token 列表失败'));
      } finally {
        if (!silent) setTokensLoading(false);
      }
    },
    [messageApi],
  );

  const openTokens = (feed: RSSGeneratorFeed, createImmediately = false) => {
    setSelectedFeed(feed);
    setAutoOpenTokenCreate(createImmediately);
    setView('tokens');
    setTokens([]);
    loadTokens(feed);
  };

  const saveFeed = async (definition: RSSGeneratorFeedInput) => {
    setSaving(true);
    try {
      const creating = !selectedFeed;
      const response = selectedFeed
        ? await updateRSSGeneratorFeed(selectedFeed.id, definition)
        : await createRSSGeneratorFeed(definition);
      if (response.code !== 0 || !response.data) {
        throw new Error(response.message || '保存 Feed 失败');
      }
      messageApi.success(selectedFeed ? 'Feed 已更新' : 'Feed 已创建');
      await load(true);
      openTokens(response.data, creating);
    } catch (error: any) {
      messageApi.error(errorText(error, '保存 Feed 失败'));
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const removeFeed = async (feed: RSSGeneratorFeed) => {
    try {
      const response = await deleteRSSGeneratorFeed(feed.id);
      if (response.code !== 0) throw new Error(response.message);
      messageApi.success('Feed 已删除，关联 Token 已失效');
      await load(true);
    } catch (error: any) {
      messageApi.error(errorText(error, '删除 Feed 失败'));
    }
  };

  const toggleFeed = async (feed: RSSGeneratorFeed, enabled: boolean) => {
    setTogglingId(feed.id);
    try {
      const response = await updateRSSGeneratorFeed(feed.id, {
        ...definitionFromFeed(feed),
        enabled,
      });
      if (response.code !== 0 || !response.data) {
        throw new Error(response.message || '更新 Feed 状态失败');
      }
      const updatedFeed = response.data;
      setFeeds((current) =>
        current.map((item) => (item.id === feed.id ? updatedFeed : item)),
      );
      messageApi.success(enabled ? 'Feed 已启用' : 'Feed 已停用');
      await load(true);
    } catch (error: any) {
      messageApi.error(errorText(error, '更新 Feed 状态失败'));
    } finally {
      setTogglingId(undefined);
    }
  };

  const previewDefinition = async (
    definition: RSSGeneratorFeedInput,
    params: Record<string, string>,
    feedId?: number,
  ) => {
    const response = await previewRSSGeneratorDefinition(
      definition,
      params,
      'rss',
      feedId,
    );
    if (response.code !== 0 || !response.data) {
      throw new Error(response.message || '生成预览失败');
    }
    return response.data;
  };

  const openSavedPreview = (feed: RSSGeneratorFeed) => {
    setPreviewFeed(feed);
    setPreview(undefined);
    setPreviewError(undefined);
    setPreviewParams(
      Object.fromEntries(
        (feed.parameters || [])
          .filter((parameter) => parameter.default !== undefined)
          .map((parameter) => [
            parameter.name,
            String(parameter.default ?? ''),
          ]),
      ),
    );
  };

  const runSavedPreview = async () => {
    if (!previewFeed) return;
    setPreviewing(true);
    setPreviewError(undefined);
    try {
      const response = await previewRSSGeneratorFeed(
        previewFeed.id,
        previewParams,
        'rss',
      );
      if (response.code !== 0 || !response.data) {
        throw new Error(response.message || '生成预览失败');
      }
      setPreview(response.data);
    } catch (error: any) {
      setPreviewError(errorText(error, '生成预览失败'));
    } finally {
      setPreviewing(false);
    }
  };

  const createToken = async (
    input: RSSGeneratorTokenInput,
  ): Promise<RSSGeneratorTokenSecret> => {
    if (!selectedFeed) throw new Error('没有选择 Feed');
    try {
      const response = await createRSSGeneratorToken(selectedFeed.id, input);
      if (response.code !== 0 || !response.data) {
        throw new Error(response.message || '创建 Token 失败');
      }
      messageApi.success('Token 已创建，请立即保存');
      await Promise.all([loadTokens(selectedFeed, true), load(true)]);
      return response.data;
    } catch (error: any) {
      messageApi.error(errorText(error, '创建 Token 失败'));
      throw error;
    }
  };

  const rotateToken = async (
    token: RSSGeneratorToken,
  ): Promise<RSSGeneratorTokenSecret> => {
    if (!selectedFeed) throw new Error('没有选择 Feed');
    try {
      const response = await rotateRSSGeneratorToken(selectedFeed.id, token.id);
      if (response.code !== 0 || !response.data) {
        throw new Error(response.message || '轮换 Token 失败');
      }
      messageApi.success('Token 已轮换，旧地址已失效');
      await loadTokens(selectedFeed, true);
      return response.data;
    } catch (error: any) {
      messageApi.error(errorText(error, '轮换 Token 失败'));
      throw error;
    }
  };

  const revokeToken = async (token: RSSGeneratorToken) => {
    if (!selectedFeed) return;
    try {
      const response = await deleteRSSGeneratorToken(selectedFeed.id, token.id);
      if (response.code !== 0) throw new Error(response.message);
      messageApi.success('Token 已撤销');
      await Promise.all([loadTokens(selectedFeed, true), load(true)]);
    } catch (error: any) {
      messageApi.error(errorText(error, '撤销 Token 失败'));
      throw error;
    }
  };

  const backToOverview = () => {
    setView('overview');
    setSelectedFeed(undefined);
  };

  const stats = useMemo(
    () => ({
      total: dashboard?.total_feeds ?? feeds.length,
      enabled:
        dashboard?.enabled_feeds ?? feeds.filter((feed) => feed.enabled).length,
      browser: feeds.filter((feed) => feed.route_kind === 'browser').length,
      tokens: dashboard?.active_tokens ?? 0,
    }),
    [dashboard, feeds],
  );

  const workerStatus =
    typeof dashboard?.worker_status === 'string'
      ? dashboard.worker_status
      : dashboard?.worker_status?.status ||
        (dashboard?.worker_status?.healthy ? 'healthy' : undefined);
  const workerDetail =
    typeof dashboard?.worker_status === 'object'
      ? dashboard.worker_status.error
      : typeof dashboard?.worker_health === 'string'
        ? dashboard.worker_health
        : undefined;
  const workerHealthy = ['ok', 'healthy', 'ready'].includes(workerStatus || '');

  return (
    <PageContainer
      extra={
        view !== 'overview'
          ? [
              <Button
                icon={<ArrowLeftOutlined />}
                key="return"
                onClick={backToOverview}
              >
                返回 Feed 列表
              </Button>,
            ]
          : undefined
      }
      title="RSS 生成器"
    >
      {contextHolder}

      {view === 'overview' && (
        <>
          {workerStatus && (
            <Alert
              className={styles.workerAlert}
              description={workerDetail}
              icon={
                workerHealthy ? <CheckCircleOutlined /> : <WarningOutlined />
              }
              message={`抓取引擎：${workerStatus}`}
              showIcon
              type={workerHealthy ? 'success' : 'warning'}
            />
          )}
          <Row className={styles.statsRow} gutter={[14, 14]}>
            <Col lg={6} sm={12} xs={24}>
              <Card>
                <Statistic
                  prefix={<GlobalOutlined />}
                  title="Feed 路由"
                  value={stats.total}
                />
              </Card>
            </Col>
            <Col lg={6} sm={12} xs={24}>
              <Card>
                <Statistic
                  prefix={<CheckCircleOutlined />}
                  title="已启用"
                  value={stats.enabled}
                />
              </Card>
            </Col>
            <Col lg={6} sm={12} xs={24}>
              <Card>
                <Statistic
                  prefix={<ChromeOutlined />}
                  title="浏览器路由"
                  value={stats.browser}
                />
              </Card>
            </Col>
            <Col lg={6} sm={12} xs={24}>
              <Card>
                <Statistic
                  prefix={<KeyOutlined />}
                  title="有效 Token"
                  value={stats.tokens}
                />
              </Card>
            </Col>
          </Row>
          <FeedList
            feeds={feeds}
            loading={loading}
            onCreate={() => {
              setSelectedFeed(undefined);
              setView('editor');
            }}
            onDelete={removeFeed}
            onEdit={(feed) => {
              setSelectedFeed(feed);
              setView('editor');
            }}
            onPreview={openSavedPreview}
            onReload={() => load()}
            onTokens={openTokens}
            onToggle={toggleFeed}
            togglingId={togglingId}
          />
        </>
      )}

      {view === 'editor' && (
        <FeedEditor
          feed={selectedFeed}
          onCancel={backToOverview}
          onPreview={previewDefinition}
          onSave={saveFeed}
          saving={saving}
        />
      )}

      {view === 'tokens' && selectedFeed && (
        <TokenManager
          autoOpenCreate={autoOpenTokenCreate}
          feed={selectedFeed}
          loading={tokensLoading}
          onCreate={createToken}
          onDelete={revokeToken}
          onReload={() => loadTokens(selectedFeed)}
          onRotate={rotateToken}
          tokens={tokens}
        />
      )}

      <Modal
        cancelText="关闭"
        footer={(_, { CancelBtn }) => (
          <Space>
            <CancelBtn />
            <Button
              loading={previewing}
              onClick={runSavedPreview}
              type="primary"
            >
              生成预览
            </Button>
          </Space>
        )}
        onCancel={() => setPreviewFeed(undefined)}
        open={Boolean(previewFeed)}
        title={`预览：${previewFeed?.name || ''}`}
        width={820}
      >
        {(previewFeed?.parameters || []).length > 0 && (
          <div className={styles.parameterGrid}>
            {previewFeed?.parameters.map((parameter) => (
              <label
                htmlFor={`saved-feed-preview-${parameter.name}`}
                key={parameter.name}
              >
                <span>{parameter.label || parameter.name}</span>
                <Input
                  aria-label={`预览参数 ${parameter.name}`}
                  id={`saved-feed-preview-${parameter.name}`}
                  onChange={(event) =>
                    setPreviewParams((current) => ({
                      ...current,
                      [parameter.name]: event.target.value,
                    }))
                  }
                  value={previewParams[parameter.name] || ''}
                />
              </label>
            ))}
          </div>
        )}
        <PreviewPanel
          error={previewError}
          loading={previewing}
          preview={preview}
        />
      </Modal>
    </PageContainer>
  );
};

export default RSSGeneratorPage;
