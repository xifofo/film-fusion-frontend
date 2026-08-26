import type {
  AutomationDefinition,
  AutomationNodeDefinition,
  AutomationWorkflow,
} from '@/services/film-fusion';

export type RecognitionMode = 'none' | 'local' | 'moviepilot' | 'shadow';

export type AutomationActionValues = {
  recognition: RecognitionMode;
  organize_enabled: boolean;
  cloud_directory_id?: number;
  media_type: 'auto' | 'movie' | 'tv';
  category?: string;
  notification_enabled: boolean;
  notification_title?: string;
  notification_message?: string;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

export const defaultAutomationActions = (): AutomationActionValues => ({
  recognition: 'shadow',
  organize_enabled: false,
  media_type: 'auto',
  notification_enabled: true,
  notification_title: '115 目录发现新媒体',
  notification_message: '{{item.path}}',
});

export const buildAutomationDefinition = (
  values: AutomationActionValues,
): AutomationDefinition => {
  const nodes: AutomationNodeDefinition[] = [
    {
      id: 'trigger',
      type: 'trigger',
      name: '115 目录新增且已稳定',
      position: { x: 40, y: 120 },
      config: {},
    },
  ];

  if (values.recognition === 'local') {
    nodes.push({
      id: 'recognize',
      type: 'filmfusion_recognize',
      name: 'FilmFusion 媒体识别',
      position: { x: 300, y: 120 },
      config: { recognition_mode: 'file', lookup_tmdb: true },
      max_attempts: 3,
    });
  } else if (
    values.recognition === 'moviepilot' ||
    values.recognition === 'shadow'
  ) {
    nodes.push({
      id: 'recognize',
      type: 'moviepilot_recognize',
      name:
        values.recognition === 'shadow'
          ? '影子识别（MP2 优先）'
          : '仅 MP2 识别',
      position: { x: 300, y: 120 },
      config: { recognition_source: values.recognition },
      max_attempts: 3,
    });
  }

  if (values.organize_enabled) {
    nodes.push({
      id: 'organize',
      type: 'organize_strm',
      name: '媒体整理与 STRM 生成',
      position: { x: 40 + nodes.length * 260, y: 120 },
      config: {
        cloud_directory_id: values.cloud_directory_id,
        media_type: values.media_type || 'auto',
        category: values.category?.trim() || '',
      },
      max_attempts: 3,
    });
  }

  if (values.notification_enabled) {
    nodes.push({
      id: 'notification',
      type: 'notification',
      name: '发送通知',
      position: { x: 40 + nodes.length * 260, y: 120 },
      config: {
        title: values.notification_title?.trim() || '115 目录发现新媒体',
        message: values.notification_message?.trim() || '{{item.path}}',
      },
      max_attempts: 2,
    });
  }

  nodes.push({
    id: 'end',
    type: 'end',
    name: '结束',
    position: { x: 40 + nodes.length * 260, y: 120 },
    config: {},
  });

  return {
    schema_version: 1,
    nodes,
    edges: nodes.slice(0, -1).map((node, index) => ({
      id: `edge-${node.id}-${nodes[index + 1].id}`,
      source: node.id,
      source_port: node.type === 'trigger' ? 'next' : 'success',
      target: nodes[index + 1].id,
    })),
    viewport: { x: 0, y: 0, zoom: 1 },
  };
};

export const readAutomationActions = (
  workflow?: AutomationWorkflow,
): AutomationActionValues => {
  const fallback = defaultAutomationActions();
  if (!workflow?.definition_json) return fallback;
  try {
    const definition = JSON.parse(workflow.definition_json) as {
      nodes?: Array<{ type?: string; config?: unknown }>;
    };
    if (!Array.isArray(definition.nodes)) return fallback;
    const local = definition.nodes.find(
      (node) => node.type === 'filmfusion_recognize',
    );
    const moviePilot = definition.nodes.find(
      (node) => node.type === 'moviepilot_recognize',
    );
    const organize = definition.nodes.find(
      (node) => node.type === 'organize_strm',
    );
    const notification = definition.nodes.find(
      (node) => node.type === 'notification',
    );
    const organizeConfig = asRecord(organize?.config);
    const notificationConfig = asRecord(notification?.config);
    const moviePilotConfig = asRecord(moviePilot?.config);
    const moviePilotRecognition =
      moviePilotConfig.recognition_source === 'shadow'
        ? 'shadow'
        : 'moviepilot';
    return {
      recognition: local
        ? 'local'
        : moviePilot
          ? moviePilotRecognition
          : 'none',
      organize_enabled: Boolean(organize),
      cloud_directory_id: asNumber(organizeConfig.cloud_directory_id),
      media_type:
        organizeConfig.media_type === 'movie' ||
        organizeConfig.media_type === 'tv'
          ? organizeConfig.media_type
          : 'auto',
      category:
        typeof organizeConfig.category === 'string'
          ? organizeConfig.category
          : '',
      notification_enabled: Boolean(notification),
      notification_title:
        typeof notificationConfig.title === 'string'
          ? notificationConfig.title
          : fallback.notification_title,
      notification_message:
        typeof notificationConfig.message === 'string'
          ? notificationConfig.message
          : fallback.notification_message,
    };
  } catch {
    return fallback;
  }
};
