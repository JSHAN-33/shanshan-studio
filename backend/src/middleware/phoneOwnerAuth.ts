import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

/**
 * 驗證請求者擁有該手機號碼：
 * - admin（帶有效的 X-Admin-Token）直接放行
 * - 一般使用者需帶 X-Line-User-Id header，且該 lineUserId 對應的會員手機號碼必須與請求的 phone 一致
 */
export function buildPhoneOwnerAuth(app: FastifyInstance) {
  return async function phoneOwnerAuth(req: FastifyRequest, reply: FastifyReply) {
    // admin 直接放行
    const adminToken = req.headers['x-admin-token'];
    if (typeof adminToken === 'string' && adminToken === process.env.ADMIN_TOKEN) {
      return;
    }

    // 取得請求中的 phone（query 或 params）
    const phone =
      (req.params as Record<string, string>).phone ??
      (req.query as Record<string, string>).phone;

    if (!phone) {
      return reply.status(400).send({ error: 'PhoneRequired' });
    }

    const lineUserId = req.headers['x-line-user-id'];
    if (typeof lineUserId !== 'string' || !lineUserId) {
      return reply.status(401).send({ error: 'Unauthorized', message: '需要 LINE 登入' });
    }

    // 查詢此 lineUserId 對應的會員
    const member = await app.prisma.member.findUnique({
      where: { lineUserId },
      select: { phone: true },
    });

    if (!member || member.phone !== phone) {
      return reply.status(403).send({ error: 'Forbidden', message: '無權存取此資料' });
    }
  };
}
