import * as cheerio from 'cheerio';
import type { AxiosInstance } from 'axios';
import type { FollowConfig } from '../schemas/scraper-config.js';
import { extractItem } from './extract.js';
import { fetchHtml } from './http.js';
import type { Item, RunContext } from './types.js';

async function mapLimit<T, R>(input: T[], limit: number, fn: (value: T, index: number) => Promise<R>) {
  const results: R[] = new Array(input.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, input.length) }, async () => {
    while (cursor < input.length) {
      const index = cursor++;
      results[index] = await fn(input[index] as T, index);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Deep scraping: list page -> detail page -> (optionally) another level.
 * Detail fields are merged onto the parent item unless merge is disabled.
 */
export async function followDetails(
  items: Item[],
  follow: FollowConfig,
  client: AxiosInstance,
  ctx: RunContext,
): Promise<Item[]> {
  if (!follow.enabled) return items;

  const concurrency = follow.concurrency ?? 3;
  let done = 0;

  ctx.log('info', `Following ${items.length} detail pages (concurrency ${concurrency})`);
  ctx.progress({ phase: 'Extracting details' });

  return mapLimit(items, concurrency, async (item) => {
    if (ctx.cancelled()) return item;
    const url = item[follow.url_field];
    if (typeof url !== 'string' || !url) return item;

    try {
      const html = await fetchHtml(client, url);
      const $ = cheerio.load(html);
      let detail = extractItem($, $.root(), follow.fields, url);

      if (follow.follow?.enabled) {
        const [nested] = await followDetails([{ ...item, ...detail }], follow.follow as FollowConfig, client, ctx);
        detail = { ...detail, ...(nested ?? {}) };
      }

      done += 1;
      if (done % 10 === 0) ctx.log('debug', `Detail pages fetched: ${done}/${items.length}`);
      return follow.merge === false ? { ...item, detail } : { ...item, ...detail };
    } catch (error) {
      ctx.log('warn', `Detail page failed: ${url} (${(error as Error).message})`);
      return item;
    }
  });
}
