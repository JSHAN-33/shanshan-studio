import type { FastifyInstance } from 'fastify';
import { lineLoginSchema, registerSchema, credentialLoginSchema } from '../schemas/auth.js';

const ADMIN_ACCOUNT = 'SHANSHAN.STUDIO';
const ADMIN_PASSWORD = 'ASdf1127';

export async function authRoutes(app: FastifyInstance) {
  // POST /auth/login — 帳號密碼登入（管理員用）
  app.post('/login', async (req, reply) => {
    const { account, password } = credentialLoginSchema.parse(req.body);

    if (account === ADMIN_ACCOUNT && password === ADMIN_PASSWORD) {
      const token = process.env.ADMIN_TOKEN ?? 'admin';
      return { ok: true, role: 'admin', token };
    }

    return reply.status(401).send({ error: 'Unauthorized', message: '帳號或密碼錯誤' });
  });
  // POST /auth/line-login — LINE 登入：查詢是否已註冊
  app.post('/line-login', async (req) => {
    const { lineUserId } = lineLoginSchema.parse(req.body);

    const member = await app.prisma.member.findUnique({
      where: { lineUserId },
    });

    if (member) {
      const bookingCount = await app.prisma.booking.count({
        where: { phone: member.phone, status: { not: '已取消' } },
      });
      return { registered: true, member: { ...member, bookingCount } };
    }

    return { registered: false };
  });

  // POST /auth/register — 新客完善資料後建立會員
  app.post('/register', async (req, reply) => {
    const input = registerSchema.parse(req.body);

    // 檢查 LINE ID 是否已被綁定
    const existingLine = await app.prisma.member.findUnique({
      where: { lineUserId: input.lineUserId },
    });
    if (existingLine) {
      return reply.status(409).send({ error: 'LineAlreadyBound', message: '此 LINE 帳號已綁定' });
    }

    // 檢查手機號碼是否已存在
    const existingPhone = await app.prisma.member.findUnique({
      where: { phone: input.phone },
    });

    let member;
    if (existingPhone) {
      // 手機已存在但沒綁 LINE → 綁定
      member = await app.prisma.member.update({
        where: { phone: input.phone },
        data: {
          lineUserId: input.lineUserId,
          name: input.name,
          gender: input.gender,
          bday: input.bday ?? undefined,
        },
      });
    } else {
      // 全新會員
      member = await app.prisma.member.create({
        data: {
          phone: input.phone,
          name: input.name,
          gender: input.gender,
          bday: input.bday ?? undefined,
          lineUserId: input.lineUserId,
        },
      });
    }

    return { registered: true, member };
  });
}
