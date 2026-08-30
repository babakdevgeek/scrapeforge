import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/db.js';
import { getStore, inferColumns, safeName } from '../database/index.js';
import { env } from '../lib/config.js';
import { list as listPlugins } from '../plugins/index.js';

export default async function datastoreRoutes(app: FastifyInstance) {
  app.get('/api/datastore', async (_request, reply) => {
    try {
      const store = await getStore();
      return { driver: store.driver, tables: await store.listTables(), plugins: listPlugins(), config: env.dataStore };
    } catch (error) {
      return reply.code(500).send({ error: (error as Error).message, plugins: listPlugins() });
    }
  });

  app.get('/api/datastore/tables/:table', async (request) => {
    const { table } = request.params as { table: string };
    const { limit, offset } = request.query as { limit?: string; offset?: string };
    const store = await getStore();
    return { table, rows: await store.read(table, Number(limit ?? 100), Number(offset ?? 0)) };
  });

  app.delete('/api/datastore/tables/:table', async (request, reply) => {
    const { table } = request.params as { table: string };
    const store = await getStore();
    await store.drop(table);
    return reply.code(204).send();
  });

  /** Preview the DDL ScrapeForge would generate from a scraper's records. */
  app.get('/api/datastore/ddl', async (request, reply) => {
    const { scraperId, table } = request.query as { scraperId?: string; table?: string };
    if (!scraperId) return reply.code(400).send({ error: 'scraperId is required' });

    const records = await prisma.scrapedRecord.findMany({ where: { scraperId }, take: 200 });
    if (!records.length) return { ddl: null, columns: [], message: 'No records yet. Run the scraper first.' };

    const rows = records.map((r) => JSON.parse(r.data) as Record<string, unknown>);
    const columns = inferColumns(rows);
    const tableName = safeName(table ?? 'scraped_items');
    const ddl =
      `CREATE TABLE ${tableName} (\n  id INTEGER PRIMARY KEY,\n` +
      columns.map((c) => `  ${c.name} ${c.type === 'JSON' || c.type === 'BOOLEAN' ? 'TEXT' : c.type}`).join(',\n') +
      '\n);';
    return { ddl, columns, sampleSize: rows.length };
  });

  /** Push a scraper's stored records into a destination table. */
  app.post('/api/datastore/sync', async (request, reply) => {
    const { scraperId, table, mode = 'append', dedupeOn, driver } = (request.body ?? {}) as {
      scraperId?: string;
      table?: string;
      mode?: 'append' | 'upsert' | 'replace';
      dedupeOn?: string[];
      driver?: 'sqlite' | 'postgres';
    };
    if (!scraperId || !table) return reply.code(400).send({ error: 'scraperId and table are required' });

    const records = await prisma.scrapedRecord.findMany({ where: { scraperId }, orderBy: { id: 'asc' } });
    if (!records.length) return reply.code(400).send({ error: 'Nothing to sync: this scraper has no records' });

    const rows = records.map((r) => JSON.parse(r.data) as Record<string, unknown>);
    try {
      const store = await getStore(driver);
      return await store.write(rows, { table, mode, dedupeOn });
    } catch (error) {
      return reply.code(500).send({ error: (error as Error).message });
    }
  });
}
