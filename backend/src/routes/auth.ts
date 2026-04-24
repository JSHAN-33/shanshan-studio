import type { FastifyInstance } from 'fastify';
import { lineLoginSchema, registerSchema, credentialLoginSchema } from '../schemas/auth.js';
import { pushToOa, buildNewMemberMessage } from '../services/lineNotifyService.js';

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
    const { lineUserId, pictureUrl } = lineLoginSchema.parse(req.body);

    let member = await app.prisma.member.findUnique({
      where: { lineUserId },
    });

    if (member) {
      // 同步最新 LINE 頭像
      if (pictureUrl && pictureUrl !== member.pictureUrl) {
        member = await app.prisma.member.update({
          where: { lineUserId },
          data: { pictureUrl },
        });
      }
      const bookingCount = await app.prisma.booking.count({
        where: { phone: member.phone, status: { not: '已取消' } },
      });
      return { registered: true, member: { ...member, bookingCount } };
    }

    return { registered: false };
  });

  // POST /auth/register — 新客完善資料後建立會員
  app.post('/register', async (req, reply) => {
    const body = req.body as Record<string, unknown>;
    const inLiff = body.inLiff === true;
    const input = registerSchema.parse(body);

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
          lineOaUserId: input.lineUserId,
          name: input.name,
          gender: input.gender,
          bday: input.bday ?? undefined,
          pictureUrl: input.pictureUrl ?? undefined,
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
          lineOaUserId: input.lineUserId,
          pictureUrl: input.pictureUrl ?? undefined,
        },
      });
    }

    // 在 LIFF 內由前端 liff.sendMessages() 以客人身份發送；
    // 非 LIFF 環境才由後端 pushToOa 作為備案
    if (!inLiff) {
      pushToOa(buildNewMemberMessage({
        name: member.name,
        phone: member.phone,
        gender: member.gender,
        bday: member.bday,
      })).catch((err) => console.error('[LINE] pushToOa (new member) failed', err));
    }

    return { registered: true, member };
  });
}
