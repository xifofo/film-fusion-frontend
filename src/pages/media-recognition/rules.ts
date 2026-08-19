import type {
  MediaRecognitionRule,
  MediaRecognitionRuleType,
} from '@/services/film-fusion';

const labels: Record<MediaRecognitionRuleType, string> = {
  block: '屏蔽词',
  replace: '替换词',
  episode_offset: '集偏移',
  replace_and_offset: '替换并偏移',
  comment: '注释',
};

export const splitRecognitionWords = (text: string) =>
  text
    .replaceAll('\r', '')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

export const inspectRecognitionWords = (text: string): MediaRecognitionRule[] =>
  splitRecognitionWords(text).map((raw, index) => {
    const trimmed = raw.trim();
    let type: MediaRecognitionRuleType = 'block';
    let valid = true;
    let error: string | undefined;

    if (trimmed.startsWith('#')) {
      type = 'comment';
    } else if (raw.includes(' && ')) {
      type = 'replace_and_offset';
      valid =
        raw.includes(' => ') && raw.includes(' <> ') && raw.includes(' >> ');
    } else if (raw.includes(' => ') || raw.endsWith(' =>')) {
      type = 'replace';
      valid = raw.split(' =>', 2)[0].trim().length > 0;
    } else if (raw.includes(' <> ') && raw.includes(' >> ')) {
      type = 'episode_offset';
    } else if (raw.includes('=>') || raw.includes('<>') || raw.includes('>>')) {
      valid = false;
      error = '运算符两侧需要空格';
    }

    if (!valid && !error) {
      error = '规则格式不完整';
    }
    return {
      line: index + 1,
      raw,
      type,
      type_label: valid ? labels[type] : '格式错误',
      valid,
      error,
    };
  });

export const tmdbImageURL = (path?: string) => {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  return `https://image.tmdb.org/t/p/w500${path.startsWith('/') ? path : `/${path}`}`;
};
