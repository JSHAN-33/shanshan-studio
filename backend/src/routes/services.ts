import type { FastifyInstance } from 'fastify';
import { adminAuth } from '../middleware/adminAuth.js';
import { createServiceSchema, updateServiceSchema } from '../schemas/service.js';

export async function servicesRoutes(app: FastifyInstance) {
  // GET /services  —— 公開
  app.get('/', async (req) => {
    const { includeInactive } = req.query as { includeInactive?: string };
    const services = await app.prisma.service.findMany({
      where: includeInactive === 'true' ? {} : { isActive: true },
      orderBy: [{ cat: 'asc' }, { sortOrder: 'asc' }],
    });
    return { services };
  });

  // POST /services  —— admin only
  app.post('/', { preHandler: adminAuth }, async (req) => {
    const input = createServiceSchema.parse(req.body);
    const service = await app.prisma.service.create({ data: input });
    return { service };
  });

  // PATCH /services/:id  —— admin only
  app.patch<{ Params: { id: string } }>('/:id', { preHandler: adminAuth }, async (req, reply) => {
    const input = updateServiceSchema.parse(req.body);
    const existing = await app.prisma.service.findUnique({ where: { id: req.params.id } });
    if (!existing) return reply.status(404).send({ error: 'NotFound' });
    const service = await app.prisma.service.update({
      where: { id: req.params.id },
      data: input,
    });
    return { service };
  });

  // DELETE /services/:id  —— 軟刪除（設 isActive=false）
  app.delete<{ Params: { id: string } }>('/:id', { preHandler: adminAuth }, async (req, reply) => {
    const existing = await app.prisma.service.findUnique({ where: { id: req.params.id } });
    if (!existing) return reply.status(404).send({ error: 'NotFound' });
    await app.prisma.service.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    return reply.status(204).send();
  });
}
