import { describe, expect, it } from 'vitest';
import { absoluteFeedURL, lanFeedURL } from './TokenManager';

describe('RSS generator token URLs', () => {
  it('turns a safe relative feed URL into an absolute subscription URL', () => {
    expect(
      absoluteFeedURL(
        '/rss/feed-public-id.xml?token=ffrss_secret',
        'https://film.example',
      ),
    ).toBe('https://film.example/rss/feed-public-id.xml?token=ffrss_secret');
  });

  it('keeps an API-provided absolute public URL', () => {
    expect(
      absoluteFeedURL(
        'https://rss.example/rss/feed-public-id.atom?token=ffrss_secret',
        'https://film.example',
      ),
    ).toBe('https://rss.example/rss/feed-public-id.atom?token=ffrss_secret');
  });

  it('builds LAN subscription URLs without a token', () => {
    expect(
      lanFeedURL('feed-public-id', 'xml', 'http://192.168.1.20:9000'),
    ).toBe('http://192.168.1.20:9000/rss/feed-public-id.xml');
  });
});
