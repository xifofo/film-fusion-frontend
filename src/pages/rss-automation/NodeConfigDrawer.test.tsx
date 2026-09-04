import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RSSAutomationNodeDefinition } from '@/services/film-fusion';
import NodeConfigModal, { type NodeFieldReference } from './NodeConfigDrawer';

const node: RSSAutomationNodeDefinition = {
  id: 'extract',
  type: 'extract_between',
  name: '文本区间提取',
  position: { x: 0, y: 0 },
  config: {
    input: '$item.title',
    start_marker: '[',
    end_marker: ']',
    variable: 'extracted_value',
    value_type: 'string',
    overwrite: 'overwrite',
  },
};

const title =
  '[Lolihouse] 从0位居民开始的边境领主大人 / Ryoumin 0-nin Start no Henkyou Ryoushusama';

const references: NodeFieldReference[] = [
  {
    kind: 'item',
    name: 'title',
    value: '$item.title',
    preview: `${title.slice(0, 42)}…`,
    previewAvailable: true,
    previewValue: title,
  },
];

describe('NodeConfigModal', () => {
  afterEach(cleanup);

  it('shows the resolved input value and exposes the full value in a tooltip', async () => {
    render(
      <NodeConfigModal
        cloudDirectories={[]}
        cloudStorages={[]}
        fieldReferences={references}
        node={node}
        onChange={vi.fn()}
        onClose={vi.fn()}
        onDelete={vi.fn()}
        targets={[]}
      />,
    );

    expect(await screen.findByText('当前值')).toBeTruthy();
    const preview = await screen.findByText(title);
    expect(preview.tagName).toBe('CODE');
    expect(preview.getAttribute('title')).toBeNull();

    fireEvent.mouseEnter(preview);
    expect((await screen.findByRole('tooltip')).textContent).toContain(title);
  });
});
