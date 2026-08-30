import { z } from 'zod';

/*
 * Types are declared by hand and zod validates against them. Recursive shapes
 * (fields inside fields, follow inside follow) stay as z.any() in the schema so
 * TypeScript never has to infer a circular type.
 */

export type FieldType =
  | 'text'
  | 'attribute'
  | 'html'
  | 'regex'
  | 'list'
  | 'table'
  | 'number'
  | 'boolean'
  | 'constant';

export type FieldDef =
  | string
  | {
      selector?: string;
      path?: string;
      type?: FieldType;
      attribute?: string;
      regex?: string;
      group?: number;
      trim?: boolean;
      default?: unknown;
      value?: unknown;
      separator?: string;
      columns?: string[];
      fields?: Record<string, FieldDef>;
    };

export interface Pagination {
  type: 'next_button' | 'url' | 'infinite_scroll' | 'api';
  selector?: string;
  url_template?: string;
  param?: string;
  start?: number;
  step?: number;
  max_pages: number;
  delay_ms?: number;
  stop_condition?: 'no_items' | 'no_next' | 'max_pages' | 'duplicate_page';
  scroll_times?: number;
  cursor_path?: string;
}

export interface FollowConfig {
  enabled: boolean;
  url_field: string;
  mode?: 'html' | 'browser';
  concurrency?: number;
  merge?: boolean;
  fields: Record<string, FieldDef>;
  follow?: FollowConfig;
}

export interface Action {
  type:
    | 'click'
    | 'type'
    | 'wait'
    | 'wait_for'
    | 'scroll'
    | 'select'
    | 'press'
    | 'hover'
    | 'evaluate'
    | 'screenshot'
    | 'goto';
  selector?: string;
  value?: string;
  times?: number;
  delay_ms?: number;
  timeout_ms?: number;
  optional?: boolean;
  script?: string;
}

export interface Target {
  url?: string;
  headers?: Record<string, string>;
  cookies?: string | Record<string, string>;
  timeout_ms?: number;
  proxy?: string;
  auth?: {
    type: 'none' | 'basic' | 'bearer' | 'header' | 'form_login';
    username?: string;
    password?: string;
    token?: string;
    header?: string;
    login_url?: string;
    user_selector?: string;
    pass_selector?: string;
    submit_selector?: string;
  };
}

export interface OutputConfig {
  store?: boolean;
  table?: string;
  driver?: 'sqlite' | 'postgres';
  mode?: 'append' | 'upsert' | 'replace';
  dedupe_on?: string[];
}

export interface ItemConfig {
  selector: string;
  limit?: number;
  fields: Record<string, FieldDef>;
}

export interface HtmlConfig {
  mode: 'html';
  target?: Target;
  url?: string;
  item: ItemConfig;
  pagination?: Pagination;
  follow?: FollowConfig;
  output?: OutputConfig;
}

export interface ApiConfig {
  mode: 'api';
  target?: Target;
  request: {
    url: string;
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    headers?: Record<string, string>;
    query?: Record<string, string | number | boolean>;
    body?: unknown;
  };
  response: {
    items: string;
    total_path?: string;
    fields: Record<string, FieldDef>;
  };
  pagination?: Pagination;
  follow?: FollowConfig;
  output?: OutputConfig;
}

export interface BrowserConfig {
  mode: 'browser';
  target?: Target;
  url?: string;
  viewport?: { width: number; height: number };
  block_resources?: ('image' | 'media' | 'font' | 'stylesheet')[];
  actions?: Action[];
  item: ItemConfig;
  pagination?: Pagination;
  follow?: FollowConfig;
  output?: OutputConfig;
}

export type ScraperConfig = HtmlConfig | ApiConfig | BrowserConfig;

/* --------------------------------- validation --------------------------------- */

const fieldSchema = z.union([
  z.string(),
  z
    .object({
      selector: z.string().optional(),
      path: z.string().optional(),
      type: z
        .enum(['text', 'attribute', 'html', 'regex', 'list', 'table', 'number', 'boolean', 'constant'])
        .optional(),
      attribute: z.string().optional(),
      regex: z.string().optional(),
      group: z.number().int().min(0).optional(),
      trim: z.boolean().optional(),
      default: z.unknown().optional(),
      value: z.unknown().optional(),
      separator: z.string().optional(),
      columns: z.array(z.string()).optional(),
      fields: z.record(z.any()).optional(),
    })
    .strict(),
]);

