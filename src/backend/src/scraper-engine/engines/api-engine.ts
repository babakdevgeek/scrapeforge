import { JSONPath } from 'jsonpath-plus';
import type { ApiConfig } from '../../schemas/scraper-config.js';
import { extractJsonItems } from '../extract.js';
import { followDetails } from '../follow.js';
import { createClient } from '../http.js';
import { pageUrl, shouldStop } from '../pagination.js';
import { sleep, type EngineResult, type Item, type RunContext } from '../types.js';

/** JSON API scraping over axios + JSONPath. Handles page/offset/cursor pagination. */
export async function runApiEngine(config: ApiConfig, ctx: RunContext): Promise<EngineResult> {
  const client = createClient(config.target ?? {});
  const pagination = config.pagination;
  const maxPages = pagination?.max_pages ?? 1;

  const all: Item[] = [];
  let page = 1;
  let errors = 0;
  let cursor: string | undefined;

  while (!ctx.cancelled()) {
    const url = pagination?.type === 'api' || pagination?.type === 'url' ? pageUrl(config.request.url, page, pagination) : config.request.url;
    const query = { ...(config.request.query ?? {}) } as Record<string, unknown>;
    if (cursor && pagination?.param) query[pagination.param] = cursor;

    ctx.progress({ page, totalPages: maxPages, items: all.length, phase: `Requesting page ${page}` });
    ctx.log('info', `${config.request.method ?? 'GET'} ${url}`);

    let payload: unknown;
    try {
      const res = await client.request({
        url,
        method: config.request.method ?? 'GET',
        headers: config.request.headers,
        params: query,
        data: config.request.body,
      });
      if (res.status >= 400) throw new Error(`responded ${res.status}`);
      payload = res.data;
    } catch (error) {
      errors += 1;
      ctx.log('error', `Request failed: ${(error as Error).message}`);
      break;
    }

    let items = extractJsonItems(payload, config.response.items ?? '$', config.response.fields);
    ctx.log(items.length ? 'success' : 'warn', `Page ${page}: ${items.length} items from "${config.response.items}"`);

    if (config.follow?.enabled && items.length) {
      items = await followDetails(items, config.follow, client, ctx);
    }

    all.push(...items);
    await ctx.push(items);

    if (pagination?.cursor_path) {
      const next = JSONPath({ path: pagination.cursor_path, json: payload as object, wrap: false });
      cursor = next ? String(next) : undefined;
    }

    const hasNext = pagination?.cursor_path ? Boolean(cursor) : Boolean(pagination);
    const stop = shouldStop({ pagination, page, itemsThisPage: items.length, hasNext, seenSignature: false });
    if (stop.stop) {
      ctx.log('info', `Pagination stopped: ${stop.reason}`);
      break;
    }

    if (pagination?.delay_ms) await sleep(pagination.delay_ms);
    page += 1;
  }

  return { items: all, pages: page, errors };
}
