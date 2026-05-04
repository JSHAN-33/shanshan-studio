import type { FastifyInstance } from 'fastify';
import { adminAuth } from '../middleware/adminAuth.js';
import { buildPhoneOwnerAuth } from '../middleware/phoneOwnerAuth.js';
import { consultationFormSchema } from '../schemas/consultationForm.js';

export async function consultationFormsRoutes(app: FastifyInstance) {
  const phoneOwnerAuth = buildPhoneOwnerAuth(app);

  // POST /consultation-forms — customer submit（需驗證身份）
  app.post('/', async (req, reply) => {
    const input = consultationFormSchema.parse(req.body);

    // 驗證提交者是本人或 admin
    const lineUserId = req.headers['x-line-user-id'];
    const adminToken = req.headers['x-admin-token'];
    const isAdmin = typeof adminToken === 'string' && adminToken === process.env.ADMIN_TOKEN;

    if (!isAdmin) {
      if (typeof lineUserId !== 'string' || !lineUserId) {
        return reply.status(401).send({ error: 'Unauthorized', message: '需要 LINE 登入' });
      }
      const member = await app.prisma.member.findUnique({
        where: { lineUserId },
        select: { phone: true },
      });
      if (!member || member.phone !== input.phone) {
        return reply.status(403).send({ error: 'Forbidden', message: '無權提交此資料' });
      }
    }

    const form = await app.prisma.consultationForm.upsert({
      where: { phone: input.phone },
      update: { ...input, hairRemoval: input.hairRemoval },
      create: { ...input, hairRemoval: input.hairRemoval },
    });
    return { form };
  });

  // GET /consultation-forms/:phone — admin view by phone
  app.get<{ Params: { phone: string } }>(
    '/:phone',
    { preHandler: adminAuth },
    async (req, reply) => {
      const form = await app.prisma.consultationForm.findFirst({
        where: { phone: req.params.phone },
        orderBy: { updatedAt: 'desc' },
      });
      if (!form) return reply.status(404).send({ error: 'NotFound' });
      return { form };
    }
  );

  // GET /consultation-forms/mine/:phone — customer view own form（需驗證身份）
  app.get<{ Params: { phone: string } }>('/mine/:phone', async (req, reply) => {
    await phoneOwnerAuth(req, reply);
    if (reply.sent) return;

    const form = await app.prisma.consultationForm.findFirst({
      where: { phone: req.params.phone },
      orderBy: { updatedAt: 'desc' },
    });
    if (!form) return reply.status(404).send({ error: 'NotFound' });
    return { form };
  });
}
