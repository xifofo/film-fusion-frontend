import { PlusOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import {
  ModalForm,
  PageContainer,
  ProFormSelect,
  ProFormSwitch,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components';
import { Alert, Button, message, Popconfirm, Tag } from 'antd';
import React, { useRef } from 'react';
import {
  createEmbyBinding,
  deleteEmbyBinding,
  getCloudStorageList,
  getEmbyBindings,
  getEmbyUsers,
  updateEmbyBinding,
} from '@/services/film-fusion';

/** 加载 115 存储下拉项 */
const loadStorageOptions = async () => {
  const res = await getCloudStorageList({ current: 1, pageSize: 200 });
  const list = res?.data?.list || [];
  return list
    .filter((s) => s.storage_type === '115open')
    .map((s) => ({ label: s.storage_name, value: s.id }));
};

type BindingModalFormProps = {
  title: string;
  trigger: React.ReactElement;
  initialValues?: API.EmbyAccountBinding;
  onOk: (values: API.EmbyAccountBindingParams) => Promise<boolean>;
};

/** 新增 / 编辑绑定弹窗表单 */
const BindingModalForm: React.FC<BindingModalFormProps> = ({
  title,
  trigger,
  initialValues,
  onOk,
}) => {
  const userNameMapRef = useRef<Record<string, string>>({});

  return (
    <ModalForm
      title={title}
      trigger={trigger}
      width={520}
      modalProps={{ destroyOnClose: true }}
      initialValues={{
        enabled: initialValues?.enabled ?? true,
        emby_user_id: initialValues?.emby_user_id,
        cloud_storage_id: initialValues?.cloud_storage_id,
        remark: initialValues?.remark,
      }}
      onFinish={async (values) => {
        const embyUserId = values.emby_user_id as string;
        const params: API.EmbyAccountBindingParams = {
          emby_user_id: embyUserId,
          emby_user_name:
            userNameMapRef.current[embyUserId] || initialValues?.emby_user_name,
          cloud_storage_id: values.cloud_storage_id,
          enabled: values.enabled,
          remark: values.remark,
        };
        return onOk(params);
      }}
    >
      <ProFormSelect
        name="emby_user_id"
        label="Emby 账号"
        rules={[{ required: true, message: '请选择 Emby 账号' }]}
        placeholder="选择 Emby 用户（自动从 Emby 拉取）"
        fieldProps={{ showSearch: true, optionFilterProp: 'label' }}
        request={async () => {
          const res = await getEmbyUsers();
          const list = res?.data || [];
          const map: Record<string, string> = {};
          const opts = list.map((u) => {
            map[u.Id] = u.Name;
            return { label: `${u.Name}（${u.Id}）`, value: u.Id };
          });
          // 编辑时若该用户已不在列表中，补一个选项保证回显
          if (initialValues?.emby_user_id && !map[initialValues.emby_user_id]) {
            map[initialValues.emby_user_id] =
              initialValues.emby_user_name || '';
            opts.unshift({
              label: `${
                initialValues.emby_user_name || initialValues.emby_user_id
              }（${initialValues.emby_user_id}）`,
              value: initialValues.emby_user_id,
            });
          }
          userNameMapRef.current = map;
          return opts;
        }}
      />
      <ProFormSelect
        name="cloud_storage_id"
        label="绑定的 115 存储"
        rules={[{ required: true, message: '请选择 115 存储' }]}
        placeholder="该账号播放时强制走的 115 cookie"
        fieldProps={{ showSearch: true, optionFilterProp: 'label' }}
        request={loadStorageOptions}
      />
      <ProFormSwitch name="enabled" label="启用" />
      <ProFormTextArea
        name="remark"
        label="备注"
        placeholder="可选"
        fieldProps={{ rows: 2 }}
      />
    </ModalForm>
  );
};

const EmbyBindingsPage: React.FC = () => {
  const actionRef = useRef<ActionType | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  const handleCreate = async (values: API.EmbyAccountBindingParams) => {
    try {
      const res = await createEmbyBinding(values);
      if (res.code === 0) {
        messageApi.success('创建成功');
        actionRef.current?.reload?.();
        return true;
      }
      messageApi.error(res.message || '创建失败');
      return false;
    } catch (error: any) {
      messageApi.error(error?.message || '创建失败');
      return false;
    }
  };

  const handleUpdate = async (
    id: number,
    values: API.EmbyAccountBindingParams,
  ) => {
    try {
      const res = await updateEmbyBinding(id, values);
      if (res.code === 0) {
        messageApi.success('更新成功');
        actionRef.current?.reload?.();
        return true;
      }
      messageApi.error(res.message || '更新失败');
      return false;
    } catch (error: any) {
      messageApi.error(error?.message || '更新失败');
      return false;
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await deleteEmbyBinding(id);
      if (res.code === 0) {
        messageApi.success('删除成功');
        actionRef.current?.reload?.();
      } else {
        messageApi.error(res.message || '删除失败');
      }
    } catch (error: any) {
      messageApi.error(error?.message || '删除失败');
    }
  };

  const columns: ProColumns<API.EmbyAccountBinding>[] = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    {
      title: 'Emby 账号',
      width: 160,
      render: (_, record) => record.emby_user_name || record.emby_user_id,
    },
    {
      title: 'Emby 用户ID',
      dataIndex: 'emby_user_id',
      width: 240,
      ellipsis: true,
      copyable: true,
    },
    {
      title: '绑定的 115 存储',
      width: 180,
      render: (_, record) => (
        <Tag color="blue">
          {record.cloud_storage?.storage_name ||
            `ID: ${record.cloud_storage_id}`}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      width: 90,
      render: (_, record) =>
        record.enabled ? <Tag color="green">启用</Tag> : <Tag>停用</Tag>,
    },
    {
      title: '备注',
      dataIndex: 'remark',
      ellipsis: true,
      render: (_, record) => record.remark || '-',
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      valueType: 'dateTime',
      width: 180,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 140,
      render: (_, record) => [
        <BindingModalForm
          key="edit"
          title="编辑绑定"
          initialValues={record}
          trigger={
            <Button type="link" size="small">
              编辑
            </Button>
          }
          onOk={(values) => handleUpdate(record.id, values)}
        />,
        <Popconfirm
          key="delete"
          title="确定要删除该绑定吗？"
          onConfirm={() => handleDelete(record.id)}
        >
          <Button type="link" size="small" danger>
            删除
          </Button>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <PageContainer
      header={{
        title: 'Emby 账号绑定',
      }}
    >
      {contextHolder}
      <Alert
        style={{ marginBottom: 16 }}
        type="info"
        showIcon
        message="为某个 Emby 账号指定固定的 115 存储(cookie)。该账号播放命中 Match302 规则时会强制走指定存储（等价于直接指定负载均衡账号，后续走相同的秒传 + 播放流程），不依赖该规则是否开启负载均衡；指定账号不可用 / 并发已满 / 秒传未就绪时自动回退到正常流程。"
      />
      <ProTable<API.EmbyAccountBinding>
        headerTitle="Emby 账号 → 115 存储 绑定"
        actionRef={actionRef}
        rowKey="id"
        search={false}
        pagination={false}
        options={{ reload: true, density: false, setting: false }}
        toolBarRender={() => [
          <BindingModalForm
            key="create"
            title="新增绑定"
            trigger={
              <Button type="primary" icon={<PlusOutlined />}>
                新增绑定
              </Button>
            }
            onOk={handleCreate}
          />,
        ]}
        request={async () => {
          const res = await getEmbyBindings();
          return {
            data: res?.data || [],
            success: res.code === 0,
          };
        }}
        columns={columns}
      />
    </PageContainer>
  );
};

export default EmbyBindingsPage;
