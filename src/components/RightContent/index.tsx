import { GlobalOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { Button, Dropdown } from 'antd';
import { supportedLocales, useAppLocale } from '@/i18n';

export type SiderTheme = 'light' | 'dark';

export const SelectLang: React.FC = () => {
  const { locale, setLocale } = useAppLocale();

  return (
    <Dropdown
      menu={{
        items: supportedLocales.map((item) => ({
          key: item.locale,
          label: item.label,
        })),
        onClick: ({ key }) =>
          setLocale(key as (typeof supportedLocales)[number]['locale']),
        selectedKeys: [locale],
      }}
      placement="bottomRight"
      trigger={['click']}
    >
      <Button aria-label="切换语言" icon={<GlobalOutlined />} type="text" />
    </Dropdown>
  );
};

export const Question: React.FC = () => {
  return (
    <a
      href="https://pro.ant.design/docs/getting-started"
      target="_blank"
      rel="noreferrer"
      style={{
        display: 'inline-flex',
        padding: '4px',
        fontSize: '18px',
        color: 'inherit',
      }}
    >
      <QuestionCircleOutlined />
    </a>
  );
};
