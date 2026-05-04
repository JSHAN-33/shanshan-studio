import type { FastifyInstance } from 'fastify';
import { adminAuth } from '../middleware/adminAuth.js';
import {
  createServiceHistorySchema,
  updateServiceHistorySchema,
  listServiceHistoryQuery,
} from '../schemas/serviceHistory.js';
import { buildPhoneOwnerAuth } from '../middleware/phoneOwnerAuth.js';

export async function serviceHistoryRoutes(app: FastifyInstance) {
  const phoneOwnerAuth = buildPhoneOwnerAuth(app);

  // GET /service-history?phone=xxx  —— 顧客查自己的（需驗證身份）
  app.get('/', async (req, reply) => {
    const { phone } = listServiceHistoryQuery.parse(req.query);
    await phoneOwnerAuth(req, reply);
    if (reply.sent) return;

    const items = await app.prisma.serviceHistory.findMany({
      where: { phone },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
    return { items };
  });

  // POST /service-history  —— admin only
  app.post('/', { preHandler: adminAuth }, async (req) => {
    const input = createServiceHistorySchema.parse(req.body);
    const item = await app.prisma.serviceHistory.create({ data: input });
    return { item };
  });

  // PATCH /service-history/:id  —— admin only
  app.patch<{ Params: { id: string } }>(
    '/:id',
    { preHandler: adminAuth },
    async (req, reply) => {
      const { id } = req.params;
      const input = updateServiceHistorySchema.parse(req.body);
      const existing = await app.prisma.serviceHistory.findUnique({ where: { id } });
      if (!existing) return reply.status(404).send({ error: 'NotFound' });
      const item = await app.prisma.serviceHistory.update({ where: { id }, data: input });
      return { item };
    }
  );

  // DELETE /service-history/:id  —— admin only
  app.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: adminAuth },
    async (req, reply) => {
      const { id } = req.params;
      const existing = await app.prisma.serviceHistory.findUnique({ where: { id } });
      if (!existing) return reply.status(404).send({ error: 'NotFound' });
      await app.prisma.serviceHistory.delete({ where: { id } });
      return reply.status(204).send();
    }
  );
}
