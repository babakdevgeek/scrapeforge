/**
 * JSON Schema for scraper configurations.
 * Monaco reads this for completion, hover docs and inline validation, so every
 * property carries a human description on purpose.
 */
export const SCHEMA_URI = 'inmemory://scrapeforge/scraper-config.json';

const fieldDefinition = {
  description: 'Field extraction. A bare string is a CSS selector; "img@src" is attribute shorthand.',
  anyOf: [
    { type: 'string' },
    {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector, relative to the item scope.' },
        path: { type: 'string', description: 'JSONPath expression (api mode).' },
        type: {
          description: 'Extraction strategy.',
          enum: ['text', 'attribute', 'html', 'regex', 'list', 'table', 'number', 'boolean', 'constant'],
          default: 'text',
        },
        attribute: { type: 'string', description: 'Attribute to read when type is "attribute" (src, href, data-id).' },
        regex: { type: 'string', description: 'Pattern applied to the element text when type is "regex".' },
        group: { type: 'number', description: 'Capture group index for regex extraction.', default: 0 },
        trim: { type: 'boolean', description: 'Collapse whitespace and trim.', default: true },
        separator: { type: 'string', description: 'Join list values with this string instead of returning an array.' },
        columns: { type: 'array', items: { type: 'string' }, description: 'Column names for table extraction.' },
        default: { description: 'Value used when nothing matches.' },
        value: { description: 'Static value when type is "constant".' },
        fields: { type: 'object', description: 'Nested object extraction.', additionalProperties: true },
      },
      additionalProperties: false,
    },
  ],
};

const paginationDefinition = {
  type: 'object',
  description: 'Controls how ScrapeForge walks multiple pages.',
  required: ['type'],
  properties: {
    type: {
      description: 'Pagination strategy.',
      enum: ['next_button', 'url', 'infinite_scroll', 'api'],
    },
    selector: { type: 'string', description: 'CSS selector for the next-page control (next_button).' },
    url_template: {
      type: 'string',
      description: 'URL pattern with {page} or {offset} placeholders (url / api).',
    },
    param: { type: 'string', description: 'Query parameter to increment, or the cursor parameter name.' },
    start: { type: 'number', description: 'First page number.', default: 1 },
    step: { type: 'number', description: 'Increment per page. Use the page size for offset pagination.', default: 1 },
    max_pages: { type: 'number', description: 'Hard ceiling on pages. Always set this.', default: 1 },
    delay_ms: { type: 'number', description: 'Politeness delay between pages.' },
    stop_condition: {
      description: 'When to stop early.',
      enum: ['no_items', 'no_next', 'max_pages', 'duplicate_page'],
      default: 'no_items',
    },
    scroll_times: { type: 'number', description: 'Scroll rounds for infinite_scroll.' },
    cursor_path: { type: 'string', description: 'JSONPath to the next cursor token (api).' },
  },
  additionalProperties: false,
};

const followDefinition: Record<string, unknown> = {
  type: 'object',
  description: 'Deep scraping: open each item\u2019s detail page and merge extra fields.',
  required: ['url_field', 'fields'],
  properties: {
    enabled: { type: 'boolean', description: 'Turn deep scraping on.', default: false },
    url_field: { type: 'string', description: 'Field on the list item holding the detail URL.' },
    concurrency: { type: 'number', description: 'Parallel detail requests.', default: 3 },
    merge: { type: 'boolean', description: 'Merge detail fields into the item (false nests them under "detail").', default: true },
    fields: { type: 'object', description: 'Fields extracted from the detail page.', additionalProperties: fieldDefinition },
    follow: { description: 'Another level deeper (reviews, specifications).', type: 'object' },
  },
  additionalProperties: false,
};

