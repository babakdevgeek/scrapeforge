import type { FastifyInstance } from 'fastify';
import { buildPreview, describeSelector } from '../services/selector-preview.js';

export default async function selectorRoutes(app: FastifyInstance) {
  app.get('/api/selector/preview', async (request, reply) => {
    const { url } = request.query as { url?: string };
    if (!url) return reply.code(400).send({ error: 'url query parameter is required' });
    try {
      const html = await buildPreview(url);
      return reply.header('Content-Type', 'text/html; charset=utf-8').send(html);
    } catch (error) {
      return reply.code(502).send({ error: `Could not load preview: ${(error as Error).message}` });
    }
  });

  app.post('/api/selector/test', async (request, reply) => {
    const { url, selector } = (request.body ?? {}) as { url?: string; selector?: string };
    if (!url || !selector) return reply.code(400).send({ error: 'url and selector are required' });
    try {
      return await describeSelector(url, selector);
    } catch (error) {
      return reply.code(502).send({ error: (error as Error).message });
    }
  });
}
