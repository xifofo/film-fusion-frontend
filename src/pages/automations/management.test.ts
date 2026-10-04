import { describe, expect, it } from 'vitest';
import type {
  AutomationCreateInput,
  AutomationWorkflow,
} from '@/services/film-fusion';
import { simulateRSSAutomation } from '../rss-automation/preview';
import {
  automationChanges,
  collectAutomationBindings,
  portableAutomationTemplate,
  readTemplateConfiguration,
  replaceAutomationBindings,
  resolveDefinitionParameters,
} from './management';
import {
  buildAutomationDefinition,
  defaultAutomationActions,
  editAutomationDefinition,
  readAutomationActions,
} from './workflow';

const configuration = (): AutomationCreateInput => ({
  source: {
    name: '入库',
    description: '',
    enabled: true,
    trigger_type: '115_directory',
    cloud_storage_id: 8,
    directory_id: '123',
    directory_path: '/待入库',
  },
  workflow: {
    name: '入库',
    description: '',
    enabled: true,
    definition: {
      schema_version: 1,
      parameters: {
        account: 8,
        category: '动画',
        caption: '完成',
        empty: false,
      },
      nodes: [
        { id: 'trigger', type: 'trigger', position: { x: 0, y: 0 } },
        {
          id: 'download',
          type: 'offline115_openapi',
          position: { x: 260, y: 0 },
          config: {
            cloud_storage_id: 8,
            directory_id: '123',
            url: '$item.download_url',
          },
          parameter_bindings: { cloud_storage_id: 'account' },
        },
        {
          id: 'notify',
          type: 'notification',
          position: { x: 520, y: 0 },
          config: { message: '{{params.caption}} {{item.title}}' },
        },
        { id: 'end', type: 'end', position: { x: 780, y: 0 } },
      ],
      edges: [
        { id: 'a', source: 'trigger', source_port: 'next', target: 'download' },
        {
          id: 'b',
          source: 'download',
          source_port: 'success',
          target: 'notify',
        },
        { id: 'c', source: 'notify', source_port: 'success', target: 'end' },
      ],
    },
  },
});

