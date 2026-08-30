import * as cheerio from 'cheerio';
import type { HtmlConfig } from '../../schemas/scraper-config.js';
import { extractItem } from '../extract.js';
import { followDetails } from '../follow.js';
import { createClient, fetchHtml } from '../http.js';
import { pageUrl, shouldStop } from '../pagination.js';
import { sleep, type EngineResult, type Item, type RunContext } from '../types.js';

/** Static HTML scraping over axios + cheerio. Fast path, no browser. */
export async function runHtmlEngine(config: HtmlConfig, ctx: RunContext): Promise<EngineResult> {
  const target = config.target ?? {};
  const startUrl = config.url ?? target.url;
  if (!startUrl) throw new Error('html mode requires target.url');

  const client = createClient(target);
  const pagination = config.pagination;
  const maxPages = pagination?.max_pages ?? 1;

  const all: Item[] = [];
  const signatures = new Set<string>();
  let page = 1;
  let errors = 0;
  let nextUrl: string | undefined = pagination?.type === 'url' ? pageUrl(startUrl, 1, pagination) : startUrl;

  while (nextUrl && !ctx.cancelled()) {
    ctx.progress({ page, totalPages: maxPages, items: all.length, phase: `Fetching page ${page}` });
    ctx.log('info', `GET ${nextUrl}`);

    let html: string;
    try {
      html = await fetchHtml(client, nextUrl);
    } catch (error) {
      errors += 1;
      ctx.log('error', `Request failed: ${(error as Error).message}`);
      break;
    }

    const $ = cheerio.load(html);
    let nodes = $(config.item.selector).toArray();
    if (config.item.limit) nodes = nodes.slice(0, config.item.limit);

    let items = nodes.map((el) => extractItem($, $(el), config.item.fields, nextUrl));
    ctx.log(items.length ? 'success' : 'warn', `Page ${page}: matched ${items.length} items for "${config.item.selector}"`);

    if (config.follow?.enabled && items.length) {
      items = await followDetails(items, config.follow, client, ctx);
    }

    all.push(...items);
    await ctx.push(items);
    ctx.progress({ page, totalPages: maxPages, items: all.length, phase: 'Page complete' });

    const signature = `${items.length}:${JSON.stringify(items[0] ?? {})}`;
    const seen = signatures.has(signature);
    signatures.add(signature);

    let candidate: string | undefined;
    if (pagination?.type === 'next_button' && pagination.selector) {
      const href = $(pagination.selector).first().attr('href');
      candidate = href ? new URL(href, nextUrl).toString() : undefined;
    } else if (pagination?.type === 'url') {
      candidate = pageUrl(startUrl, page + 1, pagination);
    }

    const stop = shouldStop({
      pagination,
      page,
      itemsThisPage: items.length,
      hasNext: Boolean(candidate),
      seenSignature: seen,
    });
    if (stop.stop) {
      ctx.log('info', `Pagination stopped: ${stop.reason}`);
      break;
    }

    if (pagination?.delay_ms) await sleep(pagination.delay_ms);
    nextUrl = candidate;
    page += 1;
  }

  return { items: all, pages: page, errors };
}
