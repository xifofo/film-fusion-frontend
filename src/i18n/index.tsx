import { ConfigProvider } from 'antd';
import bnBDLocale from 'antd/locale/bn_BD';
import enUSLocale from 'antd/locale/en_US';
import faIRLocale from 'antd/locale/fa_IR';
import idIDLocale from 'antd/locale/id_ID';
import jaJPLocale from 'antd/locale/ja_JP';
import ptBRLocale from 'antd/locale/pt_BR';
import zhCNLocale from 'antd/locale/zh_CN';
import zhTWLocale from 'antd/locale/zh_TW';
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { IntlProvider } from 'react-intl';
import bnBDMessages from '@/locales/bn-BD';
import enUSMessages from '@/locales/en-US';
import faIRMessages from '@/locales/fa-IR';
import idIDMessages from '@/locales/id-ID';
import jaJPMessages from '@/locales/ja-JP';
import ptBRMessages from '@/locales/pt-BR';
import zhCNMessages from '@/locales/zh-CN';
import zhTWMessages from '@/locales/zh-TW';

export const supportedLocales = [
  { locale: 'zh-CN', label: '简体中文' },
  { locale: 'zh-TW', label: '繁體中文' },
  { locale: 'en-US', label: 'English' },
  { locale: 'ja-JP', label: '日本語' },
  { locale: 'pt-BR', label: 'Português' },
  { locale: 'id-ID', label: 'Bahasa Indonesia' },
  { locale: 'bn-BD', label: 'বাংলা' },
  { locale: 'fa-IR', label: 'فارسی' },
] as const;

export type AppLocale = (typeof supportedLocales)[number]['locale'];

const localeMessages: Record<AppLocale, Record<string, string>> = {
  'bn-BD': bnBDMessages,
  'en-US': enUSMessages,
  'fa-IR': faIRMessages,
  'id-ID': idIDMessages,
  'ja-JP': jaJPMessages,
  'pt-BR': ptBRMessages,
  'zh-CN': zhCNMessages,
  'zh-TW': zhTWMessages,
};

const antdLocales = {
  'bn-BD': bnBDLocale,
  'en-US': enUSLocale,
  'fa-IR': faIRLocale,
  'id-ID': idIDLocale,
  'ja-JP': jaJPLocale,
  'pt-BR': ptBRLocale,
  'zh-CN': zhCNLocale,
  'zh-TW': zhTWLocale,
};

const LOCALE_STORAGE_KEY = 'film-fusion.locale';

const resolveLocale = (): AppLocale => {
  const storedLocale = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (supportedLocales.some(({ locale }) => locale === storedLocale)) {
    return storedLocale as AppLocale;
  }

  const browserLocale = navigator.language;
  const exact = supportedLocales.find(
    ({ locale }) => locale.toLowerCase() === browserLocale.toLowerCase(),
  );
  if (exact) return exact.locale;

  const language = browserLocale.split('-')[0]?.toLowerCase();
  const sameLanguage = supportedLocales.find(({ locale }) =>
    locale.toLowerCase().startsWith(`${language}-`),
  );
  return sameLanguage?.locale || 'zh-CN';
};

type LocaleContextValue = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
};

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

export function AppLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, updateLocale] = useState<AppLocale>(resolveLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'fa-IR' ? 'rtl' : 'ltr';
  }, [locale]);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale: (nextLocale) => {
        localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
        updateLocale(nextLocale);
      },
    }),
    [locale],
  );

  return (
    <LocaleContext.Provider value={value}>
      <IntlProvider
        defaultLocale="zh-CN"
        locale={locale}
        messages={localeMessages[locale]}
      >
        <ConfigProvider
          direction={locale === 'fa-IR' ? 'rtl' : 'ltr'}
          locale={antdLocales[locale]}
          theme={{
            cssVar: true,
            token: {
              fontFamily: 'AlibabaSans, sans-serif',
            },
          }}
        >
          {children}
        </ConfigProvider>
      </IntlProvider>
    </LocaleContext.Provider>
  );
}

export function useAppLocale() {
  const value = useContext(LocaleContext);
  if (!value) {
    throw new Error('useAppLocale must be used inside AppLocaleProvider');
  }
  return value;
}
