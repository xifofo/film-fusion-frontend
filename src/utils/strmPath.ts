/**
 * STRM 路径拼接工具：复刻后端 app/utils/pathhelper 与 strm 生成逻辑（Unix 语义），
 * 用于前端「效果预览」，保证与真实生成一致。
 */

const driveLetterPattern = /^[a-zA-Z]:[\\/]+/;

export function removeDriveLetter(p: string): string {
  return p ? p.replace(driveLetterPattern, '') : '';
}

export function toLinux(p: string): string {
  return removeDriveLetter(p).replace(/\\/g, '/');
}

/** 复刻 Go filepath.Clean（Unix 语义） */
export function cleanUnix(path: string): string {
  const isAbs = path.startsWith('/');
  const out: string[] = [];
  for (const seg of path.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') {
      if (out.length > 0 && out[out.length - 1] !== '..') {
        out.pop();
      } else if (!isAbs) {
        out.push('..');
      }
      continue;
    }
    out.push(seg);
  }
  let res = out.join('/');
  if (isAbs) res = '/' + res;
  if (res === '') res = isAbs ? '/' : '.';
  return res;
}

/** 复刻 Go filepath.Join（Unix 语义）：忽略空元素，再 Clean */
export function unixJoin(base: string, relative: string): string {
  const elems = [toLinux(base), toLinux(relative)].filter((e) => e !== '');
  if (elems.length === 0) return '';
  return cleanUnix(elems.join('/'));
}

/** 复刻 pathhelper.SafeFilePathJoin（http(s) 前缀按 URL 拼接，否则 Unix Join） */
export function safeFilePathJoin(
  basePath: string,
  relativePath: string,
): string {
  if (basePath.startsWith('http://') || basePath.startsWith('https://')) {
    let base = basePath;
    if (!base.endsWith('/')) base += '/';
    const rel = relativePath.replace(/^\/+/, '');
    return base + rel;
  }
  return unixJoin(basePath, relativePath);
}

/** 复刻 Go filepath.Ext：取最后一段中最后一个 "." 起的后缀（含点） */
export function extOf(p: string): string {
  const base = p.split('/').pop() ?? '';
  const idx = base.lastIndexOf('.');
  return idx >= 0 ? base.slice(idx) : '';
}

/** 逐段 URI 编码（近似后端 url.PathEscape） */
export function encodePathSegments(p: string): string {
  return p
    .split('/')
    .map((seg) => (seg === '' ? seg : encodeURIComponent(seg)))
    .join('/');
}

/**
 * 复刻后端 buildStrmInfo / CreateStrm：由保存路径、内容前缀、目标(源)路径构造本地 STRM 路径与内容。
 */
export function buildStrmInfo(
  savePath: string,
  contentPrefix: string,
  targetPath: string,
  encodeUri: boolean,
): { strmPath: string; content: string } {
  const localPath = safeFilePathJoin(savePath, targetPath);
  const ext = extOf(localPath);
  const strmPath = ext
    ? `${localPath.slice(0, localPath.length - ext.length)}.strm`
    : `${localPath}.strm`;
  const nextPath = encodeUri ? encodePathSegments(targetPath) : targetPath;
  const content = safeFilePathJoin(contentPrefix || '', nextPath);
  return { strmPath, content };
}
