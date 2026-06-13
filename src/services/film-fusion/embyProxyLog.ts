import { request } from '@umijs/max';

/**
 * 拉取 Emby 代理最近的 302 重定向日志。
 * 后端为进程内存环形缓冲（默认容量 500），重启丢失。
 */
export async function getEmbyProxy302Logs(limit?: number) {
  return request<API.Response<API.EmbyProxy302LogList>>(
    '/api/emby-proxy/302-logs',
    {
      method: 'GET',
      params: limit ? { limit } : undefined,
    },
  );
}

/** 清空 302 日志缓冲。 */
export async function clearEmbyProxy302Logs() {
  return request<API.Response<unknown>>('/api/emby-proxy/302-logs', {
    method: 'DELETE',
  });
}

/** 拉取 Emby 代理 302 负载均衡看板。 */
export async function getEmbyProxyBalanceStatus() {
  return request<API.Response<API.EmbyProxyBalanceStatus>>(
    '/api/emby-proxy/balance-status',
    {
      method: 'GET',
    },
  );
}
