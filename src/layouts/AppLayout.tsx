import { ChevronLeft, ChevronRight, Menu as MenuIcon } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';

import { AppSidebar } from '@/components/AppSidebar';
import Footer from '@/components/Footer';
import { PageLoadingBoundary } from '@/components/PageLoadingBoundary';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useAppState } from '@/contexts/app-state';
import { useLoadingPresence } from '@/hooks/useLoadingPresence';
import { cn } from '@/lib/utils';
import Loading from '@/loading';
import { findMenuTrail } from '@/router/menu';
import { getPublicAppConfig } from '@/services/film-fusion';

const loginPath = '/user/login';
const SIDEBAR_COLLAPSED_KEY = 'film-fusion-sidebar-collapsed';
const DEFAULT_APP_SUBTITLE = 'Film Fusion 是简单的 Emby + 网盘的辅助工具';

const getInitialSidebarState = () => {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
};

export default function AppLayout() {
  const location = useLocation();
  const { currentUser, loading, settings } = useAppState();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    getInitialSidebarState,
  );
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [siteBranding, setSiteBranding] = useState({
    title: '',
    subtitle: '',
  });
  const loadingTheme = settings.navTheme === 'realDark' ? 'dark' : 'light';
  const loadingColor =
    typeof settings.colorPrimary === 'string'
      ? settings.colorPrimary
      : undefined;
  const loadingPresence = useLoadingPresence(loading);
  const appTitle =
    siteBranding.title ||
    (typeof settings.title === 'string' ? settings.title : 'Film Fusion');
  const appSubtitle = siteBranding.subtitle || DEFAULT_APP_SUBTITLE;
  const menuTrail = useMemo(
    () => findMenuTrail(location.pathname),
    [location.pathname],
  );
  const currentPage = menuTrail.at(-1);

  useEffect(() => {
    document.title = currentPage
      ? `${currentPage.name} - ${appTitle}`
      : appTitle;
  }, [appTitle, currentPage]);

  useEffect(() => {
    let active = true;

    getPublicAppConfig({ skipErrorHandler: true })
      .then((response) => {
        if (!active || response.code !== 0 || !response.data) {
          return;
        }

        setSiteBranding({
          title: response.data.login_title?.trim() || 'Film Fusion',
          subtitle:
            response.data.login_subtitle?.trim() || DEFAULT_APP_SUBTITLE,
        });
      })
      .catch(() => {
        // 兼容尚未提供公开站点配置接口的后端。
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed));
    } catch {}
  }, [sidebarCollapsed]);

  useEffect(() => {
    setMobileNavigationOpen(false);
  }, [location.pathname]);

  if (!currentUser && !loadingPresence.mounted) {
    const redirect = `${location.pathname}${location.search}`;
    return (
      <Navigate
        replace
        to={`${loginPath}?${new URLSearchParams({ redirect })}`}
      />
    );
  }

  return (
    <>
      {currentUser && (
        <div
          className="relative isolate flex h-svh w-full overflow-hidden bg-[#f2f2ef] font-sans text-neutral-950 [--ring:#171717] dark:bg-[#080808] dark:text-white dark:[--ring:#ffffff]"
          style={
            {
              '--app-sidebar-offset': sidebarCollapsed ? '5.75rem' : '17.5rem',
            } as CSSProperties
          }
        >
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 -z-10 opacity-80 dark:opacity-55"
            style={{
              backgroundImage: [
                'radial-gradient(circle at 4% 4%, rgba(255, 255, 255, 0.95), transparent 24%)',
                'radial-gradient(circle at 94% 12%, rgba(0, 0, 0, 0.045), transparent 28%)',
                'radial-gradient(circle at 62% 92%, rgba(0, 0, 0, 0.035), transparent 30%)',
              ].join(', '),
            }}
          />

          <aside
            className={cn(
              'fixed top-0 left-0 z-40 hidden h-screen shrink-0 transition-[width] duration-300 ease-out lg:block',
              sidebarCollapsed ? 'w-[5.75rem]' : 'w-[17.5rem]',
            )}
          >
            <AppSidebar
              collapsed={sidebarCollapsed}
              subtitle={appSubtitle}
              title={appTitle}
            />
            <button
              aria-label={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
              className="group absolute top-24 right-0 z-10 flex size-12 translate-x-1/2 -translate-y-1/2 touch-manipulation items-center justify-center rounded-full border-0 bg-transparent p-0 outline-none"
              onClick={() => setSidebarCollapsed((current) => !current)}
              title={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
              type="button"
            >
              <span className="flex size-6 items-center justify-center rounded-full border border-black/[0.055] bg-white/90 text-neutral-400 shadow-[0_3px_10px_rgba(0,0,0,0.07)] group-hover:bg-white group-hover:text-neutral-800 group-focus-visible:ring-2 group-focus-visible:ring-black/15 dark:border-white/8 dark:bg-neutral-900/90 dark:text-white/45 dark:group-hover:bg-neutral-800 dark:group-hover:text-white/80 dark:group-focus-visible:ring-white/25">
                {sidebarCollapsed ? (
                  <ChevronRight aria-hidden="true" className="size-3" />
                ) : (
                  <ChevronLeft aria-hidden="true" className="size-3" />
                )}
              </span>
            </button>
          </aside>

          <div
            aria-hidden="true"
            className={cn(
              'pointer-events-none hidden shrink-0 transition-[width] duration-300 ease-out lg:block',
              sidebarCollapsed ? 'w-[5.75rem]' : 'w-[17.5rem]',
            )}
          />

          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-x-clip overflow-y-auto overscroll-contain">
            <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center justify-start gap-3 border-b border-black/[0.055] bg-[#f2f2ef]/82 px-3 backdrop-blur-2xl sm:h-14 sm:px-4 lg:hidden dark:border-white/10 dark:bg-[#080808]/82">
              <div className="flex min-w-0 items-center gap-2">
                <Sheet
                  onOpenChange={setMobileNavigationOpen}
                  open={mobileNavigationOpen}
                >
                  <SheetTrigger
                    render={
                      <Button
                        aria-label="打开主导航"
                        className="rounded-xl hover:bg-black/[0.055] lg:hidden dark:hover:bg-white/10"
                        size="icon"
                        variant="ghost"
                      />
                    }
                  >
                    <MenuIcon aria-hidden="true" />
                  </SheetTrigger>
                  <SheetContent
                    className="w-[min(19rem,calc(100vw-2rem))] border-0 bg-transparent p-0 shadow-none [--ring:#171717] dark:bg-transparent dark:[--ring:#ffffff]"
                    side="left"
                  >
                    <SheetTitle className="sr-only">主导航</SheetTitle>
                    <SheetDescription className="sr-only">
                      Film Fusion 控制台功能导航
                    </SheetDescription>
                    <AppSidebar
                      mobile
                      onNavigate={() => setMobileNavigationOpen(false)}
                      subtitle={appSubtitle}
                      title={appTitle}
                    />
                  </SheetContent>
                </Sheet>

                <div className="min-w-0">
                  <p className="m-0 truncate text-xs font-semibold tracking-[-0.01em] text-neutral-900 sm:text-sm dark:text-white">
                    {currentPage?.name || appTitle}
                  </p>
                  {menuTrail.length > 1 && (
                    <p className="mt-0.5 mb-0 hidden truncate text-[9px] font-medium tracking-[0.12em] text-neutral-400 uppercase sm:block dark:text-white/35">
                      {menuTrail.map((item) => item.name).join(' / ')}
                    </p>
                  )}
                </div>
              </div>
            </header>

            <main className="relative min-w-0 flex-1">
              <PageLoadingBoundary key={location.pathname}>
                <Outlet />
              </PageLoadingBoundary>
            </main>

            <Footer />
          </div>
        </div>
      )}
      {loadingPresence.mounted && (
        <Loading
          key="app-loading"
          color={loadingColor}
          exiting={loadingPresence.exiting}
          theme={loadingTheme}
        />
      )}
    </>
  );
}
