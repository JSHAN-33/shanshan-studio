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

  // Debug endpoint removed for production security
}
