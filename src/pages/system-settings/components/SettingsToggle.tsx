import { Form, Switch, Typography } from 'antd';
import { createStyles } from 'antd-style';
import type { ReactNode } from 'react';
import { useId } from 'react';

const useStyles = createStyles(({ css, token }) => ({
  card: css`
    display: flex;
    flex: 1 1 280px;
    align-items: center;
    justify-content: space-between;
    max-width: 360px;
    min-height: 76px;
    padding: 12px 14px;
    gap: 16px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 10px;
    background: ${token.colorFillAlter};
    transition:
      border-color ${token.motionDurationFast},
      background ${token.motionDurationFast};

    &:hover {
      border-color: ${token.colorBorder};
      background: ${token.colorFillQuaternary};
    }

    @media (max-width: 700px) {
      flex-basis: 100%;
      max-width: none;
    }
  `,
  copy: css`
    min-width: 0;
  `,
  titleRow: css`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    color: ${token.colorText};
    line-height: 20px;
  `,
  description: css`
    display: block;
    margin-top: 3px;
    color: ${token.colorTextSecondary};
    font-size: 12px;
    line-height: 18px;
  `,
  switch: css`
    flex: 0 0 auto;
  `,
}));

interface SettingsToggleProps {
  name: Array<string | number>;
  title: string;
  description: string;
  badge?: ReactNode;
}

export const SettingsToggle: React.FC<SettingsToggleProps> = ({
  name,
  title,
  description,
  badge,
}) => {
  const { styles } = useStyles();
  const controlId = useId();
  const titleId = `${controlId}-title`;
  const descriptionId = `${controlId}-description`;

  return (
    <div className={styles.card}>
      <div className={styles.copy}>
        <div className={styles.titleRow} id={titleId}>
          <Typography.Text strong>{title}</Typography.Text>
          {badge}
        </div>
        <Typography.Text
          className={styles.description}
          id={descriptionId}
          type="secondary"
        >
          {description}
        </Typography.Text>
      </div>
      <Form.Item name={name} valuePropName="checked" noStyle>
        <Switch
          aria-describedby={descriptionId}
          aria-labelledby={titleId}
          className={styles.switch}
        />
      </Form.Item>
    </div>
  );
};
