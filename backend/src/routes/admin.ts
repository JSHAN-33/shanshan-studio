import type { FastifyInstance } from 'fastify';

/**
 * POST /api/admin/login
 * 驗證 admin token。成功回 200，失敗回 401。
 * 前端用這支來確認使用者輸入的密碼正確，之後再把密碼塞到 axios header。
 */
export async function adminRoutes(app: FastifyInstance) {
  app.post('/login', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { token } = (req.body ?? {}) as { token?: string };
    if (!token || token !== process.env.ADMIN_TOKEN) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
    return { ok: true };
  });

  // 一次性修正：把已結帳且有預約金的訂單，將 depositAmount 加回 total
  app.post('/fix-deposit-totals', async (req, reply) => {
    const { token } = (req.body ?? {}) as { token?: string };
    if (!token || token !== process.env.ADMIN_TOKEN) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const rows = await app.prisma.booking.findMany({
      where: {
        paidAt: { not: null },
        depositStatus: '已付訂金',
        depositAmount: { gt: 0 },
      },
      select: { id: true, name: true, date: true, total: true, depositAmount: true },
    });

    const results = [];
    for (const r of rows) {
      const newTotal = r.total + (r.depositAmount ?? 0);
      await app.prisma.booking.update({
        where: { id: r.id },
        data: { total: newTotal },
      });
      results.push({
        id: r.id,
        name: r.name,
        date: r.date,
        oldTotal: r.total,
        deposit: r.depositAmount,
        newTotal,
      });
    }

    return { fixed: results.length, results };
  });
}
