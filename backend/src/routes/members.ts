import type { FastifyInstance } from 'fastify';
import { adminAuth } from '../middleware/adminAuth.js';
import { upsertMemberSchema, walletAdjustSchema } from '../schemas/member.js';

export async function membersRoutes(app: FastifyInstance) {
  // GET /members  —— admin only
  app.get('/', { preHandler: adminAuth }, async () => {
    const members = await app.prisma.member.findMany({
      orderBy: { updatedAt: 'desc' },
    });
    return { members };
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
        lineUserId: input.lineUserId ?? undefined,
      },
      create: input,
    });
    return { member };
  });

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
