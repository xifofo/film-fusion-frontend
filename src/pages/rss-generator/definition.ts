import type {
  RSSGeneratorFeed,
  RSSGeneratorFeedInput,
  RSSGeneratorParameter,
} from '@/services/film-fusion';

export type GeneratorHeader = { name: string; value: string };
export type GeneratorSecretQuery = { name: string; value: string };
export type GeneratorFieldRule = {
  field: string;
  selector: string;
  attribute?: string;
};

export type GeneratorFormValues = Omit<
  RSSGeneratorFeedInput,
  | 'headers'
  | 'selectors'
  | 'mapping'
  | 'parameters'
  | 'secret_query_params'
  | 'browser_storage_state'
  | 'wait_until'
  | 'wait_for_selector'
  | 'render_delay_ms'
> & {
  headers_list: GeneratorHeader[];
  secret_query_params_list: GeneratorSecretQuery[];
  parameters: RSSGeneratorParameter[];
  item_selector: string;
  field_rules: GeneratorFieldRule[];
  browser_wait_selector?: string;
  browser_wait_ms?: number;
  browser_wait_until?: string;
  advanced_selectors_json?: string;
  browser_storage_state_json?: string;
};

export const DEFAULT_FIELD_RULES: GeneratorFieldRule[] = [
  { field: 'title', selector: '.title', attribute: 'text' },
  { field: 'link', selector: 'a', attribute: 'href' },
  { field: 'description', selector: '.summary', attribute: 'html' },
  { field: 'date', selector: 'time', attribute: 'datetime' },
];

export const DEFAULT_FORM_VALUES: GeneratorFormValues = {
  name: '',
  slug: '',
  description: '',
  home_page_url: '',
  language: 'zh-CN',
  author: '',
  image_url: '',
  route_kind: 'http_html',
  source_url_template: '',
  method: 'GET',
  request_body_template: '',
  headers_list: [],
  secret_query_params_list: [],
  parameters: [],
  item_selector: '.article',
  field_rules: DEFAULT_FIELD_RULES,
  browser_wait_selector: '',
  browser_wait_ms: 1_000,
  browser_wait_until: 'domcontentloaded',
  advanced_selectors_json: '{}',
  cookie: '',
  proxy_url: '',
  proxy_allow_private: false,
  browser_storage_state_json: '',
  browser_fallback: false,
  item_limit: 100,
  clear_headers: false,
  clear_cookie: false,
  clear_proxy_url: false,
  clear_secret_query_params: false,
  clear_browser_storage_state: false,
  cache_ttl_seconds: 300,
  stale_ttl_seconds: 3600,
  enabled: true,
};

const parseAdvancedSelectors = (value?: string) => {
  if (!value?.trim()) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('高级选择器必须是有效 JSON');
  }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('高级选择器必须是 JSON 对象');
  }
  return Object.fromEntries(
    Object.entries(parsed).map(([key, item]) => [key, String(item ?? '')]),
  );
};

const parseBrowserStorageState = (value?: string) => {
  if (!value?.trim()) return undefined;
  if (value.trim() === '********') return '********';
  const parsed = JSON.parse(value);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('Storage State 必须是 JSON 对象');
  }
  return parsed as Record<string, unknown>;
};

const selectorsFromValues = (values: GeneratorFormValues) => {
  const selectors: Record<string, string> = {
    ...parseAdvancedSelectors(values.advanced_selectors_json),
    item: values.item_selector.trim(),
  };
  for (const rule of values.field_rules || []) {
    const field = rule.field.trim();
    const selector = rule.selector.trim();
    const attribute = rule.attribute?.trim();
    if (
      !field ||
      (!selector && (values.route_kind === 'http_json' || !attribute))
    ) {
      continue;
    }
    selectors[field] =
      values.route_kind === 'http_json' || !attribute
        ? selector
        : attribute === 'text' || attribute === 'html'
          ? `${selector}::${attribute}`
          : `${selector}::attr(${attribute})`;
  }
  return selectors;
};

