import { apiClient } from '@/lib/api-client';

export type RSSGeneratorKind = 'http_json' | 'http_html' | 'browser';
export type RSSGeneratorMethod = 'GET' | 'POST';

export type RSSGeneratorParameter = {
  name: string;
  label?: string;
  type: 'string' | 'number' | 'boolean';
  description?: string;
  required?: boolean;
  default?: string | number | boolean;
  pattern?: string;
  enum?: string[];
};

export type RSSGeneratorFeedInput = {
  name: string;
  slug: string;
  description?: string;
  home_page_url?: string;
  language?: string;
  author?: string;
  image_url?: string;
  route_kind: RSSGeneratorKind;
  source_url_template: string;
  method: RSSGeneratorMethod;
  request_body_template?: string;
  parameters: RSSGeneratorParameter[];
  headers: Record<string, string>;
  selectors: Record<string, string>;
  mapping: Record<string, string>;
  cookie?: string;
  proxy_url?: string;
  proxy_allow_private: boolean;
  secret_query_params: Record<string, string>;
  browser_storage_state?: string | Record<string, unknown>;
  wait_until?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
  wait_for_selector?: string;
  render_delay_ms?: number;
  item_limit: number;
  browser_fallback: boolean;
  cache_ttl_seconds: number;
  stale_ttl_seconds: number;
  enabled: boolean;
  clear_headers?: boolean;
  clear_cookie?: boolean;
  clear_proxy_url?: boolean;
  clear_secret_query_params?: boolean;
  clear_browser_storage_state?: boolean;
};

export type RSSGeneratorFeed = RSSGeneratorFeedInput & {
  id: number;
  public_id: string;
  created_at: string;
  updated_at: string;
  last_generated_at?: string;
  last_success_at?: string;
  last_error?: string;
  token_count?: number;
  item_count?: number;
  version: number;
};

export type RSSGeneratorWorkerStatus = {
  available: boolean;
  status: string;
  healthy?: boolean;
  service?: string;
  version?: string;
  auth_configured?: boolean;
  error?: string;
  [key: string]: unknown;
};

export type RSSGeneratorDashboard = {
  total_feeds: number;
  enabled_feeds: number;
  total_tokens: number;
  active_tokens: number;
  feeds: RSSGeneratorFeed[];
  worker_status?: string | RSSGeneratorWorkerStatus;
  worker_health?: string | Record<string, unknown>;
};

export type RSSGeneratorPreviewItem = {
  id?: string;
  title: string;
  link?: string;
  description?: string;
  content?: string;
  author?: string;
  categories?: string[];
  published_at?: string;
  date?: string;
  updated_at?: string;
  enclosures?: Array<{ url: string; type?: string; length?: number }>;
};

export type RSSGeneratorPreview = {
  title: string;
  description?: string;
  link?: string;
  language?: string;
  updated_at?: string;
  items: RSSGeneratorPreviewItem[];
};

export type RSSGeneratorTokenStatus = 'active' | 'revoked' | 'expired';

export type RSSGeneratorToken = {
  id: number;
  feed_id: number;
  name?: string;
  prefix: string;
  status: RSSGeneratorTokenStatus;
  expires_at?: string;
  last_used_at?: string;
  rate_limit_per_minute?: number;
  created_at: string;
};

export type RSSGeneratorTokenInput = {
  name?: string;
  expires_at?: string;
  rate_limit_per_minute?: number;
};

export type RSSGeneratorTokenSecret = {
  token: string;
  rss_url: string;
  atom_url: string;
  record?: RSSGeneratorToken;
};

export async function getRSSGeneratorDashboard() {
  return apiClient.get<API.Response<RSSGeneratorDashboard>>(
    '/api/rss-generator/dashboard',
  );
}

export async function listRSSGeneratorFeeds() {
  return apiClient.get<API.Response<RSSGeneratorFeed[]>>(
    '/api/rss-generator/feeds',
  );
}

export async function createRSSGeneratorFeed(input: RSSGeneratorFeedInput) {
  return apiClient.post<API.Response<RSSGeneratorFeed>>(
    '/api/rss-generator/feeds',
    input,
  );
}

export async function updateRSSGeneratorFeed(
  id: number,
  input: RSSGeneratorFeedInput,
) {
  return apiClient.put<API.Response<RSSGeneratorFeed>>(
    `/api/rss-generator/feeds/${id}`,
    input,
  );
}

export async function deleteRSSGeneratorFeed(id: number) {
  return apiClient.delete<API.Response<Record<string, never>>>(
    `/api/rss-generator/feeds/${id}`,
  );
}

export async function previewRSSGeneratorFeed(
  id: number,
  params: Record<string, string> = {},
  format: 'rss' | 'atom' = 'rss',
) {
  return apiClient.post<API.Response<RSSGeneratorPreview>>(
    `/api/rss-generator/feeds/${id}/preview`,
    { params, format },
  );
}

export async function previewRSSGeneratorDefinition(
  definition: RSSGeneratorFeedInput,
  params: Record<string, string> = {},
  format: 'rss' | 'atom' = 'rss',
  feedId?: number,
) {
  return apiClient.post<API.Response<RSSGeneratorPreview>>(
    '/api/rss-generator/preview',
    {
      definition,
      params,
      format,
      ...(feedId === undefined ? {} : { feed_id: feedId }),
    },
  );
}

export async function listRSSGeneratorTokens(feedId: number) {
  return apiClient.get<API.Response<RSSGeneratorToken[]>>(
    `/api/rss-generator/feeds/${feedId}/tokens`,
  );
}

export async function createRSSGeneratorToken(
  feedId: number,
  input: RSSGeneratorTokenInput,
) {
  return apiClient.post<API.Response<RSSGeneratorTokenSecret>>(
    `/api/rss-generator/feeds/${feedId}/tokens`,
    input,
  );
}

export async function rotateRSSGeneratorToken(feedId: number, id: number) {
  return apiClient.post<API.Response<RSSGeneratorTokenSecret>>(
    `/api/rss-generator/feeds/${feedId}/tokens/${id}/rotate`,
  );
}

export async function deleteRSSGeneratorToken(feedId: number, id: number) {
  return apiClient.delete<API.Response<Record<string, never>>>(
    `/api/rss-generator/feeds/${feedId}/tokens/${id}`,
  );
}
