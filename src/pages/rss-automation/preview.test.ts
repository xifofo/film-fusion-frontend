import { describe, expect, it } from 'vitest';
import type { RSSAutomationDefinition } from '@/services/film-fusion';
import { simulateRSSAutomation } from './preview';

const definition: RSSAutomationDefinition = {
  schema_version: 1,
  nodes: [
    { id: 'trigger', type: 'trigger', position: { x: 0, y: 0 } },
    {
      id: 'regex',
      type: 'regex',
      position: { x: 200, y: 0 },
      config: {
        input: '$item.title',
        pattern: '(\\d+)集',
        group: '1',
        variable: 'episode',
        value_type: 'integer',
      },
    },
    {
      id: 'if',
      type: 'if',
      position: { x: 400, y: 0 },
      config: {
        condition: { field: '$vars.episode', operator: 'gt', value: 1000 },
      },
    },
    { id: 'pass', type: 'end', position: { x: 600, y: 0 } },
    { id: 'reject', type: 'end', position: { x: 600, y: 160 } },
  ],
  edges: [
    { id: 'e1', source: 'trigger', source_port: 'next', target: 'regex' },
    { id: 'e2', source: 'regex', source_port: 'success', target: 'if' },
    { id: 'e3', source: 'if', source_port: 'true', target: 'pass' },
    { id: 'e4', source: 'if', source_port: 'false', target: 'reject' },
  ],
};

describe('RSS automation sample preview', () => {
  it('extracts typed variables and highlights the matching branch', () => {
    const preview = simulateRSSAutomation(definition, {
      title: '示例动画 1001集',
    });

    expect(preview.variables.episode).toBe(1001);
    expect(preview.nodes.if.label).toContain('条件成立');
    expect(preview.nodes.pass.active).toBe(true);
    expect(preview.nodes.reject.active).toBe(false);
    expect(preview.activeEdgeIds).toEqual(['e1', 'e2', 'e3']);
  });

  it('shows a failed regex path without executing downstream nodes', () => {
    const preview = simulateRSSAutomation(definition, { title: '没有集数' });
    expect(preview.nodes.regex.label).toContain('没有匹配');
    expect(preview.nodes.if.active).toBe(false);
    expect(preview.nodes.pass.active).toBe(false);
  });

  it('lets conditional branches share one end node', () => {
    const sharedEndDefinition: RSSAutomationDefinition = {
      ...definition,
      nodes: [
        ...definition.nodes.filter(
          (node) => node.id !== 'pass' && node.id !== 'reject',
        ),
        { id: 'end', type: 'end', position: { x: 600, y: 80 } },
      ],
      edges: definition.edges.map((edge) =>
        edge.source === 'if' ? { ...edge, target: 'end' } : edge,
      ),
    };

    const matching = simulateRSSAutomation(sharedEndDefinition, {
      title: '示例动画 1001集',
    });
    const rejected = simulateRSSAutomation(sharedEndDefinition, {
      title: '示例动画 999集',
    });

    expect(matching.nodes.end.active).toBe(true);
    expect(matching.activeEdgeIds).toContain('e3');
    expect(rejected.nodes.end.active).toBe(true);
    expect(rejected.activeEdgeIds).toContain('e4');
  });

  it('routes forbidden keywords through matched and unmatched ports', () => {
    const keywordDefinition: RSSAutomationDefinition = {
      schema_version: 1,
      nodes: [
        { id: 'trigger', type: 'trigger', position: { x: 0, y: 0 } },
        {
          id: 'keyword',
          type: 'keyword',
          position: { x: 200, y: 0 },
          config: {
            input: '$item.title',
            keywords: ['CAM', 'TS'],
            match_mode: 'contains_none',
            case_sensitive: false,
          },
        },
        { id: 'end', type: 'end', position: { x: 400, y: 0 } },
      ],
      edges: [
        { id: 'k1', source: 'trigger', source_port: 'next', target: 'keyword' },
        { id: 'k2', source: 'keyword', source_port: 'matched', target: 'end' },
        {
          id: 'k3',
          source: 'keyword',
          source_port: 'unmatched',
          target: 'end',
        },
      ],
    };

    const clean = simulateRSSAutomation(keywordDefinition, {
      title: 'Show 1080p WEB-DL',
    });
    const forbidden = simulateRSSAutomation(keywordDefinition, {
      title: 'Show 1080p cam',
    });

    expect(clean.nodes.keyword.label).toContain('未发现禁用关键词');
    expect(clean.activeEdgeIds).toContain('k2');
    expect(forbidden.nodes.keyword.label).toContain('发现禁用关键词 CAM');
    expect(forbidden.activeEdgeIds).toContain('k3');
    expect(clean.nodes.end.active).toBe(true);
    expect(forbidden.nodes.end.active).toBe(true);
  });
});