describe('automation management', () => {
  it('replaces a shared account and directory across the trigger, nodes and parameters', () => {
    const input = configuration();
    const before = structuredClone(input);
    const bindings = collectAutomationBindings(input);
    const account = bindings.find((item) => item.field === 'cloud_storage_id');
    const directory = bindings.find((item) => item.field === 'directory_id');
    if (!account || !directory) throw new Error('Missing binding groups');
    expect(account.locations).toHaveLength(2);
    const copy = replaceAutomationBindings(input, {
      [account.key]: 42,
      [directory.key]: '456',
    });
    expect(copy.source.cloud_storage_id).toBe(42);
    expect(copy.source.directory_id).toBe('456');
    expect(copy.workflow.definition.parameters?.account).toBe(42);
    expect(
      resolveDefinitionParameters(copy.workflow.definition).nodes[1].config
        ?.cloud_storage_id,
    ).toBe(42);
    expect(copy.workflow.definition.nodes[1].config?.directory_id).toBe('456');
    expect(input).toEqual(before);
  });

  it('exports templates with private bindings cleared and item references preserved', () => {
    const input = configuration();
    input.source.feed_url = 'https://private.example/rss?passkey=secret';
    input.workflow.definition.nodes[2].config = {
      ...input.workflow.definition.nodes[2].config,
      image_url: 'https://private.example/{{item.title}}?token=secret',
    };
    const share = portableAutomationTemplate(input);
    expect(share.source.enabled).toBe(false);
    expect(share.source.feed_url).toBe('');
    expect(share.workflow.definition.nodes[2].config?.image_url).toBe('');
    expect(share.workflow.definition.parameters?.account).toBe(0);
    expect(share.workflow.definition.nodes[1].config?.url).toBe(
      '$item.download_url',
    );
    expect(share.workflow.definition.nodes[1].parameter_bindings).toEqual({
      cloud_storage_id: 'account',
    });
    expect(readTemplateConfiguration(JSON.stringify(share))).toEqual(share);
    expect(input.workflow.definition.parameters?.account).toBe(8);
  });

  it('uses the same parameters in previews and rejects undefined references', () => {
    const definition = configuration().workflow.definition;
    const resolved = resolveDefinitionParameters(definition);
    expect(resolved.nodes[2].config?.message).toBe('完成 {{item.title}}');
    expect(
      simulateRSSAutomation(definition, {
        title: '示例',
        download_url:
          'magnet:?xt=urn:btih:0123456789012345678901234567890123456789',
      }).nodes.notify.output,
    ).toBe('完成 示例');
    delete definition.parameters?.caption;
    expect(() => resolveDefinitionParameters(definition)).toThrow('caption');
    expect(simulateRSSAutomation(definition, {}).nodes.notify.label).toBe(
      '参数无效',
    );
  });

  it('shows source, parameter and node changes between two saved versions', () => {
    const before = configuration();
    const after = structuredClone(before);
    after.source.directory_id = 'new';
    after.workflow.definition.parameters = { account: 42 };
    after.workflow.definition.nodes[2].config = { message: '不同内容' };
    expect(automationChanges(before, after).map((item) => item.key)).toEqual([
      'source.directory_id',
      'parameters',
      'node.notify',
    ]);
  });

  it('preserves parameters and bindings through the simplified directory editor', () => {
    const definition = buildAutomationDefinition({
      ...defaultAutomationActions(),
      organize_enabled: true,
      cloud_directory_id: 7,
    });
    definition.parameters = { category: '动画', library: 9 };
    const organize = definition.nodes.find(
      (node) => node.type === 'organize_strm',
    );
    if (!organize) throw new Error('Missing organize node');
    organize.parameter_bindings = {
      category: 'category',
      cloud_directory_id: 'library',
    };
    organize.config = { ...organize.config, extra_option: true };
    const workflow = {
      definition_json: JSON.stringify(definition),
    } as AutomationWorkflow;
    const actions = readAutomationActions(workflow);
    expect(actions.cloud_directory_id).toBe(9);
    expect(editAutomationDefinition(actions, workflow)).toEqual(definition);
    const changed = editAutomationDefinition(
      { ...actions, category: '电影' },
      workflow,
    );
    expect(changed.parameters?.category).toBe('电影');
    expect(
      changed.nodes.find((node) => node.id === organize.id)?.parameter_bindings,
    ).toEqual(organize.parameter_bindings);
    expect(
      changed.nodes.find((node) => node.id === organize.id)?.config
        ?.extra_option,
    ).toBe(true);
  });

  it('preserves custom nodes and options when editing a directory workflow', () => {
    const definition = buildAutomationDefinition({
      ...defaultAutomationActions(),
      recognition: 'local',
    });
    const recognize = definition.nodes.find((node) => node.id === 'recognize');
    if (!recognize) throw new Error('Missing recognize node');
    recognize.config = {
      lookup_tmdb: false,
      recognition_mode: 'file',
    };
    definition.nodes.push({
      id: 'extra',
      type: 'notification',
      position: { x: 0, y: 500 },
      config: { message: 'custom branch' },
    });
    definition.edges.push({
      id: 'custom-edge',
      source: 'trigger',
      source_port: 'next',
      target: 'extra',
    });
    const workflow = {
      definition_json: JSON.stringify(definition),
    } as AutomationWorkflow;
    const actions = readAutomationActions(workflow);
    const edited = editAutomationDefinition(
      { ...actions, notification_title: '新标题' },
      workflow,
    );
    expect(edited.nodes.find((node) => node.id === 'extra')).toEqual(
      definition.nodes.at(-1),
    );
    expect(
      edited.nodes.find((node) => node.id === 'recognize')?.config?.lookup_tmdb,
    ).toBe(false);
    expect(edited.edges).toEqual(definition.edges);
    expect(() =>
      editAutomationDefinition(
        { ...actions, notification_enabled: false },
        workflow,
      ),
    ).toThrow('自定义节点');
  });
});
