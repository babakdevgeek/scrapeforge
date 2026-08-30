import * as cheerio from 'cheerio';
import { chromium, type Browser, type Page } from 'playwright';
import { env } from '../../lib/config.js';
import type { Action, BrowserConfig } from '../../schemas/scraper-config.js';
import { extractItem } from '../extract.js';
import { followDetails } from '../follow.js';
import { createClient } from '../http.js';
import { pageUrl, shouldStop } from '../pagination.js';
import { sleep, type EngineResult, type Item, type RunContext } from '../types.js';

async function applyAction(page: Page, action: Action, ctx: RunContext) {
  const timeout = action.timeout_ms ?? env.defaultTimeout;
  try {
    switch (action.type) {
      case 'click':
        await page.click(action.selector!, { timeout });
        break;
      case 'type':
        await page.fill(action.selector!, action.value ?? '', { timeout });
        break;
      case 'select':
        await page.selectOption(action.selector!, action.value ?? '', { timeout });
        break;
      case 'press':
        await page.keyboard.press(action.value ?? 'Enter');
        break;
      case 'hover':
        await page.hover(action.selector!, { timeout });
        break;
      case 'wait':
        await sleep(action.delay_ms ?? 1000);
        break;
      case 'wait_for':
        await page.waitForSelector(action.selector!, { timeout });
        break;
      case 'goto':
        await page.goto(action.value!, { waitUntil: 'domcontentloaded', timeout });
        break;
      case 'evaluate':
        await page.evaluate(action.script ?? '');
        break;
      case 'scroll': {
        const times = action.times ?? 1;
        for (let i = 0; i < times; i += 1) {
          await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.9));
          await sleep(action.delay_ms ?? 600);
        }
        break;
      }
      case 'screenshot':
        await page.screenshot({ path: `screenshots/${ctx.runId}-${Date.now()}.png`, fullPage: false });
        break;
    }
    ctx.log('debug', `Action ${action.type}${action.selector ? ` on ${action.selector}` : ''}`);
  } catch (error) {
    if (action.optional) {
      ctx.log('warn', `Optional action ${action.type} skipped: ${(error as Error).message}`);
      return;
    }
    throw error;
  }
}

async function login(page: Page, config: BrowserConfig, ctx: RunContext) {
  const auth = config.target?.auth;
  if (auth?.type !== 'form_login' || !auth.login_url) return;
  ctx.log('info', `Logging in at ${auth.login_url}`);
  await page.goto(auth.login_url, { waitUntil: 'domcontentloaded' });
  if (auth.user_selector) await page.fill(auth.user_selector, auth.username ?? '');
  if (auth.pass_selector) await page.fill(auth.pass_selector, auth.password ?? '');
  if (auth.submit_selector) {
    await Promise.all([
      page.waitForLoadState('domcontentloaded').catch(() => undefined),
      page.click(auth.submit_selector),
    ]);
  }
  ctx.log('success', 'Login flow finished');
}

/** Playwright driven scraping: clicks, waits, infinite scroll, login flows. */
export async function runBrowserEngine(config: BrowserConfig, ctx: RunContext): Promise<EngineResult> {
  const target = config.target ?? {};
  const startUrl = config.url ?? target.url;
  if (!startUrl) throw new Error('browser mode requires target.url');

  const pagination = config.pagination;
  const maxPages = pagination?.max_pages ?? 1;
  const all: Item[] = [];
  let errors = 0;
  let page = 1;

  let browser: Browser | undefined;
  try {
    ctx.log('info', `Launching Chromium (headless: ${env.headless})`);
    browser = await chromium.launch({ headless: env.headless });
    const context = await browser.newContext({
      userAgent: env.userAgent,
      viewport: config.viewport ?? { width: 1440, height: 900 },
      extraHTTPHeaders: target.headers,
    });

    if (target.cookies && typeof target.cookies === 'object') {
      const { hostname } = new URL(startUrl);
      await context.addCookies(
        Object.entries(target.cookies).map(([name, value]) => ({ name, value, domain: hostname, path: '/' })),
      );
    }

    if (config.block_resources?.length) {
      const blocked = new Set(config.block_resources);
      await context.route('**/*', (route) => {
        const type = route.request().resourceType();
        return blocked.has(type as never) ? route.abort() : route.continue();
      });
    }

    const tab = await context.newPage();
    await login(tab, config, ctx);

    let currentUrl = pagination?.type === 'url' ? pageUrl(startUrl, 1, pagination) : startUrl;

    while (!ctx.cancelled()) {
      ctx.progress({ page, totalPages: maxPages, items: all.length, phase: `Loading page ${page}` });
      await tab.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: target.timeout_ms ?? env.defaultTimeout });
      ctx.log('info', `Opened ${currentUrl}`);

      for (const action of config.actions ?? []) {
        if (ctx.cancelled()) break;
        await applyAction(tab, action, ctx);
      }

      if (pagination?.type === 'infinite_scroll') {
        const rounds = pagination.scroll_times ?? pagination.max_pages ?? 5;
        ctx.progress({ phase: 'Infinite scrolling' });
        for (let i = 0; i < rounds; i += 1) {
          if (ctx.cancelled()) break;
          const before = await tab.evaluate(() => document.body.scrollHeight);
          await tab.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await sleep(pagination.delay_ms ?? 900);
          const after = await tab.evaluate(() => document.body.scrollHeight);
          ctx.log('debug', `Scroll ${i + 1}/${rounds} (height ${before} -> ${after})`);
          if (after === before) break;
        }
      }

      const html = await tab.content();
      const $ = cheerio.load(html);
      let nodes = $(config.item.selector).toArray();
      if (config.item.limit) nodes = nodes.slice(0, config.item.limit);
      let items = nodes.map((el) => extractItem($, $(el), config.item.fields, currentUrl));
      ctx.log(items.length ? 'success' : 'warn', `Page ${page}: matched ${items.length} items`);

      if (config.follow?.enabled && items.length) {
        items = await followDetails(items, config.follow, createClient(target), ctx);
      }

      all.push(...items);
      await ctx.push(items);

      if (pagination?.type === 'infinite_scroll') break;

      let hasNext = false;
      if (pagination?.type === 'next_button' && pagination.selector) {
        const next = tab.locator(pagination.selector).first();
        hasNext = (await next.count()) > 0 && (await next.isEnabled().catch(() => false));
        if (hasNext) {
          const href = await next.getAttribute('href');
          if (href) {
            currentUrl = new URL(href, currentUrl).toString();
          } else {
            await next.click();
            await tab.waitForLoadState('networkidle').catch(() => undefined);
            currentUrl = tab.url();
          }
        }
      } else if (pagination?.type === 'url') {
        currentUrl = pageUrl(startUrl, page + 1, pagination);
        hasNext = true;
      }

      const stop = shouldStop({ pagination, page, itemsThisPage: items.length, hasNext, seenSignature: false });
      if (stop.stop) {
        ctx.log('info', `Pagination stopped: ${stop.reason}`);
        break;
      }
      if (pagination?.delay_ms) await sleep(pagination.delay_ms);
      page += 1;
    }
  } catch (error) {
    errors += 1;
    ctx.log('error', `Browser engine failed: ${(error as Error).message}`);
    throw error;
  } finally {
    await browser?.close().catch(() => undefined);
    ctx.log('debug', 'Browser closed');
  }

  return { items: all, pages: page, errors };
}
