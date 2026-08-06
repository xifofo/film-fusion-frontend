import { ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';

import { AccountMenu } from '@/components/AccountMenu';
import { OpticalLogo } from '@/components/OpticalLogo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { type AppMenuItem, menuItems, menuPathMatches } from '@/router/menu';

type AppSidebarProps = {
  collapsed?: boolean;
  mobile?: boolean;
  onNavigate?: () => void;
  subtitle: string;
  title: string;
};

const hasActiveChild = (item: AppMenuItem, pathname: string) =>
  item.children?.some((child) => menuPathMatches(pathname, child.path)) ??
  false;

export function AppSidebar({
  collapsed = false,
  mobile = false,
  onNavigate,
  subtitle,
  title,
}: AppSidebarProps) {
  const location = useLocation();
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    return new Set(
      menuItems
        .filter((item) => hasActiveChild(item, location.pathname))
        .map((item) => item.path),
    );
  });

  useEffect(() => {
    setOpenGroups((current) => {
      const next = new Set(current);
      let changed = false;

      for (const item of menuItems) {
        if (hasActiveChild(item, location.pathname) && !next.has(item.path)) {
          next.add(item.path);
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [location.pathname]);

  const toggleGroup = (path: string) => {
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const renderLink = (item: AppMenuItem, nested = false) => {
    const active = menuPathMatches(location.pathname, item.path);
    const Icon = item.icon;

    return (
      <li className="m-0 p-0" key={item.path}>
        <Link
          aria-current={active ? 'page' : undefined}
          className={cn(
            'group relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium no-underline transition-[background-color,color,box-shadow,transform] duration-200 outline-none focus-visible:ring-2 focus-visible:ring-black/20 dark:focus-visible:ring-white/30',
            active
              ? '!bg-neutral-950 !text-white shadow-[0_10px_24px_rgba(0,0,0,0.16)] dark:!bg-white dark:!text-neutral-950'
              : '!text-neutral-600 hover:!bg-black/[0.055] hover:!text-neutral-950 dark:!text-white/62 dark:hover:!bg-white/10 dark:hover:!text-white',
            collapsed && 'justify-center px-0',
            nested && !collapsed && 'h-9 text-[13px]',
          )}
          onClick={onNavigate}
          title={collapsed ? item.name : undefined}
          to={item.path}
        >
          <Icon
            aria-hidden="true"
            className={cn(
              'size-[17px] shrink-0 transition-transform duration-200 group-hover:scale-105',
              nested && 'size-4',
            )}
            strokeWidth={active ? 2.2 : 1.8}
          />
          <span className={cn('min-w-0 truncate', collapsed && 'sr-only')}>
            {item.name}
          </span>
        </Link>
      </li>
    );
  };

  return (
    <div
      className={cn(
        'relative flex h-full min-h-0 flex-col overflow-hidden border border-black/[0.055] bg-white/[0.78] text-neutral-950 shadow-[0_24px_70px_rgba(0,0,0,0.07)] backdrop-blur-2xl dark:border-white/10 dark:bg-neutral-950/[0.78] dark:text-white dark:shadow-black/25',
        mobile ? 'rounded-none border-y-0 border-l-0' : 'rounded-l-[26px]',
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-56 opacity-80 dark:opacity-60"
        style={{
          backgroundImage:
            'radial-gradient(circle at 18% 0%, rgba(0, 0, 0, 0.07), transparent 58%)',
        }}
      />

      <div
        className={cn(
          'relative flex h-[74px] shrink-0 items-center px-4',
          collapsed && 'justify-center px-2',
        )}
      >
        <Link
          aria-label={`${title} 首页`}
          className={cn(
            'flex min-w-0 items-center gap-3 rounded-2xl !text-inherit no-underline outline-none focus-visible:ring-2 focus-visible:ring-black/20 dark:focus-visible:ring-white/30',
            mobile && 'pr-10',
          )}
          onClick={onNavigate}
          to="/cloud-storage"
        >
          <OpticalLogo className="size-10 shadow-[0_10px_30px_rgba(0,0,0,0.15)]" />
          <span
            className={cn(
              'min-w-0 transition-opacity duration-200',
              collapsed && 'sr-only',
            )}
          >
            <span className="block truncate text-[15px] font-semibold tracking-[-0.01em]">
              {title}
            </span>
            <span className="mt-0.5 block truncate text-[9px] font-medium tracking-[0.08em] text-neutral-400 dark:text-white/35">
              {subtitle}
            </span>
          </span>
        </Link>
      </div>

      <nav
        aria-label="主导航"
        className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <ul className="m-0 flex flex-col gap-2 p-0">
          {menuItems.map((item) => {
            if (!item.children?.length) {
              return renderLink(item);
            }

            const Icon = item.icon;
            const groupOpen = openGroups.has(item.path);
            const groupActive = hasActiveChild(item, location.pathname);

            return (
              <li className="m-0 p-0" key={item.path}>
                <Button
                  aria-expanded={groupOpen}
                  className={cn(
                    'group h-10 w-full justify-start gap-3 rounded-xl !bg-transparent px-3 text-sm font-medium text-neutral-600 hover:text-neutral-950 dark:text-white/62 dark:hover:text-white',
                    groupActive && 'text-neutral-950 dark:text-white',
                    collapsed && 'justify-center px-0',
                  )}
                  onClick={() => toggleGroup(item.path)}
                  title={collapsed ? item.name : undefined}
                  type="button"
                  variant="ghost"
                >
                  <Icon
                    aria-hidden="true"
                    className="size-[17px] shrink-0"
                    strokeWidth={groupActive ? 2.2 : 1.8}
                  />
                  <span
                    className={cn(
                      'min-w-0 flex-1 truncate text-left',
                      collapsed && 'sr-only',
                    )}
                  >
                    {item.name}
                  </span>
                  {!collapsed && (
                    <ChevronDown
                      aria-hidden="true"
                      className={cn(
                        'size-3.5 text-neutral-400 transition-transform duration-200 dark:text-white/35',
                        groupOpen && 'rotate-180',
                      )}
                    />
                  )}
                </Button>

                <div
                  className={cn(
                    'grid transition-[grid-template-rows,opacity] duration-200 ease-out',
                    groupOpen
                      ? 'grid-rows-[1fr] opacity-100'
                      : 'grid-rows-[0fr] opacity-0',
                  )}
                >
                  <div className="overflow-hidden">
                    <ul
                      className={cn(
                        'm-0 mt-1 flex flex-col gap-1 p-0',
                        collapsed
                          ? 'px-0'
                          : 'ml-5 border-l border-black/[0.055] pl-2 dark:border-white/10',
                      )}
                    >
                      {item.children.map((child) => renderLink(child, true))}
                    </ul>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </nav>

      <div
        className={cn(
          'relative mx-3 shrink-0 border-t border-black/[0.055] py-2 dark:border-white/10',
          collapsed && 'px-0',
        )}
      >
        <AccountMenu collapsed={collapsed} />
      </div>
    </div>
  );
}
