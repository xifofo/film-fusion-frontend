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
