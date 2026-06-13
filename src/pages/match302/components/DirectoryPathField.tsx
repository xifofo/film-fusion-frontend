import { FolderOpenOutlined, FolderOutlined } from '@ant-design/icons';
import { Button, Empty, Form, Input, message, Modal, Spin, Tree } from 'antd';
import type { InputProps } from 'antd';
import type { DataNode } from 'antd/es/tree';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { get115CookieDirs } from '@/services/film-fusion';

const ROOT_KEY = '0';
const PAGE_LIMIT = 1150;

type NodeMeta = {
  name: string;
  parentKey: string;
};

type DirectoryPickerProps = {
  open: boolean;
  cloudStorageId?: number;
  onCancel: () => void;
  onSelect: (path: string) => void;
};

type DirectoryInputProps = Omit<InputProps, 'value' | 'onChange'> & {
  value?: string;
  onChange?: (value: string) => void;
  cloudStorageId?: number;
};

type DirectoryPathFieldProps = {
  name: string;
  label: string;
  cloudStorageId?: number;
  placeholder?: string;
  extra?: React.ReactNode;
  required?: boolean;
};

const updateTreeData = (list: DataNode[], key: React.Key, children: DataNode[]): DataNode[] =>
  list.map((node) => {
    if (node.key === key) {
      return {
        ...node,
        children,
        isLeaf: children.length === 0,
      };
    }
    if (node.children) {
      return {
        ...node,
        children: updateTreeData(node.children, key, children),
      };
    }
    return node;
  });

const DirectoryPicker: React.FC<DirectoryPickerProps> = ({
  open,
  cloudStorageId,
  onCancel,
  onSelect,
}) => {
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [nodeMeta, setNodeMeta] = useState<Map<string, NodeMeta>>(new Map());
  const [selectedKey, setSelectedKey] = useState<string>(ROOT_KEY);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([ROOT_KEY]);
  const [loading, setLoading] = useState(false);

  const registerMeta = useCallback((entries: Array<{ key: string; name: string; parentKey: string }>) => {
    setNodeMeta((prev) => {
      const next = new Map(prev);
      entries.forEach(({ key, name, parentKey }) => {
        next.set(key, { name, parentKey });
      });
      return next;
    });
  }, []);

  const buildPath = useCallback(
    (key: string) => {
      if (key === ROOT_KEY) return '/';
      const parts: string[] = [];
      let current = key;
      for (let i = 0; i < 100 && current !== ROOT_KEY; i += 1) {
        const meta = nodeMeta.get(current);
        if (!meta) break;
        parts.unshift(meta.name);
        current = meta.parentKey;
      }
      return `/${parts.join('/')}`;
    },
    [nodeMeta],
  );

  const loadChildren = useCallback(
    async (parentKey: string) => {
      if (!cloudStorageId) return;
      setLoading(true);
      try {
        const res = await get115CookieDirs({
          cloud_storage_id: cloudStorageId,
          cid: parentKey,
          offset: 0,
          limit: PAGE_LIMIT,
        });
        if (res.code !== 0) {
          message.error(res.message || '获取目录失败');
          return;
        }
        const items = res.data?.items || [];
        const children: DataNode[] = items.map((item) => ({
          key: item.file_id,
          title: item.name,
          isLeaf: false,
          icon: <FolderOutlined />,
        }));
        registerMeta(items.map((item) => ({
          key: item.file_id,
          name: item.name,
          parentKey,
        })));
        if (parentKey === ROOT_KEY) {
          setTreeData(children);
        } else {
          setTreeData((prev) => updateTreeData(prev, parentKey, children));
        }
      } catch (err: any) {
        message.error(err?.message || '获取目录失败');
      } finally {
        setLoading(false);
      }
    },
    [cloudStorageId, registerMeta],
  );

  useEffect(() => {
    if (!open || !cloudStorageId) return;
    setTreeData([]);
    setNodeMeta(new Map([[ROOT_KEY, { name: '根目录', parentKey: ROOT_KEY }]]));
    setSelectedKey(ROOT_KEY);
    setExpandedKeys([ROOT_KEY]);
    loadChildren(ROOT_KEY);
  }, [cloudStorageId, loadChildren, open]);

  const fullTreeData = useMemo<DataNode[]>(() => [
    {
      key: ROOT_KEY,
      title: '根目录',
      icon: <FolderOpenOutlined />,
      children: treeData,
    },
  ], [treeData]);

  return (
    <Modal
      title="选择 115 目录"
      open={open}
      onCancel={onCancel}
      onOk={() => onSelect(buildPath(selectedKey))}
      okText="使用此目录"
      width={560}
      destroyOnClose
    >
      {!cloudStorageId ? (
        <Empty description="请先选择账号" />
      ) : (
        <Spin spinning={loading}>
          <Tree
            showIcon
            blockNode
            loadData={(node) => loadChildren(String(node.key))}
            treeData={fullTreeData}
            selectedKeys={[selectedKey]}
            expandedKeys={expandedKeys}
            onExpand={(keys) => setExpandedKeys(keys)}
            onSelect={(keys) => {
              if (keys.length > 0) {
                setSelectedKey(String(keys[0]));
              }
            }}
            style={{ maxHeight: 460, overflow: 'auto' }}
          />
        </Spin>
      )}
    </Modal>
  );
};

const DirectoryInput: React.FC<DirectoryInputProps> = ({
  value,
  onChange,
  cloudStorageId,
  placeholder,
  ...rest
}) => {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <>
      <Input
        {...rest}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange?.(event.target.value)}
        addonAfter={(
          <Button
            type="link"
            size="small"
            disabled={!cloudStorageId}
            onClick={() => setPickerOpen(true)}
          >
            选择
          </Button>
        )}
      />
      <DirectoryPicker
        open={pickerOpen}
        cloudStorageId={cloudStorageId}
        onCancel={() => setPickerOpen(false)}
        onSelect={(path) => {
          onChange?.(path);
          setPickerOpen(false);
        }}
      />
    </>
  );
};

const DirectoryPathField: React.FC<DirectoryPathFieldProps> = ({
  name,
  label,
  cloudStorageId,
  placeholder,
  extra,
  required,
}) => (
  <Form.Item
    name={name}
    label={label}
    extra={extra}
    rules={[
      ...(required ? [{ required: true, message: `请选择${label}` }] : []),
      { max: 500, message: `${label}最大长度为500字符` },
    ]}
  >
    <DirectoryInput
      cloudStorageId={cloudStorageId}
      placeholder={placeholder}
    />
  </Form.Item>
);

export default DirectoryPathField;
