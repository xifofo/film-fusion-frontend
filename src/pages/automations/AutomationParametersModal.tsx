import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Alert, Button, Input, InputNumber, Modal, Select, Switch } from 'antd';
import { useState } from 'react';
import type { AutomationDefinition } from '@/services/film-fusion';
import styles from './Management.module.less';
import {
  parameterFieldLabels,
  resolveDefinitionParameters,
  validateParameters,
} from './management';

type ParameterRow = {
  id: number;
  name: string;
  type: 'string' | 'number' | 'boolean';
  value: string | number | boolean;
};
type BindingRow = {
  id: number;
  nodeID: string;
  field: string;
  parameter: string;
};
type Props = {
  definition: AutomationDefinition;
  onCancel: () => void;
  onSave: (definition: AutomationDefinition) => Promise<void>;
};

export default function AutomationParametersModal({
  definition,
  onCancel,
  onSave,
}: Props) {
  const [parameters, setParameters] = useState<ParameterRow[]>(() =>
    Object.entries(definition.parameters || {}).map(([name, value], id) => ({
      id,
      name,
      value,
      type: typeof value as ParameterRow['type'],
    })),
  );
  const [bindings, setBindings] = useState<BindingRow[]>(() =>
    definition.nodes
      .flatMap((node) =>
        Object.entries(node.parameter_bindings || {}).map(
          ([field, parameter]) => ({
            id: 0,
            nodeID: node.id,
            field,
            parameter,
          }),
        ),
      )
      .map((row, id) => ({ ...row, id })),
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setError('');
    try {
      const names = parameters.map((row) => row.name.trim());
      if (new Set(names).size !== names.length)
        throw new Error('参数名称不能重复');
      const next = structuredClone(definition);
      next.parameters = Object.fromEntries(
        parameters.map((row) => [row.name.trim(), row.value]),
      );
      validateParameters(next.parameters);
      // Removing a binding keeps its last resolved value as a regular field.
      const previous = resolveDefinitionParameters(definition);
      for (const node of next.nodes) {
        for (const field of Object.keys(node.parameter_bindings || {})) {
          node.config = {
            ...node.config,
            [field]: previous.nodes.find((item) => item.id === node.id)
              ?.config?.[field],
          };
        }
        node.parameter_bindings = {};
      }
      const used = new Set<string>();
      for (const binding of bindings) {
        const node = next.nodes.find((item) => item.id === binding.nodeID);
        if (!node || !binding.field || !binding.parameter)
          throw new Error('请完整选择节点、字段和参数');
        const key = `${binding.nodeID}.${binding.field}`;
        if (used.has(key)) throw new Error('同一个节点字段只能绑定一次');
        used.add(key);
        node.parameter_bindings = {
          ...node.parameter_bindings,
          [binding.field]: binding.parameter,
        };
      }
      resolveDefinitionParameters(next);
      setSaving(true);
      await onSave(next);
    } catch (cause: any) {
      setError(cause?.data || cause?.message || '保存参数失败');
    } finally {
      setSaving(false);
    }
  };
  const changeParameter = (id: number, patch: Partial<ParameterRow>) =>
    setParameters((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  const changeBinding = (id: number, patch: Partial<BindingRow>) =>
    setBindings((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  return (
    <Modal
      open
      title="流程参数"
      width={860}
      onCancel={onCancel}
      onOk={save}
      confirmLoading={saving}
      okText="保存参数"
      cancelText="取消"
      mask={{ closable: !saving }}
      cancelButtonProps={{ disabled: saving }}
    >
      <div className={styles.stack}>
        <Alert
          type="info"
          title="集中修改节点配置"
          description="为账号、目录、分类等定义参数，再绑定到节点字段。文本字段也可使用 $params.参数名 或 {{params.参数名}}。保存时会校验整个流程。"
          showIcon
        />
        {parameters.map((row) => (
          <div className={styles.parameter} key={row.id}>
            <Input
              aria-label={`参数名称 ${row.id + 1}`}
              placeholder="例如 download_path"
              value={row.name}
              onChange={(e) =>
                changeParameter(row.id, { name: e.target.value })
              }
            />
            <Select
              aria-label={`参数类型 ${row.id + 1}`}
              value={row.type}
              options={[
                { value: 'string', label: '文本' },
                { value: 'number', label: '数字' },
                { value: 'boolean', label: '开关' },
              ]}
              onChange={(type) =>
                changeParameter(row.id, {
                  type,
                  value:
                    type === 'number' ? 0 : type === 'boolean' ? false : '',
                })
              }
            />
            {row.type === 'number' ? (
              <InputNumber
                className={styles.wide}
                aria-label={`参数值 ${row.id + 1}`}
                value={Number(row.value)}
                onChange={(value) =>
                  changeParameter(row.id, { value: value ?? 0 })
                }
              />
            ) : row.type === 'boolean' ? (
              <Switch
                aria-label={`参数值 ${row.id + 1}`}
                checked={Boolean(row.value)}
                onChange={(value) => changeParameter(row.id, { value })}
              />
            ) : (
              <Input
                aria-label={`参数值 ${row.id + 1}`}
                value={String(row.value)}
                onChange={(e) =>
                  changeParameter(row.id, { value: e.target.value })
                }
              />
            )}
            <Button
              aria-label={`删除参数 ${row.id + 1}`}
              icon={<DeleteOutlined />}
              onClick={() =>
                setParameters((current) =>
                  current.filter((item) => item.id !== row.id),
                )
              }
            />
          </div>
        ))}
        <Button
          icon={<PlusOutlined />}
          onClick={() =>
            setParameters((current) => [
              ...current,
              {
                id: Math.max(-1, ...current.map((row) => row.id)) + 1,
                name: '',
                type: 'string',
                value: '',
              },
            ])
          }
        >
          添加参数
        </Button>
        <strong>节点字段绑定</strong>
        {bindings.map((binding) => {
          const node = definition.nodes.find(
            (item) => item.id === binding.nodeID,
          );
          const fields = Object.entries(node?.config || {})
            .filter(([, value]) =>
              ['string', 'number', 'boolean'].includes(typeof value),
            )
            .map(([field]) => field);
          if (node?.type === 'notification' && !fields.includes('channel'))
            fields.push('channel');
          return (
            <div className={styles.binding} key={binding.id}>
              <Select
                aria-label={`绑定节点 ${binding.id + 1}`}
                placeholder="选择节点"
                value={binding.nodeID || undefined}
                options={definition.nodes
                  .filter(
                    (item) => item.type !== 'trigger' && item.type !== 'end',
                  )
                  .map((item) => ({
                    value: item.id,
                    label: item.name || item.type,
                  }))}
                onChange={(nodeID) =>
                  changeBinding(binding.id, { nodeID, field: '' })
                }
              />
              <div className={styles.row}>
                <Select
                  style={{ flex: 1 }}
                  aria-label={`绑定字段 ${binding.id + 1}`}
                  placeholder="选择配置字段"
                  value={binding.field || undefined}
                  options={fields.map((field) => ({
                    value: field,
                    label: parameterFieldLabels[field] || field,
                  }))}
                  onChange={(field) => changeBinding(binding.id, { field })}
                />
                <span>引用</span>
                <Select
                  style={{ flex: 1 }}
                  aria-label={`绑定参数 ${binding.id + 1}`}
                  placeholder="选择参数"
                  value={binding.parameter || undefined}
                  options={parameters
                    .filter((row) => row.name.trim())
                    .map((row) => ({
                      value: row.name.trim(),
                      label: row.name.trim(),
                    }))}
                  onChange={(parameter) =>
                    changeBinding(binding.id, { parameter })
                  }
                />
                <Button
                  aria-label={`删除绑定 ${binding.id + 1}`}
                  icon={<DeleteOutlined />}
                  onClick={() =>
                    setBindings((current) =>
                      current.filter((row) => row.id !== binding.id),
                    )
                  }
                />
              </div>
            </div>
          );
        })}
        <Button
          icon={<PlusOutlined />}
          onClick={() =>
            setBindings((current) => [
              ...current,
              {
                id: Math.max(-1, ...current.map((row) => row.id)) + 1,
                nodeID: '',
                field: '',
                parameter: '',
              },
            ])
          }
        >
          添加字段绑定
        </Button>
        {error && <Alert type="error" title={error} showIcon />}
      </div>
    </Modal>
  );
}
