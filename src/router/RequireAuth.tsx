import { Navigate, Outlet, useLocation } from 'react-router';
import { useAppState } from '@/contexts/app-state';
import { useLoadingPresence } from '@/hooks/useLoadingPresence';
import Loading from '@/loading';

const LOGIN_PATH = '/user/login';

export default function RequireAuth() {
  const location = useLocation();
  const { currentUser, loading, settings } = useAppState();
  const loadingPresence = useLoadingPresence(loading);
  const loadingTheme = settings.navTheme === 'realDark' ? 'dark' : 'light';
  const loadingColor =
    typeof settings.colorPrimary === 'string'
      ? settings.colorPrimary
      : undefined;

  if (!currentUser && !loadingPresence.mounted) {
    const redirect = `${location.pathname}${location.search}`;
    return (
      <Navigate
        replace
        to={`${LOGIN_PATH}?${new URLSearchParams({ redirect })}`}
      />
    );
  }

  return (
    <>
      {currentUser && <Outlet />}
      {loadingPresence.mounted && (
        <Loading
          color={loadingColor}
          exiting={loadingPresence.exiting}
          theme={loadingTheme}
        />
      )}
    </>
  );
}
