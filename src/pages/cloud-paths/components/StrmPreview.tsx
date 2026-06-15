import { ProFormDependency } from '@ant-design/pro-components';
import { Input, Tag, Typography } from 'antd';
import React, { useState } from 'react';

const { Text, Paragraph } = Typography;

// ===== 以下逻辑复刻后端 app/utils/pathhelper 与 strm_service，保证预览与真实生成一致 =====

const driveLetterPattern = /^[a-zA-Z]:[\\/]+/;

function removeDriveLetter(p: string): string {
  return p ? p.replace(driveLetterPattern, '') : '';
}

function toLinux(p: string): string {
  return removeDriveLetter(p).replace(/\\/g, '/');
}

// 复刻 Go filepath.Clean（Unix 语义）
function cleanUnix(path: string): string {
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

// 复刻 Go filepath.Join（Unix 语义）：忽略空元素，再 Clean
function unixJoin(base: string, relative: string): string {
  const elems = [toLinux(base), toLinux(relative)].filter((e) => e !== '');
  if (elems.length === 0) return '';
  return cleanUnix(elems.join('/'));
}

// 复刻 pathhelper.SafeFilePathJoin
function safeFilePathJoin(basePath: string, relativePath: string): string {
  if (basePath.startsWith('http://') || basePath.startsWith('https://')) {
    let base = basePath;
    if (!base.endsWith('/')) base += '/';
    const rel = relativePath.replace(/^\/+/, '');
    return base + rel;
  }
  return unixJoin(basePath, relativePath);
}

// 复刻 Go filepath.Ext：取最后一段中最后一个 "." 起的后缀
function extOf(p: string): string {
  const base = p.split('/').pop() ?? '';
  const idx = base.lastIndexOf('.');
  return idx >= 0 ? base.slice(idx) : '';
}

type ParsedRules = { include: string[]; download: string[] } | null;

function parseRules(filterRules?: string): ParsedRules {
  if (!filterRules || !filterRules.trim()) return null;
  try {
    const obj = JSON.parse(filterRules);
    const norm = (arr: unknown): string[] =>
      Array.isArray(arr)
        ? arr
            .map((s) => String(s).trim().toLowerCase())
            .filter(Boolean)
            .map((s) => (s.startsWith('.') ? s : '.' + s))
        : [];
    return {
      include: norm((obj as any).include),
      download: norm((obj as any).download),
    };
  } catch {
    return null;
  }
}

// 逐段 URI 编码（近似后端 url.PathEscape）
function encodePathSegments(p: string): string {
  return p
    .split('/')
    .map((seg) => (seg === '' ? seg : encodeURIComponent(seg)))
    .join('/');
}

type SimResult =
  | { kind: 'no-input' }
  | { kind: 'no-local' }
  | { kind: 'invalid-rules' }
  | { kind: 'skip' }
  | { kind: 'download'; target: string }
  | { kind: 'strm'; target: string; content: string };

function simulate(opts: {
  samplePath: string;
  localPath?: string;
  contentPrefix?: string;
  contentEncodeURI?: boolean;
  filterRules?: string;
}): SimResult {
  const path = (opts.samplePath || '').trim();
  if (!path) return { kind: 'no-input' };

  // 后端 CreateFile：未配置本地路径直接跳过
  if (!opts.localPath || !opts.localPath.trim()) return { kind: 'no-local' };

  const ext = extOf(path).toLowerCase();
  const hasFilter = !!(opts.filterRules && opts.filterRules.trim());
  const rules = parseRules(opts.filterRules);

  if (hasFilter && rules === null) return { kind: 'invalid-rules' };

  const inInclude = rules ? rules.include.includes(ext) : false;
  const inDownload = rules ? rules.download.includes(ext) : false;

  // CreateFile：有过滤规则且不在 include/download 任意规则中 -> 跳过
  if (hasFilter && !inInclude && !inDownload) return { kind: 'skip' };

  const savePath = safeFilePathJoin(opts.localPath, path);

  // IsFileMatchedByFilter(ext, rules, "download")：无规则默认命中下载
  const isDownload = hasFilter ? inDownload : true;
  if (isDownload) {
    return { kind: 'download', target: savePath };
  }

  // 生成 STRM
  const actualExt = extOf(savePath);
  const strmFilePath =
    savePath.slice(0, savePath.length - actualExt.length) + '.strm';

  const nextPath = opts.contentEncodeURI ? encodePathSegments(path) : path;
  const content = safeFilePathJoin(opts.contentPrefix || '', nextPath);

  return { kind: 'strm', target: strmFilePath, content };
}

const ResultView: React.FC<{ result: SimResult }> = ({ result }) => {
  switch (result.kind) {
    case 'no-input':
      return <Text type="secondary">输入示例路径后查看模拟结果</Text>;
    case 'no-local':
      return (
        <Text type="warning">
          <Tag color="orange">不处理</Tag>未配置「本地路径」，不会生成 STRM
          或下载
        </Text>
      );
    case 'invalid-rules':
      return (
        <Text type="danger">
          <Tag color="red">规则错误</Tag>「过滤规则」不是有效的 JSON，无法模拟
        </Text>
      );
    case 'skip':
      return (
        <Text type="secondary">
          <Tag>跳过</Tag>该扩展名不在 include/download 过滤规则中，不会处理
        </Text>
      );
    case 'download':
      return (
        <div>
          <div style={{ marginBottom: 4 }}>
            <Tag color="blue">下载</Tag>命中 download 规则，会下载到本地（不生成
            STRM）
          </div>
          <Text type="secondary">本地文件：</Text>
          <Paragraph
            copyable={{ text: result.target }}
            style={{ marginBottom: 0 }}
          >
            <Text code>{result.target}</Text>
          </Paragraph>
        </div>
      );
    case 'strm':
      return (
        <div>
          <div style={{ marginBottom: 4 }}>
            <Tag color="green">生成 STRM</Tag>
          </div>
          <Text type="secondary">本地 STRM 文件：</Text>
          <Paragraph
            copyable={{ text: result.target }}
            style={{ marginBottom: 8 }}
          >
            <Text code>{result.target}</Text>
          </Paragraph>
          <Text type="secondary">STRM 文件内容：</Text>
          <Paragraph
            copyable={{ text: result.content }}
            style={{ marginBottom: 0 }}
          >
            <Text code>{result.content}</Text>
          </Paragraph>
        </div>
      );
    default:
      return null;
  }
};

/**
 * STRM 效果预览：输入一个云盘源文件完整路径，实时展示将生成的本地 STRM 文件路径与内容。
 * 需放置在 ProForm/ModalForm 内部（依赖表单中的 local_path / content_prefix / content_encode_uri / filter_rules）。
 */
const StrmPreview: React.FC = () => {
  const [sample, setSample] = useState('');

  return (
    <div
      style={{
        marginTop: 8,
        paddingTop: 12,
        borderTop: '1px dashed #d9d9d9',
      }}
    >
      <div style={{ marginBottom: 8 }}>
        <Text strong>效果预览</Text>
        <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
          输入一个云盘源文件完整路径，查看将生成的 STRM 结果
        </Text>
      </div>
      <ProFormDependency
        name={[
          'source_path',
          'local_path',
          'content_prefix',
          'content_encode_uri',
          'filter_rules',
        ]}
      >
        {({
          source_path,
          local_path,
          content_prefix,
          content_encode_uri,
          filter_rules,
        }) => {
          const placeholder = `如：${(source_path || '/电影/动作片').replace(/\/+$/, '')}/示例电影.mkv`;
          const result = simulate({
            samplePath: sample,
            localPath: local_path,
            contentPrefix: content_prefix,
            contentEncodeURI: content_encode_uri,
            filterRules: filter_rules,
          });
          return (
            <>
              <Input
                allowClear
                value={sample}
                placeholder={placeholder}
                onChange={(e) => setSample(e.target.value)}
                style={{ marginBottom: 10 }}
              />
              <div
                style={{
                  background: '#fafafa',
                  border: '1px solid #f0f0f0',
                  borderRadius: 6,
                  padding: '10px 12px',
                  wordBreak: 'break-all',
                }}
              >
                <ResultView result={result} />
              </div>
            </>
          );
        }}
      </ProFormDependency>
    </div>
  );
};

export default StrmPreview;
