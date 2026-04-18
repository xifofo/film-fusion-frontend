import { upsertEmbyCoverLibrary } from '@/services/film-fusion';
import {
  DrawerForm,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
} from '@ant-design/pro-components';
import { message } from 'antd';
import React from 'react';

export interface EditConfigFormProps {
  /** 当前库（用来回填表单） */
  record: API.EmbyCoverLibraryView;
  /** 可选模板列表 */
  templates: API.EmbyCoverTemplate[];
  /** 触发按钮（放在列操作里） */
  trigger: React.ReactNode;
  /** 保存成功后回调 */
  onSuccess?: () => void;
}

/**
 * 编辑某个媒体库的封面配置：中英文标题、模板、是否启用。
 * 使用 DrawerForm，打开时 initialValues 回填当前记录。
 */
const EditConfigForm: React.FC<EditConfigFormProps> = ({
  record,
  templates,
  trigger,
  onSuccess,
}) => {
  return (
    <DrawerForm<API.UpsertEmbyCoverLibraryParams>
      title={`编辑封面配置 · ${record.emby_name}`}
      width={520}
      trigger={<span>{trigger}</span>}
      drawerProps={{
        destroyOnHidden: true,
      }}
      initialValues={{
        cn_title: record.cn_title || record.emby_name,
        en_subtitle: record.en_subtitle,
        template_id: record.template_id || templates[0]?.id,
        enabled: record.enabled,
      }}
      onFinish={async (values) => {
        try {
          const resp = await upsertEmbyCoverLibrary(record.emby_library_id, {
            emby_name: record.emby_name,
            cn_title: values.cn_title?.trim(),
            en_subtitle: values.en_subtitle?.trim(),
            template_id: values.template_id,
            enabled: values.enabled,
          });
          if (resp.code !== 0) {
            message.error(resp.message || '保存失败');
            return false;
          }
          message.success('已保存');
          onSuccess?.();
          return true;
        } catch (e: any) {
          message.error(e?.message || '保存失败');
          return false;
        }
      }}
    >
      <ProFormText
        name="cn_title"
        label="中文主标题"
        placeholder="例如：动漫、电影、剧集"
        extra="留空则自动使用 Emby 库名"
        rules={[{ max: 64, message: '最多 64 个字符' }]}
      />

      <ProFormText
        name="en_subtitle"
        label="英文副标题"
        placeholder="例如：ANIME / MOVIES（可留空）"
        rules={[{ max: 64, message: '最多 64 个字符' }]}
      />

      <ProFormSelect
        name="template_id"
        label="封面模板"
        options={templates.map((t) => ({ label: t.name, value: t.id }))}
        rules={[{ required: true, message: '请选择封面模板' }]}
      />

      <ProFormSwitch
        name="enabled"
        label="启用"
        extra="关闭后，批量生成和定时任务将跳过此库（手动生成仍可用）"
      />
    </DrawerForm>
  );
};

export default EditConfigForm;
