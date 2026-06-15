import { ProFormDependency } from '@ant-design/pro-components';
import { Input, Tag, Typography } from 'antd';
import React, { useState } from 'react';
import { buildStrmInfo, extOf } from '@/utils/strmPath';

const { Text, Paragraph } = Typography;

// 解析「包含/排除后缀」（支持 JSON 数组或逗号/空格分隔），统一为去点小写
function parseExts(raw?: string): string[] {
  if (!raw) return [];
  const t = raw.trim();
  if (!t) return [];
  const norm = (s: string) => s.trim().toLowerCase().replace(/^\./, '');
  try {
    const arr = JSON.parse(t);
    if (Array.isArray(arr)) {
      return arr.map((x) => norm(String(x))).filter(Boolean);
    }
  } catch {
    // 非 JSON，按分隔符解析
  }
  return t
    .split(/[,;|\s]+/)
    .map(norm)
    .filter(Boolean);
}

// 复刻后端 shouldProcessFileByExtensions
function shouldProcess(
  ext: string,
  include: string[],
  exclude: string[],
): boolean {
  if (ext === '') return include.length === 0;
  if (include.length > 0 && !include.includes(ext)) return false;
  if (exclude.length > 0 && exclude.includes(ext)) return false;
  return true;
}

type SimResult =
  | { kind: 'no-input' }
  | { kind: 'no-save' }
  | { kind: 'skip' }
  | { kind: 'strm'; target: string; content: string };

function simulate(opts: {
  samplePath: string;
  savePath?: string;
  contentPrefix?: string;
  contentEncodeURI?: boolean;
  includeExtensions?: string;
  excludeExtensions?: string;
}): SimResult {
  const path = (opts.samplePath || '').trim();
  if (!path) return { kind: 'no-input' };
  if (!opts.savePath || !opts.savePath.trim()) return { kind: 'no-save' };

  const ext = extOf(path).toLowerCase().replace(/^\./, '');
  const include = parseExts(opts.includeExtensions);
  const exclude = parseExts(opts.excludeExtensions);
  if (!shouldProcess(ext, include, exclude)) return { kind: 'skip' };

  const { strmPath, content } = buildStrmInfo(
    opts.savePath,
    opts.contentPrefix || '',
    path,
    !!opts.contentEncodeURI,
  );
  return { kind: 'strm', target: strmPath, content };
}

const ResultView: React.FC<{ result: SimResult }> = ({ result }) => {
  switch (result.kind) {
    case 'no-input':
      return <Text type="secondary">输入目标文件相对路径后查看模拟结果</Text>;
    case 'no-save':
      return (
        <Text type="warning">
          <Tag color="orange">不处理</Tag>未配置「保存路径」，不会生成 STRM
        </Text>
      );
    case 'skip':
      return (
        <Text type="secondary">
          <Tag>跳过</Tag>该扩展名被「包含/排除后缀」规则过滤，不会生成 STRM
        </Text>
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
 * 目录配置 STRM 效果预览：输入一个目标文件相对路径，实时展示将生成的本地 STRM 文件路径与内容。
 * 需放置在 ProForm/ModalForm 内部（依赖 save_path / content_prefix / content_encode_uri / include_extensions / exclude_extensions）。
 */
const DirectoryStrmPreview: React.FC = () => {
  const [sample, setSample] = useState('');

  return (
    <div
      style={{ marginTop: 8, paddingTop: 12, borderTop: '1px dashed #d9d9d9' }}
    >
      <div style={{ marginBottom: 8 }}>
        <Text strong>效果预览</Text>
        <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
          输入一个目标文件相对路径，查看将生成的 STRM 结果
        </Text>
      </div>
      <ProFormDependency
        name={[
          'directory_name',
          'save_path',
          'content_prefix',
          'content_encode_uri',
          'include_extensions',
          'exclude_extensions',
        ]}
      >
        {({
          directory_name,
          save_path,
          content_prefix,
          content_encode_uri,
          include_extensions,
          exclude_extensions,
        }) => {
          const dir = String(directory_name || '电影').replace(
            /^\/+|\/+$/g,
            '',
          );
          const placeholder = `如：/${dir}/某电影 (2020)/某电影.mkv`;
          const result = simulate({
            samplePath: sample,
            savePath: save_path,
            contentPrefix: content_prefix,
            contentEncodeURI: content_encode_uri,
            includeExtensions: include_extensions,
            excludeExtensions: exclude_extensions,
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

export default DirectoryStrmPreview;
