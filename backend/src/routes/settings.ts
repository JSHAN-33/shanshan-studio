import type { FastifyInstance } from 'fastify';
import { adminAuth } from '../middleware/adminAuth.js';

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
}
