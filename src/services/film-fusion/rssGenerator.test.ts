import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/lib/api-client';
import {
  createRSSGeneratorToken,
  deleteRSSGeneratorToken,
  previewRSSGeneratorDefinition,
  rotateRSSGeneratorToken,
} from './rssGenerator';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('RSS generator service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses feed-scoped token endpoints', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ code: 0 });
    vi.mocked(apiClient.delete).mockResolvedValue({ code: 0 });

    await createRSSGeneratorToken(4, { name: 'FreshRSS' });
    await rotateRSSGeneratorToken(4, 9);
    await deleteRSSGeneratorToken(4, 9);

    expect(apiClient.post).toHaveBeenNthCalledWith(
      1,
      '/api/rss-generator/feeds/4/tokens',
      { name: 'FreshRSS' },
    );
    expect(apiClient.post).toHaveBeenNthCalledWith(
      2,
      '/api/rss-generator/feeds/4/tokens/9/rotate',
    );
    expect(apiClient.delete).toHaveBeenCalledWith(
      '/api/rss-generator/feeds/4/tokens/9',
    );
  });

  it('posts unsaved definitions with preview params', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ code: 0 });
    const definition = {
      name: 'Test',
      slug: 'test',
      route_kind: 'http_json' as const,
      source_url_template: 'https://example.com/{{params.user}}',
      method: 'GET' as const,
      parameters: [{ name: 'user', type: 'string' as const }],
      headers: {},
      selectors: {},
      mapping: { item: 'items', title: 'title' },
      secret_query_params: {},
      proxy_allow_private: false,
      item_limit: 100,
      browser_fallback: false,
      cache_ttl_seconds: 300,
      stale_ttl_seconds: 3600,
      enabled: true,
    };

    await previewRSSGeneratorDefinition(definition, { user: 'alice' }, 'atom');

    expect(apiClient.post).toHaveBeenCalledWith('/api/rss-generator/preview', {
      definition,
      params: { user: 'alice' },
      format: 'atom',
    });
  });

  it('identifies an existing feed so masked secrets can be reused in preview', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ code: 0 });
    const definition = {
      name: 'Private Feed',
      slug: 'private-feed',
      route_kind: 'http_html' as const,
      source_url_template: 'https://example.com/posts',
      method: 'GET' as const,
      parameters: [],
      headers: { Authorization: '********' },
      selectors: { item: '.item', title: '.title::text' },
      mapping: {},
      cookie: '********',
      proxy_allow_private: false,
      secret_query_params: { api_key: '********' },
      item_limit: 100,
      browser_fallback: false,
      cache_ttl_seconds: 300,
      stale_ttl_seconds: 3600,
      enabled: true,
    };

    await previewRSSGeneratorDefinition(definition, {}, 'rss', 42);

    expect(apiClient.post).toHaveBeenCalledWith('/api/rss-generator/preview', {
      definition,
      params: {},
      format: 'rss',
      feed_id: 42,
    });
  });
});
