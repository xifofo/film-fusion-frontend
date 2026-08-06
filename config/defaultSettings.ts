export type AppLayoutSettings = {
  colorPrimary: string;
  navTheme: 'light' | 'realDark';
  title: string;
};

const defaultSettings: AppLayoutSettings = {
  colorPrimary: '#1890ff',
  navTheme: 'light',
  title: 'Film Fusion',
};

export default defaultSettings;
