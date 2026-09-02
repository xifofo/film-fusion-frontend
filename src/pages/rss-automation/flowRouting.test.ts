import { describe, expect, it } from 'vitest';
import type {
  RSSAutomationNodeDefinition,
  RSSAutomationNodeType,
} from '@/services/film-fusion';
import {
  buildFlowRoutingPlan,
  edgeDefinitionToFlowEdge,
  flowNodeHeight,
  flowToDefinition,
  nodeDefinitionToFlowNode,
  type RSSFlowEdge,
} from './flow';

const definition = (
  id: string,
  type: RSSAutomationNodeType,
  x: number,
  y: number,
): RSSAutomationNodeDefinition => ({
  id,
  type,
  name: id,
  position: { x, y },
  config: {},
});

describe('RSS workflow canvas routing', () => {
  it('splits multiple incoming edges into stable target handles and lanes', () => {
    const upper = definition('upper', 'delay', 0, 20);
    const lower = definition('lower', 'delay', 0, 220);
    const end = definition('end', 'end', 380, 100);
    const nodes = [upper, lower, end].map((node) =>
      nodeDefinitionToFlowNode(node),
    );
    const edges = [
      edgeDefinitionToFlowEdge({
        id: 'edge_lower',
        source: lower.id,
        source_port: 'success',
        target: end.id,
      }),
      edgeDefinitionToFlowEdge({
        id: 'edge_upper',
        source: upper.id,
        source_port: 'success',
        target: end.id,
      }),
    ];

    const plan = buildFlowRoutingPlan(nodes, edges);

    expect(plan.targetHandles.get(end.id)).toEqual([
      { id: 'flow-target-edge_upper', top: 18 },
      { id: 'flow-target-edge_lower', top: 82 },
    ]);
    expect(plan.routes.get('edge_upper')).toEqual({
      laneOffset: -9,
      targetHandle: 'flow-target-edge_upper',
    });
    expect(plan.routes.get('edge_lower')).toEqual({
      laneOffset: 9,
      targetHandle: 'flow-target-edge_lower',
    });
  });

  it('keeps one incoming edge on the semantic input handle', () => {
    const trigger = definition('trigger', 'trigger', 0, 0);
    const end = definition('end', 'end', 320, 0);
    const nodes = [trigger, end].map((node) => nodeDefinitionToFlowNode(node));
    const edge = edgeDefinitionToFlowEdge({
      id: 'edge_next',
      source: trigger.id,
      source_port: 'next',
      target: end.id,
    });

    const plan = buildFlowRoutingPlan(nodes, [edge]);

    expect(plan.targetHandles.has(end.id)).toBe(false);
    expect(plan.routes.get(edge.id)).toEqual({
      laneOffset: 0,
      targetHandle: 'input',
    });
  });

  it('normalizes visual handles before saving and grows crowded nodes', () => {
    const trigger = definition('trigger', 'trigger', 0, 0);
    const end = definition('end', 'end', 320, 0);
    const nodes = [trigger, end].map((node) => nodeDefinitionToFlowNode(node));
    const edge = edgeDefinitionToFlowEdge({
      id: 'edge_next',
      source: trigger.id,
      source_port: 'next',
      target: end.id,
    });
    const visualEdge: RSSFlowEdge = {
      ...edge,
      targetHandle: 'flow-target-edge_next',
    };

    expect(flowToDefinition(nodes, [visualEdge]).edges[0].target_port).toBe(
      'input',
    );
    expect(flowNodeHeight(end, 6)).toBeGreaterThan(flowNodeHeight(end, 1));
  });
});
