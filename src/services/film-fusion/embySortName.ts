import { apiClient } from '@/lib/api-client';

/** 查询 SortName backfill 当前/最近任务的状态快照 */
export async function getEmbySortNameStatus() {
  return apiClient.get<API.Response<API.EmbySortNameStatus>>(
    '/api/emby-sortname/status',
  );
}

/**
 * 启动 SortName backfill。后端立即返回任务快照并在 goroutine 中后跑；
 * 前端通过轮询 getEmbySortNameStatus 获取实时进度。
 * 已有任务在跑时返回 HTTP 409。
 *
 * @param libraryIds 留空表示扫全库
 * @param force      true 忽略 LockedFields 锁定状态强制覆盖（含已被刮削工具/手动锁定的）
 */
export async function backfillEmbySortName(
  libraryIds?: string[],
  force = false,
) {
  return apiClient.post<API.Response<API.EmbySortNameJob>>(
    '/api/emby-sortname/backfill',
    { library_ids: libraryIds || [], force },
  );
}

/** 单 Item 触发处理（调试用） */
export async function processEmbySortNameItem(itemId: string) {
  return apiClient.post<API.Response<API.EmbySortNameItemResult>>(
    `/api/emby-sortname/items/${itemId}`,
    undefined,
    { timeout: 60000 },
  );
}
