import {
  ModalForm,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { useRequest } from '@umijs/max';
import { message, Tabs } from 'antd';
import React, { cloneElement, useCallback, useEffect, useState } from 'react';
import {
  getCloudStorageList,
  getLinkTypes,
  getStrmContentTypes,
  updateCloudPath,
} from '@/services/film-fusion';
import StrmPreview from './StrmPreview';

export type UpdateFormProps = {
  trigger?: React.ReactElement<any>;
  onOk?: () => void;
  values: API.CloudPath;
};

// 字段 -> 所属 Tab 的映射，用于校验失败时定位到对应分组并友好提示
const FIELD_TAB_MAP: Record<
  string,
  { key: string; tab: string; label: string }
> = {
  cloud_storage_id: { key: 'basic', tab: '基本信息', label: '云存储' },
  source_path: { key: 'basic', tab: '基本信息', label: '云盘源路径' },
  local_path: { key: 'basic', tab: '基本信息', label: '本地路径' },
  source_type: { key: 'basic', tab: '基本信息', label: '源类型' },
  link_type: { key: 'strm', tab: 'STRM 配置', label: '链接类型' },
  strm_content_type: { key: 'strm', tab: 'STRM 配置', label: 'STRM内容类型' },
  content_prefix: { key: 'strm', tab: 'STRM 配置', label: 'STRM内容前缀' },
  content_encode_uri: { key: 'strm', tab: 'STRM 配置', label: '内容URI编码' },
  filter_rules: { key: 'filter', tab: '过滤规则', label: '文件扩展名过滤规则' },
};

const UpdateForm: React.FC<UpdateFormProps> = (props) => {
  const { onOk, values, trigger } = props;

  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [storageOptions, setStorageOptions] = useState<
    { label: string; value: number }[]
  >([]);
  const [linkTypeOptions, setLinkTypeOptions] = useState<
    { label: string; value: string }[]
  >([]);
  const [strmContentTypeOptions, setStrmContentTypeOptions] = useState<
    { label: string; value: string }[]
  >([]);

  const [messageApi, contextHolder] = message.useMessage();

  // 获取云存储列表
  const { run: getStorageList } = useRequest(
    async () => {
      const result = await getCloudStorageList({ current: 1, pageSize: 100 });
      if (result.code === 0 && result.data?.list) {
        const options = result.data.list.map((item: API.CloudStorage) => ({
          label: `${item.storage_name} (${item.storage_type})`,
          value: item.id,
        }));
        setStorageOptions(options);
      }
      return result;
    },
    {
      manual: true,
    },
  );

  // 获取链接类型列表
  const { run: getLinkTypeList } = useRequest(
    async () => {
      const result = await getLinkTypes();
      if (result.code === 0 && result.data) {
        const options = result.data.map((item: API.LinkTypeOption) => ({
          label: item.label,
          value: item.value,
        }));
        setLinkTypeOptions(options);
      }
      return result;
    },
    {
      manual: true,
    },
  );

  // 获取STRM内容类型列表
  const { run: getStrmContentTypeList } = useRequest(
    async () => {
      const result = await getStrmContentTypes();
      if (result.code === 0 && result.data) {
        const options = result.data.map((item: API.StrmContentTypeOption) => ({
          label: item.label,
          value: item.value,
        }));
        setStrmContentTypeOptions(options);
      }
      return result;
    },
    {
      manual: true,
    },
  );

  // 更新云路径
  const { run, loading } = useRequest(updateCloudPath, {
    manual: true,
    onSuccess: () => {
      messageApi.success('更新成功');
      onOk?.();
      setOpen(false);
    },
    onError: () => {
      messageApi.error('更新失败，请重试！');
    },
  });

  const onCancel = useCallback(() => {
    setOpen(false);
  }, []);

  const onOpen = useCallback(() => {
    setActiveTab('basic');
    setOpen(true);
    getStorageList();
    getLinkTypeList();
    getStrmContentTypeList();
  }, [getStorageList, getLinkTypeList, getStrmContentTypeList]);

  useEffect(() => {
    if (open) {
      getStorageList();
      getLinkTypeList();
      getStrmContentTypeList();
    }
  }, [open, getStorageList, getLinkTypeList, getStrmContentTypeList]);

  // 校验失败时：跳转到第一个出错字段所在的 Tab，并给出友好提示
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
      {trigger
        ? cloneElement(trigger, {
            onClick: onOpen,
          })
        : null}
      <ModalForm
        title="编辑云路径映射"
        open={open}
        width="640px"
        modalProps={{
          okButtonProps: { loading },
          onCancel: onCancel,
        }}
        initialValues={{
          ...values,
          filter_rules:
            values.filter_rules ||
            JSON.stringify({
              include: [
                'mkv',
                'mp4',
                'avi',
                'wmv',
                'flv',
                'mov',
                'rmvb',
                'rm',
                '3gp',
                'ts',
                'webm',
              ],
              download: ['ass', 'srt'],
            }),
        }}
        onFinish={async (value) => {
          await run({ ...value, id: values.id } as API.UpdateCloudPathParams);
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
                    rules={[
                      {
                        required: true,
                        message: '请选择云存储',
                      },
                    ]}
                    width="md"
                    name="cloud_storage_id"
                    label="选择云存储"
                    placeholder="请选择要映射的云存储"
                    options={storageOptions}
                    showSearch
                    fieldProps={{
                      filterOption: (input: string, option: any) =>
                        (option?.label ?? '')
                          .toLowerCase()
                          .includes(input.toLowerCase()),
                    }}
                  />
                  <ProFormText
                    rules={[
                      {
                        required: true,
                        message: '云盘源路径为必填项',
                      },
                    ]}
                    width="md"
                    name="source_path"
                    label="云盘源路径"
                    placeholder="请输入云盘中的文件夹路径，如：/电影/动作片"
                    tooltip="云盘中实际存储媒体文件的文件夹路径"
                  />
                  <ProFormText
                    width="md"
                    name="local_path"
                    label="本地路径"
                    placeholder="请输入本地映射路径，如：/media/movies/action"
                    tooltip="本地文件系统中用于访问云盘文件的路径（可选）"
                  />
                  <ProFormSelect
                    width="md"
                    name="source_type"
                    label="源类型"
                    placeholder="请选择源类型"
                    options={[
                      { label: 'CloudDrive2', value: 'clouddrive2' },
                      { label: 'MoviePilot2', value: 'moviepilot2' },
                    ]}
                    tooltip="选择数据源类型，用于标识数据来源"
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
                  <ProFormSelect
                    rules={[
                      {
                        required: true,
                        message: '请选择链接类型',
                      },
                    ]}
                    width="md"
                    name="link_type"
                    label="链接类型"
                    placeholder="请选择链接类型"
                    options={
                      linkTypeOptions.length > 0
                        ? linkTypeOptions
                        : [{ label: 'STRM文件', value: 'strm' }]
                    }
                    tooltip="STRM文件适用于Jellyfin/Emby等媒体服务器"
                  />
                  <ProFormSelect
                    width="md"
                    name="strm_content_type"
                    label="STRM内容类型"
                    placeholder="请选择STRM内容类型"
                    options={
                      strmContentTypeOptions.length > 0
                        ? strmContentTypeOptions
                        : [
                            { label: 'Path', value: 'path' },
                            { label: 'Openlist', value: 'openlist' },
                          ]
                    }
                    tooltip="STRM文件内容格式类型"
                  />
                  <ProFormText
                    width="md"
                    name="content_prefix"
                    label="STRM内容前缀"
                    placeholder="请输入STRM内容前缀，如：http://192.168.1.100:5005"
                    tooltip="STRM文件中使用的URL前缀"
                  />
                  <ProFormSwitch
                    name="content_encode_uri"
                    label="内容URI编码"
                    tooltip="是否对STRM文件内容进行URI编码，用于处理包含特殊字符的文件路径"
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
                <ProFormTextArea
                  width="md"
                  name="filter_rules"
                  label="文件扩展名过滤规则"
                  placeholder="请输入JSON格式的文件扩展名列表"
                  tooltip="JSON格式的数组，只处理这些扩展名的文件"
                  fieldProps={{
                    rows: 3,
                  }}
                  rules={[
                    {
                      validator: (_: any, value: string) => {
                        if (value) {
                          try {
                            JSON.parse(value);
                          } catch (error) {
                            return Promise.reject(
                              new Error('请输入有效的JSON格式'),
                            );
                          }
                        }
                        return Promise.resolve();
                      },
                    },
                  ]}
                />
              ),
            },
          ]}
        />
        <StrmPreview />
      </ModalForm>
    </>
  );
};

export default UpdateForm;
