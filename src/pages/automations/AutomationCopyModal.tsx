import { Alert, Button, Form, Input, Modal, Select } from 'antd';
import { useMemo, useRef, useState } from 'react';
import type {
  AutomationCreateInput,
  AutomationTarget,
} from '@/services/film-fusion';
import AutomationParametersModal from './AutomationParametersModal';
import styles from './Management.module.less';
import {
  bindingLabels,
  collectAutomationBindings,
  replaceAutomationBindings,
} from './management';

type Props = {
  input: AutomationCreateInput;
  title?: string;
  cloudStorages: API.CloudStorage[];
  cloudDirectories: API.CloudDirectory[];
  targets: AutomationTarget[];
  onCancel: () => void;
  onSubmit: (input: AutomationCreateInput) => Promise<void>;
};

export default function AutomationCopyModal({
  input: initialInput,
  title = '复制自动化',
  cloudStorages,
  cloudDirectories,
  targets,
  onCancel,
  onSubmit,
}: Props) {
  const [input, setInput] = useState(initialInput);
  const [parametersOpen, setParametersOpen] = useState(false);
  const [form] = Form.useForm();
  const [replacements, setReplacements] = useState<
    Record<string, string | number>
  >({});
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState('');
  const bindings = useMemo(() => collectAutomationBindings(input), [input]);
  const submit = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setError('');
    try {
      const values = await form.validateFields();
      const copy = replaceAutomationBindings(input, replacements);
      copy.source.name = values.name.trim();
      copy.workflow.name = values.name.trim();
      if (copy.source.trigger_type === 'rss')
        copy.source.feed_url = values.feed_url.trim();
      copy.source.enabled = copy.workflow.enabled = false;
      setSaving(true);
      await onSubmit(copy);
    } catch (cause: any) {
      if (!cause?.errorFields)
        setError(cause?.data || cause?.message || '创建副本失败');
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };
  return (
    <Modal
      open
      title={title}
      width={760}
      onCancel={onCancel}
      onOk={submit}
      okText="创建并编辑"
      cancelText="取消"
      confirmLoading={saving}
      closable={!saving}
      mask={{ closable: !saving }}
      cancelButtonProps={{ disabled: saving }}
    >
      <div className={styles.stack}>
        <Alert
          type="info"
          showIcon
          title="检查来源和资源绑定"
          description="相同配置会一起替换。新流程默认停用，创建后可继续修改节点，再启用运行。"
        />
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            name: input.source.name,
            feed_url: input.source.feed_url,
          }}
        >
          <Form.Item
            label="新流程名称"
            name="name"
            rules={[
              { required: true, whitespace: true, message: '请输入流程名称' },
              { max: 120 },
            ]}
          >
            <Input />
          </Form.Item>
          {input.source.trigger_type === 'rss' && (
            <Form.Item
              label="RSS 地址"
              name="feed_url"
              rules={[
                { required: true, message: '请输入 RSS 地址' },
                { type: 'url', message: '请输入完整的 HTTP/HTTPS 地址' },
              ]}
            >
              <Input />
            </Form.Item>
          )}
        </Form>
        {bindings.map((binding) => {
          const label = `${bindingLabels[binding.field]} · ${binding.locations.map((location) => location.label).join('、')}`;
          const value = replacements[binding.key] ?? binding.value;
          const options:
            | { label: string; value: string | number; disabled?: boolean }[]
            | undefined =
            binding.field === 'channel'
              ? [
                  { label: '系统默认通知渠道', value: 'default' },
                  { label: 'Telegram', value: 'telegram' },
                  { label: 'Webhook', value: 'webhook' },
                ]
              : binding.field === 'cloud_storage_id'
                ? cloudStorages.map((item) => ({
                    label: item.storage_name,
                    value: item.id,
                    disabled: item.status !== 'active',
                  }))
                : binding.field === 'target_id'
                  ? targets.map((item) => ({
                      label: item.name,
                      value: item.id,
                      disabled: !item.enabled,
                    }))
                  : binding.field === 'cloud_directory_id'
                    ? cloudDirectories.map((item) => ({
                        label: item.directory_name,
                        value: item.id,
                      }))
                    : undefined;
          return (
            <div className={styles.field} key={binding.key}>
              <span>{label}</span>
              {options ? (
                <Select
                  aria-label={label}
                  className={styles.wide}
                  value={
                    binding.field === 'channel'
                      ? String(value || 'default')
                      : Number(value) || undefined
                  }
                  options={options}
                  showSearch={{ optionFilterProp: 'label' }}
                  placeholder="请选择"
                  onChange={(next) =>
                    setReplacements((current) => ({
                      ...current,
                      [binding.key]: next,
                    }))
                  }
                />
              ) : (
                <Input
                  aria-label={label}
                  value={String(value)}
                  onChange={(event) =>
                    setReplacements((current) => ({
                      ...current,
                      [binding.key]: event.target.value,
                    }))
                  }
                />
              )}
            </div>
          );
        })}
        {Object.keys(input.workflow.definition.parameters || {}).length > 0 && (
          <p className={styles.hint}>
            已保留流程参数，绑定的参数会随资源替换一起更新。创建后可在“流程参数”中继续调整。
          </p>
        )}
        <Button
          onClick={() => {
            setInput(replaceAutomationBindings(input, replacements));
            setReplacements({});
            setParametersOpen(true);
          }}
        >
          调整流程参数
        </Button>
        {parametersOpen && (
          <AutomationParametersModal
            definition={input.workflow.definition}
            onCancel={() => setParametersOpen(false)}
            onSave={async (definition) => {
              setInput((current) => ({
                ...current,
                workflow: { ...current.workflow, definition },
              }));
              setReplacements({});
              setParametersOpen(false);
            }}
          />
        )}
        {error && <Alert type="error" showIcon title={error} />}
      </div>
    </Modal>
  );
}
