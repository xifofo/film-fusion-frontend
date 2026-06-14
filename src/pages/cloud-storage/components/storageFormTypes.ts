/** 云存储编辑——各分区独立表单的公共 props */
export type StorageSectionFormProps = {
  /** 当前云存储记录，用于各分区表单的初始值与上下文（如 115 Cookie 保活） */
  values: API.CloudStorage;
  /** 保存当前分区字段（部分更新，自动合并 id）。成功返回 true */
  onSave: (patch: Record<string, any>) => Promise<boolean>;
};
