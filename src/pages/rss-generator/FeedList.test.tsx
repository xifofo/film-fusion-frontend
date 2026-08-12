import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RSSGeneratorFeed } from '@/services/film-fusion';
import FeedList from './FeedList';

const feed: RSSGeneratorFeed = {
  id: 7,
  name: '作者动态',
  slug: 'author-updates',
  route_kind: 'http_html',
  source_url_template: 'https://example.com/u/{{params.user}}',
  method: 'GET',
  parameters: [{ name: 'user', type: 'string', required: true }],
  headers: {},
  selectors: { item: '.entry', title: '.title::text' },
  mapping: {},
  secret_query_params: {},
  proxy_allow_private: false,
  item_limit: 100,
  browser_fallback: true,
  cache_ttl_seconds: 300,
  stale_ttl_seconds: 3600,
  enabled: true,
  version: 1,
  token_count: 2,
  created_at: '2026-08-12T00:00:00Z',
  updated_at: '2026-08-12T00:00:00Z',
};

describe('RSS generator feed list', () => {
  afterEach(cleanup);

  it('opens token management for the selected feed', () => {
    const onTokens = vi.fn();
    render(
      <FeedList
        feeds={[feed]}
        loading={false}
        onCreate={vi.fn()}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        onPreview={vi.fn()}
        onReload={vi.fn()}
        onToggle={vi.fn()}
        onTokens={onTokens}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: '管理 Token 作者动态' }),
    );
    expect(onTokens).toHaveBeenCalledWith(feed);
  });

  it('can stop an enabled generated feed', () => {
    const onToggle = vi.fn();
    render(
      <FeedList
        feeds={[feed]}
        loading={false}
        onCreate={vi.fn()}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        onPreview={vi.fn()}
        onReload={vi.fn()}
        onToggle={onToggle}
        onTokens={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('switch', { name: '停用 作者动态' }));
    expect(onToggle).toHaveBeenCalledWith(feed, false);
  });
});
