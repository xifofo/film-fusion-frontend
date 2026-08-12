import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RSSGeneratorFeed } from '@/services/film-fusion';
import FeedEditor from './FeedEditor';

const savedFeed: RSSGeneratorFeed = {
  id: 42,
  public_id: 'feed-public-id',
  name: '私有作者动态',
  slug: 'private-author-updates',
  route_kind: 'http_html',
  source_url_template: 'https://example.com/posts',
  method: 'GET',
  parameters: [],
  headers: { Authorization: '********' },
  selectors: { item: '.item', title: '::text' },
  mapping: {},
  cookie: '********',
  proxy_allow_private: false,
  secret_query_params: { api_key: '********' },
  item_limit: 100,
  browser_fallback: false,
  cache_ttl_seconds: 300,
  stale_ttl_seconds: 3600,
  enabled: true,
  version: 1,
  created_at: '2026-08-12T00:00:00Z',
  updated_at: '2026-08-12T00:00:00Z',
};

describe('RSS generator zero-code editor', () => {
  afterEach(cleanup);

  it('guides a common HTML feed from source settings to field mappings', async () => {
    render(
      <FeedEditor
        onCancel={vi.fn()}
        onPreview={vi.fn()}
        onSave={vi.fn()}
        saving={false}
      />,
    );

    expect(screen.getByText('URL 与参数')).toBeTruthy();
    expect(screen.getByText('零代码提取')).toBeTruthy();
    expect(screen.getByText('登录与代理')).toBeTruthy();
    expect(screen.getByText('真实抓取')).toBeTruthy();
    expect(screen.getByText('缓存与 Token')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('例如：某站作者动态'), {
      target: { value: '作者动态' },
    });
    fireEvent.change(screen.getByPlaceholderText('author-updates'), {
      target: { value: 'author-updates' },
    });
    fireEvent.change(
      screen.getByPlaceholderText(
        'https://example.com/api/users/{{params.user}}/posts',
      ),
      { target: { value: 'https://example.com/posts' } },
    );
    fireEvent.click(screen.getByRole('button', { name: /下一步/ }));

    await waitFor(() => {
      expect(screen.getByText('配置条目与字段提取')).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: '添加字段映射' })).toBeTruthy();
  });

  it('passes the saved feed id when previewing masked credentials', async () => {
    const onPreview = vi.fn().mockResolvedValue({
      title: 'Preview',
      items: [],
    });
    render(
      <FeedEditor
        feed={savedFeed}
        onCancel={vi.fn()}
        onPreview={onPreview}
        onSave={vi.fn()}
        saving={false}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /下一步/ }));
    await waitFor(() =>
      expect(screen.getByText('配置条目与字段提取')).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole('button', { name: /下一步/ }));
    await waitFor(() => expect(screen.getByText('登录态与代理')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /下一步/ }));
    await waitFor(() => expect(screen.getByText('真实抓取预览')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /生成预览/ }));

    await waitFor(() => expect(onPreview).toHaveBeenCalled());
    expect(onPreview.mock.calls[0]?.[2]).toBe(42);
    expect(onPreview.mock.calls[0]?.[0]).toMatchObject({
      cookie: '********',
      headers: { Authorization: '********' },
      selectors: { item: '.item', title: '::text' },
      secret_query_params: { api_key: '********' },
    });
  });
});
