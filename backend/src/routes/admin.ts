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

  // 一次性修正：server 啟動時自動將已結帳且有預約金的訂單 depositAmount 加回 total
  // 用 SystemSetting flag 確保只執行一次，之後可移除此段程式碼
  app.addHook('onReady', async () => {
    try {
      const flag = await app.prisma.systemSetting.findUnique({ where: { key: 'fix_deposit_totals_done' } });
      if (flag) return; // 已執行過

      const rows = await app.prisma.booking.findMany({
        where: {
          paidAt: { not: null },
          depositStatus: '已付訂金',
          depositAmount: { gt: 0 },
        },
        select: { id: true, name: true, date: true, total: true, depositAmount: true },
      });

      let fixed = 0;
      for (const r of rows) {
        const newTotal = r.total + (r.depositAmount ?? 0);
        await app.prisma.booking.update({
          where: { id: r.id },
          data: { total: newTotal },
        });
        fixed++;
        console.log(`[fix-deposit] ${r.name} ${r.date}: ${r.total} → ${newTotal} (+${r.depositAmount})`);
      }

      // 標記已完成
      await app.prisma.systemSetting.create({ data: { key: 'fix_deposit_totals_done', value: String(fixed) } });
      console.log(`[fix-deposit] 修正完成，共 ${fixed} 筆`);
    } catch (err) {
      console.error('[fix-deposit] 修正失敗:', err);
    }
  });
}
