import { request } from '@umijs/max';

/** 列出所有可用模板 */
export async function listEmbyCoverTemplates() {
  return request<API.Response<API.EmbyCoverTemplate[]>>('/api/emby-cover/templates', {
    method: 'GET',
  });
}

/** 列出 Emby 媒体库（合并本地配置） */
export async function listEmbyCoverLibraries() {
  return request<API.Response<API.EmbyCoverLibraryView[]>>('/api/emby-cover/libraries', {
    method: 'GET',
  });
}

/** 创建或更新某个媒体库的封面配置 */
export async function upsertEmbyCoverLibrary(
  embyId: string,
  data: API.UpsertEmbyCoverLibraryParams,
) {
  return request<API.Response<API.EmbyCoverLibraryView>>(
    `/api/emby-cover/libraries/${embyId}`,
    {
      method: 'PUT',
      data,
    },
  );
}

/**
 * 预览单个媒体库封面（返回 JPEG 二进制 Blob；不上传到 Emby）
 * 调用者拿到 Blob 后用 URL.createObjectURL 展示。
 */
export async function previewEmbyCoverLibrary(embyId: string) {
  return request<Blob>(`/api/emby-cover/libraries/${embyId}/preview`, {
    method: 'POST',
    responseType: 'blob',
    getResponse: false,
    // 预览可能跑 1~3 秒，放宽超时
    timeout: 60000,
  });
}

/** 生成并上传封面到 Emby */
export async function generateEmbyCoverLibrary(embyId: string) {
  return request<API.Response<{ emby_id: string }>>(
    `/api/emby-cover/libraries/${embyId}/generate`,
    {
      method: 'POST',
      timeout: 60000,
    },
  );
}

/** 批量生成所有 enabled 的媒体库封面 */
export async function batchGenerateEmbyCovers() {
  return request<
    API.Response<{
      success: number;
      failed: number;
      errors: string[];
    }>
  >('/api/emby-cover/batch-generate', {
    method: 'POST',
    timeout: 600000,
  });
}
