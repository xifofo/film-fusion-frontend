import { ChevronUp, LoaderCircle, LogOut, UserRound } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAppState } from '@/contexts/app-state';
import { cn } from '@/lib/utils';
import { logout } from '@/services/film-fusion';

type AccountMenuProps = {
  collapsed?: boolean;
};

export function AccountMenu({ collapsed = false }: AccountMenuProps) {
  const navigate = useNavigate();
  const { currentUser, setCurrentUser } = useAppState();
  const [loggingOut, setLoggingOut] = useState(false);

  if (!currentUser) {
    return null;
  }

  const displayName = currentUser.nickname?.trim() || currentUser.username;
  const initial = Array.from(displayName.trim())[0]?.toUpperCase() || 'F';

  const loginOut = async () => {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);
    try {
      await logout();
    } catch {
      // 本地凭据仍需清理，避免接口异常时把用户困在失效会话里。
    } finally {
      setCurrentUser(undefined);
      localStorage.removeItem('token');

      const { pathname, search } = window.location;
      const redirect = `${pathname}${search}`;
      navigate(`/user/login?${new URLSearchParams({ redirect }).toString()}`, {
        replace: true,
      });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="打开账户菜单"
        className={cn(
          'group flex h-11 w-full min-w-0 items-center gap-2.5 rounded-xl border-0 !bg-transparent px-2 text-left text-neutral-950 shadow-none outline-none transition-colors hover:!bg-black/[0.04] focus-visible:ring-2 focus-visible:ring-black/15 data-popup-open:!bg-black/[0.055] dark:text-white dark:hover:!bg-white/[0.07] dark:focus-visible:ring-white/25 dark:data-popup-open:!bg-white/10',
          collapsed && 'justify-center px-0',
        )}
        title={collapsed ? displayName : undefined}
      >
        <Avatar
          className="size-8 rounded-[8px] border-black/10 bg-neutral-950 shadow-[0_5px_14px_rgba(0,0,0,0.14)] dark:border-white/12 dark:bg-white"
          size="sm"
        >
          {currentUser.avatar && (
            <AvatarImage alt="" src={currentUser.avatar} />
          )}
          <AvatarFallback className="text-[11px] tracking-[-0.02em]">
            {initial}
          </AvatarFallback>
        </Avatar>
        <span className={cn('min-w-0 flex-1', collapsed && 'sr-only')}>
          <span className="block truncate text-[13px] font-semibold tracking-[-0.01em]">
            {displayName}
          </span>
        </span>
        {!collapsed && (
          <ChevronUp
            aria-hidden="true"
            className="size-3.5 shrink-0 text-neutral-400 transition-colors group-hover:text-neutral-600 group-data-popup-open:text-neutral-700 dark:text-white/35 dark:group-hover:text-white/60 dark:group-data-popup-open:text-white/70"
            strokeWidth={1.8}
          />
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="w-[15.25rem] rounded-[18px] p-1.5"
        side="top"
        sideOffset={10}
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-3 px-2.5 py-2.5 font-normal">
            <Avatar
              className="size-9 rounded-[9px] border-black/10 bg-neutral-950 shadow-[0_6px_18px_rgba(0,0,0,0.14)] dark:border-white/12 dark:bg-white"
              size="lg"
            >
              {currentUser.avatar && (
                <AvatarImage alt="" src={currentUser.avatar} />
              )}
              <AvatarFallback className="text-xs tracking-[-0.02em]">
                {initial}
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-medium tracking-[0.08em] text-neutral-400 dark:text-white/40">
                当前账户
              </span>
              <span className="mt-0.5 block truncate text-sm font-semibold tracking-[-0.01em] text-neutral-950 dark:text-white">
                {displayName}
              </span>
              {displayName !== currentUser.username && (
                <span className="mt-0.5 block truncate text-[11px] text-neutral-400 dark:text-white/40">
                  {currentUser.username}
                </span>
              )}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="h-10 rounded-xl px-2.5"
          onClick={() => navigate('/account/profile')}
        >
          <UserRound aria-hidden="true" />
          个人资料
        </DropdownMenuItem>
        <DropdownMenuItem
          className="h-10 rounded-xl px-2.5"
          disabled={loggingOut}
          onClick={() => void loginOut()}
          variant="destructive"
        >
          {loggingOut ? (
            <LoaderCircle className="animate-spin" aria-hidden="true" />
          ) : (
            <LogOut aria-hidden="true" />
          )}
          {loggingOut ? '正在退出' : '退出登录'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
