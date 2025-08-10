import {
  ProFormText,
  ProFormSelect,
  ProFormTextArea,
  ModalForm,
  ProFormDependency,
  ProFormSwitch,
} from '@ant-design/pro-components';
import { useRequest } from '@umijs/max';
import { Button, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import React, { useState, useEffect } from 'react';
import {
  createCloudPath,
  getCloudStorageList,
  getLinkTypes,
  getStrmContentTypes
} from '@/services/film-fusion';

export type CreateFormProps = {
  reload?: () => void;
};

const CreateForm: React.FC<CreateFormProps> = (props) => {
  const { reload } = props;

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

  // 创建云路径
  const { run, loading } = useRequest(createCloudPath, {
    manual: true,
    onSuccess: () => {
      messageApi.success('创建成功');
      reload?.();
      setOpen(false);
    },
    onError: () => {
      messageApi.error('创建失败，请重试！');
    },
  });

  useEffect(() => {
    if (open) {
      getStorageList();
      getLinkTypeList();
      getStrmContentTypeList();
    }
  }, [open, getStorageList, getLinkTypeList, getStrmContentTypeList]);

  const defaultFilterRules = JSON.stringify({ include: [".mp4", ".mkv", ".avi", ".m4v", ".mov", ".wmv", ".flv", ".mpg", ".mpeg", ".rm", ".rmvb", ".vob", ".ts", ".tp"], download: ["ass", "srt"] });

  return (
    <>
      {contextHolder}
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={() => setOpen(true)}
      >
        新建路径映射
      </Button>
      <ModalForm
        title="新建云路径映射"
        open={open}
        width="600px"
        modalProps={{
          okButtonProps: { loading },
          onCancel: () => setOpen(false),
        }}
        onFinish={async (values) => {
          await run(values as API.CreateCloudPathParams);
          return true;
        }}
        initialValues={{
          link_type: 'strm',
          strm_content_type: 'path',
          filter_rules: defaultFilterRules,
          is_windows_path: false,
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
        <ProFormSwitch
          name="is_windows_path"
          label="Windows路径格式"
          tooltip="启用后将使用Windows路径分隔符（反斜杠）处理路径"
          fieldProps={{
            checkedChildren: "是",
            unCheckedChildren: "否",
          }}
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
                    placeholder="请输入STRM内容前缀，如：/vol1/1000/CloudNAS/CloudDrive"
                    tooltip="STRM文件中使用的内容前缀, 如：/vol1/1000/CloudNAS/CloudDrive"
                  />
                  <ProFormSelect
                    width="md"
                    name="strm_content_type"
                    label="STRM内容类型"
                    placeholder="请选择STRM内容类型"
                    options={strmContentTypeOptions.length > 0 ? strmContentTypeOptions : [
                      // { label: 'Openlist', value: 'openlist' },
                      { label: 'Path', value: 'path' },
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
          tooltip="JSON格式的数组，只处理这些扩展名的文件，如：[&quot;.mkv&quot;,&quot;.mp4&quot;,&quot;.avi&quot;]"
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

export default CreateForm;
