import { SyncOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Form,
  Modal,
  message,
  Select,
  Spin,
  Typography,
} from 'antd';
import React, { useState } from 'react';
import DirectoryPathField from '@/pages/match302/components/DirectoryPathField';
import {
  regenerateStrmDirectory,
  resolveEmbyMissingCloudPath,
} from '@/services/film-fusion';

const { Text } = Typography;

type RegenerateStrmModalProps = {
  record: API.EmbyMissingSeriesGroup;
};

/**
 * 缺集重生成 STRM：先由剧集反推云端源目录（自动匹配云路径映射），
 * 允许手动修正映射与目录后，触发后端递归重生成 STRM。
 */
const RegenerateStrmModal: React.FC<RegenerateStrmModalProps> = ({
  record,
}) => {
  const [open, setOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [embyPath, setEmbyPath] = useState('');
  const [matched, setMatched] = useState(true);
  const [options, setOptions] = useState<API.EmbyMissingCloudPathOption[]>([]);
  const [localDir, setLocalDir] = useState('');
  const [strmFile, setStrmFile] = useState('');
  const [strmContent, setStrmContent] = useState('');
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

  const handleOpen = async () => {
    setOpen(true);
    setResolving(true);
    setEmbyPath('');
    setMatched(true);
    setOptions([]);
    setLocalDir('');
    setStrmFile('');
    setStrmContent('');
    form.resetFields();
    try {
      const res = await resolveEmbyMissingCloudPath({
        series_id: record.series_id,
      });
      if (res.code === 0 && res.data) {
        setEmbyPath(res.data.emby_path || '');
        setOptions(res.data.options || []);
        setMatched(!!res.data.matched);
        setLocalDir(res.data.local_dir || '');
        setStrmFile(res.data.strm_file || '');
        setStrmContent(res.data.strm_content || '');
        form.setFieldsValue({
          cloud_path_id: res.data.matched ? res.data.cloud_path_id : undefined,
          cloud_dir: res.data.cloud_dir || '',
        });
      } else {
        messageApi.error(res.message || '解析云端路径失败');
      }
    } catch (error: any) {
      messageApi.error(error?.message || '解析云端路径失败');
    } finally {
      setResolving(false);
    }
  };

  const handleSubmit = async () => {
    let values: { cloud_path_id: number; cloud_dir: string };
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    setSubmitting(true);
    try {
      const res = await regenerateStrmDirectory({
        cloud_path_id: values.cloud_path_id,
        cloud_dir: values.cloud_dir,
      });
      if (res.code === 0) {
        messageApi.success('已提交重生成任务，结果见整理日志');
        setOpen(false);
      } else {
        messageApi.error(res.message || '提交失败');
      }
    } catch (error: any) {
      messageApi.error(error?.message || '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  const optionList = options.map((o) => ({
    label: `${o.storage_name || `存储#${o.cloud_storage_id}`}${
      o.storage_type ? ` (${o.storage_type})` : ''
    } | 本地: ${o.local_path || '-'}`,
    value: o.id,
  }));

  return (
    <>
      {contextHolder}
      <Button
        type="link"
        size="small"
        icon={<SyncOutlined />}
        onClick={handleOpen}
      >
        重生成STRM
      </Button>
      <Modal
        title={`重生成 STRM - ${record.series_name || ''}`}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={handleSubmit}
        okText="开始重生成"
        confirmLoading={submitting}
        width={640}
        destroyOnClose
      >
        <Spin spinning={resolving}>
          {!matched && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
              message="未自动匹配到云路径映射"
              description="未能从 Emby 路径反推出对应的云路径映射，请手动选择映射并填写/选择云端目录。"
            />
          )}
          <Form form={form} layout="vertical">
            <Form.Item label="Emby 路径">
              <Text code copyable={embyPath ? { text: embyPath } : false}>
                {embyPath || '-'}
              </Text>
            </Form.Item>
            <Form.Item label="本地剧集目录（定位结果）">
              <Text
                code
                type={localDir ? undefined : 'secondary'}
                copyable={localDir ? { text: localDir } : false}
              >
                {localDir ||
                  '未定位到本地目录（Emby 路径后缀未能在任一映射 LocalPath 下匹配）'}
              </Text>
            </Form.Item>
            <Form.Item label="STRM 文件">
              <Text
                code
                type={strmFile ? undefined : 'secondary'}
                copyable={strmFile ? { text: strmFile } : false}
              >
                {strmFile || '未找到 .strm 文件'}
              </Text>
            </Form.Item>
            <Form.Item label="STRM 内容（云端路径来源）">
              <Text
                code
                type={strmContent ? undefined : 'secondary'}
                copyable={strmContent ? { text: strmContent } : false}
                style={{ wordBreak: 'break-all' }}
              >
                {strmContent || '无内容'}
              </Text>
            </Form.Item>
            <Form.Item
              name="cloud_path_id"
              label="云路径映射"
              rules={[{ required: true, message: '请选择云路径映射' }]}
              extra="选择用于生成 STRM 的映射（提供本地路径、内容前缀、过滤规则等）"
            >
              <Select
                placeholder="请选择云路径映射"
                options={optionList}
                showSearch
                optionFilterProp="label"
                notFoundContent={
                  resolving ? <Spin size="small" /> : '暂无可用云路径映射'
                }
              />
            </Form.Item>
            <Form.Item
              noStyle
              shouldUpdate={(prev, cur) =>
                prev.cloud_path_id !== cur.cloud_path_id
              }
            >
              {() => {
                const id = form.getFieldValue('cloud_path_id');
                const opt = options.find((o) => o.id === id);
                return (
                  <DirectoryPathField
                    name="cloud_dir"
                    label="云端目录"
                    required
                    cloudStorageId={opt?.cloud_storage_id}
                    placeholder="云端剧集目录，如 /电视剧/剧名 (2020)"
                    extra="自动推断自 Emby 本地路径，可手动修正，或点右侧「选择」浏览云端目录后递归重生成。"
                  />
                );
              }}
            </Form.Item>
          </Form>
        </Spin>
      </Modal>
    </>
  );
};

export default RegenerateStrmModal;
