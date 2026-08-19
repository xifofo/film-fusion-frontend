import { describe, expect, it } from 'vitest';
import type { RSSAutomationMapping } from '@/services/film-fusion';
import {
  buildRSSItemReferences,
  parseRSSSourceMapping,
} from './rssFieldReferences';

describe('RSS field references', () => {
  it('keeps every mapped RSS field even when the current sample omits it', () => {
    const mapping: RSSAutomationMapping = {
      item_selector: 'channel/item',
      fields: [
        { name: 'title', selector: 'title#text', type: 'string' },
        {
          name: 'download_url',
          selector: 'enclosure@url',
          type: 'string',
        },
      ],
    };

    expect(buildRSSItemReferences(mapping, { title: '示例标题' })).toEqual([
      expect.objectContaining({
        name: 'title',
        value: '$item.title',
        preview: '示例标题',
      }),
      expect.objectContaining({
        name: 'download_url',
        value: '$item.download_url',
        dataType: 'string',
      }),
    ]);
  });

  it('uses the default RSS mapping when no source mapping is available', () => {
    const references = buildRSSItemReferences(undefined, {});

    expect(references.map((reference) => reference.value)).toContain(
      '$item.download_url',
    );
    expect(references.map((reference) => reference.value)).toContain(
      '$item.published_at',
    );
  });

  it('ignores malformed source mapping JSON', () => {
    expect(parseRSSSourceMapping('{invalid')).toBeUndefined();
  });
});
