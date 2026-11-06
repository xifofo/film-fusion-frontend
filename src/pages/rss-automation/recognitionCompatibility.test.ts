import { describe, expect, it } from 'vitest';
import { parseWorkflowDefinition } from './flow';
import { validateWorkflowTransferDefinition } from './workflowTransfer';

const legacy = {
  schema_version: 1,
  nodes: [
    { id: 'trigger', type: 'trigger', position: { x: 0, y: 0 } },
    {
      id: 'recognize',
      type: 'moviepilot_title_recognize',
      position: { x: 300, y: 0 },
      name: '我的标题识别',
      config: { input: '$item.title', recognition_source: 'shadow' },
      parameter_bindings: {},
      max_attempts: 3,
    },
    { id: 'end', type: 'end', position: { x: 600, y: 0 } },
  ],
  edges: [
    {
      id: 'first',
      source: 'trigger',
      source_port: 'next',
      target: 'recognize',
    },
    { id: 'last', source: 'recognize', source_port: 'success', target: 'end' },
  ],
};

describe('historical recognition workflows', () => {
  it.each(['moviepilot_title_recognize', 'moviepilot_recognize'])(
    'opens and imports %s without losing its graph',
    (type) => {
      const input = structuredClone(legacy);
      input.nodes[1].type = type;
      const original = JSON.stringify(input);
      for (const migrated of [
        parseWorkflowDefinition(original),
        validateWorkflowTransferDefinition(input),
      ]) {
        expect(migrated?.nodes[1]).toMatchObject({
          id: 'recognize',
          name: '我的标题识别',
          position: { x: 300, y: 0 },
          type:
            type === 'moviepilot_recognize'
              ? 'media_file_recognize'
              : 'media_title_recognize',
          config: { input: '$item.title', recognition_source: 'medianame' },
          parameter_bindings: {},
          max_attempts: 3,
        });
        expect(migrated?.edges).toEqual(input.edges);
      }
      expect(JSON.stringify(input)).toBe(original);
    },
  );
  it('still rejects unsupported imported nodes', () => {
    const input = structuredClone(legacy);
    input.nodes[1].type = 'unsupported';
    expect(() => validateWorkflowTransferDefinition(input)).toThrow('未知类型');
  });
});
