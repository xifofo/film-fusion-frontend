import { describe, expect, it } from 'vitest';
import { absoluteFeedURL } from './TokenManager';

describe('RSS generator token URLs', () => {
  it('turns a safe relative feed URL into an absolute subscription URL', () => {
    expect(
      absoluteFeedURL('/rss/s/ffrss_secret.xml', 'https://film.example'),
    ).toBe('https://film.example/rss/s/ffrss_secret.xml');
  });

  it('keeps an API-provided absolute public URL', () => {
    expect(
      absoluteFeedURL(
        'https://rss.example/rss/s/ffrss_secret.atom',
        'https://film.example',
      ),
    ).toBe('https://rss.example/rss/s/ffrss_secret.atom');
  });
});
