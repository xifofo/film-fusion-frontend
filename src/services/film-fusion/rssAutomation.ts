import { apiClient } from '@/lib/api-client';

export type RSSAutomationFieldType =
  | 'string'
  | 'integer'
  | 'number'
  | 'boolean'
  | 'datetime';

export type RSSAutomationFieldMapping = {
  name: string;
  selector: string;
  type?: RSSAutomationFieldType;
  required?: boolean;
  multiple?: boolean;
  join_with?: string;
  match_attribute?: string;
  match_pattern?: string;
};

export type RSSAutomationMapping = {
  item_selector: string;
  fields: RSSAutomationFieldMapping[];
};

export type RSSAutomationSourceInput = {
  name: string;
  enabled: boolean;
  feed_url: string;
  interval_minutes: number;
  mapping: RSSAutomationMapping;
};

export type RSSAutomationSource = {
  id: number;
  name: string;
  enabled: boolean;
  feed_url: string;
  interval_minutes: number;
  mapping_json: string;
  initialized: boolean;
  last_checked_at?: string;
  last_success_at?: string;
  last_error?: string;
  created_at: string;
  updated_at: string;
};

export type RSSAutomationNodeType =
  | 'trigger'
  | 'regex'
  | 'keyword'
  | 'keyword_replace'
  | 'regex_replace'
  | 'convert'
  | 'if'
  | 'parallel'
  | 'join'
  | 'qbittorrent'
  | 'wait_qbittorrent'
  | 'moviepilot_transfer'
  | 'delete_qbittorrent'
  | 'offline115'
  | 'offline115_openapi'
  | 'wait115'
  | 'rename115_openapi'
  | 'moviepilot_title_recognize'
  | 'filmfusion_recognize'
  | 'media_exists'
  | 'hdhive_query'
  | 'hdhive_unlock'
  | 'moviepilot_recognize'
  | 'organize_strm'
  | 'strm_verify'
  | 'strm_regenerate'
  | 'emby_refresh_wait'
  | 'http_request'
  | 'notification'
  | 'end';

export type RSSAutomationVariableType =
  | 'string'
  | 'integer'
  | 'number'
  | 'boolean'
  | 'array'
  | 'object'
  | 'datetime'
  | 'any';

export type RSSAutomationVariableProtocol = {
  name: string;
  type: RSSAutomationVariableType;
  label: string;
  description: string;
  example?: unknown;
  required?: boolean;
  template?: boolean;
};

export type RSSAutomationNodeProtocol = {
  type: RSSAutomationNodeType;
  label: string;
  inputs: RSSAutomationVariableProtocol[];
  outputs: RSSAutomationVariableProtocol[];
};

export type RSSAutomationPosition = { x: number; y: number };

export type RSSAutomationNodeDefinition = {
  id: string;
  type: RSSAutomationNodeType;
  name?: string;
  position: RSSAutomationPosition;
  config?: Record<string, unknown>;
  max_attempts?: number;
  ui?: Record<string, unknown>;
};

export type RSSAutomationEdgeDefinition = {
  id: string;
  source: string;
  source_port: string;
  target: string;
  target_port?: string;
};

export type RSSAutomationDefinition = {
  schema_version: 1;
  nodes: RSSAutomationNodeDefinition[];
  edges: RSSAutomationEdgeDefinition[];
  viewport?: { x: number; y: number; zoom: number };
};

export type RSSAutomationWorkflowInput = {
  source_id: number;
  name: string;
  description: string;
  enabled: boolean;
  definition: RSSAutomationDefinition;
};

export type RSSAutomationCreateWorkflowInput = Omit<
  RSSAutomationWorkflowInput,
  'source_id'
>;

export type RSSAutomationWorkflow = {
  id: number;
  source_id: number;
  name: string;
  description?: string;
  enabled: boolean;
  version: number;
  definition_json: string;
  created_at: string;
  updated_at: string;
};

export type RSSAutomationCreateInput = {
  source: RSSAutomationSourceInput;
  workflow: RSSAutomationCreateWorkflowInput;
};

export type RSSAutomationCreateResult = {
  source: RSSAutomationSource;
  workflow: RSSAutomationWorkflow;
  validation: RSSAutomationValidationResult;
};

