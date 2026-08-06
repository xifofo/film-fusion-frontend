import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { getCurrentUser } from '@/services/film-fusion';
import defaultSettings, {
  type AppLayoutSettings,
} from '../../config/defaultSettings';

type AppStateContextValue = {
  currentUser?: API.User;
  loading: boolean;
  settings: AppLayoutSettings;
  refreshCurrentUser: () => Promise<API.User | undefined>;
  setCurrentUser: Dispatch<SetStateAction<API.User | undefined>>;
};

const AppStateContext = createContext<AppStateContextValue | undefined>(
  undefined,
);

const LOGIN_PATH = '/user/login';
const THEME_STORAGE_KEY = 'film-fusion-nav-theme';

function resolveInitialSettings(): AppLayoutSettings {
  try {
    const navTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (navTheme === 'light' || navTheme === 'realDark') {
      return { ...defaultSettings, navTheme };
    }
  } catch {}

  return defaultSettings;
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<API.User>();
  const [loading, setLoading] = useState(
    () =>
      window.location.pathname !== LOGIN_PATH &&
      Boolean(localStorage.getItem('token')),
  );
  const [settings] = useState<AppLayoutSettings>(resolveInitialSettings);

  const refreshCurrentUser = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getCurrentUser();
      const user = response.code === 0 ? response.data : undefined;
      setCurrentUser(user);
      return user;
    } catch {
      setCurrentUser(undefined);
      return undefined;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (
      window.location.pathname !== LOGIN_PATH &&
      localStorage.getItem('token')
    ) {
      void refreshCurrentUser();
    } else {
      setLoading(false);
    }
  }, [refreshCurrentUser]);

  useEffect(() => {
    const navTheme = settings.navTheme === 'realDark' ? 'realDark' : 'light';
    document.documentElement.dataset.theme =
      navTheme === 'realDark' ? 'dark' : 'light';
    document.documentElement.classList.toggle('dark', navTheme === 'realDark');
    try {
      localStorage.setItem(THEME_STORAGE_KEY, navTheme);
    } catch {}
  }, [settings.navTheme]);

  const value = useMemo<AppStateContextValue>(
    () => ({
      currentUser,
      loading,
      settings,
      refreshCurrentUser,
      setCurrentUser,
    }),
    [currentUser, loading, refreshCurrentUser, settings],
  );

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const value = useContext(AppStateContext);
  if (!value) {
    throw new Error('useAppState must be used inside AppStateProvider');
  }
  return value;
}
