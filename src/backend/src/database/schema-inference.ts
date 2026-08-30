import type { Column, ColumnType } from './types.js';

const RESERVED = new Set(['id', 'select', 'from', 'table', 'order', 'group', 'where', 'index', 'default']);

export function safeName(input: string): string {
  const cleaned = input
    .trim()
    .replace(/[^a-zA-Z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
  const named = cleaned || 'column';
  const prefixed = /^[0-9]/.test(named) ? `c_${named}` : named;
  return RESERVED.has(prefixed) ? `${prefixed}_value` : prefixed;
}

function typeOf(value: unknown): ColumnType {
  if (value === null || value === undefined) return 'TEXT';
  if (typeof value === 'number') return Number.isInteger(value) ? 'INTEGER' : 'REAL';
  if (typeof value === 'boolean') return 'BOOLEAN';
  if (typeof value === 'object') return 'JSON';
  return 'TEXT';
}

function widen(a: ColumnType, b: ColumnType): ColumnType {
  if (a === b) return a;
  if (a === 'JSON' || b === 'JSON') return 'JSON';
  if ((a === 'INTEGER' && b === 'REAL') || (a === 'REAL' && b === 'INTEGER')) return 'REAL';
  return 'TEXT';
}

/** Look at every scraped row and derive the narrowest column set that fits all of them. */
export function inferColumns(rows: Record<string, unknown>[]): Column[] {
  const map = new Map<string, ColumnType>();
  for (const row of rows) {
    for (const [key, value] of Object.entries(row)) {
      const name = safeName(key);
      const type = typeOf(value);
      map.set(name, map.has(name) ? widen(map.get(name)!, type) : type);
    }
  }
  return [...map.entries()].map(([name, type]) => ({ name, type }));
}

export function serializeValue(value: unknown, type: ColumnType) {
  if (value === undefined) return null;
  if (value === null) return null;
  if (type === 'JSON') return JSON.stringify(value);
  if (type === 'BOOLEAN') return value ? 1 : 0;
  if (typeof value === 'object') return JSON.stringify(value);
  return value as string | number;
}

export function normalizeRow(row: Record<string, unknown>, columns: Column[]) {
  const out: Record<string, unknown> = {};
  const byName = new Map(columns.map((c) => [c.name, c]));
  for (const [key, value] of Object.entries(row)) {
    const name = safeName(key);
    const column = byName.get(name);
    if (!column) continue;
    out[name] = serializeValue(value, column.type);
  }
  for (const column of columns) if (!(column.name in out)) out[column.name] = null;
  return out;
}