export type RSSAutomationEnabledResult = {
  source: RSSAutomationSource;
  workflow: RSSAutomationWorkflow;
};

export type RSSAutomationTargetInput = {
  name: string;
  type: 'qbittorrent';
  enabled: boolean;
  config: {
    base_url: string;
    username: string;
    password: string;
    api_key: string;
  };
};

export type RSSAutomationTarget = {
  id: number;
  name: string;
  type: 'qbittorrent';
  enabled: boolean;
  config_json: string;
  created_at: string;
  updated_at: string;
};

export type RSSAutomationTargetStatus = {
  target_id: number;
  enabled: boolean;
  online: boolean;
  connection_status?: 'connected' | 'firewalled' | 'disconnected' | string;
  download_speed: number;
  upload_speed: number;
  downloaded_session: number;
  uploaded_session: number;
  active_torrents?: number;
  dht_nodes: number;
  error?: string;
  checked_at: string;
};

export type RSSAutomationRunStatus =
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'partial'
  | 'failed'
  | 'cancelled';

export type RSSAutomationRun = {
  id: number;
  workflow_id: number;
  workflow_name: string;
  workflow_version: number;
  entry_id: number;
  definition_json: string;
  context_json: string;
  status: RSSAutomationRunStatus;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
};

export type RSSAutomationNodeRun = {
  id: number;
  run_id: number;
  node_id: string;
  node_type: RSSAutomationNodeType;
  node_name?: string;
  status: string;
  attempt: number;
  max_attempts: number;
  next_attempt_at?: string;
  input_json?: string;
  output_json?: string;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
};

export type RSSAutomationEntry = {
  id: number;
  source_id: number;
  guid?: string;
  title?: string;
  detail_url?: string;
  download_url?: string;
  content_key?: string;
  published_at?: string;
  fields_json: string;
  baseline: boolean;
  discovered_at: string;
};

export type RSSAutomationEntryHistoryItem = {
  entry: RSSAutomationEntry;
  source_name: string;
  matched: boolean;
  legacy: boolean;
  rule_name?: string;
  latest_run?: RSSAutomationRun;
  media_title?: string;
  media_year?: string;
  media_type?: string;
  media_category?: string;
  season_episode?: string;
  rating?: number;
  quality?: string;
  tmdb_id?: string;
  poster_url?: string;
  recognition_error?: string;
  notification_status?: string;
  notification_error?: string;
};

export type RSSAutomationEntryHistory = {
  items: RSSAutomationEntryHistoryItem[];
  total: number;
};

export type RSSAutomationDashboard = {
  sources: RSSAutomationSource[];
  workflows: RSSAutomationWorkflow[];
  targets: RSSAutomationTarget[];
  recent_runs: RSSAutomationRun[];
  total_entries: number;
  pending_nodes: number;
  running_nodes: number;
  failed_runs: number;
  source_running: boolean;
  node_protocols?: RSSAutomationNodeProtocol[];
};

export type RSSAutomationParsedFeed = {
  title: string;
  items: Array<{ fields: Record<string, unknown>; errors?: string[] }>;
  selectors?: string[];
};

export type RSSAutomationRefreshResult = {
  source_id: number;
  source_name: string;
  baseline: boolean;
  not_modified: boolean;
  fetched: number;
  new_entries: number;
  created_runs: number;
  parse_warnings: number;
  completed_at: string;
  error?: string;
  failed_sources?: number;
  source_results?: RSSAutomationRefreshResult[];
};

export type RSSAutomationValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

export type RSSAutomationRunDetail = {
  run: RSSAutomationRun;
  entry: RSSAutomationEntry;
  node_runs: RSSAutomationNodeRun[];
};

export type RSSAutomationManualCandidate = {
  entry_id: number;
  title: string;
  detail_url?: string;
  download_url?: string;
  published_at?: string;
  discovered_at: string;
  action_names: string[];
  action_types: RSSAutomationNodeType[];
};

export type RSSAutomationManualCandidateList = {
  workflow_id: number;
  workflow_version: number;
  items: RSSAutomationManualCandidate[];
  scanned_entries: number;
  has_more: boolean;
};

export type RSSAutomationManualRunResult = {
  requested: number;
  created: number;
  run_ids: number[];
  skipped: Array<{ entry_id: number; reason: string }>;
};

