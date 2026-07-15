import { PageContainer } from '@ant-design/pro-components';
import { history } from '@umijs/max';
import { Button, message, Result, Spin, Typography } from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import { exchangeHDHiveToken } from '@/services/film-fusion';

type CallbackStatus = 'loading' | 'success' | 'error';

const { Text } = Typography;

const HDHiveCallbackPage: React.FC = () => {
  const [status, setStatus] = useState<CallbackStatus>('loading');
  const [detail, setDetail] = useState('');
  const [messageApi, contextHolder] = message.useMessage();

  const params = useMemo(() => new URLSearchParams(window.location.search), []);

  useEffect(() => {
    const exchange = async () => {
      const error = params.get('error');
      const errorDescription = params.get('error_description');
      if (error) {
        setStatus('error');
        setDetail(errorDescription || error);
        return;
      }

      const code = params.get('code') || '';
      if (!code) {
        setStatus('error');
        setDetail('回调地址缺少 code 参数');
        return;
      }

      const returnedState = params.get('state') || '';
      const expectedState =
        window.localStorage.getItem('hdhive_oauth_state') || '';
      if (expectedState && returnedState && expectedState !== returnedState) {
        setStatus('error');
        setDetail('OAuth state 校验失败，请重新发起授权');
        return;
      }

      try {
        const res = await exchangeHDHiveToken({ code });
        if (res.code === 0 && res.data?.success) {
          window.localStorage.removeItem('hdhive_oauth_state');
          setStatus('success');
          setDetail('Access Token / Refresh Token 已写入服务端配置');
          messageApi.success('HDHive 授权完成');
        } else {
          setStatus('error');
          setDetail(
            res.message || res.data?.message || 'HDHive Token 换取失败',
          );
        }
      } catch (err: any) {
        setStatus('error');
        setDetail(err?.message || 'HDHive Token 换取失败');
      }
    };

    exchange();
  }, [messageApi, params]);

  return (
    <PageContainer header={{ title: 'HDHive 授权回调' }}>
      {contextHolder}
      {status === 'loading' ? (
        <Result
          status="info"
          title="正在完成 HDHive 授权"
          subTitle="正在使用授权码换取 Access Token，请不要关闭页面。"
          extra={<Spin />}
        />
      ) : (
        <Result
          status={status === 'success' ? 'success' : 'error'}
          title={status === 'success' ? 'HDHive 授权完成' : 'HDHive 授权失败'}
          subTitle={<Text>{detail}</Text>}
          extra={[
            <Button
              key="settings"
              type="primary"
              onClick={() => history.push('/system-settings')}
            >
              返回系统设置
            </Button>,
          ]}
        />
      )}
    </PageContainer>
  );
};

export default HDHiveCallbackPage;
