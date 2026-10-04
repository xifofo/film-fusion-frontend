import { Alert, Form, Input, InputNumber, Select, Switch } from 'antd';
import type { RSSAutomationNodeType } from '@/services/film-fusion';
import DirectoryIdInput from './DirectoryIdInput';
import styles from './index.module.less';
import type { NodeFieldReference } from './NodeConfigDrawer';
import TemplateVariableInput from './TemplateVariableInput';

const descriptions: Partial<Record<RSSAutomationNodeType, string>> = {
  torrent115_openapi:
    '解析已上传到当前 115 账号的 .torrent 文件。输出 info_hash、文件列表和默认选中索引，再交给“添加 BT 任务”。种子文件 SHA1 与 BT 任务 info_hash 是两个不同的值。',
  offline115_bt_openapi:
    '使用种子解析结果创建任务，可选择下载哪些文件。RSS 提供磁力链或下载链接时，通常使用“添加链接任务”。提交成功只表示任务已添加，后续请连接“等待 115 下载完成”。',
  list115_tasks_openapi:
    '留空 Hash 时按页获取任务；指定 Hash 时从第一页逐页查找，最多 200 页。找到任务后可连接“等待 115 下载完成”。仅下载完成且有文件 ID 时，输出 file_id 可供重命名使用。',
  quota115_openapi:
    '读取剩余、已用和总配额，以及各类配额的过期明细。可将 surplus 交给条件节点，在配额不足时停止下载或发送通知。',
  delete115_task_openapi:
    '按 info_hash 删除单个云下载任务。默认保留源文件；此操作不会自动重试。',
  clear115_tasks_openapi:
    '清理所选账号中符合范围的全部任务，不限于当前 RSS 工作流创建的任务。默认只清理已完成任务并保留文件；此操作不会自动重试。',
};

const CloudDownload115Fields = ({
  type,
  cloudStorages,
  references,
}: {
  type: RSSAutomationNodeType;
  cloudStorages: API.CloudStorage[];
  references: NodeFieldReference[];
}) => {
  const form = Form.useFormInstance();
  const storageID = Form.useWatch('cloud_storage_id', form);
  const directoryPath = Form.useWatch('directory_path', form);
  const flag = Form.useWatch('flag', form);
  const deleteFiles = Form.useWatch('delete_files', form);
  const textField = (
    name: string,
    label: string,
    extra: string,
    required = true,
  ) => (
    <Form.Item
      className={styles.nodeConfigFull}
      extra={extra}
      key={name}
      label={label}
      name={name}
      rules={[{ required, message: `请配置${label}` }]}
    >
      <TemplateVariableInput
        ariaLabel={label}
        placeholder="输入值或插入上游节点的变量"
        references={references}
      />
    </Form.Item>
  );

  return (
    <>
      <Alert
        className={styles.nodeConfigFull}
        description={descriptions[type]}
        showIcon
        title="115 OpenAPI 云下载"
        type={type === 'clear115_tasks_openapi' ? 'warning' : 'info'}
      />
      <Form.Item
        className={styles.nodeConfigFull}
        label="115 OpenAPI 账号"
        name="cloud_storage_id"
        rules={[{ required: true, message: '请选择已授权的 115 账号' }]}
      >
        <Select
          onChange={() =>
            form.setFieldsValue({
              directory_id: undefined,
              directory_path: undefined,
            })
          }
          options={cloudStorages
            .filter(
              (storage) =>
                storage.storage_type === '115open' &&
                storage.status === 'active',
            )
            .map((storage) => ({
              label: storage.storage_name,
              value: storage.id,
            }))}
          placeholder="选择已授权的 115 OpenAPI 账号"
        />
      </Form.Item>
      {(type === 'torrent115_openapi' || type === 'offline115_bt_openapi') && (
        <>
          {textField(
            'torrent_sha1',
            '种子文件 SHA1',
            '种子必须已上传到所选账号；添加 BT 任务时可引用解析节点的 torrent_sha1。',
          )}
          {textField(
            'pick_code',
            '种子文件提取码',
            '种子文件的 pick_code；添加 BT 任务时可引用解析节点同名输出。',
          )}
        </>
      )}
      {type === 'offline115_bt_openapi' && (
        <>
          {textField(
            'info_hash',
            'BT 任务 Hash',
            '插入种子解析节点的 info_hash。',
          )}
          {textField(
            'wanted',
            '下载文件索引',
            '使用半角逗号分隔，例如 0,1,2；0 有效。可引用解析节点的 wanted，未默认选中文件时需自行填写。',
          )}
          {textField(
            'save_path',
            '相对保存路径',
            '例如 A/B，相对于下方保存目录。可引用解析节点的 torrent_name。',
          )}
          <Form.Item hidden name="directory_path">
            <Input />
          </Form.Item>
          <Form.Item
            className={styles.nodeConfigFull}
            extra="未选择时使用根目录。"
            label="保存目录"
            name="directory_id"
          >
            <DirectoryIdInput
              accessMethod="openapi"
              cloudStorageId={storageID}
              onSelectedPathChange={(path) =>
                form.setFieldValue('directory_path', path)
              }
              selectedPath={directoryPath}
            />
          </Form.Item>
        </>
      )}
      {type === 'list115_tasks_openapi' && (
        <>
          {textField(
            'info_hash',
            '查找任务 Hash',
            '可选；插入提交节点的 info_hash。找不到时 matched=false，下载未完成时 completed=false。',
            false,
          )}
          <Form.Item
            extra="仅在未指定 Hash 时使用。"
            label="查询页码"
            name="page"
            rules={[{ required: true }]}
          >
            <InputNumber
              min={1}
              max={1000000}
              precision={0}
              style={{ width: '100%' }}
            />
          </Form.Item>
        </>
      )}
      {type === 'delete115_task_openapi' && (
        <>
          {textField(
            'info_hash',
            '删除任务 Hash',
            '仅删除这个 Hash 对应的任务。',
          )}
          <Form.Item
            className={styles.nodeConfigFull}
            label="同时删除源文件"
            name="delete_files"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          {deleteFiles && (
            <Alert
              className={styles.nodeConfigFull}
              title="执行时将同时删除任务对应的云端源文件。"
              showIcon
              type="warning"
            />
          )}
        </>
      )}
      {type === 'clear115_tasks_openapi' && (
        <>
          <Form.Item
            className={styles.nodeConfigFull}
            label="清理范围"
            name="flag"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { value: 0, label: '已完成任务 · 保留文件' },
                { value: 2, label: '失败任务 · 保留文件' },
                { value: 3, label: '进行中任务 · 保留文件' },
                { value: 1, label: '全部任务 · 保留文件' },
                { value: 4, label: '已完成任务 · 同时删除源文件' },
                { value: 5, label: '全部任务 · 同时删除源文件' },
              ]}
            />
          </Form.Item>
          {(flag === 4 || flag === 5) && (
            <Alert
              className={styles.nodeConfigFull}
              title="执行时将同时删除所选范围内任务的云端源文件。"
              showIcon
              type="warning"
            />
          )}
        </>
      )}
    </>
  );
};

export default CloudDownload115Fields;
