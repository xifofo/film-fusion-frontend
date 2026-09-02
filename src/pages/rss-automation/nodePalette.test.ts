import { describe, expect, it } from 'vitest';
import { NODE_LABELS } from './flow';
import { NODE_PALETTE } from './nodePalette';

const groupTypes = (title: string) =>
  NODE_PALETTE.find((group) => group.title === title)?.types;

describe('RSS workflow node palette', () => {
  it('lists every addable node exactly once', () => {
    const paletteTypes = NODE_PALETTE.flatMap((group) => group.types);
    const addableTypes = Object.keys(NODE_LABELS).filter(
      (type) => type !== 'trigger',
    );

    expect(new Set(paletteTypes).size).toBe(paletteTypes.length);
    expect(new Set(paletteTypes)).toEqual(new Set(addableTypes));
  });

  it('separates qBittorrent, 115 OpenAPI, and shared 115 actions', () => {
    expect(groupTypes('qBittorrent')).toEqual([
      'qbittorrent',
      'wait_qbittorrent',
      'delete_qbittorrent',
    ]);
    expect(groupTypes('115 OpenAPI')).toEqual([
      'offline115_openapi',
      'rename115_openapi',
    ]);
    expect(groupTypes('115 Cookie / 通用')).toEqual(['offline115', 'wait115']);
  });
});
