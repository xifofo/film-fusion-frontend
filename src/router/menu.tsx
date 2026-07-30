import {
  BarChartOutlined,
  BranchesOutlined,
  CalendarOutlined,
  CloudOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  FolderOutlined,
  LinkOutlined,
  PictureOutlined,
  PlaySquareOutlined,
  ProfileOutlined,
  RadarChartOutlined,
  SearchOutlined,
  SettingOutlined,
  SwapOutlined,
  ThunderboltOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import type { MenuDataItem } from '@ant-design/pro-components';

export const menuItems: MenuDataItem[] = [
  {
    name: '云存储管理',
    icon: <CloudOutlined />,
    path: '/cloud-storage',
  },
  {
    name: '云路径映射',
    icon: <LinkOutlined />,
    path: '/cloud-paths',
  },
  {
    name: '目录配置',
    icon: <FolderOutlined />,
    path: '/directories',
  },
  {
    name: 'Match302重定向',
    icon: <SwapOutlined />,
    path: '/match302',
  },
  {
    name: 'Pickcode缓存管理',
    icon: <DatabaseOutlined />,
    path: '/pickcode-cache',
  },
  {
    name: 'Emby',
    icon: <PlaySquareOutlined />,
    path: '/emby',
    children: [
      {
        name: '封面生成',
        icon: <PictureOutlined />,
        path: '/emby/cover',
      },
      {
        name: '媒体统计',
        icon: <BarChartOutlined />,
        path: '/emby/stats',
      },
      {
        name: '图片优化',
        icon: <PictureOutlined />,
        path: '/emby/image-optimization',
      },
      {
        name: '缺集扫描',
        icon: <SearchOutlined />,
        path: '/emby/missing',
      },
      {
        name: '多版本检查',
        icon: <BranchesOutlined />,
        path: '/emby/version-check',
      },
      {
        name: '账号绑定',
        icon: <UserSwitchOutlined />,
        path: '/emby/bindings',
      },
    ],
  },
  {
    name: '日志中心',
    icon: <FileTextOutlined />,
    path: '/logs',
    children: [
      {
        name: '代理日志',
        icon: <ThunderboltOutlined />,
        path: '/emby/proxy-log',
      },
      {
        name: '观看记录',
        icon: <CalendarOutlined />,
        path: '/emby-watch',
      },
      {
        name: '整理日志',
        icon: <FileTextOutlined />,
        path: '/organize-logs',
      },
      {
        name: '运行日志',
        icon: <ProfileOutlined />,
        path: '/server-logs',
      },
    ],
  },
  {
    name: 'RSS监控',
    icon: <RadarChartOutlined />,
    path: '/rss-monitor',
  },
  {
    name: '系统设置',
    icon: <SettingOutlined />,
    path: '/system-settings',
  },
];
