import type { FastifyInstance } from 'fastify';
import { examples } from '../examples/index.js';

export default async function exampleRoutes(app: FastifyInstance) {
  app.get('/api/examples', async () => examples);
}
