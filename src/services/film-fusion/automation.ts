import { apiClient } from '@/lib/api-client';

export type AutomationTriggerType = 'rss' | '115_directory';

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

export type AutomationSourceInput = {
  name: string;
  description: string;
  enabled: boolean;
  trigger_type: AutomationTriggerType;
  cloud_storage_id?: number;
  directory_id?: string;
  directory_path?: string;
  recursive?: boolean;
  interval_seconds?: number;
  quiet_seconds?: number;
  feed_url?: string;
  interval_minutes?: number;
  mapping?: RSSAutomationMapping;
};

export type AutomationSource = AutomationSourceInput & {
  id: number;
  trigger_type: AutomationTriggerType;
  mapping_json?: string;
  initialized: boolean;
  last_checked_at?: string;
  last_success_at?: string;
  last_error?: string;
  created_at: string;
  updated_at: string;
};

export type AutomationNodeType =
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

export type AutomationVariableType =
  | 'string'
  | 'integer'
  | 'number'
  | 'boolean'
  | 'array'
  | 'object'
  | 'datetime'
  | 'any';

export type AutomationVariableProtocol = {
  name: string;
  type: AutomationVariableType;
  label: string;
  description: string;
  example?: unknown;
  required?: boolean;
  template?: boolean;
};

export type AutomationNodeProtocol = {
  type: AutomationNodeType;
  label: string;
  inputs: AutomationVariableProtocol[];
  outputs: AutomationVariableProtocol[];
};

export type AutomationPosition = { x: number; y: number };

export type AutomationNodeDefinition = {
  id: string;
  type: AutomationNodeType;
  name?: string;
  position: AutomationPosition;
  config?: Record<string, unknown>;
  max_attempts?: number;
  ui?: Record<string, unknown>;
};

export type AutomationEdgeDefinition = {
  id: string;
  source: string;
  source_port: string;
  target: string;
  target_port?: string;
};

export type AutomationDefinition = {
  schema_version: 1;
  nodes: AutomationNodeDefinition[];
  edges: AutomationEdgeDefinition[];
  viewport?: { x: number; y: number; zoom: number };
};

export type AutomationWorkflowInput = {
  source_id: number;
  name: string;
  description: string;
  enabled: boolean;
  definition: AutomationDefinition;
};

