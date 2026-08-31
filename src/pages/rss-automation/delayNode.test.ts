import { describe, expect, it } from 'vitest';
import type { RSSAutomationDefinition } from '@/services/film-fusion';
import { createNodeDefinition } from './flow';
import { simulateRSSAutomation } from './preview';
import { validateWorkflowTransferDefinition } from './workflowTransfer';

const delayDefinition = (): RSSAutomationDefinition => ({
  schema_version: 1,
  nodes: [
    {
      id: 'trigger',
      type: 'trigger',
      name: '收到 RSS 条目',
      position: { x: 0, y: 0 },
      config: {},
    },
    {
      id: 'delay',
      type: 'delay',
      name: '延迟执行',
      position: { x: 200, y: 0 },
      config: { delay_seconds: 600 },
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
      id: 'trigger-delay',
      source: 'trigger',
      source_port: 'next',
      target: 'delay',
    },
    {
      id: 'delay-end',
      source: 'delay',
      source_port: 'success',
      target: 'end',
    },
  ],
});

describe('RSS automation delay node', () => {
  it('creates a ten-minute delay node by default', () => {
    const node = createNodeDefinition('delay', { x: 100, y: 100 });
    expect(node.name).toBe('延迟执行');
    expect(node.config).toEqual({ delay_seconds: 600 });
    expect(node.max_attempts).toBe(1);
  });

  it('survives workflow import validation and previews without waiting', () => {
    const definition = validateWorkflowTransferDefinition(delayDefinition());
    const preview = simulateRSSAutomation(definition, { title: '示例条目' });
    expect(preview.activeNodeIds).toEqual(['trigger', 'delay', 'end']);
    expect(preview.nodes.delay).toMatchObject({
      label: '将等待 10 分钟后继续',
      detail: '样本预览不会真的等待',
      selectedPorts: ['success'],
    });
  });
});
