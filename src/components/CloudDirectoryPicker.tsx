import {
  FolderOpenOutlined,
  FolderOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  Button,
  Empty,
  Input,
  Modal,
  message,
  Space,
  Spin,
  Tree,
  Typography,
} from 'antd';
import type { DataNode } from 'antd/es/tree';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { get115CookieDirs, get115OpenDirs } from '@/services/film-fusion';

export const CLOUD_DIRECTORY_ROOT_ID = '0';
const PAGE_LIMIT = 1150;

type NodeMeta = {
  name: string;
  parentKey: string;
};

export type CloudDirectorySelection = {
  id: string;
  name: string;
  path: string;
};

type CloudDirectoryPickerProps = {
  open: boolean;
  accessMethod?: 'cookie' | 'openapi';
  cloudStorageId?: number;
  selectedId?: string;
  selectedPath?: string;
  onCancel: () => void;
  onSelect: (selection: CloudDirectorySelection) => void;
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

const CloudDirectoryPicker = ({
  open,
  accessMethod = 'cookie',
  cloudStorageId,
  selectedId,
  selectedPath,
  onCancel,
  onSelect,
}: CloudDirectoryPickerProps) => {
  const [messageApi, contextHolder] = message.useMessage();
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [nodeMeta, setNodeMeta] = useState<Map<string, NodeMeta>>(new Map());
  const [selectedKey, setSelectedKey] = useState(CLOUD_DIRECTORY_ROOT_ID);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([
    CLOUD_DIRECTORY_ROOT_ID,
  ]);
  const [searchValue, setSearchValue] = useState('');
  const [loading, setLoading] = useState(false);

  const registerMeta = useCallback(
    (entries: Array<{ key: string; name: string; parentKey: string }>) => {
      setNodeMeta((previous) => {
        const next = new Map(previous);
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
      if (key === CLOUD_DIRECTORY_ROOT_ID) return '/';
      const parts: string[] = [];
      let current = key;
      for (
        let index = 0;
        index < 100 && current !== CLOUD_DIRECTORY_ROOT_ID;
        index += 1
      ) {
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
    async (parentKey: string): Promise<API.Cookie115DirItem[]> => {
      if (!cloudStorageId) return [];
      setLoading(true);
      try {
        const getDirectories =
          accessMethod === 'openapi' ? get115OpenDirs : get115CookieDirs;
        const response = await getDirectories({
          cloud_storage_id: cloudStorageId,
          cid: parentKey,
          offset: 0,
          limit: PAGE_LIMIT,
        });
        if (response.code !== 0) {
          messageApi.error(response.message || '获取目录失败');
          return [];
        }
        const items = response.data?.items || [];
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
        if (parentKey === CLOUD_DIRECTORY_ROOT_ID) {
          setTreeData(children);
        } else {
          setTreeData((previous) =>
            updateTreeData(previous, parentKey, children),
          );
        }
        return items;
      } catch (error: any) {
        messageApi.error(error?.message || '获取目录失败');
        return [];
      } finally {
        setLoading(false);
      }
    },
    [accessMethod, cloudStorageId, messageApi, registerMeta],
  );

  useEffect(() => {
    if (!open || !cloudStorageId) return;
    let active = true;
    setTreeData([]);
    setNodeMeta(
      new Map([
        [
          CLOUD_DIRECTORY_ROOT_ID,
          { name: '根目录', parentKey: CLOUD_DIRECTORY_ROOT_ID },
        ],
      ]),
    );
    setSelectedKey(CLOUD_DIRECTORY_ROOT_ID);
    setExpandedKeys([CLOUD_DIRECTORY_ROOT_ID]);
    setSearchValue('');
    const restoreSelection = async () => {
      const segments = String(selectedPath || '')
        .split('/')
        .map((segment) => segment.trim())
        .filter(Boolean);
      let parentID = CLOUD_DIRECTORY_ROOT_ID;
      let resolvedID = CLOUD_DIRECTORY_ROOT_ID;
      const ancestors: React.Key[] = [CLOUD_DIRECTORY_ROOT_ID];
      if (segments.length === 0) {
        await loadChildren(CLOUD_DIRECTORY_ROOT_ID);
      } else {
        for (const [index, segment] of segments.entries()) {
          const items = await loadChildren(parentID);
          if (!active) return;
          const match = items.find((item) => item.name === segment);
          if (!match) break;
          parentID = match.file_id;
          resolvedID = match.file_id;
          if (index < segments.length - 1) ancestors.push(match.file_id);
        }
      }
      if (!active) return;
      setExpandedKeys(ancestors);
      setSelectedKey(
        selectedId && selectedId === resolvedID ? selectedId : resolvedID,
      );
    };
    void restoreSelection();
    return () => {
      active = false;
    };
  }, [cloudStorageId, loadChildren, open, selectedId, selectedPath]);

  const fullTreeData = useMemo<DataNode[]>(
    () => [
      {
        key: CLOUD_DIRECTORY_ROOT_ID,
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
      .filter(([key]) => key !== CLOUD_DIRECTORY_ROOT_ID)
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
      .sort((left, right) => left.path.localeCompare(right.path, 'zh-CN'))
      .slice(0, 100);
  }, [buildPath, nodeMeta, normalizedSearch]);

  const selectSearchResult = useCallback(
    (key: string) => {
      const ancestors: React.Key[] = [CLOUD_DIRECTORY_ROOT_ID];
      let current = key;
      for (
        let index = 0;
        index < 100 && current !== CLOUD_DIRECTORY_ROOT_ID;
        index += 1
      ) {
        const meta = nodeMeta.get(current);
        if (!meta || meta.parentKey === current) break;
        current = meta.parentKey;
        ancestors.push(current);
      }
      setSelectedKey(key);
      setExpandedKeys((previous) =>
        Array.from(new Set([...previous, ...ancestors])),
      );
      setSearchValue('');
    },
    [nodeMeta],
  );

  const confirmSelection = () => {
    const meta = nodeMeta.get(selectedKey);
    onSelect({
      id: selectedKey,
      name: meta?.name || '根目录',
      path: buildPath(selectedKey),
    });
  };

  return (
    <>
      {contextHolder}
      <Modal
        destroyOnHidden
        onCancel={onCancel}
        onOk={confirmSelection}
        okText="使用此目录"
        open={open}
        title="选择 115 目录"
        width={560}
      >
        {!cloudStorageId ? (
          <Empty description="请先选择 115 账号" />
        ) : (
          <Spin spinning={loading}>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Input
                allowClear
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="搜索已加载的目录名称或路径"
                prefix={<SearchOutlined />}
                value={searchValue}
              />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                搜索范围会随着目录展开逐步增加。
              </Typography.Text>
              {normalizedSearch ? (
                searchResults.length > 0 ? (
                  <Space
                    direction="vertical"
                    size={2}
                    style={{ width: '100%', maxHeight: 410, overflow: 'auto' }}
                  >
                    {searchResults.map((item) => (
                      <Button
                        block
                        icon={<FolderOutlined />}
                        key={item.key}
                        onClick={() => selectSearchResult(item.key)}
                        style={{
                          height: 'auto',
                          minHeight: 44,
                          paddingBlock: 6,
                          justifyContent: 'flex-start',
                          textAlign: 'left',
                          whiteSpace: 'normal',
                        }}
                        type="text"
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
                    description="已加载目录中没有匹配项"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                )
              ) : (
                <Tree
                  blockNode
                  expandedKeys={expandedKeys}
                  loadData={(node) => loadChildren(String(node.key))}
                  onExpand={(keys) => setExpandedKeys(keys)}
                  onSelect={(keys) => {
                    if (keys.length > 0) setSelectedKey(String(keys[0]));
                  }}
                  selectedKeys={[selectedKey]}
                  showIcon
                  style={{ maxHeight: 410, overflow: 'auto' }}
                  treeData={fullTreeData}
                />
              )}
            </Space>
          </Spin>
        )}
      </Modal>
    </>
  );
};

export default CloudDirectoryPicker;
