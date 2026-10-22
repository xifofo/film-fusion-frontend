import {
  ProForm,
  ProFormDigit,
  ProFormSelect,
} from '@ant-design/pro-components';
import React from 'react';
import {
  FULL_COL,
  HALF_COL,
  type StorageSectionFormProps,
} from './storageFormTypes';

/** Match302 分区：访问方式 / 最大同时播放 / 子账号缓存上限 */
const Match302Form: React.FC<StorageSectionFormProps> = ({
  values,
  onSave,
}) => (
  <ProForm
    grid
    rowProps={{ gutter: [16, 0] }}
    layout="vertical"
    initialValues={{
      ...values,
      match302_access_mode: values.match302_access_mode || 'auto',
    }}
    submitter={{
      searchConfig: { submitText: '保存 Match302', resetText: '重置' },
    }}
    onFinish={async (value) => onSave(value)}
  >
    <ProFormSelect
      colProps={FULL_COL}
      name="match302_access_mode"
      label="Match302 访问方式"
      options={[
        { label: '自动降级（OpenAPI → Cookie）', value: 'auto' },
        { label: '仅 OpenAPI', value: 'openapi_only' },
        { label: '仅 Cookie（DownloadWithUA）', value: 'cookie_only' },
      ]}
      extra="控制路径解析、播放直链、秒传和缓存清理。自动模式有 AccessToken 时优先使用 OpenAPI 秒传；源账号和目标账号均选择“仅 OpenAPI”时无需登录 Cookie。秒传提交失败后不会自动切换接口重复上传。"
    />
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
