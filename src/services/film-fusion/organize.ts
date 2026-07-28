import { request } from '@umijs/max';

/** 获取 MoviePilot 分类配置 */
export async function getOrganizeCategoryConfig(options?: { [key: string]: any }) {
  return request<API.Response<API.OrganizeCategoryConfigResult>>(
    '/api/organize/category-config',
    {
      method: 'GET',
      ...(options || {}),
    },
  );
}

/** 整理并处理 115 Cookie 目录 */
export async function organize115Cookie(
  data: API.Organize115CookieParams,
  options?: { [key: string]: any },
) {
  return request<API.Response<API.Organize115CookieResult>>('/api/organize/115-cookie', {
    method: 'POST',
    data,
    ...(options || {}),
  });
}

/** 加入后台预整理队列 */
export async function createOrganizePreviewTasks(
  data: API.CreateOrganizePreviewTasksParams,
  options?: { [key: string]: any },
) {
  return request<API.Response<API.OrganizePreviewTaskListResult>>(
    '/api/organize/preview-tasks',
    {
      method: 'POST',
      data,
      ...(options || {}),
    },
  );
}

/** 获取后台预整理任务列表 */
export async function getOrganizePreviewTasks(
  params: API.OrganizePreviewTaskQueryParams,
  options?: { [key: string]: any },
) {
  return request<API.Response<API.OrganizePreviewTaskListResult>>(
    '/api/organize/preview-tasks',
    {
      method: 'GET',
      params,
      ...(options || {}),
    },
  );
}

/** 获取单个后台预整理结果 */
export async function getOrganizePreviewTask(
  id: number,
  options?: { [key: string]: any },
) {
  return request<API.Response<API.OrganizePreviewTaskDetailResult>>(
    `/api/organize/preview-tasks/${id}`,
    {
      method: 'GET',
      ...(options || {}),
    },
  );
}

/** 重新加入后台预整理队列 */
export async function requeueOrganizePreviewTask(
  id: number,
  options?: { [key: string]: any },
) {
  return request<API.Response<API.OrganizePreviewTask>>(
    `/api/organize/preview-tasks/${id}/requeue`,
    {
      method: 'POST',
      ...(options || {}),
    },
  );
}

/** 为源文件夹指定 TMDB ID，重命名后重新加入后台预整理队列 */
export async function assignOrganizePreviewTaskTMDB(
  id: number,
  data: API.AssignOrganizePreviewTaskTMDBParams,
  options?: { [key: string]: any },
) {
  return request<API.Response<API.OrganizePreviewTask>>(
    `/api/organize/preview-tasks/${id}/assign-tmdb`,
    {
      method: 'POST',
      data,
      ...(options || {}),
    },
  );
}

/** 删除后台预整理任务 */
export async function deleteOrganizePreviewTask(
  id: number,
  params?: API.DeleteOrganizePreviewTaskParams,
  options?: { [key: string]: any },
) {
  return request<API.Response<API.DeleteOrganizePreviewTaskResult>>(
    `/api/organize/preview-tasks/${id}`,
    {
      method: 'DELETE',
      params,
      ...(options || {}),
    },
  );
}

/** 批量清理后台预整理任务 */
export async function clearOrganizePreviewTasks(
  params: API.ClearOrganizePreviewTasksParams,
  options?: { [key: string]: any },
) {
  return request<API.Response<API.ClearOrganizePreviewTasksResult>>(
    '/api/organize/preview-tasks',
    {
      method: 'DELETE',
      params,
      ...(options || {}),
    },
  );
}
