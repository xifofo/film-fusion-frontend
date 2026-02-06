import {
  ModalForm,
  ProDescriptions,
  ProFormSwitch,
  ProFormText,
  ProTable,
} from '@ant-design/pro-components';
import { Button, Form, message, Modal, Tabs, Tag, Tooltip, TreeSelect, Typography } from 'antd';
import React, { useMemo, useState } from 'react';
import { useRequest } from '@umijs/max';
import { get115CookieDirs, organize115Cookie } from '@/services/film-fusion';

type DirTreeNode = {
  id: string;
  pId: string;
  value: string;
  title: string;
  isLeaf?: boolean;
};

export type OrganizeModalProps = {
  record: API.CloudDirectory;
  onSuccess?: () => void;
};

const OrganizeModal: React.FC<OrganizeModalProps> = ({ record, onSuccess }) => {
  const [open, setOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [resultData, setResultData] = useState<API.Organize115CookieResult>();
  const [rawResponse, setRawResponse] = useState<any>();
  const [lastRequest, setLastRequest] = useState<API.Organize115CookieParams>();
  const [returnToFormOnSuccess, setReturnToFormOnSuccess] = useState(false);
  const [treeData, setTreeData] = useState<DirTreeNode[]>([]);
  const [loadedIds, setLoadedIds] = useState<Set<string>>(new Set());
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
      setLastRequest({
        cloud_directory_id: record.id,
        folder_id: payload?.folder_id || lastRequest?.folder_id || '',
        dry_run: payload?.dry_run ?? lastRequest?.dry_run,
      });
      if (returnToFormOnSuccess) {
        setResultOpen(false);
        setOpen(true);
        setReturnToFormOnSuccess(false);
      } else {
        setOpen(false);
        setResultOpen(true);
      }
      onSuccess?.();
    },
    onError: (error: any) => {
      messageApi.error(error?.message || '整理失败，请重试');
    },
  });

  const appendChildren = (parentId: string, items: API.Cookie115DirItem[]) => {
    setTreeData((prev) => {
      const existingIds = new Set(prev.map((node) => node.id));
      const next = [...prev];
      items.forEach((item) => {
        if (!existingIds.has(item.file_id)) {
          next.push({
            id: item.file_id,
            pId: parentId,
            value: item.file_id,
            title: item.name,
            isLeaf: false,
          });
        }
      });
      return next;
    });
  };

  const markLeaf = (nodeId: string) => {
    setTreeData((prev) =>
      prev.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              isLeaf: true,
            }
          : node,
      ),
    );
  };

  const loadChildren = async (parentId: string, force = false) => {
    if (!record.cloud_storage_id) {
      messageApi.error('云存储 ID 无效');
      return;
    }
    if (!force && loadedIds.has(parentId)) return;
    try {
      const result = await get115CookieDirs({
        cloud_storage_id: record.cloud_storage_id,
        cid: parentId,
        offset: 0,
        limit: 1150,
      });
      if (result.code !== 0) {
        messageApi.error(result.message || '获取目录失败');
        return;
      }
      const items = result.data?.items || [];
      if (items.length === 0) {
        if (parentId !== '0') {
          markLeaf(parentId);
        }
      } else {
        appendChildren(parentId, items);
      }
      setLoadedIds((prev) => new Set(prev).add(parentId));
    } catch (error: any) {
      messageApi.error(error?.message || '获取目录失败');
    }
  };

  const handleOpenChange = async (visible: boolean) => {
    setOpen(visible);
    if (visible) {
      setTreeData([]);
      setLoadedIds(new Set());
      await loadChildren('0', true);
    }
  };

  const handleLoadData = async (node: any) => {
    const nodeId = node?.id || node?.value;
    if (!nodeId) return;
    await loadChildren(String(nodeId));
  };

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
        onOpenChange={handleOpenChange}
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
          const params = {
            cloud_directory_id: record.id,
            folder_id: values.folder_id,
            dry_run: values.dry_run,
          };
          setLastRequest(params);
          await run(params);
          return true;
        }}
      >
        <ProFormText
          name="cloud_directory_name"
          label="目录配置"
          disabled
          initialValue={record.directory_name}
        />
        <Form.Item
          name="folder_id"
          label="115 目录 ID"
          rules={[{ required: true, message: '请选择 115 目录' }]}
        >
          <TreeSelect
            treeDataSimpleMode={{ rootPId: '0' }}
            treeData={treeData}
            placeholder="请选择目录"
            loadData={handleLoadData}
            showSearch
            treeLine
            style={{ width: '100%' }}
            filterTreeNode={(input, node) =>
              String(node?.title || '').toLowerCase().includes(input.toLowerCase())
            }
            dropdownStyle={{ maxHeight: 420, overflow: 'auto' }}
          />
        </Form.Item>
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
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button
              onClick={() => {
                if (!lastRequest) return;
                setReturnToFormOnSuccess(false);
                run({ ...lastRequest });
              }}
              loading={loading}
              disabled={!lastRequest}
            >
              重新整理
            </Button>
            <Button
              type="primary"
              onClick={() => {
                if (!lastRequest) return;
                setReturnToFormOnSuccess(true);
                run({ ...lastRequest, dry_run: false });
              }}
              loading={loading}
              disabled={!lastRequest || lastRequest?.dry_run === false}
            >
              确认整理
            </Button>
          </div>
        }
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
