import {
  CameraOutlined,
  LoadingOutlined,
  SaveOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { FormProps, UploadProps } from 'antd';
import {
  App,
  Avatar,
  Button,
  Card,
  Form,
  Input,
  Typography,
  Upload,
} from 'antd';
import { useEffect, useState } from 'react';
import { useAppState } from '@/contexts/app-state';
import {
  updateCurrentUserProfile,
  uploadCurrentUserAvatar,
} from '@/services/film-fusion';
import styles from './index.module.less';

const { Paragraph, Text, Title } = Typography;

type ProfileFormValues = {
  username: string;
  nickname: string;
};

const avatarTypes = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const errorMessage = (error: any, fallback: string) =>
  error?.response?.data?.message || error?.message || fallback;

export default function UserProfilePage() {
  const { message } = App.useApp();
  const [form] = Form.useForm<ProfileFormValues>();
  const { currentUser, setCurrentUser } = useAppState();
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      return;
    }
    form.setFieldValue('username', currentUser.username);
    if (!form.isFieldTouched('nickname')) {
      form.setFieldValue(
        'nickname',
        currentUser.nickname?.trim() || currentUser.username,
      );
    }
  }, [currentUser, form]);

  if (!currentUser) {
    return null;
  }

  const displayName = currentUser.nickname?.trim() || currentUser.username;
  const avatarInitial = Array.from(displayName)[0]?.toUpperCase() || 'F';

  const beforeAvatarUpload: UploadProps['beforeUpload'] = (file) => {
    if (file.type && !avatarTypes.has(file.type)) {
      void message.error('仅支持 JPG、PNG 和 WebP 图片');
      return Upload.LIST_IGNORE;
    }
    if (file.size > 2 * 1024 * 1024) {
      void message.error('头像图片不能超过 2 MiB');
      return Upload.LIST_IGNORE;
    }
    return true;
  };

  const uploadAvatar: UploadProps['customRequest'] = async ({
    file,
    onError,
    onSuccess,
  }) => {
    if (!(file instanceof Blob)) {
      const error = new Error('无法读取头像文件');
      void message.error(error.message);
      onError?.(error);
      return;
    }

    setAvatarUploading(true);
    try {
      const filename = file instanceof File ? file.name : 'avatar';
      const response = await uploadCurrentUserAvatar(file, filename);
      if (response.code !== 0 || !response.data?.user) {
        throw new Error(response.message || '头像更新失败');
      }

      setCurrentUser(response.data.user);
      void message.success('头像已更新');
      onSuccess?.(response);
    } catch (error: any) {
      const normalizedError =
        error instanceof Error ? error : new Error('头像更新失败');
      void message.error(errorMessage(error, '头像更新失败'));
      onError?.(normalizedError);
    } finally {
      setAvatarUploading(false);
    }
  };

  const saveProfile: FormProps<ProfileFormValues>['onFinish'] = async (
    values,
  ) => {
    setSaving(true);
    try {
      const response = await updateCurrentUserProfile({
        nickname: values.nickname.trim(),
      });
      if (response.code !== 0 || !response.data) {
        throw new Error(response.message || '用户资料更新失败');
      }

      setCurrentUser(response.data);
      form.setFieldsValue({
        username: response.data.username,
        nickname: response.data.nickname || response.data.username,
      });
      void message.success('用户资料已保存');
    } catch (error: any) {
      void message.error(errorMessage(error, '用户资料更新失败'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto box-border w-full max-w-[1680px] px-4 py-5 sm:px-6 sm:py-7 xl:px-8">
      <header className="mb-6">
        <p className="m-0 text-[11px] font-semibold tracking-[0.18em] text-neutral-400 uppercase dark:text-white/35">
          Account
        </p>
        <h1 className="mt-2 mb-0 text-2xl font-semibold tracking-[-0.035em] text-neutral-950 sm:text-[30px] dark:text-white">
          个人资料
        </h1>
      </header>

      <Card className={styles.card} styles={{ body: { padding: 0 } }}>
        <div className={styles.content}>
          <section className={styles.avatarPanel}>
            <span className={styles.sectionLabel}>Profile image</span>
            <Upload
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              beforeUpload={beforeAvatarUpload}
              customRequest={uploadAvatar}
              disabled={avatarUploading}
              maxCount={1}
              showUploadList={false}
            >
              <button
                aria-label={currentUser.avatar ? '更换头像' : '上传头像'}
                className={styles.avatarButton}
                disabled={avatarUploading}
                type="button"
              >
                <Avatar
                  alt={displayName}
                  className={styles.avatar}
                  icon={!currentUser.avatar ? <UserOutlined /> : undefined}
                  shape="square"
                  size={120}
                  src={currentUser.avatar || undefined}
                >
                  {avatarInitial}
                </Avatar>
                <span className={styles.avatarAction}>
                  {avatarUploading ? (
                    <LoadingOutlined spin />
                  ) : (
                    <CameraOutlined />
                  )}
                </span>
              </button>
            </Upload>

            <Title className={styles.displayName} level={4}>
              {displayName}
            </Title>
            <Text className={styles.username} type="secondary">
              @{currentUser.username}
            </Text>
            <Paragraph className={styles.avatarHint} type="secondary">
              点击头像上传或更换图片
              <br />
              JPG / PNG / WebP · 最大 2 MiB
            </Paragraph>
          </section>

          <section className={styles.formPanel}>
            <div className={styles.formHeading}>
              <span className={styles.sectionLabel}>Account details</span>
              <Title className={styles.formTitle} level={3}>
                账户信息
              </Title>
              <Paragraph className={styles.description} type="secondary">
                管理当前账户的展示昵称；登录用户名仍由系统设置统一管理。
              </Paragraph>
            </div>

            <Form<ProfileFormValues>
              className={styles.form}
              form={form}
              layout="vertical"
              onFinish={saveProfile}
              requiredMark={false}
            >
              <Form.Item label="登录用户名" name="username">
                <Input disabled size="large" />
              </Form.Item>
              <Form.Item
                label="昵称"
                name="nickname"
                rules={[
                  {
                    validator: async (_, value: string | undefined) => {
                      const nickname = value?.trim() || '';
                      if (!nickname) {
                        throw new Error('请输入昵称');
                      }
                      if (Array.from(nickname).length > 32) {
                        throw new Error('昵称不能超过 32 个字符');
                      }
                    },
                  },
                ]}
              >
                <Input
                  allowClear
                  maxLength={64}
                  placeholder="请输入昵称"
                  size="large"
                  showCount={{
                    formatter: ({ value }) => `${Array.from(value).length}/32`,
                  }}
                />
              </Form.Item>
              <div className={styles.formActions}>
                <Text className={styles.actionHint} type="secondary">
                  保存后会同步更新左侧账户区域
                </Text>
                <Button
                  className={styles.saveButton}
                  htmlType="submit"
                  icon={<SaveOutlined />}
                  loading={saving}
                  size="large"
                  type="primary"
                >
                  保存资料
                </Button>
              </div>
            </Form>
          </section>
        </div>
      </Card>
    </div>
  );
}
