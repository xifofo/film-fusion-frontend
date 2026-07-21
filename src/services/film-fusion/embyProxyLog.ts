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

/** 拉取 Emby 登录保护状态。 */
export async function getEmbyLoginSecurityStatus() {
  return request<API.Response<API.EmbyLoginSecurityStatus>>(
    '/api/emby-proxy/security-status',
    { method: 'GET' },
  );
}

/** 手动解除一条 Emby 登录封禁。 */
export async function unblockEmbyLogin(
  block: Pick<API.EmbyLoginSecurityBlock, 'scope' | 'ip' | 'username'>,
) {
  return request<API.Response<unknown>>('/api/emby-proxy/security-unblock', {
    method: 'POST',
    data: block,
  });
}
