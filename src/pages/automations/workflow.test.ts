import { describe, expect, it } from 'vitest';
import type { AutomationWorkflow } from '@/services/film-fusion';
import {
  buildAutomationDefinition,
  defaultAutomationActions,
  readAutomationActions,
} from './workflow';

describe('115 directory automation workflow', () => {
  it('builds one linear chain from the stable directory trigger', () => {
    const definition = buildAutomationDefinition({
      ...defaultAutomationActions(),
      organize_enabled: true,
      cloud_directory_id: 9,
    });
    expect(definition.nodes.map((node) => node.type)).toEqual([
      'trigger',
      'moviepilot_recognize',
      'organize_strm',
      'notification',
      'end',
    ]);
    expect(definition.edges[0].source_port).toBe('next');
    expect(
      definition.edges.slice(1).every((edge) => edge.source_port === 'success'),
    ).toBe(true);
  });

  it('keeps medianame selected for recognition and organizing after round-trip', () => {
    const definition = buildAutomationDefinition({
      ...defaultAutomationActions(),
      recognition: 'medianame',
      organize_enabled: true,
      organize_dry_run: true,
      cloud_directory_id: 9,
    });
    for (const node of definition.nodes.filter((node) =>
      ['moviepilot_recognize', 'organize_strm'].includes(node.type),
    ))
      expect(node.config?.recognition_source).toBe('medianame');
    expect(
      readAutomationActions({
        definition_json: JSON.stringify(definition),
      } as AutomationWorkflow).recognition,
    ).toBe('medianame');
    expect(
      definition.nodes.find((node) => node.type === 'organize_strm')?.config
        ?.dry_run,
    ).toBe(true);
    expect(
      readAutomationActions({
        definition_json: JSON.stringify(definition),
      } as AutomationWorkflow).organize_dry_run,
    ).toBe(true);
  });

  it('allows a monitor that only records events', () => {
    const definition = buildAutomationDefinition({
      ...defaultAutomationActions(),
      recognition: 'none',
      notification_enabled: false,
    });
    expect(definition.nodes.map((node) => node.type)).toEqual([
      'trigger',
      'end',
    ]);
  });

  it('inserts a durable delay directly after the trigger', () => {
    const definition = buildAutomationDefinition({
      ...defaultAutomationActions(),
      delay_value: 2,
      delay_unit: 'hours',
      recognition: 'none',
      notification_enabled: false,
    });
    expect(definition.nodes.map((node) => node.type)).toEqual([
      'trigger',
      'delay',
      'end',
    ]);
    expect(definition.nodes[1].config).toEqual({ delay_seconds: 7200 });
    expect(definition.edges).toMatchObject([
      { source: 'trigger', source_port: 'next', target: 'delay' },
      { source: 'delay', source_port: 'success', target: 'end' },
    ]);
  });

  it('reads the editable actions from a persisted workflow', () => {
    const definition = buildAutomationDefinition({
      ...defaultAutomationActions(),
      delay_value: 10,
      delay_unit: 'minutes',
      recognition: 'moviepilot',
      organize_enabled: true,
      cloud_directory_id: 12,
      media_type: 'tv',
      category: '剧集',
      notification_message: '{{item.title}} 已完成',
    });
    const workflow = {
      definition_json: JSON.stringify(definition),
    } as AutomationWorkflow;
    expect(readAutomationActions(workflow)).toMatchObject({
      delay_value: 10,
      delay_unit: 'minutes',
      recognition: 'moviepilot',
      organize_enabled: true,
      cloud_directory_id: 12,
      media_type: 'tv',
      category: '剧集',
      notification_message: '{{item.title}} 已完成',
    });
  });
});
