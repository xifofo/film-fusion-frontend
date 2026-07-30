import { apiClient } from '@/lib/api-client';

/**
 * 生成 115 目录树 STRM
 * 接口：POST /api/strm/gen/115-directory-tree
 * Content-Type: multipart/form-data
 * 字段：
 * - world: File (.txt)
 * - cloud_storage_id: number|string
 * - content_prefix?: string
 * - save_local_path: string
 * - filter_rules: string (JSON: { include?: string[]; download?: string[] })
 */
export async function generate115DirectoryTree(formData: FormData) {
  return apiClient.post<API.Response<any>>(
    '/api/strm/gen/115-directory-tree',
    formData,
  );
}

/**
 * 按云路径映射与云端源目录递归重生成 STRM
 * 接口：POST /api/strm/regenerate-directory
 */
export async function regenerateStrmDirectory(
  data: { cloud_path_id: number; cloud_dir: string },
  options?: { [key: string]: any },
) {
  return apiClient.post<API.Response<any>>(
    '/api/strm/regenerate-directory',
    data,
    { ...(options || {}) },
  );
}
