import { describe, expect, it } from 'vitest';
import type { RSSAutomationDefinition } from '@/services/film-fusion';
import { createNodeDefinition } from './flow';
import { simulateRSSAutomation } from './preview';
import { validateWorkflowTransferDefinition } from './workflowTransfer';

const definitionWithExtract = (
  config: Record<string, unknown>,
): RSSAutomationDefinition => ({
  schema_version: 1,
  nodes: [
    {
      id: 'trigger',
      type: 'trigger',
      name: '收到条目',
      position: { x: 0, y: 0 },
      config: {},
    },
    {
      id: 'extract',
      type: 'extract_between',
      name: '文本区间提取',
      position: { x: 200, y: 0 },
      config,
    },
    {
      id: 'end',
      type: 'end',
      name: '结束',
      position: { x: 400, y: 0 },
      config: {},
    },
  ],
  edges: [
    {
      id: 'trigger-extract',
      source: 'trigger',
      source_port: 'next',
      target: 'extract',
    },
    {
      id: 'extract-end',
      source: 'extract',
      source_port: 'success',
      target: 'end',
    },
  ],
});

const extractConfig = (valueType: string, input: string) => ({
  input,
  start_marker: '<',
  end_marker: '>',
  variable: 'extracted',
  value_type: valueType,
  overwrite: 'overwrite',
});

describe('text between automation node', () => {
  it('creates a complete default configuration', () => {
    expect(
      createNodeDefinition('extract_between', { x: 0, y: 0 }).config,
    ).toEqual({
      input: '$item.title',
      start_marker: '',
      end_marker: '',
      variable: 'extracted_value',
      value_type: 'string',
      overwrite: 'overwrite',
    });
  });

  it.each([
    ['string', 'before< value >after', ' value '],
    ['integer', 'before<42>after', 42],
    ['number', 'before<2.5>after', 2.5],
    ['boolean', 'before<true>after', true],
    ['json', 'before<{"enabled":true}>after', { enabled: true }],
    ['array', 'before<["first",2]>after', ['first', 2]],
  ])('extracts and converts a %s output', (valueType, input, expected) => {
    const preview = simulateRSSAutomation(
      definitionWithExtract(extractConfig(valueType, input)),
      {},
    );
    const output = preview.nodes.extract.output as Record<string, unknown>;

    expect(preview.nodes.extract.selectedPorts).toEqual(['success']);
    expect(preview.variables.extracted).toEqual(expected);
    expect(output.result).toEqual(expected);
    expect(output.raw_result).toBe(
      input.slice(input.indexOf('<') + 1, input.indexOf('>')),
    );
    expect(output.found).toBe(true);
  });

  it('uses the first end marker after the first start marker', () => {
    const preview = simulateRSSAutomation(
      definitionWithExtract(
        extractConfig('string', 'ignored>end first<one>second<two>'),
      ),
      {},
    );

    expect(preview.variables.extracted).toBe('one');
  });

  it('routes missing markers and invalid conversions to failure', () => {
    const missing = simulateRSSAutomation(
      definitionWithExtract(extractConfig('string', 'before<value')),
      {},
    );
    expect(missing.nodes.extract.selectedPorts).toEqual(['failure']);
    expect(missing.nodes.extract.detail).toContain('后定位词');
    expect(missing.activeNodeIds).not.toContain('end');

    const invalid = simulateRSSAutomation(
      definitionWithExtract(extractConfig('integer', 'before<nope>after')),
      {},
    );
    expect(invalid.nodes.extract.selectedPorts).toEqual(['failure']);
    expect(invalid.nodes.extract.detail).toContain('有效数字');
    expect(invalid.variables).not.toHaveProperty('extracted');
  });

  it('keeps valid nodes portable and rejects incomplete imported configs', () => {
    const definition = definitionWithExtract(
      extractConfig('array', 'before<[1,2]>after'),
    );
    expect(validateWorkflowTransferDefinition(definition).nodes[1].type).toBe(
      'extract_between',
    );

    const invalid = structuredClone(definition);
    const invalidConfig = invalid.nodes[1].config;
    if (!invalidConfig) throw new Error('test node config is missing');
    invalidConfig.start_marker = '';
    expect(() => validateWorkflowTransferDefinition(invalid)).toThrow(
      '前定位词不能为空',
    );
  });
});
