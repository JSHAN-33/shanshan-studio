import type { FastifyInstance } from 'fastify';
import { adminAuth } from '../middleware/adminAuth.js';
import { buildDepositInfoMessage, buildBookingReminderMessage, pushToUser } from '../services/lineNotifyService.js';

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

  // POST /settings/reminder/debug — admin only：診斷預約提醒，可手動觸發
  app.post('/reminder/debug', { preHandler: adminAuth }, async (req) => {
    const { send } = (req.body ?? {}) as { send?: boolean };

    // 用台灣時間計算明天日期
    const now = new Date();
    const twNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const tomorrowTw = new Date(twNow.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowStr = tomorrowTw.toISOString().slice(0, 10);

    // 也計算 cron 的舊邏輯算出的日期（用來比對）
    const cronTomorrow = new Date();
    cronTomorrow.setDate(cronTomorrow.getDate() + 1);
    const cronTomorrowStr = cronTomorrow.toISOString().slice(0, 10);

    const bookings = await app.prisma.booking.findMany({
      where: { date: tomorrowStr, status: { not: '已取消' } },
    });

    const results = [];
    for (const b of bookings) {
      const member = await app.prisma.member.findUnique({ where: { phone: b.phone } });
      const pushUserId = member?.lineOaUserId ?? member?.lineUserId;
      const entry: Record<string, unknown> = {
        bookingId: b.id,
        name: b.name,
        phone: b.phone,
        date: b.date,
        time: b.time,
        status: b.status,
        memberFound: !!member,
        lineOaUserId: member?.lineOaUserId ?? null,
        lineUserId: member?.lineUserId ?? null,
        pushUserId: pushUserId ?? null,
        sent: false,
      };

      if (send && pushUserId) {
        try {
          await pushToUser(pushUserId, buildBookingReminderMessage(b));
          entry.sent = true;
        } catch (err) {
          entry.error = String(err);
        }
      }
      results.push(entry);
    }

    return {
      serverUtcNow: now.toISOString(),
      taiwanNow: twNow.toISOString().replace('Z', '+08:00'),
      tomorrowDate: tomorrowStr,
      cronOldLogicDate: cronTomorrowStr,
      dateMismatch: tomorrowStr !== cronTomorrowStr,
      totalBookings: bookings.length,
      sendMode: !!send,
      results,
    };
  });
}
