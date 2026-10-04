import type { RSSAutomationNodeType } from '@/services/film-fusion';

export const OPENAPI_115_CLOUD_NODES: RSSAutomationNodeType[] = [
  'torrent115_openapi',
  'offline115_bt_openapi',
  'list115_tasks_openapi',
  'quota115_openapi',
  'delete115_task_openapi',
  'clear115_tasks_openapi',
];

export const OPENAPI_115_WRITE_NODES: RSSAutomationNodeType[] = [
  'offline115_openapi',
  'offline115_bt_openapi',
  'delete115_task_openapi',
  'clear115_tasks_openapi',
];
