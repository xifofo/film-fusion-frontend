import { lazy, useEffect, useState } from 'react';
import {
  createBrowserRouter,
  Navigate,
  type RouteObject,
  useSearchParams,
} from 'react-router';
import { PageLoadingBoundary, PageLoadingIndicator } from '@/components';
import { useLoadingPresence } from '@/hooks/useLoadingPresence';
import AppLayout from '@/layouts/AppLayout';
import Loading from '@/loading';

const Login = lazy(() => import('@/pages/user/login'));
const CloudStorage = lazy(() => import('@/pages/cloud-storage'));
const CloudPaths = lazy(() => import('@/pages/cloud-paths'));
const Directories = lazy(() => import('@/pages/directories'));
const Organize = lazy(() => import('@/pages/directories/Organize'));
const EpisodeOrganize = lazy(
  () => import('@/pages/directories/EpisodeOrganize'),
);
const Match302 = lazy(() => import('@/pages/match302'));
const PickcodeCache = lazy(() => import('@/pages/pickcode-cache'));
const EmbyCover = lazy(() => import('@/pages/emby-cover'));
const EmbyStats = lazy(() => import('@/pages/emby-stats'));
const EmbyProxyLog = lazy(() => import('@/pages/emby-proxy-log'));
const EmbyImageOptimization = lazy(
  () => import('@/pages/emby-image-optimization'),
);
const EmbyMissing = lazy(() => import('@/pages/emby-missing'));
const EmbyVersionCheck = lazy(() => import('@/pages/emby-version-check'));
const EmbyBindings = lazy(() => import('@/pages/emby-bindings'));
const EmbyWatch = lazy(() => import('@/pages/emby-watch'));
const OrganizeLogs = lazy(() => import('@/pages/organize-logs'));
const RSSMonitor = lazy(() => import('@/pages/rss-monitor'));
const ServerLogs = lazy(() => import('@/pages/server-logs'));
const SystemSettings = lazy(() => import('@/pages/system-settings'));
const HDHiveCallback = lazy(() => import('@/pages/hdhive-callback'));
const NotFound = lazy(() => import('@/pages/404'));

const page = (element: React.ReactNode) => (
  <PageLoadingBoundary>{element}</PageLoadingBoundary>
);

const LoadingDebugPage = () => {
  const [searchParams] = useSearchParams();
  const theme = searchParams.get('theme') === 'dark' ? 'dark' : 'light';
  const color = searchParams.get('color') || undefined;
  const exitMode = searchParams.get('exit');
  const previewPageLoading = searchParams.get('mode') === 'page';
  const previewExit = exitMode === '1' || exitMode === 'fast';
  const [loading, setLoading] = useState(previewExit);
  const presence = useLoadingPresence(loading);

  useEffect(() => {
    if (!previewExit) {
      return;
    }
    const timer = window.setTimeout(
      () => setLoading(false),
      exitMode === 'fast' ? 50 : 1600,
    );
    return () => window.clearTimeout(timer);
  }, [exitMode, previewExit]);

  if (previewPageLoading) {
    return (
      <div
        className={
          theme === 'dark'
            ? 'min-h-svh bg-slate-950 text-white'
            : 'min-h-svh bg-slate-50 text-slate-950'
        }
      >
        <PageLoadingIndicator />
      </div>
    );
  }

  if (!previewExit) {
    return <Loading color={color} theme={theme} />;
  }

  return (
    <div
      className={
        theme === 'dark'
          ? 'flex min-h-svh items-center justify-center bg-slate-950 text-white'
          : 'flex min-h-svh items-center justify-center bg-slate-50 text-slate-950'
      }
    >
      <span className="text-sm tracking-[0.24em]">页面加载完成</span>
      {presence.mounted && (
        <Loading color={color} exiting={presence.exiting} theme={theme} />
      )}
    </div>
  );
};

const routes: RouteObject[] = [
  ...(import.meta.env.DEV
    ? [
        {
          path: '/debug/loading',
          element: <LoadingDebugPage />,
        },
      ]
    : []),
  {
    path: '/user/login',
    element: page(<Login />),
  },
  {
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <Navigate replace to="/cloud-storage" />,
      },
      {
        path: 'cloud-storage',
        element: <CloudStorage />,
      },
      {
        path: 'cloud-paths',
        element: <CloudPaths />,
      },
      {
        path: 'directories',
        element: <Directories />,
      },
      {
        path: 'directories/organize/:id',
        element: <Organize />,
      },
      {
        path: 'directories/episode-organize/:id',
        element: <EpisodeOrganize />,
      },
      {
        path: 'match302',
        element: <Match302 />,
      },
      {
        path: 'pickcode-cache',
        element: <PickcodeCache />,
      },
      {
        path: 'emby',
        element: <Navigate replace to="/emby/cover" />,
      },
      {
        path: 'emby/cover',
        element: <EmbyCover />,
      },
      {
        path: 'emby/stats',
        element: <EmbyStats />,
      },
      {
        path: 'emby/proxy-log',
        element: <EmbyProxyLog />,
      },
      {
        path: 'emby/image-optimization',
        element: <EmbyImageOptimization />,
      },
      {
        path: 'emby/missing',
        element: <EmbyMissing />,
      },
      {
        path: 'emby/version-check',
        element: <EmbyVersionCheck />,
      },
      {
        path: 'emby/bindings',
        element: <EmbyBindings />,
      },
      {
        path: 'emby-watch',
        element: <EmbyWatch />,
      },
      {
        path: 'organize-logs',
        element: <OrganizeLogs />,
      },
      {
        path: 'rss-monitor',
        element: <RSSMonitor />,
      },
      {
        path: 'server-logs',
        element: <ServerLogs />,
      },
      {
        path: 'system-settings',
        element: <SystemSettings />,
      },
      {
        path: 'hdhive/callback',
        element: <HDHiveCallback />,
      },
    ],
  },
  {
    path: '*',
    element: page(<NotFound />),
  },
];

export const router = createBrowserRouter(routes);
