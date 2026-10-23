import { Button, Select } from 'antd';
import {
  type UpgradeCondition,
  upgradeAudioLanguageLabels,
  upgradeSubtitleLabels,
} from '@/services/film-fusion/upgrade';

type ConditionOp = UpgradeCondition['op'];
type ConditionField = NonNullable<UpgradeCondition['field']>;

const MAX_EDITOR_DEPTH = 5;
const operators: Array<{ value: ConditionOp; label: string }> = [
  { value: 'match', label: '匹配条件' },
  { value: 'all', label: '全部满足（AND）' },
  { value: 'any', label: '任一满足（OR）' },
  { value: 'not', label: '不满足（NOT）' },
];
const fields: Array<{ value: ConditionField; label: string }> = [
  { value: 'resolution', label: '分辨率' },
  { value: 'source', label: '片源' },
  { value: 'codec', label: '视频编码' },
  { value: 'effect', label: '效果标记' },
  { value: 'group', label: '发布组' },
  { value: 'name', label: '文件名' },
  { value: 'audio_codec', label: '音频编码标记' },
  { value: 'audio_channels', label: '声道标记' },
  { value: 'audio_language', label: '音轨语言标记' },
  { value: 'subtitle', label: '字幕标记' },
];
const suggestions: Partial<Record<ConditionField, string[]>> = {
  resolution: ['4320p', '2160p', '1080p', '1080i', '720p', '576p', '480p'],
  source: ['REMUX', 'BluRay', 'BDRip', 'WEB-DL', 'WEBRip', 'HDTV', 'DVD'],
  codec: ['H.264', 'H.265', 'AV1', 'VC-1'],
  effect: [
    'Dolby Vision',
    'HDR10+',
    'HDR10',
    'HDR',
    'SDR',
    'HLG',
    'IMAX',
    'PROPER',
    'REPACK',
  ],
  audio_codec: [
    'TrueHD',
    'DTS-HD MA',
    'DTS-HD HRA',
    'DTS-HD',
    'DTS:X',
    'DTS',
    'E-AC-3',
    'AC-3',
    'DDP',
    'DD+',
    'DD',
    'AAC',
    'FLAC',
    'LPCM',
    'PCM',
    'MP3',
    'Opus',
    'Vorbis',
  ],
  audio_channels: ['7.1', '5.1', '2.0', '1.0'],
  audio_language: ['zh', 'en', 'ja', 'ko', 'yue'],
  subtitle: ['zh-Hans', 'zh-Hant', 'zh', 'en', 'ja', 'ko'],
};

function newCondition(op: ConditionOp): UpgradeCondition {
  const leaf: UpgradeCondition = {
    op: 'match',
    field: 'resolution',
    match: 'equals',
    values: [],
  };
  return op === 'match' ? leaf : { op, children: [leaf] };
}

function AddConditionButtons({
  label,
  depth,
  disabled,
  onAdd,
}: {
  label: string;
  depth: number;
  disabled?: boolean;
  onAdd: (condition: UpgradeCondition) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {operators.map(({ value: op, label: operatorLabel }) => {
        const action = op === 'match' ? '添加匹配条件' : `添加${operatorLabel}`;
        return (
          <Button
            key={op}
            size="small"
            htmlType="button"
            aria-label={`${label}${action}`}
            disabled={
              disabled ||
              depth > MAX_EDITOR_DEPTH ||
              (op !== 'match' && depth >= MAX_EDITOR_DEPTH)
            }
            onClick={() => onAdd(newCondition(op))}
          >
            {action}
          </Button>
        );
      })}
    </div>
  );
}

