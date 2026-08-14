import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeftRight,
  ChartNoAxesCombined,
  Clapperboard,
  Cloud,
  Database,
  Download,
  FileText,
  Folder,
  GitBranch,
  Images,
  Info,
  Link2,
  ListRestart,
  Route,
  Rss,
  ScanSearch,
  Settings,
  SquareTerminal,
  UserRoundCog,
  Zap,
} from 'lucide-react';

export type AppMenuItem = {
  name: string;
  icon: LucideIcon;
  path: string;
  children?: AppMenuItem[];
};

export const menuItems: AppMenuItem[] = [
  {
    name: '云存储管理',
    icon: Cloud,
    path: '/cloud-storage',
  },
  {
    name: '云路径映射',
    icon: Link2,
    path: '/cloud-paths',
  },
  {
    name: '目录配置',
    icon: Folder,
    path: '/directories',
  },
  {
    name: '下载队列',
    icon: Download,
    path: '/download-queue',
  },
  {
    name: '下载器设置',
    icon: Download,
    path: '/downloaders',
  },
  {
    name: 'Match302 重定向',
    icon: ArrowLeftRight,
    path: '/match302',
  },
  {
    name: 'Pickcode 缓存管理',
    icon: Database,
    path: '/pickcode-cache',
  },
  {
    name: 'Emby',
    icon: Clapperboard,
    path: '/emby',
    children: [
      {
        name: '封面生成',
        icon: Images,
        path: '/emby/cover',
      },
      {
        name: '媒体统计',
        icon: ChartNoAxesCombined,
        path: '/emby/stats',
      },
      {
        name: '观看记录',
        icon: Clapperboard,
        path: '/emby-watch',
      },
      {
        name: '图片优化',
        icon: Images,
        path: '/emby/image-optimization',
      },
      {
        name: '缺集扫描',
        icon: ScanSearch,
        path: '/emby/missing',
      },
      {
        name: '多版本检查',
        icon: GitBranch,
        path: '/emby/version-check',
      },
      {
        name: '账号绑定',
        icon: UserRoundCog,
        path: '/emby/bindings',
      },
    ],
  },
  {
    name: '日志中心',
    icon: FileText,
    path: '/logs',
    children: [
      {
        name: '代理日志',
        icon: Zap,
        path: '/emby/proxy-log',
      },
      {
        name: '整理日志',
        icon: ListRestart,
        path: '/organize-logs',
      },
      {
        name: '运行日志',
        icon: SquareTerminal,
        path: '/server-logs',
      },
    ],
  },
  {
    name: 'RSS',
    icon: Rss,
    path: '/rss',
    children: [
      {
        name: 'RSS 生成器',
        icon: Rss,
        path: '/rss-generator',
      },
      {
        name: 'RSS 自动化',
        icon: Route,
        path: '/rss-automation',
      },
    ],
  },
  {
    name: '系统信息',
    icon: Info,
    path: '/system-info',
  },
  {
    name: '系统设置',
    icon: Settings,
    path: '/system-settings',
  },
];

export const menuPathMatches = (pathname: string, itemPath: string) =>
  pathname === itemPath || pathname.startsWith(`${itemPath}/`);

export const findMenuTrail = (
  pathname: string,
  items: AppMenuItem[] = menuItems,
): AppMenuItem[] => {
  let bestMatch: AppMenuItem[] = [];

  for (const item of items) {
    const childTrail = item.children
      ? findMenuTrail(pathname, item.children)
      : [];
    const candidate =
      childTrail.length > 0
        ? [item, ...childTrail]
        : menuPathMatches(pathname, item.path)
          ? [item]
          : [];

    if (
      candidate.length > 0 &&
      (bestMatch.length === 0 ||
        (candidate.at(-1)?.path.length ?? 0) >
          (bestMatch.at(-1)?.path.length ?? 0))
    ) {
      bestMatch = candidate;
    }
  }

  return bestMatch;
};
