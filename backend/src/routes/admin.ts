import type { FastifyInstance } from 'fastify';

/**
 * POST /api/admin/login
 * 驗證 admin token。成功回 200，失敗回 401。
 * 前端用這支來確認使用者輸入的密碼正確，之後再把密碼塞到 axios header。
 */
export async function adminRoutes(app: FastifyInstance) {
  app.post('/login', async (req, reply) => {
    const { token } = (req.body ?? {}) as { token?: string };
    if (!token || token !== process.env.ADMIN_TOKEN) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
    return { ok: true };
  });

  // Debug: 查詢 LINE 推播狀態
  app.get('/debug-line', async (req, reply) => {
    const adminToken = (req.query as { token?: string }).token;
    if (!adminToken || adminToken !== process.env.ADMIN_TOKEN) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
    const members = await app.prisma.member.findMany({
      select: { name: true, phone: true, lineUserId: true, lineOaUserId: true },
      take: 30,
    });
    return {
      env: {
        hasAccessToken: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
        hasChannelSecret: !!process.env.LINE_CHANNEL_SECRET,
        hasChannelId: !!process.env.LINE_CHANNEL_ID,
        hasOwnerUserId: !!process.env.LINE_OWNER_USER_ID,
      },
      members: members.map((m) => ({
        name: m.name,
        phone: m.phone,
        hasLiffId: !!m.lineUserId,
        hasOaId: !!m.lineOaUserId,
        liffId: m.lineUserId?.slice(0, 8) + '...',
        oaId: m.lineOaUserId ? m.lineOaUserId.slice(0, 8) + '...' : null,
      })),
    };
  });
}
