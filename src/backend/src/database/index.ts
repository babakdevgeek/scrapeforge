import crypto from 'node:crypto';
import { env } from '../lib/config.js';
import { PostgresStore } from './postgres-store.js';
import { SqliteStore } from './sqlite-store.js';
import type { DataStore } from './types.js';

let cached: DataStore | null = null;
let cachedKey = '';

export async function getStore(driver?: 'sqlite' | 'postgres'): Promise<DataStore> {
  const target = driver ?? env.dataStore.driver;
  const key = target === 'postgres' ? `pg:${env.dataStore.postgresUrl}` : `sqlite:${env.dataStore.sqlitePath}`;
  if (cached && cachedKey === key) return cached;

  await cached?.close().catch(() => undefined);
  cached = target === 'postgres' ? await PostgresStore.connect(env.dataStore.postgresUrl) : new SqliteStore(env.dataStore.sqlitePath);
  cachedKey = key;
  return cached;
}

/** Stable fingerprint of a scraped item, used for dedupe and re-run diffing. */
export function hashItem(item: Record<string, unknown>, keys?: string[]) {
  const source = keys?.length
    ? keys.map((k) => `${k}=${JSON.stringify(item[k] ?? null)}`).join('|')
    : JSON.stringify(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)));
  return crypto.createHash('sha1').update(source).digest('hex');
}

export * from './types.js';
export { inferColumns, safeName } from './schema-inference.js';