export const DEFAULT_RSS_AUTOMATION_MAPPING: RSSAutomationMapping = {
  item_selector: 'channel/item',
  fields: [
    { name: 'title', selector: 'title#text', type: 'string', required: true },
    { name: 'guid', selector: 'guid#text', type: 'string' },
    { name: 'detail_url', selector: 'link#text', type: 'string' },
    { name: 'download_url', selector: 'enclosure@url', type: 'string' },
    { name: 'size_bytes', selector: 'enclosure@length', type: 'integer' },
    {
      name: 'category',
      selector: 'category#text',
      type: 'string',
      multiple: true,
      join_with: ', ',
    },
    { name: 'published_at', selector: 'pubDate#text', type: 'datetime' },
  ],
};

export const DEFAULT_ATOM_AUTOMATION_MAPPING: RSSAutomationMapping = {
  item_selector: 'entry',
  fields: [
    { name: 'title', selector: 'title#text', type: 'string', required: true },
    { name: 'guid', selector: 'id#text', type: 'string' },
    {
      name: 'detail_url',
      selector: 'link@href',
      type: 'string',
      match_attribute: 'rel',
      match_pattern: '^(alternate)?$',
    },
    {
      name: 'download_url',
      selector: 'link@href',
      type: 'string',
      match_attribute: 'rel',
      match_pattern: '^enclosure$',
    },
    {
      name: 'size_bytes',
      selector: 'link@length',
      type: 'integer',
      match_attribute: 'rel',
      match_pattern: '^enclosure$',
    },
    {
      name: 'category',
      selector: 'category@term',
      type: 'string',
      multiple: true,
      join_with: ', ',
    },
    { name: 'published_at', selector: 'updated#text', type: 'datetime' },
  ],
};

export const DEFAULT_RSS_AUTOMATION_DEFINITION: RSSAutomationDefinition = {
  schema_version: 1,
  nodes: [
    {
      id: 'trigger',
      type: 'trigger',
      name: '收到 RSS 条目',
      position: { x: 80, y: 180 },
      config: {},
    },
    {
      id: 'end',
      type: 'end',
      name: '结束',
      position: { x: 420, y: 180 },
      config: {},
    },
  ],
  edges: [
    {
      id: 'edge-trigger-end',
      source: 'trigger',
      source_port: 'next',
      target: 'end',
    },
  ],
  viewport: { x: 0, y: 0, zoom: 1 },
};

export const getRSSAutomationDashboard = (limit = 50) =>
  apiClient.get<API.Response<RSSAutomationDashboard>>(
    `/api/rss-automation?limit=${limit}`,
  );

export const createRSSAutomation = (input: RSSAutomationCreateInput) =>
  apiClient.post<API.Response<RSSAutomationCreateResult>>(
    '/api/rss-automation/automations',
    input,
  );

export const updateRSSAutomationSource = (
  id: number,
  input: RSSAutomationSourceInput,
) =>
  apiClient.put<API.Response<RSSAutomationSource>>(
    `/api/rss-automation/sources/${id}`,
    input,
  );

export const deleteRSSAutomation = (id: number) =>
  apiClient.delete<API.Response<Record<string, never>>>(
    `/api/rss-automation/automations/${id}`,
  );

export const setRSSAutomationEnabled = (id: number, enabled: boolean) =>
  apiClient.patch<API.Response<RSSAutomationEnabledResult>>(
    `/api/rss-automation/automations/${id}/enabled`,
    { enabled },
  );

export const sampleRSSAutomationSource = (input: RSSAutomationSourceInput) =>
  apiClient.post<API.Response<RSSAutomationParsedFeed>>(
    '/api/rss-automation/sources/sample',
    input,
    { skipErrorHandler: true },
  );

export const refreshRSSAutomation = (sourceId?: number) =>
  apiClient.post<API.Response<RSSAutomationRefreshResult>>(
    `/api/rss-automation/refresh${sourceId ? `?source_id=${sourceId}` : ''}`,
  );

export const validateRSSAutomationWorkflow = (
  definition: RSSAutomationDefinition,
) =>
  apiClient.post<API.Response<RSSAutomationValidationResult>>(
    '/api/rss-automation/workflows/validate',
    definition,
    { skipErrorHandler: true },
  );

