import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/db.js';

export default async function statsRoutes(app: FastifyInstance) {
  app.get('/api/stats', async () => {
    const [scrapers, success, failed, records, recentRuns, byMode] = await Promise.all([
      prisma.scraper.count(),
      prisma.run.count({ where: { status: 'success' } }),
      prisma.run.count({ where: { status: 'failed' } }),
      prisma.scrapedRecord.count(),
      prisma.run.findMany({
        orderBy: { startedAt: 'desc' },
        take: 12,
        include: { scraper: { select: { name: true, mode: true } } },
      }),
      prisma.scraper.groupBy({ by: ['mode'], _count: { mode: true } }),
    ]);

    const window = await prisma.run.findMany({
      where: { startedAt: { gte: new Date(Date.now() - 14 * 24 * 3600 * 1000) } },
      select: { startedAt: true, status: true, itemCount: true, durationMs: true },
    });

    const days = new Map<string, { date: string; runs: number; items: number; failed: number }>();
    for (let i = 13; i >= 0; i -= 1) {
      const date = new Date(Date.now() - i * 24 * 3600 * 1000).toISOString().slice(0, 10);
      days.set(date, { date, runs: 0, items: 0, failed: 0 });
    }
    for (const run of window) {
      const bucket = days.get(run.startedAt.toISOString().slice(0, 10));
      if (!bucket) continue;
      bucket.runs += 1;
      bucket.items += run.itemCount;
      if (run.status === 'failed') bucket.failed += 1;
    }

    const durations = window.map((r) => r.durationMs ?? 0).filter(Boolean);
    const avgDuration = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;

    return {
      totals: { scrapers, success, failed, records, avgDuration },
      byMode: byMode.map((entry) => ({ mode: entry.mode, count: entry._count.mode })),
      timeline: [...days.values()],
      recentRuns: recentRuns.map((run) => ({
        id: run.id,
        scraperId: run.scraperId,
        scraper: run.scraper.name,
        mode: run.mode,
        status: run.status,
        itemCount: run.itemCount,
        startedAt: run.startedAt,
        durationMs: run.durationMs,
      })),
    };
  });
}
