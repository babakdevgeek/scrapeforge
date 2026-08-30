const BASE = import.meta.env.VITE_API_URL ?? '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const body = (await response.json()) as { error?: string; details?: string[] };
      message = [body.error, body.details?.join('; ')].filter(Boolean).join(' - ') || message;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/* ------------------------------- types ------------------------------- */

export type Mode = 'html' | 'api' | 'browser';
export type RunStatus = 'queued' | 'running' | 'success' | 'failed' | 'cancelled';

export interface Scraper {
  id: string;
  name: string;
  description: string | null;
  mode: Mode;
  config: Record<string, unknown>;
  tags: string[];
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
  records?: number;
  runCount?: number;
  versionCount?: number;
  lastRun?: { id: string; status: RunStatus; startedAt: string; itemCount: number; durationMs: number | null } | null;
  versions?: ScraperVersion[];
  runs?: Run[];
}

export interface ScraperVersion {
  id: string;
  version: number;
  config: string;
  note: string | null;
  createdAt: string;
}

export interface Run {
  id: string;
  scraperId: string;
  mode: Mode;
  status: RunStatus;
  pages: number;
  totalPages: number | null;
  itemCount: number;
  errorCount: number;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  scraper?: { id?: string; name: string; mode: Mode };
  logs?: LogLine[];
}

export interface LogLine {
  id: number;
  level: 'debug' | 'info' | 'warn' | 'error' | 'success';
  message: string;
  ts: string;
}

export interface Stats {
  totals: { scrapers: number; success: number; failed: number; records: number; avgDuration: number };
  byMode: { mode: Mode; count: number }[];
  timeline: { date: string; runs: number; items: number; failed: number }[];
  recentRuns: {
    id: string;
    scraperId: string;
    scraper: string;
    mode: Mode;
    status: RunStatus;
    itemCount: number;
    startedAt: string;
    durationMs: number | null;
  }[];
}

export interface RecordPage {
  columns: string[];
  total: number;
  page: number;
  pageSize: number;
  rows: Record<string, unknown>[];
}

export interface Example {
  slug: string;
  name: string;
  description: string;
  mode: Mode;
  config: Record<string, unknown>;
}

export interface SelectorTest {
  selector: string;
  matches: number;
  samples: { text: string; html: string; attributes: Record<string, string> }[];
}

export interface DataStoreInfo {
  driver: 'sqlite' | 'postgres';
  tables: { name: string; rows: number }[];
  plugins: { name: string; description: string }[];
  config: { driver: string; sqlitePath: string; postgresUrl: string };
}

/* ------------------------------- endpoints ------------------------------- */

export const api = {
  health: () => request<{ status: string; dataStore: string }>('/api/health'),
  stats: () => request<Stats>('/api/stats'),

  scrapers: () => request<Scraper[]>('/api/scrapers'),
  scraper: (id: string) => request<Scraper>(`/api/scrapers/${id}`),
  createScraper: (body: { name: string; description?: string; config: unknown; tags?: string[] }) =>
    request<Scraper>('/api/scrapers', { method: 'POST', body: JSON.stringify(body) }),
  updateScraper: (id: string, body: Record<string, unknown>) =>
    request<Scraper>(`/api/scrapers/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  duplicateScraper: (id: string) => request<Scraper>(`/api/scrapers/${id}/duplicate`, { method: 'POST' }),
  deleteScraper: (id: string) => request<void>(`/api/scrapers/${id}`, { method: 'DELETE' }),
  restoreVersion: (id: string, version: number) =>
    request<Scraper>(`/api/scrapers/${id}/versions/${version}/restore`, { method: 'POST' }),
  importScrapers: (configs: { name?: string; description?: string; config: unknown }[]) =>
    request<{ created: Scraper[]; failed: { name?: string; errors: string[] }[] }>('/api/scrapers/import', {
      method: 'POST',
      body: JSON.stringify({ configs }),
    }),
  validate: (config: unknown) =>
    request<{ valid: boolean; errors: string[] }>('/api/validate', {
      method: 'POST',
      body: JSON.stringify({ config }),
    }),

  run: (id: string, body?: { config?: unknown; limitPages?: number }) =>
    request<Run>(`/api/scrapers/${id}/run`, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  runs: (params?: { scraperId?: string; status?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.scraperId) query.set('scraperId', params.scraperId);
    if (params?.status) query.set('status', params.status);
    if (params?.limit) query.set('limit', String(params.limit));
    return request<Run[]>(`/api/runs?${query.toString()}`);
  },
  runDetail: (id: string) => request<Run>(`/api/runs/${id}`),
  cancelRun: (id: string) => request<{ cancelled: boolean }>(`/api/runs/${id}/cancel`, { method: 'POST' }),
  deleteRun: (id: string) => request<void>(`/api/runs/${id}`, { method: 'DELETE' }),
  streamUrl: (id: string) => `${BASE}/api/runs/${id}/stream`,

  records: (params: {
    scraperId?: string;
    runId?: string;
    search?: string;
    sort?: string;
    dir?: 'asc' | 'desc';
    page?: number;
    pageSize?: number;
  }) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') query.set(key, String(value));
    });
    return request<RecordPage>(`/api/records?${query.toString()}`);
  },
  deleteRecords: (params: { scraperId?: string; runId?: string }) => {
    const query = new URLSearchParams(params as Record<string, string>);
    return request<{ deleted: number }>(`/api/records?${query.toString()}`, { method: 'DELETE' });
  },
  exportUrl: (params: { scraperId?: string; runId?: string; format: 'json' | 'csv' | 'xlsx'; columns?: string[] }) => {
    const query = new URLSearchParams();
    if (params.scraperId) query.set('scraperId', params.scraperId);
    if (params.runId) query.set('runId', params.runId);
    query.set('format', params.format);
    if (params.columns?.length) query.set('columns', params.columns.join(','));
    return `${BASE}/api/records/export?${query.toString()}`;
  },

  examples: () => request<Example[]>('/api/examples'),
  testSelector: (url: string, selector: string) =>
    request<SelectorTest>('/api/selector/test', { method: 'POST', body: JSON.stringify({ url, selector }) }),
  previewUrl: (url: string) => `${BASE}/api/selector/preview?url=${encodeURIComponent(url)}`,

  datastore: () => request<DataStoreInfo>('/api/datastore'),
  ddl: (scraperId: string, table?: string) => {
    const query = new URLSearchParams({ scraperId });
    if (table) query.set('table', table);
    return request<{ ddl: string | null; columns: { name: string; type: string }[]; message?: string }>(
      `/api/datastore/ddl?${query.toString()}`,
    );
  },
  sync: (body: { scraperId: string; table: string; mode?: string; dedupeOn?: string[]; driver?: string }) =>
    request<{ inserted: number; updated: number; skipped: number; table: string; ddl: string }>('/api/datastore/sync', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  dropTable: (table: string) => request<void>(`/api/datastore/tables/${table}`, { method: 'DELETE' }),
};
