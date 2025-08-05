import {
  ProFormText,
  ProFormSelect,
  ProFormTextArea,
  ModalForm,
  ProFormDependency,
} from '@ant-design/pro-components';
import { useRequest } from '@umijs/max';
import { message } from 'antd';
import React, { cloneElement, useCallback, useState, useEffect } from 'react';
import {
  updateCloudPath,
  getCloudStorageList,
  getLinkTypes,
  getStrmContentTypes
} from '@/services/film-fusion';

export type UpdateFormProps = {
  trigger?: React.ReactElement<any>;
  onOk?: () => void;
  values: API.CloudPath;
};

const UpdateForm: React.FC<UpdateFormProps> = (props) => {
  const { onOk, values, trigger } = props;

  const [open, setOpen] = useState(false);
  const [storageOptions, setStorageOptions] = useState<{ label: string; value: number }[]>([]);
  const [linkTypeOptions, setLinkTypeOptions] = useState<{ label: string; value: string }[]>([]);
  const [strmContentTypeOptions, setStrmContentTypeOptions] = useState<{ label: string; value: string }[]>([]);

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
    }
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
    }
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
    }
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
        width="600px"
        modalProps={{
          okButtonProps: { loading },
          onCancel: onCancel,
        }}
        initialValues={{
          ...values,
          filter_rules: values.filter_rules || JSON.stringify(['mkv', 'mp4', 'avi', 'wmv', 'flv', 'mov', 'rmvb', 'rm', '3gp', 'ts', 'webm']),
        }}
        onFinish={async (value) => {
          await run({ ...value, id: values.id } as API.UpdateCloudPathParams);
          return true;
        }}
      >
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
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
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
          options={linkTypeOptions.length > 0 ? linkTypeOptions : [
            { label: 'STRM文件', value: 'strm' },
            { label: '软链接', value: 'symlink' },
          ]}
          tooltip="STRM文件适用于Jellyfin/Emby等媒体服务器，软链接直接映射文件到本地文件系统"
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
        <ProFormDependency name={['link_type']}>
          {({ link_type }) => {
            if (link_type === 'strm') {
              return (
                <>
                  <ProFormText
                    width="md"
                    name="content_prefix"
                    label="STRM内容前缀"
                    placeholder="请输入STRM内容前缀，如：http://192.168.1.100:5005"
                    tooltip="STRM文件中使用的URL前缀"
                  />
                  <ProFormSelect
                    width="md"
                    name="strm_content_type"
                    label="STRM内容类型"
                    placeholder="请选择STRM内容类型"
                    options={strmContentTypeOptions.length > 0 ? strmContentTypeOptions : [
                      { label: 'Path', value: 'path' },
                      { label: 'Openlist', value: 'openlist' },
                    ]}
                    tooltip="STRM文件内容格式类型"
                  />
                </>
              );
            }
            return null;
          }}
        </ProFormDependency>
        <ProFormTextArea
          width="md"
          name="filter_rules"
          label="文件扩展名过滤规则"
          placeholder="请输入JSON格式的文件扩展名列表"
          tooltip="JSON格式的数组，只处理这些扩展名的文件，如：[&quot;mkv&quot;,&quot;mp4&quot;,&quot;avi&quot;]"
          fieldProps={{
            rows: 3,
          }}
          rules={[
            {
              validator: (_: any, value: string) => {
                if (value) {
                  try {
                    const parsed = JSON.parse(value);
                    if (!Array.isArray(parsed)) {
                      return Promise.reject(new Error('过滤规则必须是JSON数组格式'));
                    }
                    if (parsed.some(item => typeof item !== 'string')) {
                      return Promise.reject(new Error('数组中的所有元素必须是字符串'));
                    }
                  } catch (error) {
                    return Promise.reject(new Error('请输入有效的JSON格式'));
                  }
                }
                return Promise.resolve();
              },
            },
          ]}
        />
      </ModalForm>
    </>
  );
};

export default UpdateForm;
