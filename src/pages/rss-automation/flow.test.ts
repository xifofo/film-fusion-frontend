import { describe, expect, it } from 'vitest';
import { DEFAULT_RSS_AUTOMATION_DEFINITION } from '@/services/film-fusion';
import {
  createNodeDefinition,
  definitionToFlow,
  flowToDefinition,
  joinHasConditionalOutcome,
  nodeBranches,
  sourcePortLabel,
} from './flow';

describe('RSS automation flow conversion', () => {
  it('round-trips the persisted definition and React Flow handles', () => {
    const source = structuredClone(DEFAULT_RSS_AUTOMATION_DEFINITION);
    const flow = definitionToFlow(source);
    const result = flowToDefinition(flow.nodes, flow.edges, source.viewport);

    expect(result.nodes.map((node) => node.id)).toEqual(['trigger', 'end']);
    expect(flow.nodes.every((node) => node.deletable === false)).toBe(true);
    expect(result.edges[0]).toMatchObject({
      source: 'trigger',
      source_port: 'next',
      target: 'end',
    });
  });

  it('creates a typed regex capture suitable for numeric IF comparison', () => {
    const node = createNodeDefinition('regex', { x: 100, y: 200 });

    expect(node.config).toMatchObject({
      input: '$item.title',
      pattern: '(\\d+)集',
      variable: 'episode',
      value_type: 'integer',
    });
    expect(node.position).toEqual({ x: 100, y: 200 });
  });

  it('creates a keyword matcher for RSS titles', () => {
    const node = createNodeDefinition('keyword', { x: 120, y: 220 });

    expect(node.config).toMatchObject({
      input: '$item.title',
      keywords: [],
      match_mode: 'contains_any',
      case_sensitive: false,
    });
    expect(node.name).toBe('关键词匹配');
  });

  it('normalizes visible parallel handles from node configuration', () => {
    const node = createNodeDefinition('parallel', { x: 0, y: 0 });
    expect(nodeBranches(node)).toEqual(['branch-1', 'branch-2']);
  });

  it('uses a single continue outcome for completion joins', () => {
    const join = createNodeDefinition('join', { x: 0, y: 0 });
    expect(joinHasConditionalOutcome(join)).toBe(false);
    expect(sourcePortLabel('success', join)).toBe('继续');

    join.config = { policy: 'all_success' };
    expect(joinHasConditionalOutcome(join)).toBe(true);
    expect(sourcePortLabel('success', join)).toBe('满足');
    expect(sourcePortLabel('failure', join)).toBe('未满足');
  });
});
