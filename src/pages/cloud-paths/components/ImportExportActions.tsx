import React, { useState } from 'react';
import { Button, Upload, message, Modal, Space } from 'antd';
import { DownloadOutlined, UploadOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useRequest } from '@umijs/max';
import { exportCloudPaths, importCloudPaths } from '@/services/film-fusion';
import type { UploadProps } from 'antd';

interface ImportExportActionsProps {
  onSuccess?: () => void;
}

const ImportExportActions: React.FC<ImportExportActionsProps> = ({ onSuccess }) => {
  const [messageApi, contextHolder] = message.useMessage();

  // 导出
  const { run: exportRun, loading: exportLoading } = useRequest(exportCloudPaths, {
    manual: true,
    onSuccess: (data) => {
      // 创建下载链接
      const dataStr = JSON.stringify(data, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cloud-paths-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      messageApi.success('导出成功');
    },
    onError: () => {
      messageApi.error('导出失败，请重试');
    },
  });

  // 导入
  const { run: importRun, loading: importLoading } = useRequest(importCloudPaths, {
    manual: true,
    onSuccess: (data) => {
      messageApi.success(`导入完成：成功 ${data.success_count} 个，失败 ${data.error_count} 个`);
      onSuccess?.();
    },
    onError: () => {
      messageApi.error('导入失败，请重试');
    },
  });

  const handleExport = () => {
    exportRun();
  };

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    accept: '.json',
    beforeUpload: (file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const data = JSON.parse(content);

          if (!data.paths || !Array.isArray(data.paths)) {
            messageApi.error('文件格式错误：缺少 paths 字段或格式不正确');
            return;
          }

          Modal.confirm({
            title: '确认导入',
            icon: <ExclamationCircleOutlined />,
            content: `即将导入 ${data.paths.length} 个路径配置，是否继续？`,
            okText: '确定导入',
            cancelText: '取消',
            onOk: () => {
              importRun({
                paths: data.paths,
                replace_existing: false,
              });
            },
          });
        } catch (error) {
          messageApi.error('文件解析失败，请检查文件格式');
        }
      };
      reader.readAsText(file);
      return false; // 阻止自动上传
    },
  };

  return (
    <>
      {contextHolder}
      <Space>
        <Button
          icon={<DownloadOutlined />}
          loading={exportLoading}
          onClick={handleExport}
        >
          导出配置
        </Button>
        <Upload {...uploadProps}>
          <Button icon={<UploadOutlined />} loading={importLoading}>
            导入配置
          </Button>
        </Upload>
      </Space>
    </>
  );
};

export default ImportExportActions;
