import { apiClient } from '@/lib/api-client';

export type MediaRecognitionRuleType =
  | 'block'
  | 'replace'
  | 'episode_offset'
  | 'replace_and_offset'
  | 'comment';

export type MediaRecognitionRule = {
  line: number;
  raw: string;
  type: MediaRecognitionRuleType;
  type_label: string;
  valid: boolean;
  error?: string;
  pattern?: string;
  replacement?: string;
  front?: string;
  back?: string;
  offset?: string;
};

export type MediaRecognitionWordsResult = {
  configured: boolean;
  words: string[];
  rules: MediaRecognitionRule[];
  tmdb_configured: boolean;
};

export type MediaRecognitionCategoryCondition = {
  field: string;
  value: string;
};

export type MediaRecognitionCategoryRule = {
  name: string;
  fallback: boolean;
  conditions: MediaRecognitionCategoryCondition[];
};

export type MediaRecognitionCategoryConfigResult = {
  configured: boolean;
  yaml: string;
  movie: MediaRecognitionCategoryRule[];
  tv: MediaRecognitionCategoryRule[];
  warnings: string[];
};

export type MediaRecognitionWordStep = {
  line: number;
  rule: string;
  type: MediaRecognitionRuleType;
  before: string;
  after: string;
  applied: boolean;
  error?: string;
};

export type MediaRecognitionMetaInfo = {
  original_input: string;
  processed_input: string;
  file_name?: string;
  extension?: string;
  name: string;
  year?: string;
  media_type: string;
  tmdb_id?: string;
  begin_season?: number;
  end_season?: number;
  begin_episode?: number;
  end_episode?: number;
  season_episode?: string;
  resource_type?: string;
  resource_pix?: string;
  video_encode?: string;
  video_bit?: string;
  audio_encode?: string;
  resource_effect?: string[];
  resource_team?: string;
  applied_words: string[];
};

export type MediaRecognitionMediaInfo = {
  source: string;
  media_type: string;
  title: string;
  original_title?: string;
  year?: string;
  title_year?: string;
  tmdb_id?: string;
  category?: string;
  category_path?: string;
  poster_path?: string;
  backdrop_path?: string;
  rating?: number;
  genres?: string[];
  genre_ids?: string[];
  overview?: string;
  original_language?: string;
  origin_countries?: string[];
  production_countries?: string[];
};

export type MediaRecognitionCandidate = MediaRecognitionMediaInfo & {
  score: number;
  confidence: number;
};

export type MediaRecognitionTestResult = {
  engine: 'local';
  mode: 'file' | 'title';
  word_result: {
    original: string;
    processed: string;
    applied_words: string[];
    steps: MediaRecognitionWordStep[];
  };
  meta_info: MediaRecognitionMetaInfo;
  media_info: MediaRecognitionMediaInfo;
  candidates: MediaRecognitionCandidate[];
  tmdb_status:
    | 'skipped'
    | 'not_configured'
    | 'matched'
    | 'matched_by_id'
    | 'not_found'
    | 'ambiguous'
    | 'error';
  warning?: string;
  raw: Record<string, unknown>;
};

export type MediaRecognitionShadowSnapshot = {
  engine: 'moviepilot' | 'local';
  media_type?: string;
  title?: string;
  original_title?: string;
  year?: string;
  title_year?: string;
  tmdb_id?: string;
  category?: string;
  season_episode?: string;
  resource_type?: string;
  resource_pix?: string;
  video_encode?: string;
  begin_season?: number;
};

export type MediaRecognitionShadowDifference = {
  field: string;
  label: string;
  moviepilot: string;
  local: string;
};

export type MediaRecognitionShadowComparison = {
  status:
    | 'matched'
    | 'different'
    | 'moviepilot_error'
    | 'local_error'
    | 'local_unavailable';
  matched: boolean;
  moviepilot?: MediaRecognitionShadowSnapshot;
  local?: MediaRecognitionShadowSnapshot;
  differences: MediaRecognitionShadowDifference[];
  moviepilot_error?: string;
  local_error?: string;
};

export type MediaRecognitionShadowTestResult = {
  primary_engine: 'moviepilot';
  moviepilot_raw?: Record<string, unknown>;
  local?: MediaRecognitionTestResult;
  comparison: MediaRecognitionShadowComparison;
};

export type MediaRecognitionRenameType = 'movie' | 'tv';

