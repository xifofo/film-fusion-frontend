import { apiClient } from '@/lib/api-client';

/** 获取 MoviePilot 分类配置 */
export async function getOrganizeCategoryConfig(options?: {
  [key: string]: any;
}) {
  return apiClient.get<API.Response<API.OrganizeCategoryConfigResult>>(
    '/api/organize/category-config',
    { ...(options || {}) },
  );
}

/** 整理并处理 115 Cookie 目录 */
export async function organize115Cookie(
  data: API.Organize115CookieParams,
  options?: { [key: string]: any },
) {
  return apiClient.post<API.Response<API.Organize115CookieResult>>(
    '/api/organize/115-cookie',
    data,
    { ...(options || {}) },
  );
}

/** 加入后台预整理队列 */
export async function createOrganizePreviewTasks(
  data: API.CreateOrganizePreviewTasksParams,
  options?: { [key: string]: any },
) {
  return apiClient.post<API.Response<API.OrganizePreviewTaskListResult>>(
    '/api/organize/preview-tasks',
    data,
    { ...(options || {}) },
  );
}

/** 获取后台预整理任务列表 */
export async function getOrganizePreviewTasks(
  params: API.OrganizePreviewTaskQueryParams,
  options?: { [key: string]: any },
) {
  return apiClient.get<API.Response<API.OrganizePreviewTaskListResult>>(
    '/api/organize/preview-tasks',
    { params, ...(options || {}) },
  );
}

type OrganizePreviewTaskEventOptions = {
  signal: AbortSignal;
  onOpen?: () => void;
  onEvent: (event: API.OrganizePreviewQueueEvent) => void;
};

/** 订阅后台预整理队列实时事件；使用 fetch 流以便继续通过请求头携带 Bearer Token */
export async function subscribeOrganizePreviewTaskEvents(
  params: Pick<API.OrganizePreviewTaskQueryParams, 'cloud_directory_id'>,
  options: OrganizePreviewTaskEventOptions,
) {
  const query = new URLSearchParams();
  if (params.cloud_directory_id) {
    query.set('cloud_directory_id', String(params.cloud_directory_id));
  }
  const token =
    typeof window === 'undefined' ? '' : window.localStorage.getItem('token');
  const response = await fetch(
    `/api/organize/preview-tasks/events${query.size ? `?${query}` : ''}`,
    {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: 'no-store',
      signal: options.signal,
    },
  );
  if (!response.ok) {
    throw new Error(`预整理实时连接失败（HTTP ${response.status}）`);
  }
  if (!response.body) {
    throw new Error('当前浏览器不支持预整理实时连接');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const dispatchBlock = (block: string) => {
    let eventType = 'message';
    const dataLines: string[] = [];
    for (const rawLine of block.split(/\r?\n/)) {
      const line = rawLine.trimEnd();
      if (!line || line.startsWith(':')) continue;
      if (line.startsWith('event:')) {
        eventType = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trimStart());
      }
    }
    if (eventType === 'ready') {
      options.onOpen?.();
      return;
    }
    if (eventType !== 'queue' || dataLines.length === 0) return;
    options.onEvent(
      JSON.parse(dataLines.join('\n')) as API.OrganizePreviewQueueEvent,
    );
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() || '';
    blocks.forEach(dispatchBlock);
  }
  buffer += decoder.decode();
  if (buffer.trim()) {
    dispatchBlock(buffer);
  }
}

/** 获取单个后台预整理结果 */
export async function getOrganizePreviewTask(
  id: number,
  options?: { [key: string]: any },
) {
  return apiClient.get<API.Response<API.OrganizePreviewTaskDetailResult>>(
    `/api/organize/preview-tasks/${id}`,
    { ...(options || {}) },
  );
}

/** 重新加入后台预整理队列 */
export async function requeueOrganizePreviewTask(
  id: number,
  options?: { [key: string]: any },
) {
  return apiClient.post<API.Response<API.OrganizePreviewTask>>(
    `/api/organize/preview-tasks/${id}/requeue`,
    undefined,
    { ...(options || {}) },
  );
}

/** 为源文件夹指定 TMDB ID，重命名后重新加入后台预整理队列 */
export async function assignOrganizePreviewTaskTMDB(
  id: number,
  data: API.AssignOrganizePreviewTaskTMDBParams,
  options?: { [key: string]: any },
) {
  return apiClient.post<API.Response<API.OrganizePreviewTask>>(
    `/api/organize/preview-tasks/${id}/assign-tmdb`,
    data,
    { ...(options || {}) },
  );
}

/** 删除后台预整理任务 */
export async function deleteOrganizePreviewTask(
  id: number,
  params?: API.DeleteOrganizePreviewTaskParams,
  options?: { [key: string]: any },
) {
  return apiClient.delete<API.Response<API.DeleteOrganizePreviewTaskResult>>(
    `/api/organize/preview-tasks/${id}`,
    { params, ...(options || {}) },
  );
}

/** 批量清理后台预整理任务 */
export async function clearOrganizePreviewTasks(
  params: API.ClearOrganizePreviewTasksParams,
  options?: { [key: string]: any },
) {
  return apiClient.delete<API.Response<API.ClearOrganizePreviewTasksResult>>(
    '/api/organize/preview-tasks',
    { params, ...(options || {}) },
  );
}