export const updateRSSAutomationWorkflow = (
  id: number,
  input: RSSAutomationWorkflowInput,
) =>
  apiClient.put<
    API.Response<{
      workflow: RSSAutomationWorkflow;
      validation: RSSAutomationValidationResult;
    }>
  >(`/api/rss-automation/workflows/${id}`, input);

export const listRSSAutomationManualCandidates = (id: number, limit = 100) =>
  apiClient.get<API.Response<RSSAutomationManualCandidateList>>(
    `/api/rss-automation/workflows/${id}/manual-candidates?limit=${limit}`,
  );

export const createRSSAutomationManualRuns = (id: number, entryIds: number[]) =>
  apiClient.post<API.Response<RSSAutomationManualRunResult>>(
    `/api/rss-automation/workflows/${id}/manual-runs`,
    { entry_ids: entryIds },
  );

export const createRSSAutomationTarget = (input: RSSAutomationTargetInput) =>
  apiClient.post<API.Response<RSSAutomationTarget>>(
    '/api/rss-automation/targets',
    input,
  );

export const updateRSSAutomationTarget = (
  id: number,
  input: RSSAutomationTargetInput,
) =>
  apiClient.put<API.Response<RSSAutomationTarget>>(
    `/api/rss-automation/targets/${id}`,
    input,
  );

export const deleteRSSAutomationTarget = (id: number) =>
  apiClient.delete<API.Response<Record<string, never>>>(
    `/api/rss-automation/targets/${id}`,
  );

export const testRSSAutomationTarget = (id: number) =>
  apiClient.post<API.Response<Record<string, never>>>(
    `/api/rss-automation/targets/${id}/test`,
  );

export const getDownloaders = () =>
  apiClient.get<API.Response<RSSAutomationTarget[]>>('/api/downloaders');

export const getDownloaderStatuses = () =>
  apiClient.get<API.Response<RSSAutomationTargetStatus[]>>(
    '/api/downloaders/status',
  );

export const createDownloader = (input: RSSAutomationTargetInput) =>
  apiClient.post<API.Response<RSSAutomationTarget>>('/api/downloaders', input);

export const updateDownloader = (id: number, input: RSSAutomationTargetInput) =>
  apiClient.put<API.Response<RSSAutomationTarget>>(
    `/api/downloaders/${id}`,
    input,
  );

export const deleteDownloader = (id: number) =>
  apiClient.delete<API.Response<Record<string, never>>>(
    `/api/downloaders/${id}`,
  );

export const testDownloader = (id: number) =>
  apiClient.post<API.Response<Record<string, never>>>(
    `/api/downloaders/${id}/test`,
  );

export const listRSSAutomationRuns = (params?: {
  workflowId?: number;
  status?: string;
  limit?: number;
  offset?: number;
}) => {
  const search = new URLSearchParams();
  if (params?.workflowId) search.set('workflow_id', String(params.workflowId));
  if (params?.status) search.set('status', params.status);
  search.set('limit', String(params?.limit ?? 50));
  search.set('offset', String(params?.offset ?? 0));
  return apiClient.get<
    API.Response<{ items: RSSAutomationRun[]; total: number }>
  >(`/api/rss-automation/runs?${search}`);
};

export const listRSSAutomationEntries = (params?: {
  filter?: 'all' | 'matched';
  sourceId?: number;
  limit?: number;
  offset?: number;
}) => {
  const search = new URLSearchParams();
  if (params?.filter) search.set('filter', params.filter);
  if (params?.sourceId) search.set('source_id', String(params.sourceId));
  search.set('limit', String(params?.limit ?? 50));
  search.set('offset', String(params?.offset ?? 0));
  return apiClient.get<API.Response<RSSAutomationEntryHistory>>(
    `/api/rss-automation/entries?${search}`,
  );
};

export const getRSSAutomationRun = (id: number) =>
  apiClient.get<API.Response<RSSAutomationRunDetail>>(
    `/api/rss-automation/runs/${id}`,
  );

export const retryRSSAutomationRun = (id: number) =>
  apiClient.post<API.Response<Record<string, never>>>(
    `/api/rss-automation/runs/${id}/retry`,
  );

export const cancelRSSAutomationRun = (id: number) =>
  apiClient.post<API.Response<Record<string, never>>>(
    `/api/rss-automation/runs/${id}/cancel`,
  );
