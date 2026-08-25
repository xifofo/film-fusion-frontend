import type {
  MediaRecognitionRenameType,
  MediaRecognitionRenameVariable,
} from '@/services/film-fusion';

export const renameTypeLabel: Record<MediaRecognitionRenameType, string> = {
  movie: '电影',
  tv: '电视剧',
};

export const getRenameVariables = (
  commonVariables: MediaRecognitionRenameVariable[],
  tvVariables: MediaRecognitionRenameVariable[],
  mediaType: MediaRecognitionRenameType,
) => {
  const variables =
    mediaType === 'tv' ? [...commonVariables, ...tvVariables] : commonVariables;
  const seen = new Set<string>();

  return variables.filter((variable) => {
    if (seen.has(variable.name)) return false;
    seen.add(variable.name);
    return true;
  });
};

export const buildRenameSampleJSON = (
  commonVariables: MediaRecognitionRenameVariable[],
  tvVariables: MediaRecognitionRenameVariable[],
  mediaType: MediaRecognitionRenameType,
) => {
  const sample = Object.fromEntries(
    getRenameVariables(commonVariables, tvVariables, mediaType)
      .filter((variable) => variable.example !== undefined)
      .map((variable) => [variable.name, variable.example]),
  );

  return JSON.stringify(sample, null, 2);
};

export const parseRenameSampleJSON = (text: string) => {
  if (!text.trim()) return undefined;

  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('示例数据必须是 JSON 对象');
  }

  return parsed as Record<string, unknown>;
};
