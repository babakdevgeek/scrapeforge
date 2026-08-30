import * as cheerio from 'cheerio';
import { JSONPath } from 'jsonpath-plus';
import type { FieldDef } from '../schemas/scraper-config.js';
import type { Item } from './types.js';

type Api = cheerio.CheerioAPI;
type Node = cheerio.Cheerio<any>;

interface NormalField {
  selector?: string;
  path?: string;
  type: string;
  attribute?: string;
  regex?: string;
  group?: number;
  trim?: boolean;
  default?: unknown;
  value?: unknown;
  separator?: string;
  columns?: string[];
  fields?: Record<string, FieldDef>;
}

export function normalizeField(def: FieldDef): NormalField {
  if (typeof def === 'string') {
    // ".price" -> text, ".img@src" -> attribute shorthand
    const [selector, attribute] = def.split('@');
    return attribute
      ? { selector, type: 'attribute', attribute, trim: true }
      : { selector, type: 'text', trim: true };
  }
  const raw = def as NormalField;
  return { trim: true, ...raw, type: raw.type ?? (raw.fields ? 'object' : 'text') };
}

const clean = (input: string | undefined, trim = true) => {
  if (input == null) return undefined;
  const value = input.replace(/\s+/g, ' ');
  return trim ? value.trim() : value;
};

function absolute(url: string | undefined, base?: string) {
  if (!url || !base) return url;
  try {
    return new URL(url, base).toString();
  } catch {
    return url;
  }
}

function resolveScope($: Api, scope: Node, selector?: string): Node {
  if (!selector || selector === '.' || selector === ':scope' || selector === 'self') return scope;
  const inside = scope.find(selector);
  if (inside.length) return inside;
  // allow selectors that match the scope element itself
  return scope.filter(selector);
}

function readTable($: Api, table: Node, columns?: string[]): Item[] {
  const headers =
    columns ??
    table
      .find('thead th, tr:first-child th')
      .toArray()
      .map((th, i) => clean($(th).text()) || `col_${i + 1}`);

  const rows = table.find('tbody tr').length ? table.find('tbody tr') : table.find('tr');
  return rows
    .toArray()
    .map((tr) => $(tr).find('td'))
    .filter((cells) => cells.length > 0)
    .map((cells) => {
      const row: Item = {};
      cells.each((i, td) => {
        const key = headers[i] ?? `col_${i + 1}`;
        row[key] = clean($(td).text());
      });
      return row;
    });
}

/** Extract one field from a DOM scope. Supports text, attribute, html, regex, lists, tables and nesting. */
export function extractField($: Api, scope: Node, def: FieldDef, baseUrl?: string): unknown {
  const field = normalizeField(def);
  const target = resolveScope($, scope, field.selector);

  const fallback = () => (field.default !== undefined ? field.default : null);

  switch (field.type) {
    case 'constant':
      return field.value ?? null;

    case 'boolean':
      return target.length > 0;

    case 'attribute': {
      if (!target.length) return fallback();
      const attr = field.attribute ?? 'href';
      const raw = target.first().attr(attr);
      const value = clean(raw, field.trim);
      return (attr === 'href' || attr === 'src' ? absolute(value, baseUrl) : value) ?? fallback();
    }

    case 'html':
      return target.length ? target.first().html()?.trim() ?? fallback() : fallback();

    case 'regex': {
      const source = target.length ? clean(target.first().text(), true) ?? '' : '';
      if (!field.regex) return source || fallback();
      const match = new RegExp(field.regex, 'us').exec(source);
      if (!match) return fallback();
      return match[field.group ?? 0] ?? fallback();
    }

    case 'number': {
      if (!target.length) return fallback();
      const text = clean(target.first().text(), true) ?? '';
      const numeric = text.replace(/[^0-9.,-]/g, '').replace(/,(?=\d{3}\b)/g, '').replace(',', '.');
      const parsed = Number.parseFloat(numeric);
      return Number.isFinite(parsed) ? parsed : fallback();
    }

    case 'list': {
      const values = target
        .toArray()
        .map((el) => {
          const node = $(el);
          if (field.attribute) return absolute(clean(node.attr(field.attribute), field.trim), baseUrl);
          return clean(node.text(), field.trim);
        })
        .filter((v): v is string => Boolean(v));
      if (field.separator) return values.join(field.separator);
      return values;
    }

    case 'table':
      return target.length ? readTable($, target.first(), field.columns) : fallback();

    case 'object': {
      if (!field.fields) return fallback();
      if (!target.length) return fallback();
      return extractItem($, target.first(), field.fields, baseUrl);
    }

    case 'text':
    default: {
      if (!target.length) return fallback();
      if (field.fields) return extractItem($, target.first(), field.fields, baseUrl);
      return clean(target.first().text(), field.trim) ?? fallback();
    }
  }
}

export function extractItem(
  $: Api,
  scope: Node,
  fields: Record<string, FieldDef>,
  baseUrl?: string,
): Item {
  const item: Item = {};
  for (const [key, def] of Object.entries(fields)) {
    item[key] = extractField($, scope, def, baseUrl);
  }
  return item;
}

export function extractItemsFromHtml(
  html: string,
  selector: string,
  fields: Record<string, FieldDef>,
  baseUrl?: string,
  limit?: number,
): Item[] {
  const $ = cheerio.load(html);
  let nodes = $(selector).toArray();
  if (limit && limit > 0) nodes = nodes.slice(0, limit);
  return nodes.map((el) => extractItem($, $(el), fields, baseUrl));
}

/* ------------------------------- JSON (api mode) ------------------------------- */

function jsonPath(source: unknown, path: string) {
  if (!path || path === '$') return source;
  const result = JSONPath({ path, json: source as object, wrap: false });
  return result;
}

export function extractJsonField(source: unknown, def: FieldDef): unknown {
  const field = normalizeField(def);
  const path = field.path ?? field.selector ?? '$';
  let value = jsonPath(source, path);

  if (value === undefined || value === null) return field.default ?? null;

  switch (field.type) {
    case 'number': {
      const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value).replace(/[^0-9.-]/g, ''));
      return Number.isFinite(parsed) ? parsed : field.default ?? null;
    }
    case 'boolean':
      return Boolean(value);
    case 'regex': {
      if (!field.regex) return value;
      const match = new RegExp(field.regex, 'us').exec(String(value));
      return match ? match[field.group ?? 0] : field.default ?? null;
    }
    case 'list': {
      const list = Array.isArray(value) ? value : [value];
      return field.separator ? list.join(field.separator) : list;
    }
    case 'object': {
      if (!field.fields) return value;
      return extractJsonItem(value, field.fields);
    }
    default:
      if (field.fields) return extractJsonItem(value, field.fields);
      if (typeof value === 'string' && field.trim !== false) value = value.trim();
      return value;
  }
}

export function extractJsonItem(source: unknown, fields: Record<string, FieldDef>): Item {
  const item: Item = {};
  for (const [key, def] of Object.entries(fields)) {
    item[key] = extractJsonField(source, def);
  }
  return item;
}

export function extractJsonItems(source: unknown, itemsPath: string, fields: Record<string, FieldDef>): Item[] {
  const raw = jsonPath(source, itemsPath ?? '$');
  const list = Array.isArray(raw) ? raw : raw == null ? [] : [raw];
  return list.map((entry) => extractJsonItem(entry, fields));
}
