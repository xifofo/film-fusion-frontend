import {
  FolderOpenOutlined,
  FolderOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { InputProps } from 'antd';
import {
  Button,
  Empty,
  Form,
  Input,
  Modal,
  message,
  Space,
  Spin,
  Tree,
  Typography,
} from 'antd';
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

const updateTreeData = (
  list: DataNode[],
  key: React.Key,
  children: DataNode[],
): DataNode[] =>
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
  const [searchValue, setSearchValue] = useState('');
  const [loading, setLoading] = useState(false);

  const registerMeta = useCallback(
    (entries: Array<{ key: string; name: string; parentKey: string }>) => {
      setNodeMeta((prev) => {
        const next = new Map(prev);
        entries.forEach(({ key, name, parentKey }) => {
          next.set(key, { name, parentKey });
        });
        return next;
      });
    },
    [],
  );

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
        registerMeta(
          items.map((item) => ({
            key: item.file_id,
            name: item.name,
            parentKey,
          })),
        );
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
    setSearchValue('');
    loadChildren(ROOT_KEY);
  }, [cloudStorageId, loadChildren, open]);

  const fullTreeData = useMemo<DataNode[]>(
    () => [
      {
        key: ROOT_KEY,
        title: '根目录',
        icon: <FolderOpenOutlined />,
        children: treeData,
      },
    ],
    [treeData],
  );

  const normalizedSearch = searchValue.trim().toLocaleLowerCase();
  const searchResults = useMemo(() => {
    if (!normalizedSearch) return [];
    return Array.from(nodeMeta.entries())
      .filter(([key]) => key !== ROOT_KEY)
      .map(([key, meta]) => ({
        key,
        name: meta.name,
        path: buildPath(key),
      }))
      .filter(
        (item) =>
          item.name.toLocaleLowerCase().includes(normalizedSearch) ||
          item.path.toLocaleLowerCase().includes(normalizedSearch),
      )
      .sort((a, b) => a.path.localeCompare(b.path, 'zh-CN'))
      .slice(0, 100);
  }, [buildPath, nodeMeta, normalizedSearch]);

  const selectSearchResult = useCallback(
    (key: string) => {
      const ancestors: React.Key[] = [ROOT_KEY];
      let current = key;
      for (let i = 0; i < 100 && current !== ROOT_KEY; i += 1) {
        const meta = nodeMeta.get(current);
        if (!meta || meta.parentKey === current) break;
        current = meta.parentKey;
        ancestors.push(current);
      }
      setSelectedKey(key);
      setExpandedKeys((prev) => Array.from(new Set([...prev, ...ancestors])));
      setSearchValue('');
    },
    [nodeMeta],
  );

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
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="搜索已加载的目录名称或路径"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
            />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              前端搜索仅覆盖已加载目录；展开更多层级后即可继续搜索。
            </Typography.Text>
            {normalizedSearch ? (
              searchResults.length > 0 ? (
                <Space
                  direction="vertical"
                  size={2}
                  style={{
                    width: '100%',
                    maxHeight: 410,
                    overflow: 'auto',
                  }}
                >
                  {searchResults.map((item) => (
                    <Button
                      key={item.key}
                      type="text"
                      block
                      icon={<FolderOutlined />}
                      onClick={() => selectSearchResult(item.key)}
                      style={{
                        height: 'auto',
                        minHeight: 44,
                        paddingBlock: 6,
                        justifyContent: 'flex-start',
                        textAlign: 'left',
                        whiteSpace: 'normal',
                      }}
                    >
                      <span>
                        <Typography.Text strong>{item.name}</Typography.Text>
                        <br />
                        <Typography.Text
                          type="secondary"
                          style={{ fontSize: 12, wordBreak: 'break-all' }}
                        >
                          {item.path}
                        </Typography.Text>
                      </span>
                    </Button>
                  ))}
                </Space>
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="已加载目录中没有匹配项"
                />
              )
            ) : (
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
                style={{ maxHeight: 410, overflow: 'auto' }}
              />
            )}
          </Space>
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
        addonAfter={
          <Button
            type="link"
            size="small"
            disabled={!cloudStorageId}
            onClick={() => setPickerOpen(true)}
          >
            选择
          </Button>
        }
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
    <DirectoryInput cloudStorageId={cloudStorageId} placeholder={placeholder} />
  </Form.Item>
);

export default DirectoryPathField;
