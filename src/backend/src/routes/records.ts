import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/db.js';
import { collectColumns, toCsv, toJson, toXlsx } from '../services/exporters.js';

type Row = Record<string, unknown>;

function parseRecords(records: { id: number; data: string; createdAt: Date; runId: string | null }[]): Row[] {
  return records.map((record) => ({
    _id: record.id,
    _run: record.runId,
    _scraped_at: record.createdAt.toISOString(),
    ...(JSON.parse(record.data) as Row),
  }));
}

function compare(a: unknown, b: unknown) {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true });
}

export default async function recordRoutes(app: FastifyInstance) {
  app.get('/api/records', async (request) => {
    const query = request.query as {
      scraperId?: string;
      runId?: string;
      search?: string;
      sort?: string;
      dir?: 'asc' | 'desc';
      page?: string;
      pageSize?: string;
    };
    const page = Math.max(1, Number(query.page ?? 1));
    const pageSize = Math.min(500, Math.max(5, Number(query.pageSize ?? 50)));

    const records = await prisma.scrapedRecord.findMany({
      where: { scraperId: query.scraperId || undefined, runId: query.runId || undefined },
      orderBy: { id: 'desc' },
      take: 20000,
    });

    let rows = parseRecords(records);
    if (query.search) {
      const needle = query.search.toLowerCase();
      rows = rows.filter((row) => JSON.stringify(row).toLowerCase().includes(needle));
    }
    if (query.sort) {
      const key = query.sort;
      rows.sort((a, b) => (query.dir === 'desc' ? compare(b[key], a[key]) : compare(a[key], b[key])));
    }

    const start = (page - 1) * pageSize;
    return {
      columns: collectColumns(rows),
      total: rows.length,
      page,
      pageSize,
      rows: rows.slice(start, start + pageSize),
    };
  });

  app.delete('/api/records', async (request) => {
    const query = request.query as { scraperId?: string; runId?: string };
    const { count } = await prisma.scrapedRecord.deleteMany({
      where: { scraperId: query.scraperId || undefined, runId: query.runId || undefined },
    });
    return { deleted: count };
  });

  app.get('/api/records/export', async (request, reply) => {
    const query = request.query as {
      scraperId?: string;
      runId?: string;
      format?: 'json' | 'csv' | 'xlsx';
      columns?: string;
    };
    const format = query.format ?? 'json';

    const records = await prisma.scrapedRecord.findMany({
      where: { scraperId: query.scraperId || undefined, runId: query.runId || undefined },
      orderBy: { id: 'asc' },
    });

    let rows = parseRecords(records);
    if (query.columns) {
      const keep = query.columns.split(',').filter(Boolean);
      rows = rows.map((row) => Object.fromEntries(keep.map((k) => [k, row[k]])));
    }

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const base = 'scrapeforge-' + stamp;

    if (format === 'csv') {
      return reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="${base}.csv"`)
        .send(toCsv(rows));
    }
    if (format === 'xlsx') {
      const buffer = await toXlsx(rows);
      return reply
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header('Content-Disposition', `attachment; filename="${base}.xlsx"`)
        .send(buffer);
    }
    return reply
      .header('Content-Type', 'application/json')
      .header('Content-Disposition', `attachment; filename="${base}.json"`)
      .send(toJson(rows));
  });
}
