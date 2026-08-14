import { describe, expect, it } from 'vitest';
import type { RSSGeneratorFeed } from '@/services/film-fusion';
import {
  DEFAULT_FORM_VALUES,
  feedToValues,
  valuesToDefinition,
} from './definition';

describe('RSS generator definition form', () => {
  it('turns zero-code HTML mappings into worker selector syntax', () => {
    const definition = valuesToDefinition({
      ...structuredClone(DEFAULT_FORM_VALUES),
      name: '作者动态',
      slug: 'author-updates',
      source_url_template: 'https://example.com/u/{{params.user}}',
      parameters: [
        {
          name: 'user',
          type: 'string',
          required: true,
          pattern: '^[a-z0-9]+$',
        },
      ],
      item_selector: 'article.entry',
      field_rules: [
        { field: 'title', selector: 'h2', attribute: 'text' },
        { field: 'link', selector: 'a', attribute: 'href' },
        { field: 'content', selector: '.body', attribute: 'html' },
      ],
    });

    expect(definition.selectors).toMatchObject({
      item: 'article.entry',
      title: 'h2::text',
      link: 'a::attr(href)',
      content: '.body::html',
    });
    expect(definition.parameters[0]).toMatchObject({
      name: 'user',
      type: 'string',
      required: true,
    });
  });

  it('keeps JSON field paths free of HTML extraction suffixes', () => {
    const definition = valuesToDefinition({
      ...structuredClone(DEFAULT_FORM_VALUES),
      name: 'API Feed',
      slug: 'api-feed',
      route_kind: 'http_json',
      source_url_template: 'https://example.com/api',
      item_selector: 'data.items',
      field_rules: [
        { field: 'title', selector: 'attributes.title', attribute: 'text' },
      ],
    });

    expect(definition.mapping).toMatchObject({
      item: 'data.items',
      title: 'attributes.title',
    });
  });

  it('includes POST body for JSON sources', () => {
    const definition = valuesToDefinition({
      ...structuredClone(DEFAULT_FORM_VALUES),
      name: 'JSON Feed',
      slug: 'json-feed',
      route_kind: 'http_json',
      method: 'POST',
      source_url_template: 'https://example.com/search',
      request_body_template: '{"keyword":{{json.params.keyword}}}',
    });

    expect(definition.request_body_template).toContain(
      '{{json.params.keyword}}',
    );
    expect(definition.browser_fallback).toBe(false);
  });

  it('forces browser execution settings to a GET-compatible definition', () => {
    const definition = valuesToDefinition({
      ...structuredClone(DEFAULT_FORM_VALUES),
      name: 'Browser Feed',
      slug: 'browser-feed',
      route_kind: 'browser',
      method: 'POST',
      source_url_template: 'https://example.com/search',
      request_body_template: '{"unsafe":true}',
      browser_wait_selector: '.results',
      browser_wait_until: 'networkidle',
      browser_wait_ms: 2500,
      browser_storage_state_json: '{"cookies":[],"origins":[]}',
    });

    expect(definition.method).toBe('GET');
    expect(definition.request_body_template).toBeUndefined();
    expect(definition.wait_for_selector).toBe('.results');
    expect(definition.wait_until).toBe('networkidle');
    expect(definition.render_delay_ms).toBe(2500);
    expect(definition.browser_storage_state).toEqual({
      cookies: [],
      origins: [],
    });
  });

  it('keeps private query values separate from public route parameters', () => {
    const definition = valuesToDefinition({
      ...structuredClone(DEFAULT_FORM_VALUES),
      name: 'Private API Feed',
      slug: 'private-api-feed',
      route_kind: 'http_json',
      source_url_template: 'https://example.com/posts/{{params.user}}',
      parameters: [{ name: 'user', type: 'string', required: true }],
      secret_query_params_list: [{ name: 'api_key', value: 'secret-value' }],
      item_selector: 'items',
      field_rules: [{ field: 'title', selector: 'title' }],
    });

    expect(definition.parameters).toEqual([
      expect.objectContaining({ name: 'user', required: true }),
    ]);
    expect(definition.secret_query_params).toEqual({
      api_key: 'secret-value',
    });
  });

  it('decodes saved HTML selector syntax for editing without exposing secrets', () => {
    const feed: RSSGeneratorFeed = {
      ...valuesToDefinition({
        ...structuredClone(DEFAULT_FORM_VALUES),
        name: 'Saved Feed',
        slug: 'saved-feed',
        source_url_template: 'https://example.com',
      }),
      headers: { Authorization: '********' },
      cookie: '********',
      proxy_url: '********',
      id: 7,
      public_id: 'saved-feed-public-id',
      version: 2,
      created_at: '2026-08-12T00:00:00Z',
      updated_at: '2026-08-12T00:00:00Z',
    };

    const values = feedToValues(feed);
    expect(values.field_rules[0]).toMatchObject({
      field: 'title',
      selector: '.title',
      attribute: 'text',
    });
    expect(values.headers_list).toEqual([
      { name: 'Authorization', value: '********' },
    ]);
    expect(values.cookie).toBe('********');
    expect(values.proxy_url).toBe('********');
  });

  it('preserves operation-only HTML selectors through an edit roundtrip', () => {
    const feed: RSSGeneratorFeed = {
      ...valuesToDefinition({
        ...structuredClone(DEFAULT_FORM_VALUES),
        name: 'Root selector feed',
        slug: 'root-selector-feed',
        source_url_template: 'https://example.com',
      }),
      selectors: {
        item: 'article',
        title: '::text',
        content: '::html',
        link: '::attr(href)',
      },
      id: 8,
      public_id: 'root-feed-public-id',
      version: 1,
      created_at: '2026-08-12T00:00:00Z',
      updated_at: '2026-08-12T00:00:00Z',
    };

    const values = feedToValues(feed);
    expect(values.field_rules).toEqual([
      { field: 'title', selector: '', attribute: 'text' },
      { field: 'content', selector: '', attribute: 'html' },
      { field: 'link', selector: '', attribute: 'href' },
    ]);

    expect(valuesToDefinition(values).selectors).toEqual(feed.selectors);
  });
});
