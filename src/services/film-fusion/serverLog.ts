import { request } from '@umijs/max';

/** 获取运行日志文件列表（最新优先） */
export async function getServerLogFiles(options?: { [key: string]: any }) {
  return request<API.Response<API.ServerLogFile[]>>('/api/logs/files', {
    method: 'GET',
    ...(options || {}),
  });
}

/** 读取运行日志（最近 N 行，可按级别/关键字过滤，最新在前） */
export async function getServerLogs(
  params?: API.ServerLogQueryParams,
  options?: { [key: string]: any },
) {
  return request<API.Response<API.ServerLogResult>>('/api/logs', {
    method: 'GET',
    params,
    ...(options || {}),
  });
}
