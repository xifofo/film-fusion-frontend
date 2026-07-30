import { Card, Result } from 'antd';
import React from 'react';
import { useIntl } from 'react-intl';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';

const NoFoundPage: React.FC = () => {
  const intl = useIntl();
  const navigate = useNavigate();

  return (
    <Card variant="borderless">
      <Result
        status="404"
        title="404"
        subTitle={intl.formatMessage({ id: 'pages.404.subTitle' })}
        extra={
          <Button type="button" onClick={() => navigate('/')}>
            {intl.formatMessage({ id: 'pages.404.buttonText' })}
          </Button>
        }
      />
    </Card>
  );
};

export default NoFoundPage;