function ConditionNode({
  value,
  onChange,
  onRemove,
  disabled,
  label,
  depth,
}: {
  value: UpgradeCondition;
  onChange: (value: UpgradeCondition) => void;
  onRemove: () => void;
  disabled?: boolean;
  label: string;
  depth: number;
}) {
  const children = value.children || [];
  const isMatch = value.op === 'match';
  const field = value.field || 'resolution';
  const match = value.match || 'equals';
  return (
    <fieldset className="m-0 min-w-0 space-y-3 rounded-md border border-border p-3">
      <legend className="px-1 text-xs text-muted-foreground">{label}</legend>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select<ConditionOp>
          aria-label={`${label}组合方式`}
          value={value.op}
          disabled={disabled}
          style={{ width: 190, maxWidth: '100%' }}
          options={operators
            .filter((operator) => isMatch || operator.value !== 'match')
            .map((operator) => ({
              ...operator,
              disabled: isMatch
                ? operator.value !== 'match' && depth >= MAX_EDITOR_DEPTH
                : operator.value === 'not' && children.length > 1,
            }))}
          onChange={(op) => {
            if (op === value.op) return;
            onChange({ op, children: isMatch ? [value] : children });
          }}
        />
        <Button
          size="small"
          htmlType="button"
          danger
          aria-label={`删除${label}`}
          disabled={disabled}
          onClick={onRemove}
        >
          删除条件
        </Button>
      </div>
      {isMatch ? (
        <>
          <div className="flex min-w-0 flex-wrap gap-2">
            <Select<ConditionField>
              aria-label={`${label}字段`}
              value={field}
              disabled={disabled}
              options={fields}
              style={{ flex: '1 1 150px', minWidth: 0 }}
              onChange={(nextField) =>
                onChange({ ...value, field: nextField, values: [] })
              }
            />
            <Select<NonNullable<UpgradeCondition['match']>>
              aria-label={`${label}匹配方式`}
              value={match}
              disabled={disabled}
              options={[
                { value: 'equals', label: '等于' },
                { value: 'contains', label: '包含' },
                { value: 'regex', label: '正则表达式' },
              ]}
              style={{ flex: '1 1 130px', minWidth: 0 }}
              onChange={(nextMatch) => onChange({ ...value, match: nextMatch })}
            />
          </div>
          <Select<string[]>
            aria-label={`${label}匹配值`}
            mode="tags"
            showSearch={{ optionFilterProp: 'label' }}
            value={value.values || []}
            disabled={disabled}
            style={{ width: '100%' }}
            placeholder={
              match === 'regex'
                ? '输入表达式后按回车'
                : '选择或输入匹配值后按回车'
            }
            options={(match === 'regex' ? [] : suggestions[field] || []).map(
              (item) => ({
                label:
                  (field === 'audio_language'
                    ? upgradeAudioLanguageLabels[item]
                    : field === 'subtitle'
                      ? upgradeSubtitleLabels[item]
                      : undefined) || item,
                value: item,
              }),
            )}
            onChange={(values) => onChange({ ...value, values })}
          />
          {match === 'regex' && (
            <p className="m-0 text-xs text-muted-foreground">
              正则采用 Go RE2 语法，默认区分大小写；可使用 (?i) 忽略大小写。
            </p>
          )}
        </>
      ) : (
        <>
          <p className="m-0 text-xs text-muted-foreground">
            {value.op === 'not'
              ? '仅允许 1 个子条件；该条件不成立时匹配。'
              : value.op === 'all'
                ? '以下子条件必须全部成立。'
                : '以下任意一个子条件成立即可。'}
          </p>
          {children.map((child, index) => {
            const childLabel = `${label}.${index + 1}`;
            return (
              <ConditionNode
                key={childLabel}
                value={child}
                label={childLabel}
                depth={depth + 1}
                disabled={disabled}
                onChange={(nextChild) =>
                  onChange({
                    ...value,
                    children: children.map((item, childIndex) =>
                      childIndex === index ? nextChild : item,
                    ),
                  })
                }
                onRemove={() =>
                  onChange({
                    ...value,
                    children: children.filter(
                      (_, childIndex) => childIndex !== index,
                    ),
                  })
                }
              />
            );
          })}
          {children.length === 0 && (
            <p className="m-0 text-xs text-muted-foreground">
              暂无子条件，请添加匹配条件或条件组。
            </p>
          )}
          <AddConditionButtons
            label={label}
            depth={depth + 1}
            disabled={disabled || (value.op === 'not' && children.length >= 1)}
            onAdd={(child) =>
              onChange({ ...value, children: [...children, child] })
            }
          />
          {depth >= MAX_EDITOR_DEPTH - 1 && (
            <p className="m-0 text-xs text-muted-foreground">
              编辑器最多新增到 5 层；已有的更深条件仍可编辑或删除。
            </p>
          )}
        </>
      )}
    </fieldset>
  );
}

export default function UpgradeConditionEditor({
  value,
  onChange,
  disabled = false,
  label = '组合条件',
}: {
  value?: UpgradeCondition;
  onChange: (value?: UpgradeCondition) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <p className="m-0 text-xs text-muted-foreground">
        匹配文件名中识别出的标记；音轨和字幕条件不代表对媒体内容的实测。
      </p>
      {value ? (
        <ConditionNode
          value={value}
          label={label}
          depth={1}
          disabled={disabled}
          onChange={onChange}
          onRemove={() => onChange(undefined)}
        />
      ) : (
        <>
          <p className="m-0 text-xs text-muted-foreground">
            未设置组合条件，可添加单个匹配条件或嵌套条件组。
          </p>
          <AddConditionButtons
            label={label}
            depth={1}
            disabled={disabled}
            onAdd={onChange}
          />
        </>
      )}
    </div>
  );
}
