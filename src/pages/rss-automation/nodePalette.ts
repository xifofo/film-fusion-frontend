import type { RSSAutomationNodeType } from '@/services/film-fusion';

export type NodePaletteGroup = {
  title: string;
  types: readonly RSSAutomationNodeType[];
};

export const NODE_PALETTE_COLUMNS: readonly (readonly NodePaletteGroup[])[] = [
  [
    {
      title: '变量与数据',
      types: [
        'set_variable',
        'template',
        'json_extract',
        'math',
        'datetime_operation',
        'list_operation',
        'coalesce',
        'convert',
      ],
    },
    {
      title: '文本处理',
      types: ['keyword', 'keyword_replace', 'regex', 'regex_replace'],
    },
    {
      title: '条件与分支',
      types: ['if', 'switch', 'foreach', 'parallel', 'join'],
    },
    {
      title: '流程控制',
      types: ['delay', 'end'],
    },
    {
      title: '流程保护',
      types: ['deduplicate', 'rate_limit'],
    },
  ],
  [
    {
      title: 'qBittorrent',
      types: ['qbittorrent', 'wait_qbittorrent', 'delete_qbittorrent'],
    },
    {
      title: '115 OpenAPI',
      types: ['offline115_openapi', 'rename115_openapi'],
    },
    {
      title: '115 Cookie / 通用',
      types: ['offline115', 'wait115'],
    },
    {
      title: 'MoviePilot',
      types: [
        'moviepilot_title_recognize',
        'moviepilot_transfer',
        'moviepilot_recognize',
      ],
    },
    {
      title: 'FilmFusion',
      types: ['filmfusion_recognize', 'media_exists'],
    },
    {
      title: 'HDHive',
      types: ['hdhive_query', 'hdhive_unlock'],
    },
    {
      title: 'STRM / Emby',
      types: [
        'organize_strm',
        'strm_verify',
        'strm_regenerate',
        'emby_refresh_wait',
      ],
    },
    {
      title: 'Webhook / 通知',
      types: ['http_request', 'notification'],
    },
  ],
];

export const NODE_PALETTE = NODE_PALETTE_COLUMNS.flat();
