import {
  ModalForm,
  ProDescriptions,
  ProFormSwitch,
  ProFormText,
  ProTable,
} from '@ant-design/pro-components';
import { Button, message, Modal, Tabs, Tag, Tooltip, Typography } from 'antd';
import React, { useMemo, useState } from 'react';
import { useRequest } from '@umijs/max';
import { organize115Cookie } from '@/services/film-fusion';

export type OrganizeModalProps = {
  record: API.CloudDirectory;
  onSuccess?: () => void;
};

const OrganizeModal: React.FC<OrganizeModalProps> = ({ record, onSuccess }) => {
  const [open, setOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [resultData, setResultData] = useState<API.Organize115CookieResult>();
  const [rawResponse, setRawResponse] = useState<any>();
  const [messageApi, contextHolder] = message.useMessage();

  const { run, loading } = useRequest(organize115Cookie, {
    manual: true,
    onSuccess: (result) => {
      const payload =
        result && typeof result === 'object' && 'data' in result && ('code' in result || 'message' in result)
          ? (result as any).data
          : (result as any);
      const total = payload?.total;
      const dryRun = payload?.dry_run;
      const suffix = typeof total === 'number' ? `，共 ${total} 项` : '';
      const dryRunText = dryRun ? '（演练）' : '';
      const messageText =
        (result && typeof result === 'object' && 'message' in result && (result as any).message) || '整理完成';
      messageApi.success(`${messageText}${suffix}${dryRunText}`);
      setResultData(payload);
      setRawResponse(result);
      setOpen(false);
      setResultOpen(true);
      onSuccess?.();
    },
    onError: (error: any) => {
      messageApi.error(error?.message || '整理失败，请重试');
    },
  });

  const renderBoolTag = (value?: boolean) => (
    <Tag color={value ? 'green' : 'default'}>{value ? '是' : '否'}</Tag>
  );

  const itemColumns = useMemo(
    () => [
      {
        title: '文件 ID',
        dataIndex: 'file_id',
        width: 160,
        ellipsis: true,
      },
      {
        title: '文件名',
        dataIndex: 'file_name',
        width: 220,
        ellipsis: true,
        render: (text: string) => (
          <Tooltip title={text}>
            <span>{text}</span>
          </Tooltip>
        ),
      },
      {
        title: 'Pickcode',
        dataIndex: 'pickcode',
        width: 140,
        ellipsis: true,
      },
      {
        title: '类型',
        dataIndex: 'media_type',
        width: 80,
      },
      {
        title: '分类',
        dataIndex: 'category',
        width: 120,
        ellipsis: true,
      },
      {
        title: '标题年份',
        dataIndex: 'title_year',
        width: 160,
        ellipsis: true,
      },
      {
        title: '转名',
        dataIndex: 'transfer_name',
        width: 200,
        ellipsis: true,
        render: (text: string) => (
          <Tooltip title={text}>
            <span>{text}</span>
          </Tooltip>
        ),
      },
      {
        title: '目标路径',
        dataIndex: 'target_path',
        width: 260,
        ellipsis: true,
        render: (text: string) => (
          <Tooltip title={text}>
            <span>{text}</span>
          </Tooltip>
        ),
      },
      {
        title: '重命名为',
        dataIndex: 'rename_to',
        width: 180,
        ellipsis: true,
      },
      {
        title: '目标目录 ID',
        dataIndex: 'target_dir_id',
        width: 160,
        ellipsis: true,
      },
      {
        title: '需创建',
        dataIndex: 'need_create',
        width: 100,
        render: (value: boolean) => renderBoolTag(value),
      },
      {
        title: '缺失目录',
        dataIndex: 'missing_dirs',
        width: 200,
        render: (value: string[]) => (value?.length ? value.join(' / ') : '-'),
      },
      {
        title: 'STRM 路径',
        dataIndex: 'strm_path',
        width: 260,
        ellipsis: true,
        render: (text: string) => (
          <Tooltip title={text}>
            <span>{text}</span>
          </Tooltip>
        ),
      },
      {
        title: '字幕入队',
        dataIndex: 'subtitle_queued',
        width: 100,
        render: (value: boolean) => renderBoolTag(value),
      },
      {
        title: '字幕错误',
        dataIndex: 'subtitle_error',
        width: 200,
        ellipsis: true,
      },
    ],
    [],
  );

  const dirDebugColumns = useMemo(
    () => [
      {
        title: '目标目录',
        dataIndex: 'target_dir',
        width: 240,
        ellipsis: true,
        render: (text: string) => (
          <Tooltip title={text}>
            <span>{text}</span>
          </Tooltip>
        ),
      },
      {
        title: '已存在目录',
        dataIndex: 'existing_dir',
        width: 220,
        ellipsis: true,
      },
      {
        title: '已存在 ID',
        dataIndex: 'existing_id',
        width: 180,
        ellipsis: true,
      },
      {
        title: '缺失目录',
        dataIndex: 'missing_dirs',
        width: 200,
        render: (value: string[]) => (value?.length ? value.join(' / ') : '-'),
      },
      {
        title: '需创建',
        dataIndex: 'need_create',
        width: 100,
        render: (value: boolean) => renderBoolTag(value),
      },
      {
        title: '最终 ID',
        dataIndex: 'final_id',
        width: 180,
        ellipsis: true,
      },
      {
        title: '查找记录',
        dataIndex: 'lookups',
        width: 240,
        render: (value: Array<{ path: string; id: string }>) =>
          value?.length ? (
            <Tooltip title={value.map((item) => `${item.path} => ${item.id}`).join('\n')}>
              <span>{value.length} 条</span>
            </Tooltip>
          ) : (
            '-'
          ),
      },
    ],
    [],
  );

  return (
    <>
      {contextHolder}
      <Button type="link" size="small" onClick={() => setOpen(true)}>
        整理
      </Button>
      <ModalForm<{ folder_id: string; dry_run: boolean }>
        title="整理 115 Cookie 目录"
        open={open}
        onOpenChange={setOpen}
        modalProps={{
          destroyOnClose: true,
        }}
        submitter={{
          submitButtonProps: { loading },
        }}
        initialValues={{
          dry_run: true,
        }}
        onFinish={async (values) => {
          await run({
            cloud_directory_id: record.id,
            folder_id: values.folder_id,
            dry_run: values.dry_run,
          });
          return true;
        }}
      >
        <ProFormText
          name="cloud_directory_name"
          label="目录配置"
          disabled
          initialValue={record.directory_name}
        />
        <ProFormText
          name="folder_id"
          label="115 目录 ID"
          placeholder="请输入 115 目录 ID"
          rules={[{ required: true, message: '请输入 115 目录 ID' }]}
        />
        <ProFormSwitch
          name="dry_run"
          label="演练模式"
          tooltip="预览模式：只计算路径/STRM，不执行创建/重命名/移动/字幕下载"
          fieldProps={{
            checkedChildren: '是',
            unCheckedChildren: '否',
          }}
        />
      </ModalForm>

      <Modal
        title="整理结果预览"
        open={resultOpen}
        onCancel={() => setResultOpen(false)}
        footer={null}
        width={1000}
        destroyOnClose
      >
        <ProDescriptions<API.Organize115CookieResult>
          column={3}
          dataSource={resultData}
          columns={[
            { title: '目录配置 ID', dataIndex: 'cloud_directory_id' },
            { title: '云存储 ID', dataIndex: 'cloud_storage_id' },
            { title: '目录 ID', dataIndex: 'folder_id' },
            {
              title: '演练模式',
              render: () => renderBoolTag(resultData?.dry_run),
            },
            { title: '总数', dataIndex: 'total' },
          ]}
        />

        <Tabs
          style={{ marginTop: 16 }}
          items={[
            {
              key: 'items',
              label: `处理明细 (${resultData?.items?.length || 0})`,
              children: (
                <ProTable
                  rowKey="file_id"
                  search={false}
                  options={false}
                  pagination={{ pageSize: 10, showSizeChanger: true }}
                  scroll={{ x: 'max-content', y: 360 }}
                  dataSource={resultData?.items || []}
                  columns={itemColumns}
                  expandable={{
                    expandedRowRender: (record) => (
                      <Typography.Paragraph style={{ margin: 0 }}>
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                          {JSON.stringify(record, null, 2)}
                        </pre>
                      </Typography.Paragraph>
                    ),
                  }}
                />
              ),
            },
            {
              key: 'dir-debug',
              label: `目录调试 (${resultData?.dir_debug?.length || 0})`,
              children: (
                <ProTable
                  rowKey={(row) => row.target_dir}
                  search={false}
                  options={false}
                  pagination={{ pageSize: 10, showSizeChanger: true }}
                  scroll={{ x: 'max-content', y: 360 }}
                  dataSource={resultData?.dir_debug || []}
                  columns={dirDebugColumns}
                  expandable={{
                    expandedRowRender: (record) => (
                      <Typography.Paragraph style={{ margin: 0 }}>
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                          {JSON.stringify(record, null, 2)}
                        </pre>
                      </Typography.Paragraph>
                    ),
                  }}
                />
              ),
            },
            {
              key: 'raw',
              label: '原始响应',
              children: (
                <Typography.Paragraph style={{ margin: 0 }}>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(rawResponse ?? resultData ?? {}, null, 2)}
                  </pre>
                </Typography.Paragraph>
              ),
            },
          ]}
        />
      </Modal>
    </>
  );
};

export default OrganizeModal;
