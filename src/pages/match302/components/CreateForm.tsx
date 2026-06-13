import { PlusOutlined } from '@ant-design/icons';
import {
  ModalForm,
  ProFormText,
  ProFormSelect,
  ProFormSwitch,
  ProFormDigit,
  ProFormList,
  ProFormDependency,
} from '@ant-design/pro-components';
import { Button, message } from 'antd';
import type { FC } from 'react';
import { useState } from 'react';
import { useRequest } from '@umijs/max';
import { createMatch302, getCloudStorageList } from '@/services/film-fusion';
import DirectoryPathField from './DirectoryPathField';

interface CreateFormProps {
  onSuccess?: () => void;
}

const CreateForm: FC<CreateFormProps> = (props) => {
  const { onSuccess } = props;
  const [open, setOpen] = useState(false);

  const { data: cloudStorageData, loading: cloudStorageLoading } = useRequest(() =>
    getCloudStorageList({ current: 1, pageSize: 1000 }), {
    formatResult: (res) => res.data?.list || []
  });
  const storageOptions = cloudStorageData?.map((item: API.CloudStorage) => ({
    label: `${item.storage_name} (${item.storage_type})`,
    value: item.id,
  }));
  const memberStorageOptions = cloudStorageData
    ?.filter((item: API.CloudStorage) => item.storage_type === '115open')
    .map((item: API.CloudStorage) => ({
      label: `${item.storage_name} (${item.status})`,
      value: item.id,
    }));

  return (
    <>
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={() => setOpen(true)}
      >
        新建
      </Button>

      <ModalForm<API.CreateMatch302Params>
        title="新建 Match302 重定向"
        open={open}
        onOpenChange={setOpen}
        modalProps={{
          destroyOnClose: true,
        }}
        initialValues={{
          balance_enabled: false,
          balance_strategy: 'sticky_least_active',
          balance_limit_mode: 'loose',
          source_weight: 1,
          cleanup_enabled: true,
          retention_hours: 72,
          cleanup_mode: 'recycle',
          cleanup_interval_min: 30,
          min_keep_ready: 0,
        }}
        onFinish={async (values) => {
          try {
            await createMatch302(values);
            message.success('创建成功');
            onSuccess?.();
            return true;
          } catch (_error) {
            message.error('创建失败，请重试');
            return false;
          }
        }}
      >
        <ProFormText
          name="source_path"
          label="源路径"
          rules={[
            { required: true, message: '请输入源路径' },
            { max: 500, message: '源路径最大长度为500字符' },
          ]}
          placeholder="请输入源路径，例如：/source/path"
          extra="输入需要重定向的源路径"
        />

        <ProFormSelect
          name="cloud_storage_id"
          label="云存储"
          rules={[{ required: true, message: '请选择云存储' }]}
          options={storageOptions}
          placeholder="请选择关联的云存储"
          showSearch
          fieldProps={{
            loading: cloudStorageLoading,
            filterOption: (input: string, option: any) =>
              option?.label?.toLowerCase().indexOf(input.toLowerCase()) >= 0,
          }}
        />

        <ProFormDependency name={['cloud_storage_id']}>
          {({ cloud_storage_id }) => (
            <DirectoryPathField
              name="target_path"
              label="目标路径"
              cloudStorageId={cloud_storage_id}
              placeholder="留空表示把源路径前缀替换为空"
              extra="从当前源账号目录中选择；也可手动输入。留空时表示把源路径前缀替换为空。"
            />
          )}
        </ProFormDependency>

        <ProFormSwitch
          name="balance_enabled"
          label="启用 302 负载均衡"
          checkedChildren="启用"
          unCheckedChildren="关闭"
        />

        <ProFormSelect
          name="balance_strategy"
          label="选择策略"
          options={[{ label: '固定分配 + 最少活跃', value: 'sticky_least_active' }]}
          allowClear={false}
        />

        <ProFormSelect
          name="balance_limit_mode"
          label="并发限制模式"
          options={[
            { label: '宽松：只限制新分配', value: 'loose' },
            { label: '严格：每次播放都检查', value: 'strict' },
          ]}
          allowClear={false}
        />

        <ProFormDigit
          name="source_weight"
          label="源账号权重"
          min={1}
          max={100}
          fieldProps={{ precision: 0 }}
        />

        <ProFormList
          name="pool_members"
          label="子账号池"
          creatorButtonProps={{ creatorButtonText: '添加子账号' }}
          copyIconProps={false}
        >
          <ProFormSelect
            name="cloud_storage_id"
            label="子账号"
            rules={[{ required: true, message: '请选择子账号' }]}
            options={memberStorageOptions}
            fieldProps={{
              loading: cloudStorageLoading,
              showSearch: true,
              filterOption: (input: string, option: any) =>
                option?.label?.toLowerCase().indexOf(input.toLowerCase()) >= 0,
            }}
          />
          <ProFormSwitch
            name="enabled"
            label="启用"
            initialValue
            checkedChildren="启用"
            unCheckedChildren="停用"
          />
          <ProFormDigit
            name="weight"
            label="权重"
            min={1}
            max={100}
            initialValue={1}
            fieldProps={{ precision: 0 }}
          />
          <ProFormDependency name={['cloud_storage_id']}>
            {({ cloud_storage_id }) => (
              <DirectoryPathField
                name="target_root_path"
                label="秒传缓存目录"
                cloudStorageId={cloud_storage_id}
                placeholder="/FilmFusion-302/{match302_id}"
                extra="秒传到当前子账号时保存文件的目录；留空时后端使用默认缓存目录。"
              />
            )}
          </ProFormDependency>
        </ProFormList>

        <ProFormSwitch
          name="cleanup_enabled"
          label="自动清理子账号缓存"
          checkedChildren="开启"
          unCheckedChildren="关闭"
        />
        <ProFormDigit
          name="retention_hours"
          label="播放后保留小时"
          min={1}
          max={24 * 365}
          fieldProps={{ precision: 0 }}
        />
        <ProFormSelect
          name="cleanup_mode"
          label="清理模式"
          options={[
            { label: '移动到回收站', value: 'recycle' },
            { label: '彻底删除', value: 'hard_delete' },
          ]}
          allowClear={false}
        />
        <ProFormDigit
          name="cleanup_interval_min"
          label="清理扫描间隔分钟"
          min={5}
          max={24 * 60}
          fieldProps={{ precision: 0 }}
        />
        <ProFormDigit
          name="min_keep_ready"
          label="至少保留 ready 数"
          min={0}
          max={1000}
          fieldProps={{ precision: 0 }}
        />
      </ModalForm>
    </>
  );
};

export default CreateForm;
