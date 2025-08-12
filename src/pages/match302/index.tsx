import type {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
} from '@ant-design/pro-components';
import {
  PageContainer,
  ProDescriptions,
  ProTable,
} from '@ant-design/pro-components';
import { useRequest } from '@umijs/max';
import { Button, Drawer, message, Tag, Popconfirm, Space } from 'antd';
import React, { useRef, useState } from 'react';
import {
  getMatch302List,
  deleteMatch302,
  batchDeleteMatch302,
} from '@/services/film-fusion';
import CreateForm from '@/pages/match302/components/CreateForm';
import UpdateForm from '@/pages/match302/components/UpdateForm';

const Match302List: React.FC = () => {
  const actionRef = useRef<ActionType | null>(null);

  const [showDetail, setShowDetail] = useState<boolean>(false);
  const [currentRow, setCurrentRow] = useState<API.Match302>();
  const [showTest, setShowTest] = useState<boolean>(false);
  const [testRow, setTestRow] = useState<API.Match302>();

  const [messageApi, contextHolder] = message.useMessage();

  const { run: delRun, loading: delLoading } = useRequest(deleteMatch302, {
    manual: true,
    onSuccess: () => {
      actionRef.current?.reloadAndRest?.();
      messageApi.success('删除成功');
    },
    onError: () => {
      messageApi.error('删除失败，请重试');
    },
  });

  const { run: batchDelRun, loading: batchDelLoading } = useRequest(batchDeleteMatch302, {
    manual: true,
    onSuccess: () => {
      actionRef.current?.reloadAndRest?.();
      messageApi.success('批量删除成功');
    },
    onError: () => {
      messageApi.error('批量删除失败，请重试');
    },
  });

  const handleTestRedirect = (record: API.Match302) => {
    setTestRow(record);
    setShowTest(true);
  };

  const columns: ProColumns<API.Match302>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
      search: false,
    },
    {
      title: '源路径',
      dataIndex: 'source_path',
      ellipsis: true,
      copyable: true,
      width: 200,
    },
    {
      title: '目标路径',
      dataIndex: 'target_path',
      ellipsis: true,
      copyable: true,
      width: 200,
    },
    {
      title: '云存储',
      dataIndex: 'cloud_storage_id',
      render: (_, record) => (
        <Tag color="blue">
          {record.cloud_storage?.storage_name || `ID: ${record.cloud_storage_id}`}
        </Tag>
      ),
      renderFormItem: () => {
        // 这里可以添加云存储选择器组件
        return <div>云存储选择器</div>;
      },
    },
    {
      title: '操作',
      dataIndex: 'option',
      valueType: 'option',
      width: 200,
      render: (_, record) => [
        <Button
          type="link"
          size="small"
          key="view"
          onClick={() => {
            setCurrentRow(record);
            setShowDetail(true);
          }}
        >
          查看
        </Button>,
        <UpdateForm
          key="update"
          record={record}
          onSuccess={() => {
            actionRef.current?.reload?.();
            messageApi.success('更新成功');
          }}
        />,
        <Popconfirm
          key="delete"
          title="确定要删除这条记录吗？"
          onConfirm={() => delRun(record.id)}
          okButtonProps={{ loading: delLoading }}
        >
          <Button type="link" size="small" danger>
            删除
          </Button>
        </Popconfirm>,
      ],
    },
  ];

  const expandedRowRender = (record: API.Match302) => {
    const data: ProDescriptionsItemProps<API.Match302>[] = [
      {
        title: 'ID',
        dataIndex: 'id',
      },
      {
        title: '源路径',
        dataIndex: 'source_path',
        copyable: true,
      },
      {
        title: '目标路径',
        dataIndex: 'target_path',
        copyable: true,
      },
      {
        title: '云存储ID',
        dataIndex: 'cloud_storage_id',
      },
      {
        title: '云存储名称',
        render: () => record.cloud_storage?.storage_name || '-',
      },
      {
        title: '云存储类型',
        render: () => record.cloud_storage?.storage_type || '-',
      },
      {
        title: '创建时间',
        dataIndex: 'created_at',
        valueType: 'dateTime',
      },
      {
        title: '更新时间',
        dataIndex: 'updated_at',
        valueType: 'dateTime',
      },
    ];

    return (
      <ProDescriptions
        column={2}
        title="详细信息"
        dataSource={record}
        columns={data}
      />
    );
  };

  return (
    <PageContainer
      header={{
        title: 'Match302 重定向管理',
        breadcrumb: {
          routes: [
            {
              path: '',
              breadcrumbName: '首页',
            },
            {
              path: '',
              breadcrumbName: 'Match302 重定向管理',
            },
          ],
        },
      }}
    >
      {contextHolder}
      <ProTable<API.Match302, API.Match302QueryParams>
        headerTitle="Match302 重定向列表"
        actionRef={actionRef}
        rowKey="id"
        search={{
          labelWidth: 120,
          defaultCollapsed: false,
        }}
        toolBarRender={() => [
          <CreateForm
            key="create"
            onSuccess={() => {
              actionRef.current?.reload?.();
              messageApi.success('创建成功');
            }}
          />,
        ]}
        request={async (params) => {
          const response = await getMatch302List({
            current: params.current,
            pageSize: params.pageSize,
            source_path: params.source_path,
            target_path: params.target_path,
            cloud_storage_id: params.cloud_storage_id,
          });

          return {
            data: response.data.list,
            success: response.code == 0,
            total: response.data.total,
          };
        }}
        columns={columns}
        expandable={{
          expandedRowRender,
        }}
        rowSelection={{
          onChange: (selectedRowKeys, selectedRows) => {
            // 处理行选择
          },
        }}
        tableAlertRender={({ selectedRowKeys, onCleanSelected }) => (
          <Space size={24}>
            <span>
              已选择 <a style={{ fontWeight: 600 }}>{selectedRowKeys.length}</a> 项
              <a style={{ marginLeft: 8 }} onClick={onCleanSelected}>
                取消选择
              </a>
            </span>
          </Space>
        )}
        tableAlertOptionRender={({ selectedRowKeys }) => (
          <Space size={16}>
            <Popconfirm
              title="确定要删除选中的记录吗？"
              onConfirm={() => batchDelRun(selectedRowKeys as number[])}
              okButtonProps={{ loading: batchDelLoading }}
            >
              <Button size="small" danger>
                批量删除
              </Button>
            </Popconfirm>
          </Space>
        )}
      />

      <Drawer
        width={600}
        open={showDetail}
        onClose={() => {
          setCurrentRow(undefined);
          setShowDetail(false);
        }}
        closable={false}
      >
        {currentRow?.id && (
          <ProDescriptions<API.Match302>
            column={1}
            title="Match302 详细信息"
            request={async () => ({
              data: currentRow || {},
            })}
            params={{
              id: currentRow?.id,
            }}
            columns={expandedRowRender(currentRow).props.columns}
          />
        )}
      </Drawer>

    </PageContainer>
  );
};

export default Match302List;
