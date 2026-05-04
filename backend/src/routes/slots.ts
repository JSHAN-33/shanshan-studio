import type { FastifyInstance } from 'fastify';
import { adminAuth } from '../middleware/adminAuth.js';
import { blockedSlotSchema, slotConfigSchema } from '../schemas/slot.js';

export async function slotsRoutes(app: FastifyInstance) {
  // GET /slots/config  —— 公開（前端需要知道可預約時段）
  app.get('/config', async () => {
    const config = await app.prisma.slotConfig.findFirst();
    return { slots: (config?.slots as string[] | undefined) ?? [] };
  });

  // PUT /slots/config  —— admin only
  app.put('/config', { preHandler: adminAuth }, async (req) => {
    const { slots } = slotConfigSchema.parse(req.body);
    const existing = await app.prisma.slotConfig.findFirst();
    const config = existing
      ? await app.prisma.slotConfig.update({ where: { id: existing.id }, data: { slots } })
      : await app.prisma.slotConfig.create({ data: { slots } });
    return { slots: config.slots };
  });

  // GET /slots/blocked?month=YYYY-MM  —— 公開（前端日曆顯示封鎖）
  app.get('/blocked', async (req) => {
    const { month } = req.query as { month?: string };
    const where = month ? { date: { startsWith: month } } : {};
    const blocked = await app.prisma.blockedSlot.findMany({ where });
    return { blocked };
  });

  // POST /slots/blocked  —— admin only
  app.post('/blocked', { preHandler: adminAuth }, async (req, reply) => {
    const input = blockedSlotSchema.parse(req.body);
    try {
      const blocked = await app.prisma.blockedSlot.create({ data: input });
      return reply.status(201).send({ blocked });
    } catch {
      return reply.status(409).send({ error: 'AlreadyBlocked' });
    }
  });

  // DELETE /slots/blocked  —— admin only
  app.delete('/blocked', { preHandler: adminAuth }, async (req, reply) => {
    const input = blockedSlotSchema.parse(req.body);
    await app.prisma.blockedSlot.deleteMany({ where: input });
    return reply.status(204).send();
  });

  // GET /slots/forced-open?month=YYYY-MM  —— admin only
  app.get('/forced-open', { preHandler: adminAuth }, async (req) => {
    const { month } = req.query as { month?: string };
    const where = month ? { date: { startsWith: month } } : {};
    const items = await app.prisma.forcedOpenSlot.findMany({ where });
    return { forcedOpen: items };
  });

  // POST /slots/forced-open  —— admin only（強制開放已預約時段）
  app.post('/forced-open', { preHandler: adminAuth }, async (req, reply) => {
    const input = blockedSlotSchema.parse(req.body);
    try {
      const item = await app.prisma.forcedOpenSlot.create({ data: input });
      return reply.status(201).send({ forcedOpen: item });
    } catch {
      return reply.status(409).send({ error: 'AlreadyForcedOpen' });
    }
  });

  // DELETE /slots/forced-open  —— admin only
  app.delete('/forced-open', { preHandler: adminAuth }, async (req, reply) => {
    const input = blockedSlotSchema.parse(req.body);
    await app.prisma.forcedOpenSlot.deleteMany({ where: input });
    return reply.status(204).send();
  });
}
