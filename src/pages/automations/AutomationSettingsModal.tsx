import { Alert, AutoComplete, Form, InputNumber, Modal, Switch } from 'antd';
import { useState } from 'react';
import type { AutomationSettings } from '@/services/film-fusion';
import styles from './Management.module.less';

export default function AutomationSettingsModal({
  settings,
  groups,
  onCancel,
  onSave,
}: {
  settings: AutomationSettings;
  groups: string[];
  onCancel: () => void;
  onSave: (settings: AutomationSettings) => Promise<void>;
}) {
  const [form] = Form.useForm<AutomationSettings>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const enabled = Form.useWatch('alerts_enabled', form);
  const save = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      setError('');
      await onSave({ ...settings, ...values });
    } catch (cause: any) {
      if (!cause?.errorFields)
        setError(cause?.data || cause?.message || '保存设置失败');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open
      title="分组与异常提醒"
      onCancel={onCancel}
      onOk={save}
      confirmLoading={saving}
      okText="保存设置"
      cancelText="取消"
      mask={{ closable: !saving }}
    >
      <Form form={form} layout="vertical" initialValues={settings}>
        <Form.Item name="group_name" label="所属分组" rules={[{ max: 80 }]}>
          <AutoComplete
            options={groups.map((value) => ({ value }))}
            placeholder="选择或输入分组，留空为未分组"
          />
        </Form.Item>
        <Form.Item
          name="alerts_enabled"
          label="启用异常提醒"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
        <div className={styles.grid}>
          <Form.Item
            name="failure_threshold"
            label="连续失败次数"
            rules={[{ required: true }]}
          >
            <InputNumber
              min={1}
              max={100}
              disabled={!enabled}
              className={styles.wide}
            />
          </Form.Item>
          <Form.Item
            name="stuck_minutes"
            label="节点执行超时（分钟）"
            rules={[{ required: true }]}
          >
            <InputNumber
              min={1}
              max={43200}
              disabled={!enabled}
              className={styles.wide}
            />
          </Form.Item>
        </div>
        <Form.Item
          name="source_errors"
          label="来源检查失败时提醒"
          valuePropName="checked"
        >
          <Switch disabled={!enabled} />
        </Form.Item>
        <Form.Item
          name="cooldown_minutes"
          label="同类提醒间隔（分钟）"
          rules={[{ required: true }]}
        >
          <InputNumber
            min={1}
            max={43200}
            disabled={!enabled}
            className={styles.wide}
          />
        </Form.Item>
        <Alert
          type="info"
          showIcon
          title="使用系统设置中的自动化通知渠道"
          description="每分钟检查一次；流程停用后停止提醒。计划中的延迟和等待不算执行超时。问题恢复后会自动清除异常状态。"
        />
        {error && <Alert type="error" title={error} showIcon />}
      </Form>
    </Modal>
  );
}
