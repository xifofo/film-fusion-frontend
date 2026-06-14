import { ProForm, ProFormDigit } from '@ant-design/pro-components';
import React from 'react';
import { HALF_COL, type StorageSectionFormProps } from './storageFormTypes';

/** Match302 分区：最大同时播放 / 子账号缓存上限 */
const Match302Form: React.FC<StorageSectionFormProps> = ({
  values,
  onSave,
}) => (
  <ProForm
    grid
    rowProps={{ gutter: [16, 0] }}
    layout="vertical"
    initialValues={values}
    submitter={{ searchConfig: { submitText: '保存 Match302', resetText: '重置' } }}
    onFinish={async (value) => onSave(value)}
  >
    <ProFormDigit
      colProps={HALF_COL}
      name="match302_max_active"
      label="Match302 最大同时播放"
      placeholder="0 表示不限制"
      min={0}
      max={100}
      fieldProps={{ precision: 0 }}
    />
    <ProFormDigit
      colProps={HALF_COL}
      name="match302_cache_max_gb"
      label="Match302 子账号缓存空间上限(GB)"
      placeholder="0 表示不限制"
      min={0}
      max={1024}
      fieldProps={{ precision: 0 }}
      extra="仅统计 FilmFusion 秒传到该账号并记录的缓存文件；超出后会优先清理最早缓存。"
    />
  </ProForm>
);

export default Match302Form;
