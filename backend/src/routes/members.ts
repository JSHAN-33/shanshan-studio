import type { FastifyInstance } from 'fastify';
import { adminAuth } from '../middleware/adminAuth.js';
import { upsertMemberSchema, walletAdjustSchema } from '../schemas/member.js';

export async function membersRoutes(app: FastifyInstance) {
  // GET /members  —— admin only
  app.get('/', { preHandler: adminAuth }, async () => {
    const members = await app.prisma.member.findMany({
      orderBy: { updatedAt: 'desc' },
    });

    // 批量取得每位會員的預約次數和最後到訪日期
    const phones = members.map((m) => m.phone);
    const bookingStats = await app.prisma.booking.groupBy({
      by: ['phone'],
      where: { phone: { in: phones }, status: { not: '已取消' } },
      _count: true,
    });
    const lastVisits = await app.prisma.booking.groupBy({
      by: ['phone'],
      where: { phone: { in: phones }, status: '已完成' },
      _max: { date: true },
    });

    const countMap = new Map(bookingStats.map((s) => [s.phone, s._count]));
    const visitMap = new Map(lastVisits.map((s) => [s.phone, s._max.date]));

    const enriched = members.map((m) => ({
      ...m,
      bookingCount: countMap.get(m.phone) ?? 0,
      lastVisitAt: visitMap.get(m.phone) ?? null,
    }));

    return { members: enriched };
  });

  // GET /members/:phone  —— 公開（顧客端判斷新客折扣用）
  app.get<{ Params: { phone: string } }>('/:phone', async (req, reply) => {
    const member = await app.prisma.member.findUnique({
      where: { phone: req.params.phone },
    });
    if (!member) return reply.status(404).send({ error: 'NotFound' });

    // 統計預約次數
    const bookingCount = await app.prisma.booking.count({
      where: { phone: req.params.phone, status: { not: '已取消' } },
    });
    return { member: { ...member, bookingCount } };
  });

  // POST /members  —— admin only（新增/更新）
  app.post('/', { preHandler: adminAuth }, async (req) => {
    const input = upsertMemberSchema.parse(req.body);
    const member = await app.prisma.member.upsert({
      where: { phone: input.phone },
      update: {
        name: input.name,
        bday: input.bday ?? undefined,
        gender: input.gender ?? undefined,
        note: input.note ?? undefined,
        vip: input.vip ?? undefined,
        lineUserId: input.lineUserId ?? undefined,
      },
      create: input,
    });
    return { member };
  });

  // DELETE /members/:phone  —— admin only
  app.delete<{ Params: { phone: string } }>(
    '/:phone',
    { preHandler: adminAuth },
    async (req, reply) => {
      const { phone } = req.params;
      const existing = await app.prisma.member.findUnique({ where: { phone } });
      if (!existing) return reply.status(404).send({ error: 'NotFound' });
      await app.prisma.member.delete({ where: { phone } });
      return reply.status(204).send();
    }
  );

  // PATCH /members/:phone/wallet  —— admin only
  app.patch<{ Params: { phone: string } }>(
    '/:phone/wallet',
    { preHandler: adminAuth },
    async (req, reply) => {
      const { phone } = req.params;
      const { delta } = walletAdjustSchema.parse(req.body);
      const existing = await app.prisma.member.findUnique({ where: { phone } });
      if (!existing) return reply.status(404).send({ error: 'NotFound' });

      const member = await app.prisma.member.update({
        where: { phone },
        data: { wallet: existing.wallet + delta },
      });
      return { member };
    }
  );
}
