import { request } from '@umijs/max';

/** 获取 Match302 列表 */
export async function getMatch302List(
  params: API.Match302QueryParams,
  options?: { [key: string]: any },
) {
  return request<API.Response<API.PageResult<API.Match302>>>('/api/match-302', {
    method: 'GET',
    params,
    ...(options || {}),
  });
}

/** 创建 Match302 */
export async function createMatch302(
  data: API.CreateMatch302Params,
  options?: { [key: string]: any },
) {
  return request<API.Response<API.Match302>>('/api/match-302', {
    method: 'POST',
    data,
    ...(options || {}),
  });
}

/** 更新 Match302 */
export async function updateMatch302(
  data: API.UpdateMatch302Params,
  options?: { [key: string]: any },
) {
  return request<API.Response<API.Match302>>(`/api/match-302/${data.id}`, {
    method: 'PUT',
    data,
    ...(options || {}),
  });
}

/** 删除 Match302 */
export async function deleteMatch302(
  id: number,
  options?: { [key: string]: any },
) {
  return request<API.Response<boolean>>(`/api/match-302/${id}`, {
    method: 'DELETE',
    ...(options || {}),
  });
}

/** 获取 Match302 详情 */
export async function getMatch302Detail(
  id: number,
  options?: { [key: string]: any },
) {
  return request<API.Response<API.Match302>>(`/api/match-302/${id}`, {
    method: 'GET',
    ...(options || {}),
  });
}

/** 批量删除 Match302 */
export async function batchDeleteMatch302(
  ids: number[],
  options?: { [key: string]: any },
) {
  return request<API.Response<boolean>>('/api/match-302/batch-delete', {
    method: 'DELETE',
    data: { ids },
    ...(options || {}),
  });
}

/** 根据云存储ID获取 Match302 列表 */
export async function getMatch302ListByCloudStorage(
  cloudStorageId: number,
  options?: { [key: string]: any },
) {
  return request<API.Response<API.Match302[]>>(`/api/match-302/cloud-storage/${cloudStorageId}`, {
    method: 'GET',
    ...(options || {}),
  });
}

/** 测试 Match302 重定向 */
export async function testMatch302Redirect(
  id: number,
  testPath: string,
  options?: { [key: string]: any },
) {
  return request<API.Response<{ matched: boolean; result_path?: string; message?: string }>>(`/api/match-302/${id}/test`, {
    method: 'POST',
    data: { test_path: testPath },
    ...(options || {}),
  });
}
