import type { ScraperConfig } from '../schemas/scraper-config.js';

export type Item = Record<string, unknown>;

export interface RunContext {
  runId: string;
  scraperId: string;
  log(level: 'debug' | 'info' | 'warn' | 'error' | 'success', message: string, meta?: unknown): void;
  progress(update: { page?: number; totalPages?: number; items?: number; phase?: string }): void;
  push(items: Item[]): Promise<void>;
  cancelled(): boolean;
}

export interface EngineResult {
  items: Item[];
  pages: number;
  errors: number;
}

export type Engine = (config: ScraperConfig, ctx: RunContext) => Promise<EngineResult>;

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
