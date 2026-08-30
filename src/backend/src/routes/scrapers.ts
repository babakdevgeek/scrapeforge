import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/db.js';
import { validateConfig } from '../schemas/scraper-config.js';

interface ScraperRow {
  id: string;
  name: string;
  description: string | null;
  mode: string;
  config: string;
  tags: string;
  favorite: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function serialize(scraper: ScraperRow) {
  return {
    ...scraper,
    config: JSON.parse(scraper.config) as unknown,
    tags: scraper.tags ? scraper.tags.split(',').filter(Boolean) : [],
  };
}

export default async function scraperRoutes(app: FastifyInstance) {
  app.get('/api/scrapers', async () => {
    const scrapers = await prisma.scraper.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        runs: { orderBy: { startedAt: 'desc' }, take: 1 },
        _count: { select: { records: true, runs: true, versions: true } },
      },
    });

    return scrapers.map((scraper) => ({
      ...serialize(scraper),
      records: scraper._count.records,
      runCount: scraper._count.runs,
      versionCount: scraper._count.versions,
      lastRun: scraper.runs[0]
        ? {
            id: scraper.runs[0].id,
            status: scraper.runs[0].status,
            startedAt: scraper.runs[0].startedAt,
            itemCount: scraper.runs[0].itemCount,
            durationMs: scraper.runs[0].durationMs,
          }
        : null,
    }));
  });

  app.get('/api/scrapers/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const scraper = await prisma.scraper.findUnique({
      where: { id },
      include: {
        versions: { orderBy: { version: 'desc' }, take: 25 },
        runs: { orderBy: { startedAt: 'desc' }, take: 10 },
      },
    });
    if (!scraper) return reply.code(404).send({ error: 'Scraper not found' });
    return { ...serialize(scraper), versions: scraper.versions, runs: scraper.runs };
  });

  app.post('/api/scrapers', async (request, reply) => {
    const { name, description, config, tags } = request.body as {
      name?: string;
      description?: string;
      config: unknown;
      tags?: string[];
    };
    const parsed = validateConfig(config);
    if (!parsed.ok) return reply.code(400).send({ error: 'Invalid configuration', details: parsed.errors });

    const serialized = JSON.stringify(config, null, 2);
    const scraper = await prisma.scraper.create({
      data: {
        name: name?.trim() || 'Untitled scraper',
        description,
        mode: parsed.config.mode,
        config: serialized,
        tags: (tags ?? []).join(','),
        versions: { create: { version: 1, config: serialized, note: 'Initial version' } },
      },
    });
    return reply.code(201).send(serialize(scraper));
  });

  app.patch('/api/scrapers/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.scraper.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: 'Scraper not found' });

    const { name, description, config, tags, favorite, note } = request.body as {
      name?: string;
      description?: string;
      config?: unknown;
      tags?: string[];
      favorite?: boolean;
      note?: string;
    };

    let mode = existing.mode;
    let configString = existing.config;

    if (config !== undefined) {
      const parsed = validateConfig(config);
      if (!parsed.ok) return reply.code(400).send({ error: 'Invalid configuration', details: parsed.errors });
      mode = parsed.config.mode;
      configString = JSON.stringify(config, null, 2);
    }

    if (configString !== existing.config) {
      const last = await prisma.scraperVersion.findFirst({ where: { scraperId: id }, orderBy: { version: 'desc' } });
      await prisma.scraperVersion.create({
        data: {
          scraperId: id,
          version: (last?.version ?? 0) + 1,
          config: configString,
          note: note ?? 'Config updated',
        },
      });
    }

    const scraper = await prisma.scraper.update({
      where: { id },
      data: {
        name: name?.trim() ?? existing.name,
        description: description ?? existing.description,
        mode,
        config: configString,
        favorite: favorite ?? existing.favorite,
        tags: tags ? tags.join(',') : existing.tags,
      },
    });
    return serialize(scraper);
  });

  app.post('/api/scrapers/:id/duplicate', async (request, reply) => {
    const { id } = request.params as { id: string };
    const source = await prisma.scraper.findUnique({ where: { id } });
    if (!source) return reply.code(404).send({ error: 'Scraper not found' });

    const copy = await prisma.scraper.create({
      data: {
        name: `${source.name} (copy)`,
        description: source.description,
        mode: source.mode,
        config: source.config,
        tags: source.tags,
        versions: { create: { version: 1, config: source.config, note: `Duplicated from ${source.name}` } },
      },
    });
    return reply.code(201).send(serialize(copy));
  });

  app.post('/api/scrapers/:id/versions/:version/restore', async (request, reply) => {
    const { id, version: versionParam } = request.params as { id: string; version: string };
    const version = await prisma.scraperVersion.findFirst({
      where: { scraperId: id, version: Number(versionParam) },
    });
    if (!version) return reply.code(404).send({ error: 'Version not found' });

    const last = await prisma.scraperVersion.findFirst({ where: { scraperId: id }, orderBy: { version: 'desc' } });
    await prisma.scraperVersion.create({
      data: {
        scraperId: id,
        version: (last?.version ?? 0) + 1,
        config: version.config,
        note: `Restored v${version.version}`,
      },
    });
    const scraper = await prisma.scraper.update({ where: { id }, data: { config: version.config } });
    return serialize(scraper);
  });

  app.delete('/api/scrapers/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.scraper.delete({ where: { id } }).catch(() => null);
    return reply.code(204).send();
  });

  app.post('/api/scrapers/import', async (request, reply) => {
    const { configs } = request.body as { configs: { name?: string; description?: string; config: unknown }[] };
    const created: unknown[] = [];
    const failed: { name?: string; errors: string[] }[] = [];

    for (const entry of configs ?? []) {
      const parsed = validateConfig(entry.config);
      if (!parsed.ok) {
        failed.push({ name: entry.name, errors: parsed.errors });
        continue;
      }
      const serialized = JSON.stringify(entry.config, null, 2);
      const scraper = await prisma.scraper.create({
        data: {
          name: entry.name?.trim() || 'Imported scraper',
          description: entry.description,
          mode: parsed.config.mode,
          config: serialized,
          versions: { create: { version: 1, config: serialized, note: 'Imported' } },
        },
      });
      created.push(serialize(scraper));
    }

    return reply.code(created.length ? 201 : 400).send({ created, failed });
  });

  app.post('/api/validate', async (request) => {
    const { config } = (request.body ?? {}) as { config?: unknown };
    const parsed = validateConfig(config);
    return { valid: parsed.ok, errors: parsed.errors };
  });
}
