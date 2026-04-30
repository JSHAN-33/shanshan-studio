import type { FastifyInstance } from 'fastify';
import { adminAuth } from '../middleware/adminAuth.js';
import { createCostSchema, listCostsQuery, updateCostSchema } from '../schemas/cost.js';

export async function costsRoutes(app: FastifyInstance) {
  // GET /costs?month=YYYY-MM&cat=xxx  —— admin only
  app.get('/', { preHandler: adminAuth }, async (req) => {
    const { month, cat } = listCostsQuery.parse(req.query);
    const where: Record<string, unknown> = {};
    if (month) where.date = { startsWith: month };
    if (cat) where.cat = cat;
    const costs = await app.prisma.cost.findMany({
      where,
      orderBy: { date: 'desc' },
    });
    return { costs };
  });

  // POST /costs  —— admin only
  app.post('/', { preHandler: adminAuth }, async (req) => {
    const input = createCostSchema.parse(req.body);
    const cost = await app.prisma.cost.create({ data: input });
    return { cost };
  });

  // PATCH /costs/:id  —— admin only
  app.patch<{ Params: { id: string } }>('/:id', { preHandler: adminAuth }, async (req, reply) => {
    const existing = await app.prisma.cost.findUnique({ where: { id: req.params.id } });
    if (!existing) return reply.status(404).send({ error: 'NotFound' });
    const input = updateCostSchema.parse(req.body);
    const cost = await app.prisma.cost.update({ where: { id: req.params.id }, data: input });
    return { cost };
  });

  // DELETE /costs/:id  —— admin only
  app.delete<{ Params: { id: string } }>('/:id', { preHandler: adminAuth }, async (req, reply) => {
    const existing = await app.prisma.cost.findUnique({ where: { id: req.params.id } });
    if (!existing) return reply.status(404).send({ error: 'NotFound' });
    await app.prisma.cost.delete({ where: { id: req.params.id } });
    return reply.status(204).send();
  });
}
