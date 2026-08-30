import { z } from 'zod';

/** Field extraction primitives shared by every engine. */
export const fieldSchema = z.union([
  z.string(),
  z.object({
    selector: z.string().optional(),
    path: z.string().optional(), // JSONPath, api mode
    type: z
      .enum(['text', 'attribute', 'html', 'regex', 'list', 'table', 'number', 'boolean', 'constant'])
      .default('text'),
    attribute: z.string().optional(),
    regex: z.string().optional(),
    group: z.number().int().min(0).default(0).optional(),
    trim: z.boolean().default(true).optional(),
    default: z.unknown().optional(),
    value: z.unknown().optional(),
    separator: z.string().optional(),
    columns: z.array(z.string()).optional(),
    fields: z.record(z.lazy((): z.ZodTypeAny => fieldSchema)).optional(),
  }),
]);
export type FieldDef = z.infer<typeof fieldSchema>;

export const paginationSchema = z.object({
  type: z.enum(['next_button', 'url', 'infinite_scroll', 'api']),
  selector: z.string().optional(),
  url_template: z.string().optional(),
  start: z.number().int().default(1).optional(),
  step: z.number().int().default(1).optional(),
  param: z.string().optional(),
  max_pages: z.number().int().min(1).max(5000).default(1),
  delay_ms: z.number().int().min(0).default(0).optional(),
  stop_condition: z.enum(['no_items', 'no_next', 'max_pages', 'duplicate_page']).default('no_items').optional(),
  scroll_times: z.number().int().optional(),
  cursor_path: z.string().optional(),
});

export const followSchema = z.object({
  enabled: z.boolean().default(false),
  url_field: z.string(),
  mode: z.enum(['html', 'browser']).default('html').optional(),
  concurrency: z.number().int().min(1).max(10).default(3).optional(),
  merge: z.boolean().default(true).optional(),
  fields: z.record(fieldSchema),
  follow: z.lazy((): z.ZodTypeAny => followSchema).optional(),
});

export const actionSchema = z.object({
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
});

export const targetSchema = z.object({
  url: z.string().optional(),
  headers: z.record(z.string()).optional(),
  cookies: z.union([z.string(), z.record(z.string())]).optional(),
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
    .optional(),
  proxy: z.string().optional(),
  timeout_ms: z.number().int().optional(),
});

const itemSchema = z.object({
  selector: z.string(),
  fields: z.record(fieldSchema),
  limit: z.number().int().optional(),
});

const outputSchema = z.object({
  store: z.boolean().default(true).optional(),
  table: z.string().optional(),
  driver: z.enum(['sqlite', 'postgres']).optional(),
  mode: z.enum(['append', 'upsert', 'replace']).default('append').optional(),
  dedupe_on: z.array(z.string()).optional(),
});

export const htmlConfigSchema = z.object({
  mode: z.literal('html'),
  target: targetSchema.optional(),
  url: z.string().optional(),
  item: itemSchema,
  pagination: paginationSchema.optional(),
  follow: followSchema.optional(),
  output: outputSchema.optional(),
});

export const apiConfigSchema = z.object({
  mode: z.literal('api'),
  target: targetSchema.optional(),
  request: z.object({
    url: z.string(),
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('GET'),
    headers: z.record(z.string()).optional(),
    query: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
    body: z.unknown().optional(),
  }),
  response: z.object({
    items: z.string().default('$'),
    fields: z.record(fieldSchema),
    total_path: z.string().optional(),
  }),
  pagination: paginationSchema.optional(),
  follow: followSchema.optional(),
  output: outputSchema.optional(),
});

export const browserConfigSchema = z.object({
  mode: z.literal('browser'),
  target: targetSchema.optional(),
  url: z.string().optional(),
  viewport: z.object({ width: z.number(), height: z.number() }).optional(),
  block_resources: z.array(z.enum(['image', 'media', 'font', 'stylesheet'])).optional(),
  actions: z.array(actionSchema).optional(),
  item: itemSchema,
  pagination: paginationSchema.optional(),
  follow: followSchema.optional(),
  output: outputSchema.optional(),
});

export const scraperConfigSchema = z.discriminatedUnion('mode', [
  htmlConfigSchema,
  apiConfigSchema,
  browserConfigSchema,
]);

export type ScraperConfig = z.infer<typeof scraperConfigSchema>;
export type HtmlConfig = z.infer<typeof htmlConfigSchema>;
export type ApiConfig = z.infer<typeof apiConfigSchema>;
export type BrowserConfig = z.infer<typeof browserConfigSchema>;
export type Pagination = z.infer<typeof paginationSchema>;
export type FollowConfig = z.infer<typeof followSchema>;
export type Action = z.infer<typeof actionSchema>;
export type Target = z.infer<typeof targetSchema>;

export function validateConfig(input: unknown) {
  const parsed = scraperConfigSchema.safeParse(input);
  if (parsed.success) return { ok: true as const, config: parsed.data, errors: [] as string[] };
  return {
    ok: false as const,
    config: null,
    errors: parsed.error.issues.map((i) => `${i.path.join('.') || 'root'}: ${i.message}`),
  };
}
