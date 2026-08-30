import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './lib/config.js';
import scraperRoutes from './routes/scrapers.js';
import runRoutes from './routes/runs.js';
import recordRoutes from './routes/records.js';
import statsRoutes from './routes/stats.js';
import selectorRoutes from './routes/selector.js';
import datastoreRoutes from './routes/datastore.js';
import exampleRoutes from './routes/examples.js';

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
  bodyLimit: 20 * 1024 * 1024,
});

await app.register(cors, { origin: true, credentials: true });

app.get('/api/health', async () => ({
  status: 'ok',
  uptime: process.uptime(),
  dataStore: env.dataStore.driver,
}));

await app.register(scraperRoutes);
await app.register(runRoutes);
await app.register(recordRoutes);
await app.register(statsRoutes);
await app.register(selectorRoutes);
await app.register(datastoreRoutes);
await app.register(exampleRoutes);

app.setErrorHandler((error, _request, reply) => {
  app.log.error(error);
  reply.code(error.statusCode ?? 500).send({ error: error.message });
});

try {
  await app.listen({ port: env.port, host: '127.0.0.1' });
  app.log.info(`ScrapeForge API ready on http://localhost:${env.port}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
