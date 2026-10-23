import { apiClient } from '@/lib/api-client';

export type CloudFileAccessMethod = 'cookie' | 'openapi';

export type CloudFileItem = {
  file_id: string;
  parent_id?: string;
  name: string;
  is_file: boolean;
  size: number;
};

export type CloudFileList = {
  items: CloudFileItem[];
  total: number;
  cid: string;
  offset: number;
  limit: number;
};

export type CloudFolderMoveParams = {
  access_method: CloudFileAccessMethod;
  source_parent_id: string;
  file_id: string;
  file_name: string;
  target_parent_id: string;
  folder_name: string;
  folder_id?: string;
};

export type CloudFolderMoveResult = {
  status: 'moved' | 'already_moved' | 'pending';
  folder_id: string;
  folder_name: string;
  file_id: string;
  file_name: string;
  reused_folder: boolean;
  strm?: {
    status: 'created' | 'skipped' | 'failed';
    cloud_path_id?: number;
    local_path?: string;
    message: string;
  };
};

export function getCloudFiles(
  storageId: number,
  params: {
    access_method: CloudFileAccessMethod;
    cid: string;
    offset: number;
    limit: number;
  },
  signal?: AbortSignal,
) {
  return apiClient.get<API.Response<CloudFileList>>(
    `/api/cloud-storage/${storageId}/files`,
    { params, signal, skipErrorHandler: true },
  );
}

export function moveCloudFileToFolder(
  storageId: number,
  data: CloudFolderMoveParams,
) {
  return apiClient.post<API.Response<CloudFolderMoveResult>>(
    `/api/cloud-storage/${storageId}/folder-move`,
    data,
    { timeout: 135_000, skipErrorHandler: true },
  );
}
