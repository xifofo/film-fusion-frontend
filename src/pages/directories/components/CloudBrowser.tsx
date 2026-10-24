import {
  FileOutlined,
  FolderOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { TableProps } from 'antd';
import {
  Alert,
  Breadcrumb,
  Button,
  Drawer,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
} from 'antd';
import axios from 'axios';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  type CloudBrowserAccessMethod,
  type CloudBrowserItem,
  type CloudBrowserPage,
  type CloudBrowserQuery,
  type CloudSTRMResult,
  cancelCloudBrowserSTRMJob,
  generateCloudBrowserSTRM,
  getActiveCloudBrowserSTRMJob,
  getCloudBrowserPage,
  getCloudBrowserSTRMJob,
} from '@/services/film-fusion/cloud-browser';

export type CloudBrowserHandle = {
  open: (directory: API.CloudDirectory) => void;
};
type JobState = { directoryId: number; name: string; data: CloudSTRMResult };

const jobLabels: Record<CloudSTRMResult['status'], string> = {
  queued: '等待执行',
  running: '正在生成',
  cancelling: '正在停止',
  completed: '已完成',
  failed: '失败',
  cancelled: '已停止',
};

function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return (
      error.response?.data?.message || error.message || '请求失败，请手动重试'
    );
  }
  return error instanceof Error ? error.message : '请求失败，请手动重试';
}

function unwrap<T>(response: API.Response<T>): T {
  if (response.code !== 0 || !response.data) {
    throw new Error(response.message || '请求失败，请手动重试');
  }
  return response.data;
}

