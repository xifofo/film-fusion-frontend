import {
  generateEmbyCoverLibrary,
  previewEmbyCoverLibrary,
} from '@/services/film-fusion';
import { CloudUploadOutlined, ReloadOutlined } from '@ant-design/icons';
import { Button, Modal, Popconfirm, Space, Spin, Typography, message } from 'antd';
import React, { useCallback, useEffect, useRef, useState } from 'react';

const { Text } = Typography;

export interface PreviewModalProps {
  /** 弹窗开关 */
  open: boolean;
  /** 当前要预览的库 */
  record?: API.EmbyCoverLibraryView;
  /** 关闭弹窗 */
  onClose: () => void;
  /** 上传成功后回调（用来刷列表） */
  onUploaded?: () => void;
}

/**
 * 封面预览弹窗：
 *   - 打开时立即拉一次 preview（image/jpeg Blob → objectURL 展示）
 *   - "重新生成"：再次调预览接口（重拉海报、重建合成）
 *   - "确认上传到 Emby"：调生成接口（上传真库）
 */
const PreviewModal: React.FC<PreviewModalProps> = ({
  open,
  record,
  onClose,
  onUploaded,
}) => {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imgUrl, setImgUrl] = useState<string>('');
  const [errMsg, setErrMsg] = useState<string>('');
  // 保存当前创建的 objectURL 以便切换时释放
  const currentUrlRef = useRef<string>('');

  const releaseUrl = useCallback(() => {
    if (currentUrlRef.current) {
      URL.revokeObjectURL(currentUrlRef.current);
      currentUrlRef.current = '';
    }
  }, []);

  const loadPreview = useCallback(async () => {
    if (!record) return;
    setLoading(true);
    setErrMsg('');
    try {
      const blob = await previewEmbyCoverLibrary(record.emby_library_id);
      // request 配置了 responseType: 'blob'，但 Umi 可能仍包一层，这里兜底判断
      const realBlob = blob instanceof Blob ? blob : new Blob([blob as any], { type: 'image/jpeg' });
      releaseUrl();
      const url = URL.createObjectURL(realBlob);
      currentUrlRef.current = url;
      setImgUrl(url);
    } catch (e: any) {
      // 如果后端返回 JSON 错误，blob 会是 application/json，尝试读一下
      let msg = e?.message || '预览失败';
      if (e?.response?.data instanceof Blob) {
        try {
          const text = await e.response.data.text();
          const json = JSON.parse(text);
          msg = json.message || json.error || msg;
        } catch {
          /* ignore */
        }
      }
      setErrMsg(msg);
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [record, releaseUrl]);

  // 打开时自动拉一次
  useEffect(() => {
    if (open && record) {
      loadPreview();
    }
    if (!open) {
      // 关闭后释放资源
      releaseUrl();
      setImgUrl('');
      setErrMsg('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, record?.emby_library_id]);

  // 组件卸载时释放
  useEffect(() => {
    return () => releaseUrl();
  }, [releaseUrl]);

  const handleUpload = async () => {
    if (!record) return;
    setUploading(true);
    try {
      const resp = await generateEmbyCoverLibrary(record.emby_library_id);
      if (resp.code !== 0) {
        message.error(resp.message || '上传失败');
        return;
      }
      message.success('已生成并上传到 Emby');
      onUploaded?.();
      onClose();
    } catch (e: any) {
      message.error(e?.message || '上传失败');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={960}
      title={record ? `封面预览 · ${record.emby_name}` : '封面预览'}
      destroyOnHidden
      maskClosable={!loading && !uploading}
      footer={
        <Space>
          <Button onClick={onClose} disabled={uploading}>
            关闭
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={loadPreview}
            loading={loading}
            disabled={uploading}
          >
            重新生成
          </Button>
          <Popconfirm
            title="上传到 Emby？"
            description="将用当前这张封面覆盖 Emby 媒体库的 Primary 图。"
            okText="确认上传"
            cancelText="取消"
            onConfirm={handleUpload}
            okButtonProps={{ loading: uploading }}
            disabled={!imgUrl || loading}
          >
            <Button
              type="primary"
              icon={<CloudUploadOutlined />}
              loading={uploading}
              disabled={!imgUrl || loading}
            >
              上传到 Emby
            </Button>
          </Popconfirm>
        </Space>
      }
    >
      <Spin spinning={loading} tip="生成中，通常需要 1~3 秒...">
        <div
          style={{
            minHeight: 480,
            background:
              'repeating-conic-gradient(#f5f5f5 0% 25%, #fff 0% 50%) 50%/20px 20px',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {imgUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imgUrl}
              alt="cover preview"
              style={{ maxWidth: '100%', maxHeight: 540, display: 'block' }}
            />
          ) : errMsg ? (
            <Text type="danger">{errMsg}</Text>
          ) : (
            <Text type="secondary">生成中...</Text>
          )}
        </div>
        {record && (
          <div style={{ marginTop: 12, color: '#666' }}>
            <Space split={<span>·</span>} size="middle">
              <span>
                模板：<Text strong>{record.template_id}</Text>
              </span>
              <span>
                中文：<Text>{record.cn_title || record.emby_name}</Text>
              </span>
              {record.en_subtitle && (
                <span>
                  英文：<Text>{record.en_subtitle}</Text>
                </span>
              )}
            </Space>
          </div>
        )}
      </Spin>
    </Modal>
  );
};

export default PreviewModal;
