import { apiClient } from '@/lib/api-client';

/**
 * 拉取 Emby 代理最近的 302 重定向日志。
 * 后端为进程内存环形缓冲（默认容量 500），重启丢失。
 */
export async function getEmbyProxy302Logs(limit?: number) {
  return apiClient.get<API.Response<API.EmbyProxy302LogList>>(
    '/api/emby-proxy/302-logs',
    { params: limit ? { limit } : undefined },
  );
}

/** 清空 302 日志缓冲。 */
export async function clearEmbyProxy302Logs() {
  return apiClient.delete<API.Response<unknown>>('/api/emby-proxy/302-logs');
}

/** 拉取 Emby 代理 302 负载均衡看板。 */
export async function getEmbyProxyBalanceStatus() {
  return apiClient.get<API.Response<API.EmbyProxyBalanceStatus>>(
    '/api/emby-proxy/balance-status',
  );
}

/** 拉取 Emby 登录保护状态。 */
export async function getEmbyLoginSecurityStatus() {
  return apiClient.get<API.Response<API.EmbyLoginSecurityStatus>>(
    '/api/emby-proxy/security-status',
  );
}

/** 手动解除一条 Emby 登录封禁。 */
export async function unblockEmbyLogin(
  block: Pick<API.EmbyLoginSecurityBlock, 'scope' | 'ip' | 'username'>,
) {
  return apiClient.post<API.Response<unknown>>(
    '/api/emby-proxy/security-unblock',
    block,
  );
}
