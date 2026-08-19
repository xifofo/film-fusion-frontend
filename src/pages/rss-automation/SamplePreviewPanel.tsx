import { CheckCircleOutlined } from '@ant-design/icons';
import { Select, Tag, Typography } from 'antd';
import type {
  RSSAutomationDefinition,
  RSSAutomationParsedFeed,
} from '@/services/film-fusion';
import styles from './index.module.less';
import type { RSSAutomationFlowPreview } from './preview';

const { Paragraph, Text } = Typography;

type SamplePreviewPanelProps = {
  definition: RSSAutomationDefinition;
  feed: RSSAutomationParsedFeed;
  itemIndex: number;
  onItemChange: (index: number) => void;
  preview: RSSAutomationFlowPreview;
};

const displayValue = (value: unknown) => {
  if (value == null || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const SamplePreviewPanel = ({
  definition,
  feed,
  itemIndex,
  onItemChange,
  preview,
}: SamplePreviewPanelProps) => {
  const item = feed.items[itemIndex]?.fields || {};
  const activeNames = preview.activeNodeIds
    .map((id) => definition.nodes.find((node) => node.id === id)?.name)
    .filter(Boolean);
  const fields = Object.entries(item);
  const variables = Object.entries(preview.variables);
  const activePath = activeNames.join(' → ') || '请先连接流程节点';

  return (
    <div className={styles.samplePreviewPanel}>
      <Select
        aria-label="选择流程预览样本"
        className={styles.previewItemSelect}
        onChange={onItemChange}
        options={feed.items.map((entry, index) => ({
          label: `${index + 1}. ${String(entry.fields.title || `样本 ${index + 1}`)}`,
          value: index,
        }))}
        showSearch={{ optionFilterProp: 'label' }}
        value={itemIndex}
      />

      <div className={styles.previewPath}>
        <CheckCircleOutlined />
        <div className={styles.previewPathBody}>
          <Text className={styles.previewPathLabel} type="secondary">
            预计经过 {activeNames.length} 个节点
          </Text>
          <Text className={styles.previewPathText} title={activePath}>
            {activePath}
          </Text>
        </div>
      </div>

      {variables.length > 0 && (
        <div className={styles.previewSection}>
          <div className={styles.previewSectionHeading}>
            <Text className={styles.previewSectionLabel} type="secondary">
              流程变量
            </Text>
            <Text className={styles.previewSectionCount} type="secondary">
              {variables.length}
            </Text>
          </div>
          <div className={styles.previewVariableList}>
            {variables.map(([name, value]) => (
              <Tag color="green" icon={<CheckCircleOutlined />} key={name}>
                {name} = {displayValue(value)}
              </Tag>
            ))}
          </div>
        </div>
      )}

      <div className={styles.previewSection}>
        <div className={styles.previewSectionHeading}>
          <Text className={styles.previewSectionLabel} type="secondary">
            RSS 字段
          </Text>
          <Text className={styles.previewSectionCount} type="secondary">
            {fields.length}
          </Text>
        </div>
        <div className={styles.previewFieldList}>
          {fields.map(([name, value]) => (
            <div className={styles.previewField} key={name}>
              <Text className={styles.previewFieldName} code title={name}>
                {name}
              </Text>
              <Paragraph
                copyable
                ellipsis={{ rows: 1, expandable: true }}
                title={displayValue(value)}
              >
                {displayValue(value)}
              </Paragraph>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SamplePreviewPanel;
