// The editor never fetches a torrent. URL inputs use explicitly marked sample
// metadata; existing magnets can be inspected without network access.
export const previewTorrentToMagnet = (
  input: string,
  includeTrackers: boolean,
): Record<string, unknown> => {
  if (!input.trim() || input.length > 8192)
    throw new Error('种子地址为空或超过 8192 字节');
  const url = new URL(input.trim());
  if (url.protocol === 'magnet:') {
    if (url.host || url.pathname || url.hash)
      throw new Error('磁力链接格式无效');
    let hash = '';
    for (const xt of url.searchParams.getAll('xt')) {
      if (!xt.toLowerCase().startsWith('urn:btih:')) continue;
      let next = xt.slice(9).toLowerCase();
      if (/^[a-z2-7]{32}$/.test(next)) {
        const alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
        let value = 0n;
        for (const char of next)
          value = (value << 5n) | BigInt(alphabet.indexOf(char));
        next = value.toString(16).padStart(40, '0');
      }
      if (!/^[0-9a-f]{40}$/.test(next) || (hash && hash !== next))
        throw new Error('磁力链接的 BT info_hash 无效或相互冲突');
      hash = next;
    }
    if (!hash) throw new Error('磁力链接缺少 v1 BT info_hash；暂不支持纯 v2');
    const trackers = url.searchParams.getAll('tr');
    if (!includeTrackers) url.searchParams.delete('tr');
    return {
      preview: true,
      magnet: url.toString(),
      info_hash: hash,
      torrent_name: url.searchParams.get('dn') || '',
      trackers,
      trackers_included: includeTrackers,
      metadata_available: false,
      warnings: ['输入已是磁力链接，文件列表、大小和私有标记未知。'],
    };
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password
  )
    throw new Error('种子来源必须是 HTTP/HTTPS 下载地址或磁力链接');
  const hash = '0123456789abcdef0123456789abcdef01234567';
  return {
    preview: true,
    magnet: `magnet:?xt=urn:btih:${hash}&dn=Example.mkv`,
    info_hash: hash,
    torrent_name: 'Example.mkv',
    file_size: 1024,
    file_count: 1,
    files: [{ index: 0, path: 'Example.mkv', size: 1024 }],
    private: false,
    trackers: [],
    trackers_included: includeTrackers,
    torrent_version: 'v1',
    metadata_available: true,
    warnings: [
      '示例数据：预览未下载种子；真实 Hash、文件列表和私有标记由运行时解析。',
    ],
  };
};
