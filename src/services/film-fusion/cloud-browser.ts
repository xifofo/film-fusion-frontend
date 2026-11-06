import { apiClient } from '@/lib/api-client';

export type CloudBrowserAccessMethod = 'cookie' | 'openapi';

export type CloudBrowserQuery = {
  access_method: CloudBrowserAccessMethod;
  cid: string;
  offset: number;
  limit: number;
};

export type CloudBrowserItem = {
  file_id: string;
  parent_id: string;
  name: string;
  is_file: boolean;
  size: number;
  selection_token?: string;
  matched_directory_id?: number;
  matched_directory_name?: string;
  strm_unavailable_reason?: string;
};

export type CloudBrowserPage = {
  cid: string;
  offset: number;
  limit: number;
  total: number;
  has_more: boolean;
  access_method: CloudBrowserAccessMethod;
  available_methods: CloudBrowserAccessMethod[];
  breadcrumbs: { id: string; parent_id: string; name: string }[];
  matched_directory?: { id: number; directory_name: string } | null;
  strm_unavailable_reason?: string;
  items: CloudBrowserItem[];
  current_directory_token?: string;
};

export type CloudSTRMFileResult = {
  file_id: string;
  name: string;
  status: 'created' | 'updated' | 'unchanged' | 'skipped' | 'failed';
  message: string;
  local_path?: string;
  directory_id?: number;
};

export type CloudSTRMResult = {
  job_id?: string;
  name?: string;
  status:
    | 'queued'
    | 'running'
    | 'cancelling'
    | 'completed'
    | 'failed'
    | 'cancelled';
  finished: boolean;
  generated: number;
  skipped: number;
  failed: number;
  visited_directories?: number;
  scanned_files?: number;
  errors?: string[];
  results?: CloudSTRMFileResult[];
};

// Browsing is event driven: each call fetches one page, with no retry or prefetch.
export function getCloudBrowserPage(
  directoryId: number,
  query: CloudBrowserQuery,
  signal?: AbortSignal,
) {
  return apiClient.get<API.Response<CloudBrowserPage>>(
    `/api/media-directories/${directoryId}/browser`,
    { params: query, signal, skipErrorHandler: true },
  );
}

export function generateCloudBrowserSTRM(
  directoryId: number,
  selectionToken: string,
  signal?: AbortSignal,
) {
  return apiClient.post<API.Response<CloudSTRMResult>>(
    `/api/media-directories/${directoryId}/browser/strm`,
    { selection_token: selectionToken },
    { signal, skipErrorHandler: true },
  );
}

// These endpoints read/cancel a local job; they never list the 115 drive.
export function getActiveCloudBrowserSTRMJob(
  directoryId: number,
  signal?: AbortSignal,
) {
  return apiClient.get<API.Response<CloudSTRMResult | null>>(
    `/api/media-directories/${directoryId}/browser/jobs`,
    { signal, skipErrorHandler: true },
  );
}

export function getCloudBrowserSTRMJob(
  directoryId: number,
  jobId: string,
  signal?: AbortSignal,
) {
  return apiClient.get<API.Response<CloudSTRMResult>>(
    `/api/media-directories/${directoryId}/browser/jobs/${encodeURIComponent(jobId)}`,
    { signal, skipErrorHandler: true },
  );
}

export function cancelCloudBrowserSTRMJob(
  directoryId: number,
  jobId: string,
  signal?: AbortSignal,
) {
  return apiClient.delete<API.Response<CloudSTRMResult>>(
    `/api/media-directories/${directoryId}/browser/jobs/${encodeURIComponent(jobId)}`,
    { signal, skipErrorHandler: true },
  );
}
