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

  it('reads the editable actions from a persisted workflow', () => {
    const definition = buildAutomationDefinition({
      ...defaultAutomationActions(),
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
      recognition: 'moviepilot',
      organize_enabled: true,
      cloud_directory_id: 12,
      media_type: 'tv',
      category: '剧集',
      notification_message: '{{item.title}} 已完成',
    });
  });
});
