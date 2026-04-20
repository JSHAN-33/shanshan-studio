import cron from 'node-cron';
import type { PrismaClient } from '@prisma/client';
import { buildBookingReminderMessage, pushToUser } from './lineNotifyService.js';

/**
 * 每天下午 17:00 自動發送明日預約提醒給有綁定 OA 的客人。
 */
export function startReminderScheduler(prisma: PrismaClient) {
  // 每天 17:00 執行（台灣時間 UTC+8）
  cron.schedule('0 17 * * *', async () => {
    console.log('[Reminder] Running daily booking reminder...');
    try {
      // 計算明天的日期
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().slice(0, 10);

      // 找出明天所有非取消的預約
      const bookings = await prisma.booking.findMany({
        where: {
          date: tomorrowStr,
          status: { not: '已取消' },
        },
      });

      console.log(`[Reminder] Found ${bookings.length} bookings for ${tomorrowStr}`);

      for (const b of bookings) {
        // 用 phone 找會員的 lineOaUserId（由 @903zzutx webhook 頭像配對綁定）
        const member = await prisma.member.findUnique({ where: { phone: b.phone } });
        if (!member?.lineOaUserId) continue;

        await pushToUser(member.lineOaUserId, buildBookingReminderMessage(b));
        console.log(`[Reminder] Sent to ${b.name} (${b.phone})`);
      }

      console.log('[Reminder] Done.');
    } catch (err) {
      console.error('[Reminder] Error:', err);
    }
  }, {
    timezone: 'Asia/Taipei',
  });

  console.log('[Reminder] Scheduler started — daily at 17:00 (Asia/Taipei)');
}