const targetDefinition = {
  type: 'object',
  description: 'Request context: URL, headers, cookies and authentication.',
  properties: {
    url: { type: 'string', description: 'Start URL.' },
    headers: { type: 'object', description: 'Extra request headers.', additionalProperties: { type: 'string' } },
    cookies: {
      description: 'Cookie string or name/value map.',
      anyOf: [{ type: 'string' }, { type: 'object', additionalProperties: { type: 'string' } }],
    },
    timeout_ms: { type: 'number', description: 'Per-request timeout.' },
    auth: {
      type: 'object',
      description: 'Authentication strategy.',
      properties: {
        type: { enum: ['none', 'basic', 'bearer', 'header', 'form_login'] },
        username: { type: 'string' },
        password: { type: 'string' },
        token: { type: 'string' },
        header: { type: 'string', description: 'Header name for header auth (e.g. x-api-key).' },
        login_url: { type: 'string', description: 'Login page URL (form_login, browser mode).' },
        user_selector: { type: 'string' },
        pass_selector: { type: 'string' },
        submit_selector: { type: 'string' },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
};

const outputDefinition = {
  type: 'object',
  description: 'Where extracted rows are stored.',
  properties: {
    store: { type: 'boolean', description: 'Write rows to the data store.', default: true },
    table: { type: 'string', description: 'Destination table. Created automatically from the scraped shape.' },
    driver: { enum: ['sqlite', 'postgres'], description: 'Destination driver. Defaults to the server setting.' },
    mode: { enum: ['append', 'upsert', 'replace'], description: 'Write strategy.', default: 'append' },
    dedupe_on: { type: 'array', items: { type: 'string' }, description: 'Columns forming the dedupe key.' },
  },
  additionalProperties: false,
};

const itemDefinition = {
  type: 'object',
  description: 'Repeating element on the page and the fields read from each one.',
  required: ['selector', 'fields'],
  properties: {
    selector: { type: 'string', description: 'CSS selector matching one item (e.g. ".product").' },
    limit: { type: 'number', description: 'Stop after N items per page.' },
    fields: { type: 'object', description: 'Field name to extraction rule.', additionalProperties: fieldDefinition },
  },
  additionalProperties: false,
};

export const configSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'ScrapeForge scraper configuration',
  type: 'object',
  required: ['mode'],
  properties: {
    mode: {
      description: 'Engine used for this scraper: html (cheerio), api (axios + JSONPath), browser (Playwright).',
      enum: ['html', 'api', 'browser'],
    },
  },
  allOf: [
    {
      if: { properties: { mode: { const: 'html' } } },
      then: {
        properties: {
          mode: { const: 'html' },
          target: targetDefinition,
          url: { type: 'string', description: 'Shortcut for target.url.' },
          item: itemDefinition,
          pagination: paginationDefinition,
          follow: followDefinition,
          output: outputDefinition,
        },
        required: ['item'],
        additionalProperties: false,
      },
    },
    {
      if: { properties: { mode: { const: 'api' } } },
      then: {
        properties: {
          mode: { const: 'api' },
          target: targetDefinition,
          request: {
            type: 'object',
            required: ['url'],
            description: 'HTTP request sent to the API.',
            properties: {
              url: { type: 'string' },
              method: { enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], default: 'GET' },
              headers: { type: 'object', additionalProperties: { type: 'string' } },
              query: { type: 'object', description: 'Query string parameters.' },
              body: { description: 'Request body for POST/PUT/PATCH.' },
            },
            additionalProperties: false,
          },
          response: {
            type: 'object',
            required: ['items', 'fields'],
            description: 'How to read the response payload.',
            properties: {
              items: { type: 'string', description: 'JSONPath to the array of items, e.g. "$.data" or "$.products.*".' },
              total_path: { type: 'string', description: 'JSONPath to a total count, used for progress.' },
              fields: { type: 'object', additionalProperties: fieldDefinition },
            },
            additionalProperties: false,
          },
          pagination: paginationDefinition,
          follow: followDefinition,
          output: outputDefinition,
        },
        required: ['request', 'response'],
        additionalProperties: false,
      },
    },
    {
      if: { properties: { mode: { const: 'browser' } } },
      then: {
        properties: {
          mode: { const: 'browser' },
          target: targetDefinition,
          url: { type: 'string' },
          viewport: {
            type: 'object',
            properties: { width: { type: 'number' }, height: { type: 'number' } },
            additionalProperties: false,
          },
          block_resources: {
            type: 'array',
            description: 'Resource types to abort for speed.',
            items: { enum: ['image', 'media', 'font', 'stylesheet'] },
          },
          actions: {
            type: 'array',
            description: 'Steps performed before extraction.',
            items: {
              type: 'object',
              required: ['type'],
              properties: {
                type: {
                  enum: ['click', 'type', 'wait', 'wait_for', 'scroll', 'select', 'press', 'hover', 'evaluate', 'screenshot', 'goto'],
                },
                selector: { type: 'string' },
                value: { type: 'string' },
                times: { type: 'number', description: 'Repeat count (scroll).' },
                delay_ms: { type: 'number' },
                timeout_ms: { type: 'number' },
                optional: { type: 'boolean', description: 'Ignore failures (cookie banners that may not appear).' },
                script: { type: 'string', description: 'JavaScript evaluated in the page (evaluate).' },
              },
              additionalProperties: false,
            },
          },
          item: itemDefinition,
          pagination: paginationDefinition,
          follow: followDefinition,
          output: outputDefinition,
        },
        required: ['item'],
        additionalProperties: false,
      },
    },
  ],
};