export type MediaRecognitionRenameVariable = {
  name: string;
  label: string;
  description: string;
  example: unknown;
};

export type MediaRecognitionRenameConfigResult = {
  configured: boolean;
  active: boolean;
  movie_format: string;
  tv_format: string;
  default_movie_format: string;
  default_tv_format: string;
  common_variables: MediaRecognitionRenameVariable[];
  tv_variables: MediaRecognitionRenameVariable[];
  load_errors: string[];
};

export type MediaRecognitionRenameValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  variables: string[];
};

export type MediaRecognitionRenamePreviewResult = {
  path: string;
  template: string;
  variables: Record<string, unknown>;
  warnings: string[];
};

/** 获取 FilmFusion 本地识别词。 */
export async function getMediaRecognitionWords() {
  return apiClient.get<API.Response<MediaRecognitionWordsResult>>(
    '/api/media-recognition/words',
  );
}

/** 覆盖保存 FilmFusion 本地识别词。 */
export async function saveMediaRecognitionWords(words: string[]) {
  return apiClient.put<API.Response<MediaRecognitionWordsResult>>(
    '/api/media-recognition/words',
    { words },
  );
}

/** 获取 FilmFusion 本地 category.yaml。 */
export async function getMediaRecognitionCategoryConfig() {
  return apiClient.get<API.Response<MediaRecognitionCategoryConfigResult>>(
    '/api/media-recognition/category-config',
  );
}

/** 校验 category.yaml，但不保存。 */
export async function validateMediaRecognitionCategoryConfig(yaml: string) {
  return apiClient.post<API.Response<MediaRecognitionCategoryConfigResult>>(
    '/api/media-recognition/category-config/validate',
    { yaml },
  );
}

/** 覆盖保存 FilmFusion 本地 category.yaml。 */
export async function saveMediaRecognitionCategoryConfig(yaml: string) {
  return apiClient.put<API.Response<MediaRecognitionCategoryConfigResult>>(
    '/api/media-recognition/category-config',
    { yaml },
  );
}

/** 使用当前编辑器中的词表与分类 YAML 执行一次纯本地识别。 */
export async function testMediaRecognition(data: {
  input: string;
  mode: 'file' | 'title';
  words?: string[];
  category_yaml?: string;
  lookup_tmdb: boolean;
}) {
  return apiClient.post<API.Response<MediaRecognitionTestResult>>(
    '/api/media-recognition/test',
    data,
  );
}

/** MP2 先给出主结果，再用同一份草稿配置运行 FilmFusion 本地影子。 */
export async function compareMediaRecognition(data: {
  input: string;
  mode: 'file' | 'title';
  words?: string[];
  category_yaml?: string;
  lookup_tmdb: boolean;
}) {
  return apiClient.post<API.Response<MediaRecognitionShadowTestResult>>(
    '/api/media-recognition/shadow-test',
    data,
  );
}

/** 获取全局电影、电视剧重命名模板及可用变量。 */
export async function getMediaRecognitionRenameConfig() {
  return apiClient.get<API.Response<MediaRecognitionRenameConfigResult>>(
    '/api/media-recognition/rename-config',
    { skipErrorHandler: true },
  );
}

/** 覆盖保存两套重命名模板，保存后立即接管整理命名。 */
export async function saveMediaRecognitionRenameConfig(data: {
  movie_format: string;
  tv_format: string;
}) {
  return apiClient.put<API.Response<MediaRecognitionRenameConfigResult>>(
    '/api/media-recognition/rename-config',
    data,
    { skipErrorHandler: true },
  );
}

/** 校验当前草稿模板，不保存。 */
export async function validateMediaRecognitionRenameTemplate(data: {
  media_type: MediaRecognitionRenameType;
  template: string;
}) {
  return apiClient.post<API.Response<MediaRecognitionRenameValidationResult>>(
    '/api/media-recognition/rename-config/validate',
    data,
    { skipErrorHandler: true },
  );
}

/** 使用当前草稿模板和可选示例变量生成相对路径，不保存。 */
export async function previewMediaRecognitionRenameTemplate(data: {
  media_type: MediaRecognitionRenameType;
  template: string;
  sample?: Record<string, unknown>;
}) {
  return apiClient.post<API.Response<MediaRecognitionRenamePreviewResult>>(
    '/api/media-recognition/rename-config/preview',
    data,
    { skipErrorHandler: true },
  );
}
