import type { Pagination } from '../schemas/scraper-config.js';

/** Build the URL for page N of a url-template pagination strategy. */
export function pageUrl(base: string, page: number, pagination?: Pagination): string {
  if (!pagination) return base;

  const start = pagination.start ?? 1;
  const step = pagination.step ?? 1;
  const value = start + (page - 1) * step;

  if (pagination.url_template) {
    return pagination.url_template
      .replace(/\{page\}/g, String(value))
      .replace(/\{offset\}/g, String((page - 1) * step))
      .replace(/\{base\}/g, base);
  }

  if (pagination.param) {
    const url = new URL(base);
    url.searchParams.set(pagination.param, String(value));
    return url.toString();
  }

  return base;
}

export function shouldStop(opts: {
  pagination?: Pagination;
  page: number;
  itemsThisPage: number;
  hasNext: boolean;
  seenSignature: boolean;
}): { stop: boolean; reason?: string } {
  const { pagination, page, itemsThisPage, hasNext, seenSignature } = opts;
  const max = pagination?.max_pages ?? 1;

  if (page >= max) return { stop: true, reason: `reached max_pages (${max})` };
  const condition = pagination?.stop_condition ?? 'no_items';
  if (condition === 'no_items' && itemsThisPage === 0) return { stop: true, reason: 'page returned no items' };
  if (condition === 'no_next' && !hasNext) return { stop: true, reason: 'no next page link' };
  if (condition === 'duplicate_page' && seenSignature) return { stop: true, reason: 'duplicate page content' };
  if (!hasNext) return { stop: true, reason: 'no next page' };
  return { stop: false };
}
