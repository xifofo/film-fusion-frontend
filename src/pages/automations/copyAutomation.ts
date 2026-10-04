import type {
  AutomationCreateInput,
  AutomationDefinition,
  AutomationSource,
  AutomationWorkflow,
  RSSAutomationMapping,
} from '@/services/film-fusion';

export const copyName = (name: string, existingNames: string[]): string => {
  const names = new Set(existingNames);
  for (let index = 1; ; index += 1) {
    const suffix = index === 1 ? '（副本）' : `（副本 ${index}）`;
    const candidate = `${Array.from(name.trim())
      .slice(0, 120 - Array.from(suffix).length)
      .join('')}${suffix}`;
    if (!names.has(candidate)) return candidate;
  }
};

export const readAutomationConfiguration = (
  source: AutomationSource,
  workflow: AutomationWorkflow,
): AutomationCreateInput => {
  const input = buildAutomationCopy(source, workflow, []);
  input.source.name = source.name;
  input.source.enabled = source.enabled;
  input.workflow.name = workflow.name;
  input.workflow.enabled = workflow.enabled;
  return input;
};

export const buildAutomationCopy = (
  source: AutomationSource,
  workflow: AutomationWorkflow | undefined,
  existingNames: string[],
): AutomationCreateInput => {
  if (!workflow || workflow.source_id !== source.id) {
    throw new Error('找不到对应流程，无法复制');
  }

  let definition: AutomationDefinition;
  try {
    definition = JSON.parse(workflow.definition_json);
    if (
      definition?.schema_version !== 1 ||
      !Array.isArray(definition.nodes) ||
      definition.nodes.length === 0 ||
      !Array.isArray(definition.edges)
    ) {
      throw new Error('Invalid workflow');
    }
  } catch {
    throw new Error('原流程配置无法读取，请修复后再复制');
  }

  let mapping: RSSAutomationMapping | undefined;
  if (source.trigger_type === 'rss') {
    try {
      mapping = source.mapping_json
        ? JSON.parse(source.mapping_json)
        : structuredClone(source.mapping);
      if (!mapping?.item_selector || !Array.isArray(mapping.fields)) {
        throw new Error('Invalid RSS mapping');
      }
    } catch {
      throw new Error('RSS 解析配置无法读取，请先检查原流程的 RSS 设置');
    }
  }

  const name = copyName(source.name, existingNames);
  return {
    source: {
      name,
      description: source.description,
      enabled: false,
      trigger_type: source.trigger_type,
      ...(source.trigger_type === 'rss'
        ? {
            feed_url: source.feed_url,
            interval_minutes: source.interval_minutes,
            mapping,
          }
        : {
            cloud_storage_id: source.cloud_storage_id,
            directory_id: source.directory_id,
            directory_path: source.directory_path,
            recursive: source.recursive,
            interval_seconds: source.interval_seconds,
            quiet_seconds: source.quiet_seconds,
          }),
    },
    workflow: {
      name:
        workflow.name && workflow.name !== source.name
          ? copyName(workflow.name, existingNames)
          : name,
      description: workflow.description || '',
      enabled: false,
      definition,
    },
  };
};
