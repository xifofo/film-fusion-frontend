import { describe, expect, it } from 'vitest';
import type {
  RSSAutomationNodeDefinition,
  RSSAutomationNodeProtocol,
  RSSAutomationNodeType,
} from '@/services/film-fusion';
import {
  buildFlowNodeVariableSummaries,
  edgeDefinitionToFlowEdge,
  nodeDefinitionToFlowNode,
} from './flow';

const definition = (
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

const variable = (
  name: string,
  type: RSSAutomationNodeProtocol['outputs'][number]['type'],
  label = name,
) => ({
  name,
  type,
  label,
  description: `${label}说明`,
  example: `${name}-example`,
});

const protocols: RSSAutomationNodeProtocol[] = [
  {
    type: 'trigger',
    label: '触发事件',
    inputs: [],
    outputs: [
      variable('selected_port', 'string', '流程出口'),
      variable('title', 'string', '事件名称'),
      variable('download_url', 'string', '下载链接'),
    ],
  },
  {
    type: 'qbittorrent',
    label: '添加 qBittorrent 任务',
    inputs: [
      {
        ...variable('url', 'string', '下载地址'),
        required: true,
        template: true,
      },
    ],
    outputs: [
      variable('target_id', 'integer', '下载器 ID'),
      variable('hash', 'string', 'Torrent Hash'),
    ],
  },
  {
    type: 'wait_qbittorrent',
    label: '等待 qBittorrent 完成',
    inputs: [],
    outputs: [variable('completed', 'boolean', '是否完成')],
  },
  {
    type: 'end',
    label: '结束',
    inputs: [],
    outputs: [variable('message', 'string', '结果消息')],
  },
];

describe('RSS workflow node variables', () => {
  it('shows trigger fields as received and returned variables', () => {
    const trigger = nodeDefinitionToFlowNode(definition('trigger', 'trigger'));

    const summaries = buildFlowNodeVariableSummaries([trigger], [], protocols, {
      triggerFields: {
        title: 'Example S01E01',
        download_url: 'magnet:?xt=example',
        size_bytes: 1024,
      },
    });
    const summary = summaries.get(trigger.id);

    expect(summary?.received.map((item) => item.reference)).toEqual([
      '$item.title',
      '$item.download_url',
      '$item.size_bytes',
    ]);
    expect(summary?.returned.map((item) => item.name)).toEqual([
      'selected_port',
      'title',
      'download_url',
      'size_bytes',
    ]);
    expect(summary?.received.at(-1)).toMatchObject({
      type: 'integer',
    });
    expect(summary?.received.at(-1)).not.toHaveProperty('value');
    expect(summary?.returned[0]).not.toHaveProperty('value');
  });

  it('uses direct upstream outputs for received variables and keeps config inputs separate', () => {
    const trigger = nodeDefinitionToFlowNode(definition('trigger', 'trigger'));
    const add = nodeDefinitionToFlowNode(
      definition('add', 'qbittorrent', { url: '$item.download_url' }),
    );
    const wait = nodeDefinitionToFlowNode(
      definition('wait', 'wait_qbittorrent'),
    );
    const nodes = [trigger, add, wait];
    const edges = [
      edgeDefinitionToFlowEdge({
        id: 'trigger_add',
        source: 'trigger',
        source_port: 'next',
        target: 'add',
      }),
      edgeDefinitionToFlowEdge({
        id: 'add_wait',
        source: 'add',
        source_port: 'success',
        target: 'wait',
      }),
    ];

    const summaries = buildFlowNodeVariableSummaries(nodes, edges, protocols, {
      previews: {
        add: {
          active: true,
          tone: 'success',
          label: '已模拟',
          selectedPorts: ['success'],
          output: { target_id: 3, hash: 'abc123' },
        },
      },
    });

    expect(summaries.get(add.id)?.configuredInputs[0]).toMatchObject({
      name: 'url',
      required: true,
      value: '$item.download_url',
      valueKind: 'configured',
    });
    expect(summaries.get(wait.id)?.received).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reference: '$nodes.add.output.hash',
          source: 'add',
        }),
      ]),
    );
    expect(
      summaries
        .get(wait.id)
        ?.received.some((item) => item.reference === '$item.title'),
    ).toBe(false);
  });

  it('reports an unavailable protocol instead of inventing variables', () => {
    const unknown = nodeDefinitionToFlowNode(definition('end', 'end'));

    expect(
      buildFlowNodeVariableSummaries([unknown], [], []).get(unknown.id),
    ).toEqual({
      protocolAvailable: false,
      received: [],
      configuredInputs: [],
      returned: [],
    });
  });
});
