import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/db.js';
import { runBus } from '../lib/bus.js';
import { cancelRun, startRun } from '../services/runner.js';

export default async function runRoutes(app: FastifyInstance) {
  app.post('/api/scrapers/:id/run', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { config?: unknown; limitPages?: number };
    try {
      const run = await startRun(id, body);
      return reply.code(202).send(run);
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  app.get('/api/runs', async (request) => {
    const { scraperId, status, limit } = request.query as { scraperId?: string; status?: string; limit?: string };
    return prisma.run.findMany({
      where: { scraperId: scraperId || undefined, status: status || undefined },
      orderBy: { startedAt: 'desc' },
      take: Math.min(Number(limit ?? 50), 200),
      include: { scraper: { select: { name: true, mode: true } } },
    });
  });

  app.get('/api/runs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const run = await prisma.run.findUnique({
      where: { id },
      include: {
        scraper: { select: { id: true, name: true, mode: true } },
        logs: { orderBy: { id: 'asc' }, take: 1000 },
      },
    });
    if (!run) return reply.code(404).send({ error: 'Run not found' });
    return run;
  });

  app.post('/api/runs/:id/cancel', async (request) => {
    const { id } = request.params as { id: string };
    cancelRun(id);
    return { cancelled: true };
  });

  app.delete('/api/runs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.run.delete({ where: { id } }).catch(() => null);
    return reply.code(204).send();
  });

  /** Server-sent events: live logs, progress and freshly extracted items. */
  app.get('/api/runs/:id/stream', async (request, reply) => {
    const { id: runId } = request.params as { id: string };

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const send = (event: unknown) => reply.raw.write('data: ' + JSON.stringify(event) + '\n\n');
    for (const buffered of runBus.replay(runId)) send(buffered);

    const listener = (event: unknown) => send(event);
    runBus.on(runId, listener);
    const heartbeat = setInterval(() => reply.raw.write(': ping\n\n'), 15000);

    request.raw.on('close', () => {
      clearInterval(heartbeat);
      runBus.off(runId, listener);
    });
  });
}
