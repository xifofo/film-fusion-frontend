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

const definition = (
  middle: RSSAutomationNodeDefinition[],
  ports: string[] = middle.map(() => 'success'),
): RSSAutomationDefinition => {
  const nodes = [node('trigger', 'trigger'), ...middle, node('end', 'end')];
  return {
    schema_version: 1,
    nodes,
    edges: nodes.slice(0, -1).map((current, index) => ({
      id: `edge_${index}`,
      source: current.id,
      source_port: current.type === 'trigger' ? 'next' : ports[index - 1],
      target: nodes[index + 1].id,
    })),
  };
};

describe('RSS automation advanced nodes', () => {
  it('creates complete defaults for all seven node types', () => {
    expect(
      createNodeDefinition('datetime_operation', { x: 0, y: 0 }).config,
    ).toEqual({
      operation: 'parse',
      input: '',
      right: '',
      input_format: 'auto',
      output_format: 'rfc3339',
      timezone: 'Asia/Shanghai',
      amount: 0,
      unit: 'second',
      precision: 0,
      variable: 'datetime_result',
      overwrite: 'overwrite',
    });
    expect(
      createNodeDefinition('list_operation', { x: 0, y: 0 }).config,
    ).toEqual({
      operation: 'unique',
      input: '',
      separator: ',',
      trim_items: true,
      omit_empty: true,
      pointer: '',
      missing: 'failure',
      direction: 'asc',
      compare_as: 'auto',
      offset: 0,
      limit: 100,
      variable: 'list_result',
      overwrite: 'overwrite',
    });
    expect(createNodeDefinition('switch', { x: 0, y: 0 }).config).toEqual({
      input: '',
      compare_as: 'auto',
      case_sensitive: false,
      cases: [{ id: 'case1', label: '条件 1', operator: 'eq', value: '' }],
    });
    expect(createNodeDefinition('coalesce', { x: 0, y: 0 }).config).toEqual({
      candidates: [],
      missing: 'skip',
      skip_null: true,
      skip_empty_string: true,
      skip_empty_array: false,
      skip_empty_object: false,
      trim_strings: false,
      on_empty: 'failure',
      default_value: '',
      value_type: 'auto',
      variable: 'coalesced',
      overwrite: 'overwrite',
    });
    expect(
      createNodeDefinition('deduplicate', { x: 0, y: 0 }).config,
    ).toMatchObject({
      scope: 'workflow',
      normalize: 'trim',
      ttl_seconds: 604800,
      preview_assumption: 'new',
    });
    expect(
      createNodeDefinition('rate_limit', { x: 0, y: 0 }).config,
    ).toMatchObject({
      scope: 'workflow',
      limit: 5,
      window_seconds: 60,
      behavior: 'defer',
      preview_assumption: 'allowed',
    });
    expect(createNodeDefinition('foreach', { x: 0, y: 0 }).config).toEqual({
      input: '',
      transform: {
        type: 'template',
        config: { template: '{{each.item}}', missing: 'error', trim: false },
      },
      on_error: 'fail_fast',
      max_items: 100,
      variable: 'mapped_items',
      overwrite: 'overwrite',
    });
  });

  it('keeps the seven types in portable definitions and validates dynamic ports', () => {
    const workflow = definition(
      [
        node('datetime', 'datetime_operation', {
          ...createNodeDefinition('datetime_operation', { x: 0, y: 0 }).config,
          input: '$item.date',
        }),
        node('list', 'list_operation', {
          ...createNodeDefinition('list_operation', { x: 0, y: 0 }).config,
          input: '$item.items',
        }),
        node('switch', 'switch', {
          input: '$item.kind',
          compare_as: 'string',
          case_sensitive: false,
          cases: [
            { id: 'movie', label: '电影', operator: 'eq', value: 'movie' },
          ],
        }),
        node('coalesce', 'coalesce', {
          ...createNodeDefinition('coalesce', { x: 0, y: 0 }).config,
          candidates: ['$item.title'],
        }),
        node('dedupe', 'deduplicate', {
          ...createNodeDefinition('deduplicate', { x: 0, y: 0 }).config,
          key: '$item.guid',
        }),
        node('rate', 'rate_limit', {
          ...createNodeDefinition('rate_limit', { x: 0, y: 0 }).config,
          key: '$item.guid',
        }),
        node('foreach', 'foreach', {
          ...createNodeDefinition('foreach', { x: 0, y: 0 }).config,
          input: '$item.items',
        }),
      ],
      [
        'success',
        'success',
        'case-movie',
        'success',
        'new',
        'allowed',
        'success',
      ],
    );

    expect(
      validateWorkflowTransferDefinition(workflow).nodes.map(
        (item) => item.type,
      ),
    ).toContain('foreach');

    const invalidPort = structuredClone(workflow);
    invalidPort.edges[3].source_port = 'case-missing';
    expect(() => validateWorkflowTransferDefinition(invalidPort)).toThrow(
      '不存在的多路分支出口',
    );

    const invalidTransform = structuredClone(workflow);
    const foreach = invalidTransform.nodes.find(
      (item) => item.type === 'foreach',
    );
    const transform = foreach?.config?.transform as Record<string, unknown>;
    (transform.config as Record<string, unknown>).variable = 'leak';
    expect(() => validateWorkflowTransferDefinition(invalidTransform)).toThrow(
      '不能写入流程变量',
    );
  });

  it('previews calendar datetime operations and list pointer semantics', () => {
    const datetimePreview = simulateRSSAutomation(
      definition([
        node('datetime', 'datetime_operation', {
          operation: 'add',
          input: '2025-01-31T12:00:00Z',
          input_format: 'rfc3339',
          output_format: 'date',
          timezone: 'UTC',
          amount: 1,
          unit: 'month',
          variable: 'next_month',
          overwrite: 'overwrite',
        }),
      ]),
      {},
    );
    expect(datetimePreview.variables.next_month).toBe('2025-02-28');

    const leapYearPreview = simulateRSSAutomation(
      definition([
        node('datetime', 'datetime_operation', {
          operation: 'add',
          input: '2024-02-29 12:00:00',
          input_format: 'datetime',
          output_format: 'date',
          timezone: 'Asia/Shanghai',
          amount: 1,
          unit: 'year',
          variable: 'next_year',
          overwrite: 'overwrite',
        }),
      ]),
      {},
    );
    expect(leapYearPreview.variables.next_year).toBe('2025-02-28');

    const listPreview = simulateRSSAutomation(
      definition([
        node('list', 'list_operation', {
          operation: 'unique',
          input: '$item.items',
          pointer: '/id',
          missing: 'null',
          variable: 'unique_items',
          overwrite: 'overwrite',
        }),
      ]),
      { items: [{ id: 1 }, { name: 'a' }, { name: 'b' }, { id: 1 }] },
    );
    expect(listPreview.variables.unique_items).toEqual([
      { id: 1 },
      { name: 'a' },
    ]);
  });

  it('uses first-match switch routing and explicit persistent preview assumptions', () => {
    const switchPreview = simulateRSSAutomation(
      definition(
        [
          node('switch', 'switch', {
            input: '$item.enabled',
            compare_as: 'boolean',
            case_sensitive: false,
            cases: [
              { id: 'yes', label: '已启用', operator: 'eq', value: 'true' },
              { id: 'fallback', label: '其他', operator: 'exists', value: '' },
            ],
          }),
        ],
        ['case-yes'],
      ),
      { enabled: true },
    );
    expect(switchPreview.nodes.switch.selectedPorts).toEqual(['case-yes']);

    const dedupePreview = simulateRSSAutomation(
      definition(
        [
          node('dedupe', 'deduplicate', {
            key: '$item.guid',
            scope: 'workflow',
            namespace: '',
            normalize: 'trim',
            ttl_seconds: 600,
            preview_assumption: 'duplicate',
          }),
        ],
        ['duplicate'],
      ),
      { guid: ' abc ' },
    );
    expect(dedupePreview.nodes.dedupe).toMatchObject({
      selectedPorts: ['duplicate'],
      tone: 'warning',
    });
    expect(dedupePreview.nodes.dedupe.detail).toContain('真实执行');

    const ratePreview = simulateRSSAutomation(
      definition(
        [
          node('rate', 'rate_limit', {
            key: '$item.guid',
            scope: 'workflow',
            namespace: '',
            normalize: 'trim',
            limit: 1,
            window_seconds: 60,
            behavior: 'defer',
            max_wait_seconds: 60,
            preview_assumption: 'throttled',
          }),
        ],
        ['allowed'],
      ),
      { guid: 'abc' },
    );
    expect(ratePreview.nodes.rate.selectedPorts).toEqual([]);
    expect(ratePreview.activeNodeIds).toEqual(['trigger', 'rate']);
  });

  it('maps bounded items with $each values and keeps failed indexes as null', () => {
    const preview = simulateRSSAutomation(
      definition(
        [
          node('foreach', 'foreach', {
            input: '$item.values',
            transform: {
              type: 'math',
              config: {
                operation: 'multiply',
                left: '$each.item',
                right: 2,
                precision: 0,
                result_type: 'integer',
              },
            },
            on_error: 'collect',
            max_items: 10,
            variable: 'mapped',
            overwrite: 'overwrite',
          }),
        ],
        ['partial'],
      ),
      { values: [2, 'bad', 4] },
    );

    expect(preview.variables.mapped).toEqual([4, null, 8]);
    expect(preview.nodes.foreach.selectedPorts).toEqual(['partial']);
    expect(preview.nodes.foreach.output).toMatchObject({
      count: 3,
      succeeded_count: 2,
      failed_count: 1,
    });
  });

  it('rejects backend-sized list/foreach payloads and invalid guard configs', () => {
    const oversizedList = simulateRSSAutomation(
      definition([
        node('list', 'list_operation', {
          operation: 'split',
          input: `${'x,'.repeat(10000)}x`,
          separator: ',',
          variable: 'items',
          overwrite: 'overwrite',
        }),
      ]),
      {},
    );
    expect(oversizedList.nodes.list.detail).toContain('10000');

    const oversizedForeach = simulateRSSAutomation(
      definition([
        node('foreach', 'foreach', {
          input: Array.from({ length: 20 }, (_, index) => index),
          transform: {
            type: 'template',
            config: { template: 'x'.repeat(60000) },
          },
          on_error: 'fail_fast',
          max_items: 100,
          variable: 'mapped',
          overwrite: 'overwrite',
        }),
      ]),
      {},
    );
    expect(oversizedForeach.nodes.foreach.detail).toContain('1048576');
    expect(oversizedForeach.variables).not.toHaveProperty('mapped');

    const invalidGuard = definition([
      node('dedupe', 'deduplicate', {
        key: '$item.guid',
        ttl_seconds: 59,
      }),
    ]);
    expect(() => validateWorkflowTransferDefinition(invalidGuard)).toThrow(
      'TTL',
    );
  });
});
