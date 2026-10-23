import { FolderOpenOutlined } from '@ant-design/icons';
import { Alert, Button, Input, Modal, Select } from 'antd';
import { useEffect, useRef, useState } from 'react';
import CloudDirectoryPicker, {
  type CloudDirectorySelection,
} from '@/components/CloudDirectoryPicker';
import {
  type CloudFileAccessMethod,
  type CloudFileItem,
  type CloudFileList,
  type CloudFolderMoveResult,
  getCloudFiles,
  moveCloudFileToFolder,
} from '@/services/film-fusion/cloudFileMove';
import { getCloudStorageList } from '@/services/film-fusion/cloudStorage';
import type { EmbyLibraryCheckItem } from '@/services/film-fusion/embyLibraryCheck';

const PAGE_SIZE = 100;
const joinPath = (parent: string, name: string) =>
  `${parent.replace(/\/$/, '')}/${name}`;
const errorMessage = (error: unknown) => {
  const failure = error as {
    message?: string;
    response?: { status?: number; data?: { message?: string } };
  };
  if (failure?.response?.status === 401)
    return '登录已过期，请重新登录后再操作';
  return (
    failure?.response?.data?.message || failure?.message || '请求失败，请重试'
  );
};

function folderNameError(value: string) {
  const name = value.trim();
  if (!name) return '请输入文件夹名称';
  if (
    name === '.' ||
    name === '..' ||
    /[/\\<>:"|?*]/.test(name) ||
    Array.from(name).some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  ) {
    return '文件夹名称不能包含路径分隔符或 / \\ < > : " | ? * 等特殊字符';
  }
  if (new TextEncoder().encode(name).length > 255)
    return '文件夹名称超过 255 字节，请缩短名称';
  return '';
}

export default function FolderMoveModal({
  item,
  stale,
  onClose,
  onMoved,
}: {
  item: EmbyLibraryCheckItem;
  stale: boolean;
  onClose: () => void;
  onMoved: (targetPath: string) => void;
}) {
  const [storages, setStorages] = useState<API.CloudStorage[]>([]);
  const [storageLoading, setStorageLoading] = useState(true);
  const [storageError, setStorageError] = useState('');
  const [storageId, setStorageId] = useState<number>();
  const [method, setMethod] = useState<CloudFileAccessMethod>();
  const [source, setSource] = useState<CloudDirectorySelection>();
  const [target, setTarget] = useState<CloudDirectorySelection>();
  const [picker, setPicker] = useState<'source' | 'target' | null>(null);
  const [folderName, setFolderName] = useState(item.name);
  const [files, setFiles] = useState<CloudFileList | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState('');
  const [fileQuery, setFileQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<CloudFileItem>();
  const [moveError, setMoveError] = useState('');
  const [pendingFolder, setPendingFolder] = useState<CloudFolderMoveResult>();
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState<CloudFolderMoveResult>();
  const [strmRetryError, setStrmRetryError] = useState('');
  const filesRequest = useRef<AbortController | null>(null);
  const storageRequest = useRef<AbortController | null>(null);
  const savingRef = useRef(false);
  const selectedStorage = storages.find((storage) => storage.id === storageId);
  const methodOptions = [
    ...(selectedStorage?.cookie ? [{ value: 'cookie', label: 'Cookie' }] : []),
    ...(selectedStorage?.access_token
      ? [{ value: 'openapi', label: 'OpenAPI' }]
      : []),
  ];
  const nameError = folderNameError(folderName);
  const targetFolderPath = target
    ? joinPath(target.path, folderName.trim())
    : '';
  const finalPath =
    targetFolderPath && selectedFile
      ? joinPath(targetFolderPath, selectedFile.name)
      : '';
  const locked = saving || !!completed;
  const canMove =
    !!(storageId && method && source && target && selectedFile) &&
    !nameError &&
    !fileLoading &&
    !fileError &&
    !locked &&
    !stale;
  const canRetryStrm =
    completed?.strm?.status === 'failed' &&
    !!completed.folder_id &&
    !saving &&
    !stale;

  const loadStorages = async () => {
    storageRequest.current?.abort();
    const controller = new AbortController();
    storageRequest.current = controller;
    setStorageLoading(true);
    setStorageError('');
    try {
      const collected: API.CloudStorage[] = [];
      let current = 1;
      while (true) {
        const response = await getCloudStorageList(
          { current, pageSize: 100, storage_type: '115open' },
          { signal: controller.signal, skipErrorHandler: true },
        );
        if (controller.signal.aborted) return;
        if (response.code !== 0)
          throw new Error(response.message || '读取已配置账号失败');
        const page = response.data?.list || [];
        collected.push(...page);
        if (page.length === 0 || collected.length >= response.data.total) break;
        current++;
      }
      setStorages(
        collected.filter((storage) => storage.storage_type === '115open'),
      );
    } catch (error) {
      if (!controller.signal.aborted) setStorageError(errorMessage(error));
    } finally {
      if (!controller.signal.aborted) setStorageLoading(false);
    }
  };

  useEffect(() => {
    void loadStorages();
    return () => {
      storageRequest.current?.abort();
      filesRequest.current?.abort();
    };
  }, []);

  const resetMove = () => {
    setPendingFolder(undefined);
    setMoveError('');
  };

  const resetDirectories = () => {
    filesRequest.current?.abort();
    setSource(undefined);
    setTarget(undefined);
    setSelectedFile(undefined);
    setFiles(null);
    setFileLoading(false);
    setFileError('');
    setFileQuery('');
    resetMove();
  };

  const loadFiles = async (
    directory: CloudDirectorySelection,
    offset: number,
  ) => {
    if (!storageId || !method || locked || stale) return;
    filesRequest.current?.abort();
    const controller = new AbortController();
    filesRequest.current = controller;
    setFileLoading(true);
    setFileError('');
    try {
      const response = await getCloudFiles(
        storageId,
        { access_method: method, cid: directory.id, offset, limit: PAGE_SIZE },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      if (response.code !== 0)
        throw new Error(response.message || '读取文件失败');
      setFiles(response.data);
    } catch (error) {
      if (!controller.signal.aborted) setFileError(errorMessage(error));
    } finally {
      if (!controller.signal.aborted) setFileLoading(false);
    }
  };

  const handleDirectory = (selection: CloudDirectorySelection) => {
    if (locked || stale) return;
    resetMove();
    if (picker === 'source') {
      setSource(selection);
      setSelectedFile(undefined);
      setFiles(null);
      setFileQuery('');
      void loadFiles(selection, 0);
    } else {
      setTarget(selection);
    }
    setPicker(null);
  };

  const rememberFailure = (text: string, data?: CloudFolderMoveResult) => {
    setMoveError(text);
    if (data?.folder_id) setPendingFolder(data);
  };

  const move = async (retryStrm = false) => {
    if (
      !(retryStrm ? canRetryStrm : canMove) ||
      !storageId ||
      !method ||
      !source ||
      !target ||
      !selectedFile ||
      savingRef.current
    )
      return;
    savingRef.current = true;
    setSaving(true);
    setMoveError('');
    setStrmRetryError('');
    const folderId = retryStrm
      ? completed?.folder_id
      : pendingFolder?.folder_id;
    try {
      const response = await moveCloudFileToFolder(storageId, {
        access_method: method,
        source_parent_id: source.id,
        file_id: selectedFile.file_id,
        file_name: selectedFile.name,
        target_parent_id: target.id,
        folder_name: folderName.trim(),
        ...(folderId ? { folder_id: folderId } : {}),
      });
      if (
        response.code !== 0 ||
        !['moved', 'already_moved'].includes(response.data?.status)
      ) {
        if (retryStrm) {
          setStrmRetryError(
            response.message || '未能确认 STRM 生成结果，请重试',
          );
        } else {
          rememberFailure(
            response.message || '移动尚未完成，请确认后重试',
            response.data,
          );
        }
        return;
      }
      setCompleted(response.data);
      setPendingFolder(undefined);
      onMoved(finalPath);
    } catch (error) {
      const detail = error as {
        response?: { data?: { data?: CloudFolderMoveResult } };
      };
      if (retryStrm) {
        setStrmRetryError(errorMessage(error));
      } else {
        rememberFailure(errorMessage(error), detail?.response?.data?.data);
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const shownFiles = (files?.items || []).filter(
    (file) =>
      file.is_file &&
      file.name
        .toLocaleLowerCase()
        .includes(fileQuery.trim().toLocaleLowerCase()),
  );
  const selectedDirectory = picker === 'source' ? source : target;

  return (
    <>
      <Modal
        open
        title="创建文件夹并移入文件"
        width={720}
        onCancel={saving ? undefined : onClose}
        closable={!saving}
        keyboard={!saving}
        mask={{ closable: !saving }}
        footer={
          completed ? (
            <div className="flex flex-wrap justify-end gap-2">
              {completed.strm?.status === 'failed' && (
                <Button
                  aria-label="重试生成 STRM"
                  disabled={!canRetryStrm}
                  loading={saving}
                  onClick={() => move(true)}
                >
                  重试生成 STRM
                </Button>
              )}
              <Button type="primary" disabled={saving} onClick={onClose}>
                完成
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap justify-end gap-2">
              <Button disabled={saving} onClick={onClose}>
                取消
              </Button>
              <Button
                type="primary"
                aria-label={pendingFolder ? '重试移入文件' : '创建文件夹并移入'}
                disabled={!canMove}
                loading={saving}
                onClick={() => move()}
              >
                {pendingFolder ? '重试移入文件' : '创建文件夹并移入'}
              </Button>
            </div>
          )
        }
      >
        <div className="space-y-4">
          <p className="m-0 text-sm text-neutral-500 dark:text-white/50">
            选择已配置的 115
            账号、具体文件和自定义目标位置。目录选择与文件列表会读取
            115；确认后创建或复用同名文件夹，再移动所选文件，检测到同名冲突时停止。
            匹配云路径映射后生成本地 STRM。
          </p>
          {stale && !completed && (
            <Alert
              showIcon
              type="warning"
              title="查询名称已修改，请关闭弹窗并重新查询后再操作"
            />
          )}
          {storageError && (
            <Alert
              showIcon
              type="error"
              title="读取账号失败"
              description={storageError}
              action={
                <Button size="small" onClick={loadStorages}>
                  重试
                </Button>
              }
            />
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <label
                htmlFor="folder-move-storage"
                className="mb-1.5 block text-sm font-medium"
              >
                115 账号
              </label>
              <Select
                id="folder-move-storage"
                aria-label="115 账号"
                className="w-full"
                placeholder="选择已配置的账号"
                value={storageId}
                loading={storageLoading}
                disabled={locked || stale}
                options={storages.map((storage) => ({
                  value: storage.id,
                  label: storage.storage_name,
                  disabled:
                    storage.status !== 'active' ||
                    (!storage.cookie && !storage.access_token),
                }))}
                onChange={(value: number) => {
                  setStorageId(value);
                  const storage = storages.find((entry) => entry.id === value);
                  setMethod(
                    storage?.cookie && !storage.access_token
                      ? 'cookie'
                      : storage?.access_token && !storage.cookie
                        ? 'openapi'
                        : undefined,
                  );
                  resetDirectories();
                }}
              />
              {!storageLoading && !storageError && storages.length === 0 && (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                  请先在云存储管理中配置 115 账号。
                </p>
              )}
            </div>
            <div className="min-w-0">
              <label
                htmlFor="folder-move-method"
                className="mb-1.5 block text-sm font-medium"
              >
                访问方式
              </label>
              <Select
                id="folder-move-method"
                aria-label="访问方式"
                className="w-full"
                value={method}
                disabled={!storageId || locked || stale}
                placeholder="选择 Cookie 或 OpenAPI"
                options={methodOptions}
                onChange={(value: CloudFileAccessMethod) => {
                  setMethod(value);
                  resetDirectories();
                }}
              />
            </div>
          </div>
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">来源目录</span>
              <Button
                size="small"
                icon={<FolderOpenOutlined aria-hidden="true" />}
                disabled={!method || locked || stale}
                onClick={() => setPicker('source')}
              >
                选择来源目录
              </Button>
            </div>
            <p className="m-0 text-xs break-all text-neutral-500 dark:text-white/50">
              {source?.path || '请明确选择文件所在目录'}
            </p>
            {source && (
              <div className="mt-3 rounded-lg border border-neutral-200 p-3 dark:border-white/10">
                <div className="mb-2 flex flex-wrap gap-2">
                  <Input
                    aria-label="筛选本页文件"
                    placeholder="筛选本页文件"
                    value={fileQuery}
                    allowClear
                    disabled={locked || stale}
                    onChange={(event) => setFileQuery(event.target.value)}
                    className="min-w-0 flex-1"
                  />
                  <Button
                    disabled={locked || stale}
                    loading={fileLoading}
                    onClick={() => loadFiles(source, files?.offset || 0)}
                  >
                    刷新文件
                  </Button>
                </div>
                {fileError && (
                  <Alert
                    showIcon
                    type="error"
                    title="读取文件失败"
                    description={fileError}
                  />
                )}
                {fileLoading ? (
                  <output className="my-4 block text-sm text-neutral-500">
                    正在读取文件列表…
                  </output>
                ) : (
                  !fileError && (
                    <fieldset
                      aria-label="选择要移入的文件"
                      className="m-0 max-h-52 min-w-0 space-y-1 overflow-y-auto border-0 p-0"
                    >
                      {shownFiles.length ? (
                        shownFiles.map((file) => (
                          <label
                            key={file.file_id}
                            className="flex min-w-0 cursor-pointer items-start gap-2 rounded px-1 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-white/5"
                          >
                            <input
                              type="radio"
                              name="folder-move-file"
                              value={file.file_id}
                              checked={selectedFile?.file_id === file.file_id}
                              disabled={locked || stale}
                              className="mt-1 shrink-0"
                              onChange={() => {
                                setSelectedFile(file);
                                resetMove();
                              }}
                            />
                            <span className="min-w-0 break-all">
                              {file.name}
                            </span>
                          </label>
                        ))
                      ) : (
                        <p className="my-3 text-sm text-neutral-500">
                          本页没有可选文件，请更换筛选、页码或来源目录。
                        </p>
                      )}
                    </fieldset>
                  )
                )}
                {files && (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-2 dark:border-white/10">
                    <span className="text-xs text-neutral-500">
                      第 {Math.floor(files.offset / PAGE_SIZE) + 1} 页，共{' '}
                      {files.total} 个条目，仅可选择文件
                    </span>
                    <div className="flex gap-2">
                      <Button
                        size="small"
                        disabled={
                          files.offset === 0 || fileLoading || locked || stale
                        }
                        onClick={() =>
                          loadFiles(
                            source,
                            Math.max(0, files.offset - PAGE_SIZE),
                          )
                        }
                      >
                        上一页
                      </Button>
                      <Button
                        size="small"
                        disabled={
                          files.offset + files.limit >= files.total ||
                          fileLoading ||
                          locked ||
                          stale
                        }
                        onClick={() =>
                          loadFiles(source, files.offset + files.limit)
                        }
                      >
                        下一页
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">
                目标父目录（自定义位置）
              </span>
              <Button
                size="small"
                icon={<FolderOpenOutlined aria-hidden="true" />}
                disabled={!method || locked || stale}
                onClick={() => setPicker('target')}
              >
                选择目标父目录
              </Button>
            </div>
            <p className="m-0 text-xs break-all text-neutral-500 dark:text-white/50">
              {target?.path || '尚未选择；请指定新文件夹要创建在哪里'}
            </p>
          </div>
          <div>
            <label
              htmlFor="folder-move-name"
              className="mb-1.5 block text-sm font-medium"
            >
              文件夹名称
            </label>
            <Input
              id="folder-move-name"
              value={folderName}
              disabled={locked || stale}
              status={nameError ? 'error' : undefined}
              onChange={(event) => {
                setFolderName(event.target.value);
                resetMove();
              }}
            />
            {nameError && (
              <p className="mt-1 mb-0 text-xs text-red-600 dark:text-red-400">
                {nameError}
              </p>
            )}
          </div>
          <div className="space-y-2 rounded-lg bg-neutral-50 p-3 text-xs dark:bg-white/5">
            <p className="m-0 break-all">
              来源文件：
              {source && selectedFile
                ? joinPath(source.path, selectedFile.name)
                : '尚未选择具体文件'}
            </p>
            <p className="m-0 break-all">
              最终位置：
              {finalPath || '选择目标父目录、文件并填写文件夹名称后显示'}
            </p>
          </div>
          {moveError && (
            <Alert
              showIcon
              type="error"
              title={
                pendingFolder
                  ? '文件夹已创建或复用，文件移动尚未完成'
                  : '文件移动失败'
              }
              description={
                <div className="space-y-1 break-words">
                  <div>{moveError}</div>
                  {pendingFolder && (
                    <div>
                      目标文件夹 ID：{pendingFolder.folder_id}
                      。保留当前选择后重试会复用此文件夹。
                    </div>
                  )}
                </div>
              }
            />
          )}
          {completed && (
            <Alert
              showIcon
              type="success"
              title={
                completed.status === 'already_moved'
                  ? '文件已在目标文件夹中'
                  : '文件已移入目标文件夹'
              }
              description={`${completed.reused_folder ? '已复用同名文件夹。' : ''}Emby 入库状态需等待媒体库扫描后重新查询。`}
            />
          )}
          {completed?.strm && (
            <Alert
              showIcon
              type={
                completed.strm.status === 'created'
                  ? 'success'
                  : completed.strm.status === 'skipped'
                    ? 'info'
                    : 'error'
              }
              title={
                completed.strm.status === 'created'
                  ? '本地 STRM 已生成'
                  : completed.strm.status === 'skipped'
                    ? '已跳过 STRM 生成'
                    : '本地 STRM 生成失败'
              }
              description={
                <div className="space-y-1 break-words">
                  <div>{completed.strm.message}</div>
                  {completed.strm.cloud_path_id != null && (
                    <div>云路径映射：#{completed.strm.cloud_path_id}</div>
                  )}
                  {completed.strm.local_path && (
                    <div className="break-all">
                      本地路径：{completed.strm.local_path}
                    </div>
                  )}
                  {strmRetryError && (
                    <div>
                      重试失败：{strmRetryError}。115
                      文件已移动，当前选择已保留。
                    </div>
                  )}
                </div>
              }
            />
          )}
        </div>
      </Modal>
      {picker && (
        <CloudDirectoryPicker
          open
          accessMethod={method}
          cloudStorageId={storageId}
          selectedId={selectedDirectory?.id}
          selectedPath={selectedDirectory?.path}
          onCancel={() => setPicker(null)}
          onSelect={handleDirectory}
        />
      )}
    </>
  );
}
