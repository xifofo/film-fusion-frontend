import {
  DownloadOutlined,
  PlusOutlined,
  ReloadOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Spin,
  Tag,
} from 'antd';
import { useEffect, useRef, useState } from 'react';
import type {
  AutomationCreateInput,
  AutomationTemplate,
} from '@/services/film-fusion';
import {
  deleteAutomationTemplate,
  getAutomationTemplates,
  saveAutomationTemplate,
} from '@/services/film-fusion';
import styles from './Management.module.less';
import {
  portableAutomationTemplate,
  readTemplateConfiguration,
} from './management';

export function SaveAutomationTemplateModal({
  input,
  template,
  onCancel,
  onSaved,
}: {
  input: AutomationCreateInput;
  template?: AutomationTemplate;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      setError('');
      const response = await saveAutomationTemplate(
        { ...values, configuration: input },
        template?.id,
      );
      if (response.code !== 0 || !response.data)
        throw new Error(response.message || '保存模板失败');
      onSaved();
    } catch (cause: any) {
      if (!cause?.errorFields)
        setError(cause?.data || cause?.message || '保存模板失败');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open
      title={template ? '编辑模板' : '保存为模板'}
      onCancel={onCancel}
      onOk={save}
      confirmLoading={saving}
      okText="保存模板"
      cancelText="取消"
      mask={{ closable: !saving }}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          name: template?.name || input.workflow.name,
          description: template?.description || input.workflow.description,
        }}
      >
        <Form.Item
          label="模板名称"
          name="name"
          rules={[
            { required: true, whitespace: true, message: '请输入模板名称' },
            { max: 120 },
          ]}
        >
          <Input placeholder="例如 动漫下载" />
        </Form.Item>
        <Form.Item label="用途说明" name="description">
          <Input.TextArea rows={3} />
        </Form.Item>
        <p className={styles.hint}>
          模板保存在服务器，保留节点和参数；使用模板时可统一调整账号和目录。
        </p>
        {error && <Alert type="error" title={error} showIcon />}
      </Form>
    </Modal>
  );
}

export default function AutomationTemplates({
  onUse,
  refreshKey = 0,
}: {
  onUse: (input: AutomationCreateInput, name: string) => void;
  refreshKey?: number;
}) {
  const [templates, setTemplates] = useState<AutomationTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [visit, setVisit] = useState(0);
  const [editing, setEditing] = useState<{
    input: AutomationCreateInput;
    template?: AutomationTemplate;
  }>();
  const [removing, setRemoving] = useState<number>();
  const upload = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getAutomationTemplates()
      .then((response) => {
        if (response.code !== 0 || !response.data)
          throw new Error(response.message || '加载模板失败');
        if (active) setTemplates(response.data);
      })
      .catch((cause) => {
        if (active) setError(cause?.data || cause?.message || '加载模板失败');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [visit, refreshKey]);
  const use = (template: AutomationTemplate) => {
    try {
      onUse(
        readTemplateConfiguration(template.configuration_json),
        template.name,
      );
    } catch (cause: any) {
      setError(cause?.message || '模板无法读取');
    }
  };
  const remove = async (template: AutomationTemplate) => {
    setRemoving(template.id);
    try {
      const response = await deleteAutomationTemplate(template.id);
      if (response.code !== 0)
        throw new Error(response.message || '删除模板失败');
      setVisit((value) => value + 1);
    } catch (cause: any) {
      setError(cause?.data || cause?.message || '删除模板失败');
    } finally {
      setRemoving(undefined);
    }
  };
  const download = (template: AutomationTemplate) => {
    try {
      const configuration = portableAutomationTemplate(
        readTemplateConfiguration(template.configuration_json),
      );
      const url = URL.createObjectURL(
        new Blob(
          [
            JSON.stringify(
              {
                format: 'film-fusion-automation-template',
                version: 1,
                name: template.name,
                description: template.description,
                configuration,
              },
              null,
              2,
            ),
          ],
          { type: 'application/json' },
        ),
      );
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${template.name.replace(/[\\/:*?"<>|]/g, '_')}.json`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause: any) {
      setError(cause?.message || '导出失败');
    }
  };
  const importFile = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 1024 * 1024) throw new Error('模板文件不能超过 1 MiB');
      const parsed = JSON.parse(await file.text());
      if (
        parsed.format !== 'film-fusion-automation-template' ||
        parsed.version !== 1
      )
        throw new Error('请选择 FilmFusion 自动化模板文件');
      const input = readTemplateConfiguration(
        JSON.stringify(parsed.configuration),
      );
      input.workflow.name = String(parsed.name || input.workflow.name);
      input.workflow.description = String(parsed.description || '');
      setEditing({ input });
      setError('');
    } catch (cause: any) {
      setError(cause?.message || '导入失败');
    }
    if (upload.current) upload.current.value = '';
  };
  const visible = templates.filter((item) =>
    `${item.name} ${item.description}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <div className={styles.stack}>
      <div className={styles.row}>
        <Input
          aria-label="搜索流程模板"
          placeholder="搜索模板名称或用途"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 280 }}
          allowClear
        />
        <Button
          icon={<ReloadOutlined />}
          onClick={() => setVisit((value) => value + 1)}
          loading={loading}
        >
          刷新模板
        </Button>
        <Button
          icon={<UploadOutlined />}
          onClick={() => upload.current?.click()}
        >
          导入模板
        </Button>
        <input
          ref={upload}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => void importFile(e.target.files?.[0])}
        />
      </div>
      <p className={styles.hint}>
        在流程卡片的更多菜单中选择“保存为模板”。导出分享文件时会清除账号、路径、地址及参数值，使用时重新绑定。
      </p>
      {error && <Alert type="error" showIcon title={error} />}
      {loading ? (
        <Spin />
      ) : visible.length === 0 ? (
        <Empty description={search ? '没有匹配的模板' : '还没有流程模板'} />
      ) : (
        <div className={styles.library}>
          {visible.map((template) => (
            <article className={styles.template} key={template.id}>
              <div>
                <Tag>
                  {template.trigger_type === 'rss' ? 'RSS' : '115 目录'}
                </Tag>
              </div>
              <h3>{template.name}</h3>
              <p className={styles.hint}>
                {template.description || '可复用的自动化流程'}
              </p>
              <div className={styles.row}>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => use(template)}
                >
                  使用模板
                </Button>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() => download(template)}
                >
                  导出
                </Button>
                <Button
                  type="text"
                  onClick={() => {
                    try {
                      setEditing({
                        template,
                        input: readTemplateConfiguration(
                          template.configuration_json,
                        ),
                      });
                    } catch (cause: any) {
                      setError(cause.message);
                    }
                  }}
                >
                  编辑说明
                </Button>
                <Popconfirm
                  title="删除这个模板？"
                  description="使用它创建的流程会继续保留。"
                  onConfirm={() => remove(template)}
                >
                  <Button type="text" danger loading={removing === template.id}>
                    删除
                  </Button>
                </Popconfirm>
              </div>
            </article>
          ))}
        </div>
      )}
      {editing && (
        <SaveAutomationTemplateModal
          input={editing.input}
          template={editing.template}
          onCancel={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            setVisit((value) => value + 1);
          }}
        />
      )}
    </div>
  );
}
