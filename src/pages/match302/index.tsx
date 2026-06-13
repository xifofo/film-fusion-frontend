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
import { Button, Drawer, message, Popconfirm, Space, Switch, Tag, Typography } from 'antd';
import React, { useRef, useState } from 'react';
import {
  getMatch302List,
  deleteMatch302,
  batchDeleteMatch302,
  getMatch302Assignments,
  updateMatch302BalanceEnabled,
} from '@/services/film-fusion';
import CreateForm from '@/pages/match302/components/CreateForm';
import UpdateForm from '@/pages/match302/components/UpdateForm';

const { Text } = Typography;

const balanceLimitModeLabel = (mode?: string) => mode === 'strict' ? '严格' : '宽松';
const cleanupModeLabel = (mode?: string) => mode === 'hard_delete' ? '彻底删除' : '移动到回收站';
const assignmentStatusColor = (status?: string) => {
  if (status === 'ready') return 'green';
  if (status === 'pending') return 'gold';
  if (status === 'transferring') return 'processing';
  if (status === 'failed') return 'red';
  return 'default';
};

const Match302List: React.FC = () => {
  const actionRef = useRef<ActionType | null>(null);

  const [showDetail, setShowDetail] = useState<boolean>(false);
  const [currentRow, setCurrentRow] = useState<API.Match302>();
  const [balanceTogglingID, setBalanceTogglingID] = useState<number>();
  const [balanceEnabledOverrides, setBalanceEnabledOverrides] = useState<Record<number, boolean>>({});

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

  const handleBalanceEnabledChange = async (record: API.Match302, checked: boolean) => {
    setBalanceTogglingID(record.id);
    setBalanceEnabledOverrides((current) => ({
      ...current,
      [record.id]: checked,
    }));
    try {
      await updateMatch302BalanceEnabled(record.id, checked);
      messageApi.success(checked ? '已开启负载均衡' : '已关闭负载均衡');
      await actionRef.current?.reload?.();
      setBalanceEnabledOverrides((current) => {
        const next = { ...current };
        delete next[record.id];
        return next;
      });
    } catch (_error) {
      setBalanceEnabledOverrides((current) => {
        const next = { ...current };
        delete next[record.id];
        return next;
      });
      messageApi.error(checked ? '开启失败，请重试' : '关闭失败，请重试');
    } finally {
      setBalanceTogglingID(undefined);
    }
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
      title: '负载均衡',
      dataIndex: 'balance_enabled',
      width: 150,
      search: false,
      render: (_, record) => {
        const balanceEnabled = balanceEnabledOverrides[record.id] ?? record.balance_enabled;
        return (
          <Space size={4} wrap>
            <Switch
              size="small"
              checked={balanceEnabled}
              loading={balanceTogglingID === record.id}
              checkedChildren="开"
              unCheckedChildren="关"
              onChange={(checked) => handleBalanceEnabledChange(record, checked)}
            />
            {balanceEnabled && (
              <>
                <Tag color={record.balance_limit_mode === 'strict' ? 'red' : 'blue'}>
                  {balanceLimitModeLabel(record.balance_limit_mode)}
                </Tag>
                <Tag color="blue">{record.pool_members?.length || 0} 子账号</Tag>
              </>
            )}
          </Space>
        );
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
        title: '负载均衡',
        render: () => record.balance_enabled ? '已启用' : '未启用',
      },
      {
        title: '策略',
        render: () => record.balance_strategy || '-',
      },
      {
        title: '并发限制模式',
        render: () => balanceLimitModeLabel(record.balance_limit_mode),
      },
      {
        title: '源账号权重',
        dataIndex: 'source_weight',
      },
      {
        title: '清理策略',
        render: () => record.cleanup_enabled
          ? `${record.retention_hours || 72} 小时后 ${cleanupModeLabel(record.cleanup_mode)}`
          : '未启用',
      },
      {
        title: '子账号池',
        render: () => {
          const members = record.pool_members || [];
          if (!members.length) return '-';
          return (
            <Space direction="vertical" size={2}>
              {members.map((member) => (
                <Text key={`${member.cloud_storage_id}-${member.id || ''}`}>
                  {member.cloud_storage?.storage_name || `ID: ${member.cloud_storage_id}`}
                  {' / '}
                  权重 {member.weight || 1}
                  {' / '}
                  {member.enabled ? '启用' : '停用'}
                  {member.target_root_path ? ` / 缓存目录 ${member.target_root_path}` : ''}
                </Text>
              ))}
            </Space>
          );
        },
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

  const assignmentColumns: ProColumns<API.Match302BalanceAssignment>[] = [
    {
      title: '源文件',
      dataIndex: 'source_file_path',
      width: 280,
      ellipsis: true,
      copyable: true,
    },
    {
      title: '缓存账号',
      width: 160,
      render: (_, record) => record.is_source_playback
        ? <Tag color="green">源账号</Tag>
        : <Tag color="blue">{record.playback_storage?.storage_name || `ID: ${record.playback_storage_id}`}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 130,
      render: (_, record) => (
        <Space size={4} wrap>
          <Tag color={assignmentStatusColor(record.status)}>{record.status}</Tag>
          {record.cleanup_status && record.cleanup_status !== 'none' && (
            <Tag>{record.cleanup_status}</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '目标路径',
      dataIndex: 'target_path',
      width: 240,
      ellipsis: true,
      copyable: true,
      render: (_, record) => record.target_path || '-',
    },
    {
      title: '目标 pickcode',
      dataIndex: 'target_pickcode',
      width: 150,
      copyable: true,
      render: (_, record) => record.target_pickcode || '-',
    },
    {
      title: '过期时间',
      dataIndex: 'expires_at',
      width: 180,
      render: (_, record) => record.expires_at || '-',
    },
    {
      title: '最近播放',
      dataIndex: 'last_played_at',
      width: 180,
      render: (_, record) => record.last_played_at || '-',
    },
  ];

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
            success: response.code === 0,
            total: response.data.total,
          };
        }}
        columns={columns}
        expandable={{
          expandedRowRender,
        }}
        rowSelection={{}}
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
        width={1000}
        open={showDetail}
        onClose={() => {
          setCurrentRow(undefined);
          setShowDetail(false);
        }}
        closable={false}
      >
        {currentRow?.id && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
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
            <ProTable<API.Match302BalanceAssignment>
              rowKey="id"
              size="small"
              search={false}
              options={false}
              headerTitle="秒传缓存记录"
              columns={assignmentColumns}
              scroll={{ x: 1300 }}
              pagination={{ pageSize: 10 }}
              request={async (params) => {
                const response = await getMatch302Assignments(currentRow.id, {
                  page: params.current,
                  page_size: params.pageSize,
                });
                return {
                  data: response.data?.list || [],
                  success: response.code === 0,
                  total: response.data?.total || 0,
                };
              }}
            />
          </Space>
        )}
      </Drawer>

    </PageContainer>
  );
};

export default Match302List;
