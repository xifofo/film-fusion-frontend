import { Steps } from 'antd';
import styles from './Editor.module.less';

const AutomationSteps = ({
  current,
  trigger,
}: {
  current: number;
  trigger: string;
}) => (
  <div className={styles.steps}>
    <div className={styles.stepContext}>
      <span>{trigger}</span>
      <span>第 {current + 1} 步，共 3 步</span>
    </div>
    <Steps
      current={current}
      items={[
        { title: '配置触发器', content: '确定来源与检查频率' },
        { title: '设计流程', content: '安排发现内容后的操作' },
        { title: '确认启用', content: '检查配置并保存' },
      ]}
      size="small"
    />
  </div>
);

export default AutomationSteps;