export const valuesToDefinition = (
  values: GeneratorFormValues,
): RSSGeneratorFeedInput => ({
  name: values.name.trim(),
  slug: values.slug.trim(),
  description: values.description?.trim() || undefined,
  home_page_url: values.home_page_url?.trim() || undefined,
  language: values.language?.trim() || undefined,
  author: values.author?.trim() || undefined,
  image_url: values.image_url?.trim() || undefined,
  route_kind: values.route_kind,
  source_url_template: values.source_url_template.trim(),
  method: values.route_kind === 'browser' ? 'GET' : values.method,
  request_body_template:
    values.route_kind !== 'browser' && values.method === 'POST'
      ? values.request_body_template?.trim() || undefined
      : undefined,
  headers: Object.fromEntries(
    (values.headers_list || [])
      .filter((header) => header.name?.trim())
      .map((header) => [header.name.trim(), header.value || '']),
  ),
  selectors:
    values.route_kind === 'http_json' ? {} : selectorsFromValues(values),
  mapping: values.route_kind === 'http_json' ? selectorsFromValues(values) : {},
  parameters: (values.parameters || []).map((parameter) => ({
    ...parameter,
    name: parameter.name.trim(),
    label: parameter.label?.trim() || undefined,
    type: parameter.type || 'string',
    description: parameter.description?.trim() || undefined,
    default:
      typeof parameter.default === 'string'
        ? parameter.default.trim() || undefined
        : parameter.default,
    pattern: parameter.pattern?.trim() || undefined,
  })),
  cookie: values.cookie?.trim() || undefined,
  proxy_url: values.proxy_url?.trim() || undefined,
  proxy_allow_private: values.proxy_allow_private,
  secret_query_params: Object.fromEntries(
    (values.secret_query_params_list || [])
      .filter((parameter) => parameter.name?.trim())
      .map((parameter) => [parameter.name.trim(), parameter.value || '']),
  ),
  browser_storage_state: parseBrowserStorageState(
    values.browser_storage_state_json,
  ),
  wait_until:
    values.route_kind === 'browser'
      ? (values.browser_wait_until as RSSGeneratorFeedInput['wait_until'])
      : undefined,
  wait_for_selector:
    values.route_kind === 'browser'
      ? values.browser_wait_selector?.trim() || undefined
      : undefined,
  render_delay_ms:
    values.route_kind === 'browser' ? values.browser_wait_ms || 0 : 0,
  item_limit: values.item_limit || 100,
  browser_fallback:
    values.method === 'GET' && values.route_kind !== 'browser'
      ? values.browser_fallback
      : false,
  cache_ttl_seconds: values.cache_ttl_seconds,
  stale_ttl_seconds: values.stale_ttl_seconds,
  enabled: values.enabled,
  clear_headers: values.clear_headers || undefined,
  clear_cookie: values.clear_cookie || undefined,
  clear_proxy_url: values.clear_proxy_url || undefined,
  clear_secret_query_params: values.clear_secret_query_params || undefined,
  clear_browser_storage_state: values.clear_browser_storage_state || undefined,
});

const fieldRulesFromSelectors = (selectors: Record<string, string>) => {
  const reserved = new Set([
    'item',
    'items',
    'wait_for_selector',
    'render_delay_ms',
    'wait_until',
  ]);
  return Object.entries(selectors)
    .filter(([key]) => !reserved.has(key))
    .map(([field, rawSelector]) => {
      const match = rawSelector.match(
        /^(.*)::(?:attr\(([^)]+)\)|(text|html))$/,
      );
      return {
        field,
        selector: match ? match[1] : rawSelector,
        attribute: match?.[2] || match?.[3] || '',
      };
    });
};

export const feedToValues = (feed: RSSGeneratorFeed): GeneratorFormValues => {
  const selectors =
    feed.route_kind === 'http_json'
      ? feed.mapping || feed.selectors || {}
      : feed.selectors || feed.mapping || {};
  const knownKeys = new Set([
    'item',
    'items',
    'wait_for_selector',
    'render_delay_ms',
    'wait_until',
    ...fieldRulesFromSelectors(selectors).map((rule) => rule.field),
  ]);
  const advanced = Object.fromEntries(
    Object.entries(selectors).filter(([key]) => !knownKeys.has(key)),
  );

  return {
    name: feed.name,
    slug: feed.slug,
    description: feed.description || '',
    home_page_url: feed.home_page_url || '',
    language: feed.language || '',
    author: feed.author || '',
    image_url: feed.image_url || '',
    route_kind: feed.route_kind,
    source_url_template: feed.source_url_template,
    method: feed.method,
    request_body_template: feed.request_body_template || '',
    headers_list: Object.entries(feed.headers || {}).map(([name, value]) => ({
      name,
      value,
    })),
    parameters: (feed.parameters || []).map((parameter) => ({
      ...parameter,
      default:
        parameter.default === undefined ? undefined : String(parameter.default),
    })),
    item_selector: selectors.item || selectors.items || '',
    field_rules: fieldRulesFromSelectors(selectors),
    browser_wait_selector: feed.wait_for_selector || '',
    browser_wait_ms: feed.render_delay_ms ?? 1_000,
    browser_wait_until: feed.wait_until || 'domcontentloaded',
    item_limit: feed.item_limit || 100,
    advanced_selectors_json: JSON.stringify(advanced, null, 2),
    cookie: feed.cookie || '',
    proxy_url: feed.proxy_url || '',
    proxy_allow_private: feed.proxy_allow_private || false,
    secret_query_params_list: Object.entries(
      feed.secret_query_params || {},
    ).map(([name, value]) => ({ name, value })),
    browser_storage_state_json:
      typeof feed.browser_storage_state === 'string'
        ? feed.browser_storage_state
        : feed.browser_storage_state
          ? JSON.stringify(feed.browser_storage_state, null, 2)
          : '',
    browser_fallback: feed.browser_fallback,
    cache_ttl_seconds: feed.cache_ttl_seconds,
    stale_ttl_seconds: feed.stale_ttl_seconds,
    enabled: feed.enabled,
    clear_headers: false,
    clear_cookie: false,
    clear_proxy_url: false,
    clear_secret_query_params: false,
    clear_browser_storage_state: false,
  };
};

export const parameterDefaults = (parameters: RSSGeneratorParameter[]) =>
  Object.fromEntries(
    parameters
      .filter((parameter) => parameter.default !== undefined)
      .map((parameter) => [parameter.name, String(parameter.default ?? '')]),
  );
