import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
      value: '当前预览标题',
      valueKind: 'preview',
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
  returned: [
    {
      key: 'returned-hash',
      name: 'hash',
      label: 'Torrent Hash',
      type: 'string',
      description: '当前预览返回的任务 Hash。',
      reference: '$nodes.add_qb.output.hash',
      value: 'abc123',
      valueKind: 'preview',
    },
  ],
};

describe('NodeVariableDrawer', () => {
  afterEach(cleanup);

  it('shows received preview values and configured input values', () => {
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
    expect(screen.getByText('当前预览标题')).toBeTruthy();
    expect(screen.getByText('当前值')).toBeTruthy();
    expect(screen.getByText('$item.download_url')).toBeTruthy();
    expect(screen.getByText('配置值')).toBeTruthy();
    expect(screen.queryByText('示例值')).toBeNull();
  });

  it('shows the full current output value in a tooltip', async () => {
    render(
      <NodeVariableDrawer
        node={node}
        onClose={vi.fn()}
        open
        summary={summary}
        view="returned"
      />,
    );

    expect(screen.getByText('$nodes.add_qb.output.hash')).toBeTruthy();
    expect(screen.getByText('当前值')).toBeTruthy();
    const value = screen.getByText('abc123');
    expect(value.getAttribute('title')).toBeNull();

    fireEvent.mouseEnter(value);
    expect((await screen.findByRole('tooltip')).textContent).toContain(
      'abc123',
    );
  });
});
