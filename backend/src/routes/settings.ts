import type { FastifyInstance } from 'fastify';
import { adminAuth } from '../middleware/adminAuth.js';
import { buildDepositInfoMessage, pushToUser } from '../services/lineNotifyService.js';

export async function settingsRoutes(app: FastifyInstance) {
  // GET /settings/deposit — 公開（前台需要知道是否啟用）
  app.get('/deposit', async () => {
    const enabled = await app.prisma.systemSetting.findUnique({ where: { key: 'depositEnabled' } });
    const amount = await app.prisma.systemSetting.findUnique({ where: { key: 'depositAmount' } });
    const bankInfo = await app.prisma.systemSetting.findUnique({ where: { key: 'depositBankInfo' } });
    return {
      enabled: enabled?.value === 'true',
      amount: Number(amount?.value ?? '500'),
      bankInfo: bankInfo?.value ?? '',
    };
  });

  // PUT /settings/deposit — admin only
  app.put('/deposit', { preHandler: adminAuth }, async (req) => {
    const { enabled, amount, bankInfo } = (req.body ?? {}) as {
      enabled?: boolean;
      amount?: number;
      bankInfo?: string;
    };

    if (enabled !== undefined) {
      await app.prisma.systemSetting.upsert({
        where: { key: 'depositEnabled' },
        update: { value: String(enabled) },
        create: { key: 'depositEnabled', value: String(enabled) },
      });
    }
    if (amount !== undefined) {
      await app.prisma.systemSetting.upsert({
        where: { key: 'depositAmount' },
        update: { value: String(amount) },
        create: { key: 'depositAmount', value: String(amount) },
      });
    }
    if (bankInfo !== undefined) {
      await app.prisma.systemSetting.upsert({
        where: { key: 'depositBankInfo' },
        update: { value: bankInfo },
        create: { key: 'depositBankInfo', value: bankInfo },
      });
    }

    return { ok: true };
  });

  // POST /settings/deposit/test — admin only：測試推送匯款 Flex 給指定會員
  app.post('/deposit/test', { preHandler: adminAuth }, async (req, reply) => {
    const { memberId } = (req.body ?? {}) as { memberId?: string };
    if (!memberId) return reply.status(400).send({ error: 'memberId required' });

    const member = await app.prisma.member.findUnique({ where: { id: memberId } });
    if (!member) return reply.status(404).send({ error: 'member not found' });

    const pushUid = member.lineOaUserId ?? member.lineUserId;
    if (!pushUid) return reply.status(400).send({ error: 'member has no LINE userId' });

    const bankSetting = await app.prisma.systemSetting.findUnique({ where: { key: 'depositBankInfo' } });
    if (!bankSetting?.value) return reply.status(400).send({ error: 'depositBankInfo not set' });

    const amountSetting = await app.prisma.systemSetting.findUnique({ where: { key: 'depositAmount' } });

    await pushToUser(pushUid, buildDepositInfoMessage({
      name: member.name,
      date: '2026-05-05',
      time: '14:00',
      items: '測試項目',
      total: 2000,
      depositAmount: Number(amountSetting?.value ?? '500'),
      bankInfo: bankSetting.value,
    }));

    return { ok: true, pushedTo: member.name };
  });
}
