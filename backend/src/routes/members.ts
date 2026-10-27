import type { FastifyInstance } from 'fastify';
import { adminAuth } from '../middleware/adminAuth.js';
import { upsertMemberSchema, walletAdjustSchema } from '../schemas/member.js';
import {
  buildWalletDepositMessage,
  buildWalletDeductMessage,
  buildWalletRefundMessage,
  pushToUser,
} from '../services/lineNotifyService.js';
import { buildPhoneOwnerAuth } from '../middleware/phoneOwnerAuth.js';

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
  // 只回傳最少必要欄位，不���露 lineUserId 等敏感資訊
  app.get<{ Params: { phone: string } }>('/:phone', async (req, reply) => {
    const member = await app.prisma.member.findUnique({
      where: { phone: req.params.phone },
      select: { name: true, phone: true, gender: true, bday: true, vip: true, wallet: true, pictureUrl: true, note: true },
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
      const { delta, reason, type: txType, bookingId, bonus } = walletAdjustSchema.parse(req.body);
      const existing = await app.prisma.member.findUnique({ where: { phone } });
      if (!existing) return reply.status(404).send({ error: 'NotFound' });

      const newBalance = existing.wallet + delta;
      // 自動推斷 type：正數預設 deposit，負數預設 adjust
      const walletType = txType ?? (delta > 0 ? 'deposit' : 'adjust');

      const [member] = await app.prisma.$transaction([
        app.prisma.member.update({
          where: { phone },
          data: { wallet: newBalance },
        }),
        app.prisma.walletTransaction.create({
          data: {
            memberId: existing.id,
            type: walletType,
            amount: Math.abs(delta),
            balanceAfter: newBalance,
            bookingId: bookingId ?? undefined,
            reason: reason ?? undefined,
          },
        }),
      ]);

      // LINE 通知：deposit / deduct 發通知，adjust 不發
      const pushUid = existing.lineOaUserId ?? existing.lineUserId;
      if (pushUid) {
        if (walletType === 'deposit' && delta > 0) {
          pushToUser(pushUid, buildWalletDepositMessage({
            name: existing.name,
            amount: bonus ? delta - bonus : delta,
            balance: newBalance,
            bonus: bonus ?? undefined,
          })).catch((err) => console.error('[LINE] wallet deposit push failed', err));
        } else if (walletType === 'deduct') {
          // 取得 booking items 用於通知
          let items = '';
          if (bookingId) {
            const bk = await app.prisma.booking.findUnique({ where: { id: bookingId } });
            if (bk) items = bk.items;
          }
          pushToUser(pushUid, buildWalletDeductMessage({
            amount: Math.abs(delta),
            balance: newBalance,
            items,
          })).catch((err) => console.error('[LINE] wallet deduct push failed', err));
        }
      }

      return { member };
    }
  );

  // GET /members/:phone/wallet-transactions  —— 公開（顧客可查自己的）
  const phoneOwnerAuth = buildPhoneOwnerAuth(app);
  app.get<{ Params: { phone: string } }>(
    '/:phone/wallet-transactions',
    async (req, reply) => {
      await phoneOwnerAuth(req, reply);
      if (reply.sent) return;

      const { phone } = req.params;
      const member = await app.prisma.member.findUnique({ where: { phone } });
      if (!member) return reply.status(404).send({ error: 'NotFound' });

      const transactions = await app.prisma.walletTransaction.findMany({
        where: { memberId: member.id },
        orderBy: { createdAt: 'desc' },
      });
      return { transactions };
    }
  );
}