export type AutomationWorkflow = {
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

export type AutomationCreateInput = {
  source: AutomationSourceInput;
  workflow: Omit<AutomationWorkflowInput, 'source_id'>;
};

export type AutomationValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

export type AutomationCreateResult = {
  source: AutomationSource;
  workflow: AutomationWorkflow;
  validation: AutomationValidationResult;
};

export type AutomationEnabledResult = {
  source: AutomationSource;
  workflow: AutomationWorkflow;
};

export type AutomationTargetInput = {
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

export type AutomationTarget = {
  id: number;
  name: string;
  type: 'qbittorrent';
  enabled: boolean;
  config_json: string;
  created_at: string;
  updated_at: string;
};

export type AutomationTargetStatus = {
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

export type AutomationRunStatus =
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'partial'
  | 'failed'
  | 'cancelled';

export type AutomationRun = {
  id: number;
  workflow_id: number;
  workflow_name: string;
  workflow_version: number;
  entry_id: number;
  definition_json: string;
  context_json: string;
  status: AutomationRunStatus;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
};

export type AutomationNodeRun = {
  id: number;
  run_id: number;
  node_id: string;
  node_type: AutomationNodeType;
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

export type AutomationEntry = {
  id: number;
  source_id: number;
  event_key: string;
  item_id: string;
  parent_id?: string;
  title: string;
  path: string;
  is_directory: boolean;
  size: number;
  updated_at_115: number;
  guid?: string;
  detail_url?: string;
  download_url?: string;
  content_key?: string;
  published_at?: string;
  baseline: boolean;
  fields_json: string;
  discovered_at: string;
  created_at: string;
};

export type AutomationEntryHistoryItem = {
  entry: AutomationEntry;
  source_name: string;
  matched: boolean;
  legacy?: boolean;
  rule_name?: string;
  latest_run?: AutomationRun;
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

export type AutomationEntryHistory = {
  items: AutomationEntryHistoryItem[];
  total: number;
};

export type AutomationRunDetail = {
  run: AutomationRun;
  entry: AutomationEntry;
  node_runs: AutomationNodeRun[];
};

export type AutomationScanResult = {
  source_id: number;
  source_name: string;
  trigger_type: AutomationTriggerType;
  baseline: boolean;
  not_modified?: boolean;
  fetched?: number;
  new_entries?: number;
  parse_warnings?: number;
  scanned_folders: number;
  scanned_items: number;
  baseline_items: number;
  new_candidates: number;
  created_entries: number;
  created_runs: number;
  pending_stable: number;
  completed_at: string;
};

export type AutomationDashboard = {
  sources: AutomationSource[];
  workflows: AutomationWorkflow[];
  targets: AutomationTarget[];
  recent_runs: AutomationRun[];
  total_entries: number;
  pending_nodes: number;
  running_nodes: number;
  failed_runs: number;
  scanning_count: number;
  node_protocols?: AutomationNodeProtocol[];
};

// Compatibility names keep the mature RSS workflow designer focused on RSS
// semantics while it now persists through the shared /api/automations API.
export type RSSAutomationSourceInput = {
  name: string;
  description?: string;
  enabled: boolean;
  feed_url: string;
  interval_minutes: number;
  mapping: RSSAutomationMapping;
};

export type RSSAutomationSource = AutomationSource & {
  trigger_type: 'rss';
  feed_url: string;
  interval_minutes: number;
  mapping_json: string;
};

export type RSSAutomationNodeType = AutomationNodeType;
export type RSSAutomationVariableType = AutomationVariableType;
export type RSSAutomationVariableProtocol = AutomationVariableProtocol;
export type RSSAutomationNodeProtocol = AutomationNodeProtocol;
export type RSSAutomationPosition = AutomationPosition;
export type RSSAutomationNodeDefinition = AutomationNodeDefinition;
export type RSSAutomationEdgeDefinition = AutomationEdgeDefinition;
export type RSSAutomationDefinition = AutomationDefinition;
export type RSSAutomationWorkflowInput = AutomationWorkflowInput;
export type RSSAutomationCreateWorkflowInput = Omit<
  RSSAutomationWorkflowInput,
  'source_id'
>;
export type RSSAutomationWorkflow = AutomationWorkflow;
export type RSSAutomationTargetInput = AutomationTargetInput;
export type RSSAutomationTarget = AutomationTarget;
export type RSSAutomationTargetStatus = AutomationTargetStatus;
export type RSSAutomationRunStatus = AutomationRunStatus;
export type RSSAutomationRun = AutomationRun;
export type RSSAutomationNodeRun = AutomationNodeRun;
export type RSSAutomationEntry = AutomationEntry;
export type RSSAutomationEntryHistoryItem = AutomationEntryHistoryItem;
export type RSSAutomationEntryHistory = AutomationEntryHistory;
export type RSSAutomationValidationResult = AutomationValidationResult;

export type RSSAutomationCreateInput = {
  source: RSSAutomationSourceInput;
  workflow: RSSAutomationCreateWorkflowInput;
};

export type RSSAutomationCreateResult = {
  source: RSSAutomationSource;
  workflow: RSSAutomationWorkflow;
  validation: RSSAutomationValidationResult;
};

export type RSSAutomationParsedFeed = {
  title: string;
  items: Array<{ fields: Record<string, unknown>; errors?: string[] }>;
  selectors?: string[];
};

export type RSSAutomationRefreshResult = {
  source_id: number;
  source_name: string;
  trigger_type: 'rss';
  baseline: boolean;
  not_modified?: boolean;
  fetched?: number;
  new_entries?: number;
  created_entries: number;
  created_runs: number;
  parse_warnings?: number;
  completed_at: string;
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

export const getAutomationDashboard = (limit = 50) =>
  apiClient.get<API.Response<AutomationDashboard>>(
    `/api/automations?limit=${limit}`,
  );

export const createAutomation = (input: AutomationCreateInput) =>
  apiClient.post<API.Response<AutomationCreateResult>>(
    '/api/automations',
    input,
  );

export const updateAutomation = (id: number, input: AutomationCreateInput) =>
  apiClient.put<API.Response<AutomationCreateResult>>(
    `/api/automations/${id}`,
    input,
  );

export const updateAutomationSource = (
  id: number,
  input: AutomationSourceInput,
) =>
  apiClient.put<API.Response<AutomationSource>>(
    `/api/automations/${id}/source`,
    input,
  );

export const deleteAutomation = (id: number) =>
  apiClient.delete<API.Response<Record<string, never>>>(
    `/api/automations/${id}`,
  );

export const setAutomationEnabled = (id: number, enabled: boolean) =>
  apiClient.patch<API.Response<AutomationEnabledResult>>(
    `/api/automations/${id}/enabled`,
    { enabled },
  );

export const scanAutomation = (id: number) =>
  apiClient.post<API.Response<AutomationScanResult>>(
    `/api/automations/${id}/scan`,
  );

export const validateAutomationWorkflow = (definition: AutomationDefinition) =>
  apiClient.post<API.Response<AutomationValidationResult>>(
    '/api/automations/workflow/validate',
    definition,
    { skipErrorHandler: true },
  );

export const updateAutomationWorkflow = (
  id: number,
  input: AutomationWorkflowInput,
) =>
  apiClient.put<
    API.Response<{
      workflow: AutomationWorkflow;
      validation: AutomationValidationResult;
    }>
  >(`/api/automations/workflows/${id}`, input);

export const getDownloaders = () =>
  apiClient.get<API.Response<AutomationTarget[]>>('/api/downloaders');

export const getDownloaderStatuses = () =>
  apiClient.get<API.Response<AutomationTargetStatus[]>>(
    '/api/downloaders/status',
  );

export const createDownloader = (input: AutomationTargetInput) =>
  apiClient.post<API.Response<AutomationTarget>>('/api/downloaders', input);

export const updateDownloader = (id: number, input: AutomationTargetInput) =>
  apiClient.put<API.Response<AutomationTarget>>(
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

export const listAutomationRuns = (params?: {
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
  return apiClient.get<API.Response<{ items: AutomationRun[]; total: number }>>(
    `/api/automations/runs?${search}`,
  );
};

export const listAutomationEntries = (params?: {
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
  return apiClient.get<API.Response<AutomationEntryHistory>>(
    `/api/automations/entries?${search}`,
  );
};

export const getAutomationRun = (id: number) =>
  apiClient.get<API.Response<AutomationRunDetail>>(
    `/api/automations/runs/${id}`,
  );

export const retryAutomationRun = (id: number) =>
  apiClient.post<API.Response<Record<string, never>>>(
    `/api/automations/runs/${id}/retry`,
  );

export const cancelAutomationRun = (id: number) =>
  apiClient.post<API.Response<Record<string, never>>>(
    `/api/automations/runs/${id}/cancel`,
  );

export const createRSSAutomation = (input: RSSAutomationCreateInput) =>
  apiClient.post<API.Response<RSSAutomationCreateResult>>('/api/automations', {
    source: {
      ...input.source,
      description: input.source.description || '',
      trigger_type: 'rss',
    },
    workflow: input.workflow,
  });

export const sampleRSSAutomationSource = (input: RSSAutomationSourceInput) =>
  apiClient.post<API.Response<RSSAutomationParsedFeed>>(
    '/api/automations/sources/sample',
    { ...input, trigger_type: 'rss' },
    { skipErrorHandler: true },
  );

export const updateRSSAutomationSource = (
  id: number,
  input: RSSAutomationSourceInput,
) =>
  apiClient.put<API.Response<RSSAutomationSource>>(
    `/api/automations/${id}/source`,
    {
      ...input,
      description: input.description || '',
      trigger_type: 'rss',
    },
  );

export const deleteRSSAutomation = deleteAutomation;

export const refreshRSSAutomation = (sourceId: number) =>
  apiClient.post<API.Response<RSSAutomationRefreshResult>>(
    `/api/automations/${sourceId}/scan`,
  );

export const validateRSSAutomationWorkflow = validateAutomationWorkflow;

export const updateRSSAutomationWorkflow = (
  id: number,
  input: RSSAutomationWorkflowInput,
) =>
  apiClient.put<
    API.Response<{
      workflow: RSSAutomationWorkflow;
      validation: RSSAutomationValidationResult;
    }>
  >(`/api/automations/workflows/${id}`, input);

export const listRSSAutomationEntries = listAutomationEntries;