const paginationSchema = z
  .object({
    type: z.enum(['next_button', 'url', 'infinite_scroll', 'api']),
    selector: z.string().optional(),
    url_template: z.string().optional(),
    param: z.string().optional(),
    start: z.number().int().optional(),
    step: z.number().int().optional(),
    max_pages: z.number().int().min(1).max(5000).default(1),
    delay_ms: z.number().int().min(0).optional(),
    stop_condition: z.enum(['no_items', 'no_next', 'max_pages', 'duplicate_page']).optional(),
    scroll_times: z.number().int().optional(),
    cursor_path: z.string().optional(),
  })
  .strict();

const followSchema = z
  .object({
    enabled: z.boolean().default(false),
    url_field: z.string(),
    mode: z.enum(['html', 'browser']).optional(),
    concurrency: z.number().int().min(1).max(10).optional(),
    merge: z.boolean().optional(),
    fields: z.record(fieldSchema),
    follow: z.any().optional(),
  })
  .strict();

const actionSchema = z
  .object({
    type: z.enum([
      'click',
      'type',
      'wait',
      'wait_for',
      'scroll',
      'select',
      'press',
      'hover',
      'evaluate',
      'screenshot',
      'goto',
    ]),
    selector: z.string().optional(),
    value: z.string().optional(),
    times: z.number().int().min(1).optional(),
    delay_ms: z.number().int().min(0).optional(),
    timeout_ms: z.number().int().min(0).optional(),
    optional: z.boolean().optional(),
    script: z.string().optional(),
  })
  .strict();

const targetSchema = z
  .object({
    url: z.string().optional(),
    headers: z.record(z.string()).optional(),
    cookies: z.union([z.string(), z.record(z.string())]).optional(),
    timeout_ms: z.number().int().optional(),
    proxy: z.string().optional(),
    auth: z
      .object({
        type: z.enum(['none', 'basic', 'bearer', 'header', 'form_login']),
        username: z.string().optional(),
        password: z.string().optional(),
        token: z.string().optional(),
        header: z.string().optional(),
        login_url: z.string().optional(),
        user_selector: z.string().optional(),
        pass_selector: z.string().optional(),
        submit_selector: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

const outputSchema = z
  .object({
    store: z.boolean().optional(),
    table: z.string().optional(),
    driver: z.enum(['sqlite', 'postgres']).optional(),
    mode: z.enum(['append', 'upsert', 'replace']).optional(),
    dedupe_on: z.array(z.string()).optional(),
  })
  .strict();

const itemSchema = z
  .object({
    selector: z.string().min(1),
    limit: z.number().int().positive().optional(),
    fields: z.record(fieldSchema),
  })
  .strict();

const htmlSchema = z
  .object({
    mode: z.literal('html'),
    target: targetSchema.optional(),
    url: z.string().optional(),
    item: itemSchema,
    pagination: paginationSchema.optional(),
    follow: followSchema.optional(),
    output: outputSchema.optional(),
  })
  .strict();

const apiSchema = z
  .object({
    mode: z.literal('api'),
    target: targetSchema.optional(),
    request: z
      .object({
        url: z.string().min(1),
        method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional(),
        headers: z.record(z.string()).optional(),
        query: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
        body: z.unknown().optional(),
      })
      .strict(),
    response: z
      .object({
        items: z.string().default('$'),
        total_path: z.string().optional(),
        fields: z.record(fieldSchema),
      })
      .strict(),
    pagination: paginationSchema.optional(),
    follow: followSchema.optional(),
    output: outputSchema.optional(),
  })
  .strict();

const browserSchema = z
  .object({
    mode: z.literal('browser'),
    target: targetSchema.optional(),
    url: z.string().optional(),
    viewport: z.object({ width: z.number(), height: z.number() }).strict().optional(),
    block_resources: z.array(z.enum(['image', 'media', 'font', 'stylesheet'])).optional(),
    actions: z.array(actionSchema).optional(),
    item: itemSchema,
    pagination: paginationSchema.optional(),
    follow: followSchema.optional(),
    output: outputSchema.optional(),
  })
  .strict();

export const scraperConfigSchema = z.discriminatedUnion('mode', [htmlSchema, apiSchema, browserSchema]);

export type ValidationResult =
  | { ok: true; config: ScraperConfig; errors: string[] }
  | { ok: false; config: null; errors: string[] };

export function validateConfig(input: unknown): ValidationResult {
  const parsed = scraperConfigSchema.safeParse(input);
  if (parsed.success) {
    return { ok: true, config: parsed.data as unknown as ScraperConfig, errors: [] };
  }
  return {
    ok: false,
    config: null,
    errors: parsed.error.issues.map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`),
  };
}
