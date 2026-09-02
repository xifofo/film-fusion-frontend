import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RSSAutomationNodeDefinition } from '@/services/film-fusion';
import type { RSSFlowNodeVariableSummary } from './flow';
import NodeVariableDrawer from './NodeVariableDrawer';

const node: RSSAutomationNodeDefinition = {
  id: 'add_qb',
  type: 'qbittorrent',
  name: '添加下载任务',
  position: { x: 0, y: 0 },
  config: {},
};

const summary: RSSFlowNodeVariableSummary = {
  protocolAvailable: true,
  received: [
    {
      key: 'received-title',
      name: 'title',
      label: '标题',
      type: 'string',
      description: '上游节点返回的标题。',
      reference: '$nodes.trigger.output.title',
      source: 'RSS 触发器',
      value: '不应展示的示例标题',
    },
  ],
  configuredInputs: [
    {
      key: 'configured-url',
      name: 'url',
      label: '下载地址',
      type: 'string',
      description: '节点配置的下载地址引用。',
      reference: '$config.url',
      required: true,
      value: '$item.download_url',
      valueKind: 'configured',
    },
  ],
  returned: [],
};

describe('NodeVariableDrawer', () => {
  afterEach(cleanup);

  it('shows variable metadata in a drawer without sample values', () => {
    render(
      <NodeVariableDrawer
        node={node}
        onClose={vi.fn()}
        open
        summary={summary}
        view="received"
      />,
    );

    expect(screen.getByText('添加下载任务')).toBeTruthy();
    expect(screen.getByText('$nodes.trigger.output.title')).toBeTruthy();
    expect(screen.getByText('来自 RSS 触发器')).toBeTruthy();
    expect(screen.getByText('$item.download_url')).toBeTruthy();
    expect(screen.queryByText('不应展示的示例标题')).toBeNull();
    expect(screen.queryByText('当前值')).toBeNull();
    expect(screen.queryByText('示例值')).toBeNull();
  });
});
