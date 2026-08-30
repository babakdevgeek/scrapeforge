import { prisma } from '../lib/db.js';
import { runBus, type RunEvent } from '../lib/bus.js';
import { getStore, hashItem } from '../database/index.js';
import { execute } from '../scraper-engine/index.js';
import type { Item, RunContext } from '../scraper-engine/types.js';
import { validateConfig, type ScraperConfig } from '../schemas/scraper-config.js';
import { applyPlugins } from '../plugins/index.js';

interface QueuedLog {
  runId: string;
  level: string;
  message: string;
  meta?: string;
  ts: Date;
}

const logQueue: QueuedLog[] = [];
let flushing = false;

async function flushLogs() {
  if (flushing || logQueue.length === 0) return;
  flushing = true;
  const batch = logQueue.splice(0, logQueue.length);
  try {
    await prisma.logLine.createMany({ data: batch });
  } catch {
    /* logging must never break a run */
  } finally {
    flushing = false;
  }
}

const flushTimer = setInterval(() => void flushLogs(), 750) as unknown as { unref?: () => void };
flushTimer.unref?.();

/**
 * Create a run row, execute the right engine and stream telemetry to the UI.
 * Runs are fire-and-forget: the HTTP call returns as soon as the run is registered.
 */
export async function startRun(scraperId: string, overrides?: { config?: unknown; limitPages?: number }) {
  const scraper = await prisma.scraper.findUnique({ where: { id: scraperId } });
  if (!scraper) throw new Error('Scraper not found');

  const raw = overrides?.config ?? JSON.parse(scraper.config);
  const parsed = validateConfig(raw);
  if (!parsed.ok) throw new Error(`Invalid configuration: ${parsed.errors.join('; ')}`);
  const config = parsed.config;

  if (overrides?.limitPages && config.pagination) {
    config.pagination.max_pages = Math.min(config.pagination.max_pages, overrides.limitPages);
  }

  const run = await prisma.run.create({ data: { scraperId, mode: config.mode, status: 'running' } });
  void executeRun(run.id, scraperId, config);
  return run;
}

async function executeRun(runId: string, scraperId: string, config: ScraperConfig) {
  const started = Date.now();
  const collected: Item[] = [];
  const seen = new Set<string>();
  const output = config.output;
  const dedupeOn = output?.dedupe_on;

  const emit = (event: RunEvent) => runBus.emitRun(runId, event);

  const ctx: RunContext = {
    runId,
    scraperId,
    cancelled: () => runBus.isCancelled(runId),
    log(level, message, meta) {
      const ts = new Date();
      logQueue.push({ runId, level, message, meta: meta ? JSON.stringify(meta) : undefined, ts });
      emit({ type: 'log', level, message, ts: ts.toISOString(), meta });
    },
    progress(update) {
      emit({
        type: 'progress',
        page: update.page ?? 0,
        totalPages: update.totalPages,
        items: update.items ?? collected.length,
        phase: update.phase ?? 'Working',
      });
      if (update.page) {
        void prisma.run
          .update({ where: { id: runId }, data: { pages: update.page, totalPages: update.totalPages ?? null } })
          .catch(() => undefined);
      }
    },
    async push(items) {
      const fresh: Item[] = [];
      for (const item of items) {
        const transformed = applyPlugins(item);
        const hash = hashItem(transformed, dedupeOn);
        if (seen.has(hash)) continue;
        seen.add(hash);
        fresh.push(transformed);
        collected.push(transformed);
      }
      if (!fresh.length) return;

      emit({ type: 'items', items: fresh.slice(0, 25) as Record<string, unknown>[] });
      await prisma.scrapedRecord.createMany({
        data: fresh.map((item) => ({ scraperId, runId, hash: hashItem(item, dedupeOn), data: JSON.stringify(item) })),
      });
      await prisma.run.update({ where: { id: runId }, data: { itemCount: collected.length } });
    },
  };

  try {
    ctx.log('info', `Run started in ${config.mode} mode`);
    emit({ type: 'status', status: 'running' });

    const result = await execute(config, ctx);

    if (output?.store !== false && output?.table && collected.length) {
      ctx.log('info', `Writing ${collected.length} rows to ${output.driver ?? 'sqlite'}:${output.table}`);
      const store = await getStore(output.driver);
      const written = await store.write(collected, {
        table: output.table,
        mode: output.mode ?? 'append',
        dedupeOn: output.dedupe_on,
      });
      ctx.log(
        'success',
        `Stored ${written.inserted} new, ${written.updated} updated, ${written.skipped} duplicate rows in "${written.table}"`,
      );
    }

    const durationMs = Date.now() - started;
    const cancelled = runBus.isCancelled(runId);
    await prisma.run.update({
      where: { id: runId },
      data: {
        status: cancelled ? 'cancelled' : 'success',
        pages: result.pages,
        itemCount: collected.length,
        errorCount: result.errors,
        finishedAt: new Date(),
        durationMs,
      },
    });
    ctx.log('success', `Run finished: ${collected.length} items across ${result.pages} page(s) in ${durationMs}ms`);
    emit({ type: 'status', status: cancelled ? 'cancelled' : 'success' });
    emit({ type: 'done', itemCount: collected.length, pages: result.pages, durationMs });
  } catch (error) {
    const message = (error as Error).message;
    ctx.log('error', `Run failed: ${message}`);
    await prisma.run.update({
      where: { id: runId },
      data: {
        status: 'failed',
        error: message,
        itemCount: collected.length,
        errorCount: 1,
        finishedAt: new Date(),
        durationMs: Date.now() - started,
      },
    });
    emit({ type: 'status', status: 'failed', error: message });
  } finally {
    await flushLogs();
    runBus.clear(runId);
  }
}

export function cancelRun(runId: string) {
  runBus.cancel(runId);
}
