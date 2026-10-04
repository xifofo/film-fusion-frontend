import type {
  AutomationDefinition,
  AutomationNodeDefinition,
  AutomationWorkflow,
} from '@/services/film-fusion';
import {
  type AutomationDelayUnit,
  automationDelayParts,
  toAutomationDelaySeconds,
} from './delay';
import { resolveDefinitionParameters } from './management';

export type RecognitionMode =
  | 'none'
  | 'local'
  | 'moviepilot'
  | 'shadow'
  | 'medianame';

export type AutomationActionValues = {
  delay_value: number;
  delay_unit: AutomationDelayUnit;
  recognition: RecognitionMode;
  organize_enabled: boolean;
  organize_dry_run: boolean;
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
  delay_value: 0,
  delay_unit: 'minutes',
  recognition: 'shadow',
  organize_enabled: false,
  organize_dry_run: false,
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

  const delaySeconds = toAutomationDelaySeconds(
    values.delay_value,
    values.delay_unit,
  );
  if (delaySeconds > 0) {
    nodes.push({
      id: 'delay',
      type: 'delay',
      name: '触发后延迟',
      position: { x: 40 + nodes.length * 260, y: 120 },
      config: { delay_seconds: delaySeconds },
      max_attempts: 1,
    });
  }

  if (values.recognition === 'local') {
    nodes.push({
      id: 'recognize',
      type: 'filmfusion_recognize',
      name: 'FilmFusion 媒体识别',
      position: { x: 40 + nodes.length * 260, y: 120 },
      config: { recognition_mode: 'file', lookup_tmdb: true },
      max_attempts: 3,
    });
  } else if (
    values.recognition === 'medianame' ||
    values.recognition === 'moviepilot' ||
    values.recognition === 'shadow'
  ) {
    nodes.push({
      id: 'recognize',
      type: 'moviepilot_recognize',
      name:
        values.recognition === 'shadow'
          ? '影子识别（MP2 优先）'
          : values.recognition === 'medianame'
            ? 'medianame 识别'
            : '仅 MP2 识别',
      position: { x: 40 + nodes.length * 260, y: 120 },
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
        dry_run: values.organize_dry_run,
        recognition_source:
          values.recognition === 'none' ? '' : values.recognition,
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
    const definition = resolveDefinitionParameters(
      JSON.parse(workflow.definition_json),
    ) as {
      nodes?: Array<{ type?: string; config?: unknown }>;
    };
    if (!Array.isArray(definition.nodes)) return fallback;
    const delayNode = definition.nodes.find((node) => node.type === 'delay');
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
    const delayConfig = asRecord(delayNode?.config);
    const delay = automationDelayParts(delayConfig.delay_seconds);
    const notificationConfig = asRecord(notification?.config);
    const moviePilotConfig = asRecord(moviePilot?.config);
    const moviePilotRecognition =
      moviePilotConfig.recognition_source === 'medianame'
        ? 'medianame'
        : moviePilotConfig.recognition_source === 'shadow'
          ? 'shadow'
          : 'moviepilot';
    return {
      delay_value: delay.value,
      delay_unit: delay.unit,
      recognition: local
        ? 'local'
        : moviePilot
          ? moviePilotRecognition
          : 'none',
      organize_enabled: Boolean(organize),
      organize_dry_run: organizeConfig.dry_run === true,
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

export const editAutomationDefinition = (
  values: AutomationActionValues,
  workflow?: AutomationWorkflow,
): AutomationDefinition => {
  if (!workflow) return buildAutomationDefinition(values);
  const original = JSON.parse(workflow.definition_json) as AutomationDefinition;
  const initial = readAutomationActions(workflow);
  if (
    (Object.keys(initial) as (keyof AutomationActionValues)[]).every(
      (key) => (values[key] ?? initial[key]) === initial[key],
    )
  )
    return structuredClone(original);
  const previousManaged = buildAutomationDefinition(initial);
  const next = buildAutomationDefinition(values);
  const parameters = { ...original.parameters };
  const topology = (definition: AutomationDefinition) =>
    JSON.stringify({
      nodes: definition.nodes.map(({ id, type }) => ({ id, type })),
      edges: definition.edges.map(
        ({ source, source_port, target, target_port }) => ({
          source,
          source_port,
          target,
          target_port,
        }),
      ),
    });
  const custom = topology(original) !== topology(previousManaged);
  if (custom && topology(next) !== topology(previousManaged)) {
    throw new Error(
      '此流程包含自定义节点或连线，不能在简化编辑器中增删步骤；可以通过流程参数调整配置。',
    );
  }
  const mergeNode = (
    node: AutomationNodeDefinition,
    previous?: AutomationNodeDefinition,
  ) => {
    if (!previous) return node;
    const baseline = previousManaged.nodes.find(
      (item) => item.id === node.id && item.type === node.type,
    );
    const config = { ...previous.config };
    for (const [field, after] of Object.entries(node.config || {})) {
      if (baseline && baseline.config?.[field] === after) continue;
      const raw = previous.config?.[field];
      const parameter =
        previous.parameter_bindings?.[field] ||
        (typeof raw === 'string' && /^\$params\.[A-Za-z_]\w*$/.test(raw)
          ? raw.slice(8)
          : undefined);
      if (parameter) parameters[parameter] = after as string | number | boolean;
      else config[field] = after;
    }
    return { ...node, ...previous, config };
  };
  const nodes = custom
    ? original.nodes.map((previous) => {
        const node =
          next.nodes.find(
            (item) => item.id === previous.id && item.type === previous.type,
          ) ||
          (original.nodes.filter((item) => item.type === previous.type)
            .length === 1
            ? next.nodes.find((item) => item.type === previous.type)
            : undefined);
        return node ? mergeNode(node, previous) : previous;
      })
    : next.nodes.map((node) =>
        mergeNode(
          node,
          original.nodes.find(
            (item) => item.id === node.id && item.type === node.type,
          ),
        ),
      );
  const sameNodes =
    original.nodes.length === nodes.length &&
    original.nodes.every((node) =>
      nodes.some((item) => item.id === node.id && item.type === node.type),
    );
  return {
    ...original,
    ...next,
    nodes,
    edges: custom || sameNodes ? original.edges : next.edges,
    parameters,
    metadata: original.metadata,
    viewport: original.viewport || next.viewport,
  };
};
