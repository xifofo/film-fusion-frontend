import { LoaderCircle, LogOut } from 'lucide-react';
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

  const initial =
    Array.from(currentUser.username.trim())[0]?.toUpperCase() || 'F';

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
          'flex h-9 w-full min-w-0 items-center gap-2 rounded-lg border-0 !bg-transparent px-1 text-left text-neutral-950 shadow-none outline-none hover:!bg-transparent focus-visible:ring-2 focus-visible:ring-black/15 data-popup-open:!bg-transparent dark:text-white dark:focus-visible:ring-white/25',
          collapsed && 'justify-center px-0',
        )}
        title={collapsed ? currentUser.username : undefined}
      >
        <Avatar className="size-7" size="sm">
          {currentUser.avatar && (
            <AvatarImage alt="" src={currentUser.avatar} />
          )}
          <AvatarFallback>{initial}</AvatarFallback>
        </Avatar>
        <span className={cn('min-w-0 flex-1', collapsed && 'sr-only')}>
          <span className="block max-w-32 truncate text-[13px] font-medium">
            {currentUser.username}
          </span>
        </span>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="w-64 rounded-2xl p-2"
        side="top"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 py-2 font-normal">
            <span className="block truncate text-sm font-semibold text-neutral-950 dark:text-white">
              {currentUser.username}
            </span>
            <span className="mt-0.5 block truncate text-[11px] text-neutral-400 dark:text-white/40">
              {currentUser.email?.trim() || 'Film Fusion 管理账户'}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
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
