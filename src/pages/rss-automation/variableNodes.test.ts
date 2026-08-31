import { describe, expect, it } from 'vitest';
import type {
  RSSAutomationDefinition,
  RSSAutomationNodeDefinition,
  RSSAutomationNodeType,
} from '@/services/film-fusion';
import { createNodeDefinition } from './flow';
import { simulateRSSAutomation } from './preview';
import { validateWorkflowTransferDefinition } from './workflowTransfer';

const node = (
  id: string,
  type: RSSAutomationNodeType,
  config: Record<string, unknown> = {},
): RSSAutomationNodeDefinition => ({
  id,
  type,
  name: id,
  position: { x: 0, y: 0 },
  config,
});

const linearDefinition = (
  middle: RSSAutomationNodeDefinition[],
): RSSAutomationDefinition => {
  const nodes = [node('trigger', 'trigger'), ...middle, node('end', 'end')];
  return {
    schema_version: 1,
    nodes,
    edges: nodes.slice(0, -1).map((current, index) => ({
      id: `edge_${index}`,
      source: current.id,
      source_port: current.type === 'trigger' ? 'next' : 'success',
      target: nodes[index + 1].id,
    })),
  };
};

describe('RSS automation variable nodes', () => {
  it('creates complete defaults for the first four variable nodes', () => {
    expect(createNodeDefinition('set_variable', { x: 0, y: 0 }).config).toEqual(
      {
        variable: 'result',
        value: '',
        value_type: 'auto',
        overwrite: 'overwrite',
      },
    );
    expect(createNodeDefinition('template', { x: 0, y: 0 }).config).toEqual({
      template: '{{item.title}}',
      variable: 'rendered_text',
      missing: 'error',
      trim: false,
      overwrite: 'overwrite',
    });
    expect(createNodeDefinition('json_extract', { x: 0, y: 0 }).config).toEqual(
      {
        input: '$item',
        pointer: '',
        variable: 'extracted_value',
        missing: 'failure',
        default_value: '',
        value_type: 'auto',
        overwrite: 'overwrite',
      },
    );
    expect(createNodeDefinition('math', { x: 0, y: 0 }).config).toEqual({
      operation: 'add',
      left: 0,
      right: 0,
      precision: 2,
      result_type: 'number',
      variable: 'result',
      overwrite: 'overwrite',
    });
  });

  it('keeps the four node types in portable workflow definitions', () => {
    const definition = linearDefinition([
      node('set', 'set_variable', {
        variable: 'payload',
        value: '$item.payload',
        value_type: 'auto',
        overwrite: 'overwrite',
      }),
      node('template', 'template', {
        template: '{{vars.payload}}',
        variable: 'text',
        missing: 'error',
        trim: false,
        overwrite: 'overwrite',
      }),
      node('json', 'json_extract', {
        input: '$vars.payload',
        pointer: '/value',
        variable: 'value',
        missing: 'failure',
        value_type: 'auto',
        overwrite: 'overwrite',
      }),
      node('math', 'math', {
        operation: 'add',
        left: '$vars.value',
        right: 1,
        precision: 0,
        result_type: 'number',
        variable: 'total',
        overwrite: 'overwrite',
      }),
    ]);

    expect(
      validateWorkflowTransferDefinition(definition).nodes.map(
        (item) => item.type,
      ),
    ).toEqual([
      'trigger',
      'set_variable',
      'template',
      'json_extract',
      'math',
      'end',
    ]);
  });

  it('preserves exact reference types and reuses produced variables', () => {
    const definition = linearDefinition([
      node('set', 'set_variable', {
        variable: 'payload',
        value: '$item.payload',
        value_type: 'auto',
        overwrite: 'overwrite',
      }),
      node('json', 'json_extract', {
        input: '$vars.payload',
        pointer: '/items/0/value',
        variable: 'value',
        missing: 'failure',
        value_type: 'integer',
        overwrite: 'overwrite',
      }),
      node('math', 'math', {
        operation: 'multiply',
        left: '$vars.value',
        right: 2,
        precision: 0,
        result_type: 'integer',
        variable: 'total',
        overwrite: 'overwrite',
      }),
    ]);
    const payload = { items: [{ value: 6 }] };
    const preview = simulateRSSAutomation(definition, { payload });

    expect(preview.variables.payload).toEqual(payload);
    expect(preview.variables.value).toBe(6);
    expect(preview.variables.total).toBe(12);
    expect(
      (preview.nodes.set.output as Record<string, unknown>).variables,
    ).toEqual({ payload });
  });

  it('records missing template references when empty fallback is selected', () => {
    const preview = simulateRSSAutomation(
      linearDefinition([
        node('template', 'template', {
          template: '  {{item.title}} / {{vars.quality}}  ',
          variable: 'label',
          missing: 'empty',
          trim: true,
          overwrite: 'overwrite',
        }),
      ]),
      { title: '示例剧' },
    );
    const output = preview.nodes.template.output as Record<string, unknown>;

    expect(preview.variables.label).toBe('示例剧 /');
    expect(output.missing_references).toEqual(['vars.quality']);
  });

  it('fails template preview when a required reference is missing', () => {
    const preview = simulateRSSAutomation(
      linearDefinition([
        node('template', 'template', {
          template: '{{vars.missing}}',
          variable: 'label',
          missing: 'error',
          overwrite: 'overwrite',
        }),
      ]),
      {},
    );

    expect(preview.nodes.template.selectedPorts).toEqual(['failure']);
    expect(preview.nodes.template.detail).toContain('vars.missing');
  });

  it('supports RFC 6901 escapes and preserves a zero default value', () => {
    const preview = simulateRSSAutomation(
      linearDefinition([
        node('escaped', 'json_extract', {
          input: '$item.payload',
          pointer: '/a~1b/~0key',
          variable: 'escaped',
          missing: 'failure',
          value_type: 'auto',
          overwrite: 'overwrite',
        }),
        node('fallback', 'json_extract', {
          input: '$item.payload',
          pointer: '/missing',
          variable: 'fallback',
          missing: 'default',
          default_value: 0,
          value_type: 'integer',
          overwrite: 'overwrite',
        }),
      ]),
      { payload: { 'a/b': { '~key': false } } },
    );

    expect(preview.variables.escaped).toBe(false);
    expect(preview.variables.fallback).toBe(0);
  });

  it('uses half-away-from-zero precision and rejects implicit integer rounding', () => {
    const rounded = simulateRSSAutomation(
      linearDefinition([
        node('math', 'math', {
          operation: 'add',
          left: -1.25,
          right: 0,
          precision: 1,
          result_type: 'number',
          variable: 'result',
          overwrite: 'overwrite',
        }),
      ]),
      {},
    );
    expect(rounded.variables.result).toBe(-1.3);

    const roundedInteger = simulateRSSAutomation(
      linearDefinition([
        node('math', 'math', {
          operation: 'round',
          left: -1.5,
          precision: 0,
          result_type: 'integer',
          variable: 'result',
          overwrite: 'overwrite',
        }),
      ]),
      {},
    );
    expect(roundedInteger.variables.result).toBe(-2);

    const untouchedPrecision = simulateRSSAutomation(
      linearDefinition([
        node('math', 'math', {
          operation: 'add',
          left: 1.2,
          right: 0,
          result_type: 'number',
          variable: 'result',
          overwrite: 'overwrite',
        }),
      ]),
      {},
    );
    expect(untouchedPrecision.variables.result).toBe(1.2);

    const invalidInteger = simulateRSSAutomation(
      linearDefinition([
        node('math', 'math', {
          operation: 'divide',
          left: 3,
          right: 2,
          precision: 0,
          result_type: 'integer',
          variable: 'result',
          overwrite: 'overwrite',
        }),
      ]),
      {},
    );
    expect(invalidInteger.nodes.math.selectedPorts).toEqual(['failure']);
    expect(invalidInteger.nodes.math.detail).toContain('round');
  });

  it('does not coerce non-decimal values into math operands', () => {
    for (const left of [null, false, '0x10']) {
      const preview = simulateRSSAutomation(
        linearDefinition([
          node('math', 'math', {
            operation: 'add',
            left,
            right: 1,
            result_type: 'number',
            variable: 'result',
            overwrite: 'overwrite',
          }),
        ]),
        {},
      );
      expect(preview.nodes.math.selectedPorts).toEqual(['failure']);
      expect(preview.variables).not.toHaveProperty('result');
    }
  });

  it('rejects unsafe or non-finite values anywhere in variable JSON', () => {
    for (const payload of [
      { nested: Number.MAX_SAFE_INTEGER + 1 },
      { nested: Number.POSITIVE_INFINITY },
    ]) {
      const preview = simulateRSSAutomation(
        linearDefinition([
          node('set', 'set_variable', {
            variable: 'payload',
            value: '$item.payload',
            value_type: 'auto',
            overwrite: 'overwrite',
          }),
        ]),
        { payload },
      );
      expect(preview.nodes.set.selectedPorts).toEqual(['failure']);
      expect(preview.variables).not.toHaveProperty('payload');
    }
  });

  it('matches backend boolean and strict datetime conversions', () => {
    const converted = simulateRSSAutomation(
      linearDefinition([
        node('enabled', 'set_variable', {
          variable: 'enabled',
          value: 1,
          value_type: 'boolean',
          overwrite: 'overwrite',
        }),
        node('published', 'set_variable', {
          variable: 'published',
          value: '2026-08-30 12:34:56',
          value_type: 'datetime',
          overwrite: 'overwrite',
        }),
      ]),
      {},
    );
    expect(converted.variables.enabled).toBe(true);
    expect(converted.variables.published).toBe('2026-08-30T12:34:56Z');

    const invalid = simulateRSSAutomation(
      linearDefinition([
        node('published', 'set_variable', {
          variable: 'published',
          value: '2026-02-30',
          value_type: 'datetime',
          overwrite: 'overwrite',
        }),
      ]),
      {},
    );
    expect(invalid.nodes.published.selectedPorts).toEqual(['failure']);
  });

  it('applies overwrite keep and error policies', () => {
    const keep = simulateRSSAutomation(
      linearDefinition([
        node('first', 'set_variable', {
          variable: 'title',
          value: 'first',
          value_type: 'string',
          overwrite: 'overwrite',
        }),
        node('second', 'set_variable', {
          variable: 'title',
          value: 'second',
          value_type: 'string',
          overwrite: 'keep',
        }),
      ]),
      {},
    );
    expect(keep.variables.title).toBe('first');
    expect((keep.nodes.second.output as Record<string, unknown>).written).toBe(
      false,
    );

    const error = simulateRSSAutomation(
      linearDefinition([
        node('first', 'set_variable', {
          variable: 'title',
          value: 'first',
          value_type: 'string',
          overwrite: 'overwrite',
        }),
        node('second', 'set_variable', {
          variable: 'title',
          value: 'second',
          value_type: 'string',
          overwrite: 'error',
        }),
      ]),
      {},
    );
    expect(error.nodes.second.selectedPorts).toEqual(['failure']);
    expect(error.nodes.second.detail).toContain('$vars.title 已存在');

    const mathKeep = simulateRSSAutomation(
      linearDefinition([
        node('first', 'set_variable', {
          variable: 'result',
          value: 10,
          value_type: 'integer',
          overwrite: 'overwrite',
        }),
        node('second', 'math', {
          operation: 'add',
          left: 1,
          right: 1,
          result_type: 'integer',
          variable: 'result',
          overwrite: 'keep',
        }),
      ]),
      {},
    );
    expect(mathKeep.variables.result).toBe(10);
    expect(
      (mathKeep.nodes.second.output as Record<string, unknown>).result,
    ).toBe(2);
  });

  it('isolates sibling branch variables in preview', () => {
    const definition: RSSAutomationDefinition = {
      schema_version: 1,
      nodes: [
        node('trigger', 'trigger'),
        node('parallel', 'parallel', {
          branches: ['branch-a', 'branch-b'],
        }),
        node('writer_a', 'set_variable', {
          variable: 'secret',
          value: 'only-a',
          value_type: 'string',
          overwrite: 'overwrite',
        }),
        node('reader_b', 'template', {
          template: '{{vars.secret}}',
          variable: 'copied',
          missing: 'error',
          trim: false,
          overwrite: 'overwrite',
        }),
        node('end_a', 'end'),
        node('end_b', 'end'),
      ],
      edges: [
        {
          id: 'to_parallel',
          source: 'trigger',
          source_port: 'next',
          target: 'parallel',
        },
        {
          id: 'to_a',
          source: 'parallel',
          source_port: 'branch-a',
          target: 'writer_a',
        },
        {
          id: 'to_b',
          source: 'parallel',
          source_port: 'branch-b',
          target: 'reader_b',
        },
        {
          id: 'end_a',
          source: 'writer_a',
          source_port: 'success',
          target: 'end_a',
        },
        {
          id: 'end_b',
          source: 'reader_b',
          source_port: 'failure',
          target: 'end_b',
        },
      ],
    };

    const preview = simulateRSSAutomation(definition, {});
    expect(preview.nodes.writer_a.selectedPorts).toEqual(['success']);
    expect(preview.nodes.reader_b.selectedPorts).toEqual(['failure']);
    expect(preview.nodes.reader_b.detail).toContain('vars.secret');
    expect(preview.nodes.end_b.active).toBe(true);
  });

  it('does not activate an always edge from a node that was never entered', () => {
    const definition: RSSAutomationDefinition = {
      schema_version: 1,
      nodes: [
        node('trigger', 'trigger'),
        node('condition', 'if', {
          condition: { field: '$item.enabled', operator: 'eq', value: true },
        }),
        node('hidden', 'set_variable', {
          variable: 'hidden',
          value: true,
          value_type: 'boolean',
          overwrite: 'overwrite',
        }),
        node('after', 'end'),
      ],
      edges: [
        {
          id: 'to_condition',
          source: 'trigger',
          source_port: 'next',
          target: 'condition',
        },
        {
          id: 'to_hidden',
          source: 'condition',
          source_port: 'true',
          target: 'hidden',
        },
        {
          id: 'to_after',
          source: 'hidden',
          source_port: 'always',
          target: 'after',
        },
      ],
    };

    const preview = simulateRSSAutomation(definition, { enabled: false });
    expect(preview.nodes.hidden.active).toBe(false);
    expect(preview.nodes.after.active).toBe(false);
  });
});
