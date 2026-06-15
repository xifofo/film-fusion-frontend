import { EditOutlined } from '@ant-design/icons';
import {
  ModalForm,
  ProFormDigit,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { useRequest } from '@umijs/max';
import { Button, message, Tabs } from 'antd';
import React, { useMemo, useState } from 'react';
import { updateCloudDirectory } from '@/services/film-fusion';
import DirectoryStrmPreview from './DirectoryStrmPreview';

export type UpdateFormProps = {
  record: API.CloudDirectory;
  onSuccess?: () => void;
  storageOptions: { label: string; value: number }[];
  storageLoading?: boolean;
};

// 字段 -> 所属 Tab 映射，用于校验失败时定位并友好提示
const FIELD_TAB_MAP: Record<
  string,
  { key: string; tab: string; label: string }
> = {
  cloud_storage_id: { key: 'basic', tab: '基本信息', label: '云存储' },
  directory_name: { key: 'basic', tab: '基本信息', label: '目录名称' },
  directory_id: { key: 'basic', tab: '基本信息', label: '云盘目录 ID' },
  save_path: { key: 'basic', tab: '基本信息', label: '保存路径' },
  classify_by_category: { key: 'basic', tab: '基本信息', label: '按分类目录' },
  content_prefix: { key: 'strm', tab: 'STRM 配置', label: '内容前缀' },
  content_encode_uri: { key: 'strm', tab: 'STRM 配置', label: '内容 URI 编码' },
  include_extensions: { key: 'filter', tab: '过滤规则', label: '包含后缀' },
  exclude_extensions: { key: 'filter', tab: '过滤规则', label: '排除后缀' },
  exclude_smaller_than_mb: {
    key: 'filter',
    tab: '过滤规则',
    label: '排除小于 (MB)',
  },
};

const UpdateForm: React.FC<UpdateFormProps> = ({
  record,
  onSuccess,
  storageOptions,
  storageLoading,
}) => {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [messageApi, contextHolder] = message.useMessage();

  const { run, loading } = useRequest(updateCloudDirectory, {
    manual: true,
    onSuccess: () => {
      messageApi.success('更新成功');
      onSuccess?.();
      setOpen(false);
    },
    onError: () => {
      messageApi.error('更新失败，请重试');
    },
  });

  const jsonValidator = useMemo(
    () => (_: any, value: string) => {
      if (!value) return Promise.resolve();
      try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) {
          return Promise.reject(new Error('请输入 JSON 数组格式'));
        }
      } catch (error) {
        return Promise.reject(new Error('请输入有效的 JSON 格式'));
      }
      return Promise.resolve();
    },
    [],
  );

  const handleFinishFailed = (errorInfo: {
    errorFields: { name: (string | number)[] }[];
  }) => {
    const first = errorInfo?.errorFields?.[0];
    if (!first) return;
    const name = Array.isArray(first.name) ? first.name[0] : first.name;
    const info = FIELD_TAB_MAP[String(name)];
    if (info) {
      setActiveTab(info.key);
      messageApi.warning(`请前往「${info.tab}」标签页完善「${info.label}」`);
    }
  };

  return (
    <>
      {contextHolder}
      <Button
        type="link"
        size="small"
        icon={<EditOutlined />}
        onClick={() => {
          setActiveTab('basic');
          setOpen(true);
        }}
      >
        编辑
      </Button>
      <ModalForm<API.UpdateCloudDirectoryParams>
        title="编辑目录配置"
        open={open}
        width="640px"
        onOpenChange={setOpen}
        modalProps={{
          destroyOnClose: true,
        }}
        submitter={{
          submitButtonProps: { loading },
        }}
        initialValues={{
          ...record,
          include_extensions: record.include_extensions ?? '[]',
          exclude_extensions: record.exclude_extensions ?? '[]',
        }}
        onFinish={async (values) => {
          await run({ ...values, id: record.id });
          return true;
        }}
        onFinishFailed={handleFinishFailed}
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'basic',
              label: '基本信息',
              forceRender: true,
              children: (
                <>
                  <ProFormSelect
                    name="cloud_storage_id"
                    label="云存储"
                    rules={[{ required: true, message: '请选择云存储' }]}
                    options={storageOptions}
                    placeholder="请选择关联的云存储"
                    showSearch
                    fieldProps={{
                      loading: storageLoading,
                      filterOption: (input: string, option: any) =>
                        option?.label
                          ?.toLowerCase()
                          .includes(input.toLowerCase()),
                    }}
                  />
                  <ProFormText
                    name="directory_name"
                    label="目录名称"
                    rules={[{ required: true, message: '请输入目录名称' }]}
                    placeholder="例如：电影"
                  />
                  <ProFormText
                    name="directory_id"
                    label="云盘目录 ID"
                    rules={[{ required: true, message: '请输入云盘目录 ID' }]}
                    placeholder="例如：123456789"
                  />
                  <ProFormText
                    name="save_path"
                    label="保存路径"
                    placeholder="例如：/mnt/media"
                    tooltip="保存文件地址"
                  />
                  <ProFormSwitch
                    name="classify_by_category"
                    label="按分类目录"
                    tooltip="是否按分类目录进行归类"
                    fieldProps={{
                      checkedChildren: '开启',
                      unCheckedChildren: '关闭',
                    }}
                  />
                </>
              ),
            },
            {
              key: 'strm',
              label: 'STRM 配置',
              forceRender: true,
              children: (
                <>
                  <ProFormText
                    name="content_prefix"
                    label="内容前缀"
                    placeholder="例如：http://example.com/"
                    tooltip="STRM 内容前缀"
                  />
                  <ProFormSwitch
                    name="content_encode_uri"
                    label="内容 URI 编码"
                    tooltip="是否对内容进行 URI 编码"
                    fieldProps={{
                      checkedChildren: '开启',
                      unCheckedChildren: '关闭',
                    }}
                  />
                </>
              ),
            },
            {
              key: 'filter',
              label: '过滤规则',
              forceRender: true,
              children: (
                <>
                  <ProFormTextArea
                    name="include_extensions"
                    label="包含后缀"
                    placeholder='例如：["mp4","mkv","avi"]'
                    tooltip="JSON 字符串，仅处理包含的文件后缀"
                    fieldProps={{ rows: 3 }}
                    rules={[{ validator: jsonValidator }]}
                  />
                  <ProFormTextArea
                    name="exclude_extensions"
                    label="排除后缀"
                    placeholder='例如：["txt","nfo"]'
                    tooltip="JSON 字符串，排除的文件后缀"
                    fieldProps={{ rows: 3 }}
                    rules={[{ validator: jsonValidator }]}
                  />
                  <ProFormDigit
                    name="exclude_smaller_than_mb"
                    label="排除小于 (MB)"
                    tooltip="排除小于该大小的文件"
                    min={0}
                    fieldProps={{ precision: 0 }}
                  />
                </>
              ),
            },
          ]}
        />
        <DirectoryStrmPreview />
      </ModalForm>
    </>
  );
};

export default UpdateForm;
