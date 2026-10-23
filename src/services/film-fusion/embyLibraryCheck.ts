import { apiClient } from '@/lib/api-client';

export type EmbyLibraryCheckStatus = 'found' | 'possible' | 'missing' | 'error';

export type EmbyLibraryMatch = {
  id: string;
  name: string;
  type: string;
  year?: number;
  path?: string;
  emby_url?: string;
};

export type EmbyLibraryCheckItem = {
  original_name: string;
  name: string;
  status: EmbyLibraryCheckStatus;
  matches: EmbyLibraryMatch[];
  error?: string;
  truncated?: boolean;
};

export type EmbyLibraryCheckResult = {
  results: EmbyLibraryCheckItem[];
  total: number;
  duplicates_removed: number;
};

export function checkEmbyLibrary(names: string[], signal?: AbortSignal) {
  return apiClient.post<API.Response<EmbyLibraryCheckResult>>(
    '/api/emby-library-check',
    { names },
    { timeout: 135_000, signal, skipErrorHandler: true },
  );
}