function formatSize(size: number): string {
  if (!Number.isFinite(size) || size < 0) return '-';
  if (size < 1024) return `${size} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = size / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}

const CloudBrowser = forwardRef<CloudBrowserHandle>(
  function CloudBrowser(_, ref) {
    const [open, setOpen] = useState(false);
    const [directory, setDirectory] = useState<API.CloudDirectory>();
    const [query, setQuery] = useState<CloudBrowserQuery>({
      access_method: 'openapi',
      cid: '0',
      offset: 0,
      limit: 50,
    });
    const [page, setPage] = useState<CloudBrowserPage>();
    const [pageOffsets, setPageOffsets] = useState([0]);
    const [busy, setBusy] = useState<'list' | 'generate' | 'cancel' | null>(
      null,
    );
    const [error, setError] = useState('');
    const [result, setResult] = useState<CloudSTRMResult>();
    const [job, setJob] = useState<JobState>();
    const [pollError, setPollError] = useState('');
    const [pollVersion, setPollVersion] = useState(0);
    const [recovering, setRecovering] = useState(false);
    const [recoveryError, setRecoveryError] = useState('');
    const activeRequest = useRef<AbortController | null>(null);
    const recoveryRequest = useRef<AbortController | null>(null);
    const statusRequest = useRef<AbortController | null>(null);
    const busyRef = useRef(false);
    const jobRef = useRef<JobState | undefined>(undefined);
    const jobActive = !!job && !job.data.finished;

    useEffect(
      () => () => {
        activeRequest.current?.abort();
        activeRequest.current = null;
        recoveryRequest.current?.abort();
        recoveryRequest.current = null;
        busyRef.current = false;
      },
      [],
    );

    function finish(controller: AbortController) {
      if (activeRequest.current !== controller) return;
      activeRequest.current = null;
      busyRef.current = false;
      setBusy(null);
    }

    async function recoverJob(anchor: API.CloudDirectory) {
      if (busyRef.current) return;
      recoveryRequest.current?.abort();
      statusRequest.current?.abort();
      const controller = new AbortController();
      recoveryRequest.current = controller;
      setRecovering(true);
      setRecoveryError('');
      try {
        const response = await getActiveCloudBrowserSTRMJob(
          anchor.id,
          controller.signal,
        );
        if (controller.signal.aborted || recoveryRequest.current !== controller)
          return;
        if (response.code !== 0)
          throw new Error(response.message || '读取生成任务失败');
        const data = response.data;
        const previous = jobRef.current;
        // Keep an already visible task from another entry until it completes.
        if (
          (!data || data.finished) &&
          previous &&
          !previous.data.finished &&
          previous.directoryId !== anchor.id
        )
          return;
        const nextJob = data?.job_id
          ? {
              directoryId: anchor.id,
              name: data.name || anchor.directory_name,
              data,
            }
          : undefined;
        jobRef.current = nextJob;
        setJob(nextJob);
        setPollError('');
      } catch (cause) {
        if (
          !controller.signal.aborted &&
          recoveryRequest.current === controller
        )
          setRecoveryError(errorMessage(cause));
      } finally {
        if (recoveryRequest.current === controller) {
          recoveryRequest.current = null;
          setRecovering(false);
        }
      }
    }

    async function loadPage(
      anchor: API.CloudDirectory,
      nextQuery: CloudBrowserQuery,
    ) {
      if (busyRef.current) return;
      busyRef.current = true;
      const controller = new AbortController();
      activeRequest.current = controller;
      setBusy('list');
      setError('');
      setResult(undefined);
      setPage(undefined);
      setQuery(nextQuery);
      try {
        const data = unwrap(
          await getCloudBrowserPage(anchor.id, nextQuery, controller.signal),
        );
        if (!controller.signal.aborted && activeRequest.current === controller)
          setPage(data);
      } catch (cause) {
        if (!controller.signal.aborted && activeRequest.current === controller)
          setError(errorMessage(cause));
      } finally {
        finish(controller);
      }
    }

    useImperativeHandle(ref, () => ({
      open(anchor) {
        if (busyRef.current) return;
        activeRequest.current?.abort();
        activeRequest.current = null;
        busyRef.current = false;
        setDirectory(anchor);
        setOpen(true);
        setPageOffsets([0]);
        void recoverJob(anchor);
        const accessMethod =
          anchor.cloud_storage?.storage_type === '115' ? 'cookie' : 'openapi';
        void loadPage(anchor, {
          access_method: accessMethod,
          cid: anchor.directory_id || '0',
          offset: 0,
          limit: 50,
        });
      },
    }));

    function close() {
      if (busy === 'generate' || busy === 'cancel') return;
      activeRequest.current?.abort();
      activeRequest.current = null;
      recoveryRequest.current?.abort();
      recoveryRequest.current = null;
      busyRef.current = false;
      setBusy(null);
      setRecovering(false);
      setOpen(false);
    }

    function navigate(
      cid: string,
      offset = 0,
      method = query.access_method,
      limit = query.limit,
    ) {
      if (!directory || busyRef.current) return;
      if (
        cid !== query.cid ||
        method !== query.access_method ||
        limit !== query.limit
      ) {
        setPageOffsets([offset]);
      } else if (!pageOffsets.includes(offset)) {
        setPageOffsets([
          ...pageOffsets.slice(0, pageOffsets.indexOf(query.offset) + 1),
          offset,
        ]);
      }
      void loadPage(directory, { access_method: method, cid, offset, limit });
    }

    async function generate(selectionToken: string, name: string) {
      if (
        !directory ||
        busyRef.current ||
        recoveryRequest.current ||
        (jobRef.current && !jobRef.current.data.finished)
      )
        return;
      busyRef.current = true;
      const controller = new AbortController();
      activeRequest.current = controller;
      setBusy('generate');
      setError('');
      setResult(undefined);
      try {
        const data = unwrap(
          await generateCloudBrowserSTRM(
            directory.id,
            selectionToken,
            controller.signal,
          ),
        );
        if (controller.signal.aborted || activeRequest.current !== controller)
          return;
        if (data.job_id) {
          const nextJob = { directoryId: directory.id, name, data };
          jobRef.current = nextJob;
          setJob(nextJob);
          setPollError('');
          setPollVersion((value) => value + 1);
        } else {
          setResult(data);
        }
      } catch (cause) {
        if (!controller.signal.aborted && activeRequest.current === controller)
          setError(errorMessage(cause));
      } finally {
        finish(controller);
      }
    }

    // Only local job status is polled. Directory pages are fetched exclusively by user events.
    useEffect(() => {
      if (!open || recovering || !job?.data.job_id || job.data.finished) return;
      const jobId = job.data.job_id;
      const controller = new AbortController();
      statusRequest.current = controller;
      let timer: ReturnType<typeof setTimeout>;
      const poll = async () => {
        if (controller.signal.aborted) return;
        try {
          const data = unwrap(
            await getCloudBrowserSTRMJob(
              job.directoryId,
              jobId,
              controller.signal,
            ),
          );
          if (controller.signal.aborted) return;
          const nextJob = { ...job, data };
          jobRef.current = nextJob;
          setJob(nextJob);
          setPollError('');
          if (!data.finished) timer = setTimeout(poll, 2000);
        } catch (cause) {
          if (controller.signal.aborted) return;
          if (axios.isAxiosError(cause) && cause.response?.status === 404) {
            const nextJob: JobState = {
              ...job,
              data: {
                ...job.data,
                status: 'failed',
                finished: true,
                errors: [
                  '任务已不存在，可能已因服务重启或清理而结束。可以重新生成。',
                ],
              },
            };
            jobRef.current = nextJob;
            setJob(nextJob);
            setPollError('');
          } else {
            setPollError(errorMessage(cause));
          }
        }
      };
      timer = setTimeout(poll, 2000);
      return () => {
        clearTimeout(timer);
        controller.abort();
        if (statusRequest.current === controller) statusRequest.current = null;
      };
    }, [open, recovering, job?.data.job_id, job?.data.finished, pollVersion]);

    async function cancelJob() {
      const currentJob = jobRef.current;
      if (
        !currentJob?.data.job_id ||
        currentJob.data.finished ||
        busyRef.current ||
        recoveryRequest.current
      )
        return;
      busyRef.current = true;
      statusRequest.current?.abort();
      const controller = new AbortController();
      activeRequest.current = controller;
      setBusy('cancel');
      setPollError('');
      try {
        const data = unwrap(
          await cancelCloudBrowserSTRMJob(
            currentJob.directoryId,
            currentJob.data.job_id,
            controller.signal,
          ),
        );
        if (controller.signal.aborted || activeRequest.current !== controller)
          return;
        const nextJob = { ...currentJob, data };
        jobRef.current = nextJob;
        setJob(nextJob);
      } catch (cause) {
        if (!controller.signal.aborted && activeRequest.current === controller)
          setPollError(errorMessage(cause));
      } finally {
        if (!controller.signal.aborted) setPollVersion((value) => value + 1);
        finish(controller);
      }
    }

    function directoryGenerateButton(
      token: string | undefined,
      name: string,
      label: string,
      unavailableReason?: string,
    ) {
      const disabled =
        !token || !!unavailableReason || !!busy || recovering || jobActive;
      if (disabled) {
        return (
          <Tooltip
            title={
              unavailableReason ||
              (!token ? '目录必须匹配有效配置后才能生成 STRM' : undefined)
            }
          >
            <Button size="small" disabled>
              {label}
            </Button>
          </Tooltip>
        );
      }
      return (
        <Popconfirm
          title={`为“${name}”生成 STRM？`}
          description="将递归读取这个目录及全部子目录，沿用匹配配置的保存路径和过滤规则，重新写入普通 STRM；受管理的文件会受到保护。任务可随时停止。"
          okText="开始生成"
          cancelText="取消"
          styles={{ root: { maxWidth: 'min(420px, calc(100vw - 32px))' } }}
          onConfirm={() => token && generate(token, name)}
        >
          <Button size="small">{label}</Button>
        </Popconfirm>
      );
    }

    const columns: TableProps<CloudBrowserItem>['columns'] = [
      {
        title: '名称',
        dataIndex: 'name',
        width: 300,
        render: (_, item) => (
          <Space align="start">
            {item.is_file ? <FileOutlined /> : <FolderOutlined />}
            {item.is_file ? (
              <span style={{ overflowWrap: 'anywhere' }}>{item.name}</span>
            ) : (
              <Button
                type="link"
                disabled={!!busy}
                style={{
                  padding: 0,
                  height: 'auto',
                  whiteSpace: 'normal',
                  textAlign: 'left',
                  overflowWrap: 'anywhere',
                }}
                onClick={() => navigate(item.file_id)}
              >
                {item.name}
              </Button>
            )}
          </Space>
        ),
      },
      {
        title: '大小',
        width: 100,
        render: (_, item) => (item.is_file ? formatSize(item.size) : '文件夹'),
      },
      {
        title: '目录配置',
        width: 150,
        render: (_, item) => (
          <Tooltip title={item.strm_unavailable_reason}>
            {item.matched_directory_id ? (
              <Tag color="green">
                {item.matched_directory_name || `#${item.matched_directory_id}`}
              </Tag>
            ) : (
              <span>未匹配</span>
            )}
          </Tooltip>
        ),
      },
      {
        title: '操作',
        width: 160,
        render: (_, item) => {
          const token =
            item.matched_directory_id && !item.strm_unavailable_reason
              ? item.selection_token
              : undefined;
          return item.is_file ? (
            <Tooltip
              title={
                item.strm_unavailable_reason ||
                (!token ? '文件必须匹配目录配置后才能生成 STRM' : undefined)
              }
            >
              <Button
                size="small"
                disabled={!token || !!busy || recovering || jobActive}
                onClick={() => token && generate(token, item.name)}
              >
                重新生成 STRM
              </Button>
            </Tooltip>
          ) : (
            directoryGenerateButton(
              token,
              item.name,
              '生成目录 STRM',
              item.strm_unavailable_reason,
            )
          );
        },
      },
    ];

    const currentName =
      page?.breadcrumbs.at(-1)?.name || directory?.directory_name || '当前目录';
    const actionBusy = busy === 'generate' || busy === 'cancel';
    return (
      <Drawer
        title={`浏览网盘 · ${directory?.directory_name || ''}`}
        open={open}
        size="min(100vw, 1000px)"
        onClose={close}
        closable={{ disabled: actionBusy }}
        mask={{ closable: !actionBusy }}
        keyboard={!actionBusy}
      >
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            title="目录列表只在打开、进入目录或手动翻页时读取。"
            description="浏览不会自动翻页。生成目录 STRM 会递归读取子目录；文件与目录必须匹配目录配置。"
          />
          <Space wrap>
            <span>
              {directory?.cloud_storage?.storage_name ||
                `云存储 #${directory?.cloud_storage_id ?? ''}`}
            </span>
            <Select<CloudBrowserAccessMethod>
              aria-label="115 访问方式"
              value={query.access_method}
              disabled={!!busy}
              style={{ width: 145 }}
              options={[
                { value: 'cookie', label: 'Cookie' },
                { value: 'openapi', label: 'OpenAPI' },
              ]}
              onChange={(method) => navigate(query.cid, 0, method)}
            />
            <Button
              icon={<ReloadOutlined />}
              disabled={!!busy}
              onClick={() => navigate(query.cid, query.offset)}
            >
              刷新当前页
            </Button>
            {directoryGenerateButton(
              page?.matched_directory
                ? page.current_directory_token
                : undefined,
              currentName,
              '生成当前目录 STRM',
              page?.strm_unavailable_reason,
            )}
          </Space>
          {page && (
            <Breadcrumb
              items={page.breadcrumbs.map((item) => ({
                key: item.id,
                title:
                  item.id === page.cid ? (
                    item.name
                  ) : (
                    <Button
                      type="link"
                      size="small"
                      disabled={!!busy}
                      onClick={() => navigate(item.id)}
                    >
                      {item.name || '根目录'}
                    </Button>
                  ),
              }))}
            />
          )}
          {page && (
            <div>
              {page.strm_unavailable_reason ||
                (page.matched_directory
                  ? `当前目录匹配：${page.matched_directory.directory_name}，沿用其保存路径和过滤规则。`
                  : '当前目录未匹配目录配置，无法生成 STRM。可进入已配置的子目录。')}
            </div>
          )}
          {error && <Alert type="error" showIcon title={error} />}
          {recoveryError && (
            <Alert
              type="warning"
              showIcon
              title={`读取已有生成任务失败：${recoveryError}`}
              action={
                <Button
                  size="small"
                  disabled={recovering || !!busy}
                  onClick={() => directory && void recoverJob(directory)}
                >
                  重试恢复任务
                </Button>
              }
            />
          )}
          <Table<CloudBrowserItem>
            rowKey={(item) =>
              `${item.is_file ? 'file' : 'directory'}:${item.file_id}`
            }
            dataSource={page?.items || []}
            columns={columns}
            loading={busy === 'list'}
            pagination={false}
            size="small"
            scroll={{ x: 710 }}
            locale={{
              emptyText: error ? '加载失败，请手动刷新' : '当前目录没有文件',
            }}
          />
          <Space wrap>
            <Button
              disabled={
                !!busy || !page || pageOffsets.indexOf(page.offset) <= 0
              }
              onClick={() =>
                page &&
                navigate(
                  page.cid,
                  pageOffsets[
                    Math.max(0, pageOffsets.indexOf(page.offset) - 1)
                  ],
                )
              }
            >
              上一页
            </Button>
            <span>
              {page
                ? `第 ${Math.max(0, pageOffsets.indexOf(page.offset)) + 1} 页 · 共 ${page.total} 项`
                : '尚未加载'}
            </span>
            <Button
              disabled={!!busy || !page?.has_more || page.items.length === 0}
              onClick={() =>
                page && navigate(page.cid, page.offset + page.items.length)
              }
            >
              下一页
            </Button>
            <Select<number>
              aria-label="每页数量"
              value={query.limit}
              disabled={!!busy}
              options={[25, 50, 100].map((value) => ({
                value,
                label: `${value} 项 / 页`,
              }))}
              onChange={(limit) =>
                navigate(query.cid, 0, query.access_method, limit)
              }
            />
          </Space>
          {job && (
            <Alert
              type={
                job.data.failed > 0 || job.data.status === 'failed'
                  ? 'warning'
                  : job.data.finished
                    ? 'success'
                    : 'info'
              }
              showIcon
              title={`目录任务 · ${job.name} · ${jobLabels[job.data.status]}`}
              description={
                <Space orientation="vertical" style={{ width: '100%' }}>
                  <span>
                    已生成 {job.data.generated} · 已跳过 {job.data.skipped} ·
                    失败 {job.data.failed} · 已扫描{' '}
                    {job.data.scanned_files || 0} 个文件 /{' '}
                    {job.data.visited_directories || 0} 个目录
                  </span>
                  {!job.data.finished && (
                    <span>
                      关闭面板后任务会继续。重新打开此目录可查看进度，点击“停止生成”可停止任务。
                    </span>
                  )}
                  {job.data.errors?.map((item, index) => (
                    <div key={`${index}:${item}`}>{item}</div>
                  ))}
                  {pollError && (
                    <div role="alert">任务状态读取失败：{pollError}</div>
                  )}
                  <Space wrap>
                    {!job.data.finished && (
                      <Button
                        danger
                        size="small"
                        disabled={
                          !!busy ||
                          recovering ||
                          job.data.status === 'cancelling'
                        }
                        onClick={() => void cancelJob()}
                      >
                        停止生成
                      </Button>
                    )}
                    {pollError && (
                      <Button
                        size="small"
                        onClick={() => {
                          setPollError('');
                          setPollVersion((value) => value + 1);
                        }}
                      >
                        重试读取任务状态
                      </Button>
                    )}
                  </Space>
                </Space>
              }
            />
          )}
          {result && (
            <Alert
              type={result.failed > 0 ? 'warning' : 'success'}
              showIcon
              title={`STRM 处理完成：生成 ${result.generated} · 跳过 ${result.skipped} · 失败 ${result.failed}`}
              description={result.results?.map((item) => (
                <div key={item.file_id}>
                  {item.name}：{item.message || item.status}
                  {item.local_path && ` · ${item.local_path}`}
                </div>
              ))}
            />
          )}
        </Space>
      </Drawer>
    );
  },
);

export default CloudBrowser;
