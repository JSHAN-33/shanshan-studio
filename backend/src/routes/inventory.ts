import type { FastifyInstance } from 'fastify';
import { adminAuth } from '../middleware/adminAuth.js';
import { createInventorySchema, updateInventorySchema } from '../schemas/inventory.js';

export async function inventoryRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: adminAuth }, async () => {
    const items = await app.prisma.inventory.findMany({
      orderBy: { name: 'asc' },
    });
    const lowStock = items.filter((i) => i.qty <= i.minQty);
    return { items, lowStock };
  });

  app.post('/', { preHandler: adminAuth }, async (req) => {
    const input = createInventorySchema.parse(req.body);
    const item = await app.prisma.inventory.create({ data: input });
    return { item };
  });

  app.patch<{ Params: { id: string } }>('/:id', { preHandler: adminAuth }, async (req, reply) => {
    const input = updateInventorySchema.parse(req.body);
    const existing = await app.prisma.inventory.findUnique({ where: { id: req.params.id } });
    if (!existing) return reply.status(404).send({ error: 'NotFound' });
    const item = await app.prisma.inventory.update({
      where: { id: req.params.id },
      data: input,
    });
    return { item };
  });

  app.delete<{ Params: { id: string } }>('/:id', { preHandler: adminAuth }, async (req, reply) => {
    const existing = await app.prisma.inventory.findUnique({ where: { id: req.params.id } });
    if (!existing) return reply.status(404).send({ error: 'NotFound' });
    await app.prisma.inventory.delete({ where: { id: req.params.id } });
    return reply.status(204).send();
  });
}
