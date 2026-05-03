import cron from 'node-cron';
import type { PrismaClient } from '@prisma/client';
import { buildBookingReminderMessage, buildAftercareMessage, buildFeedbackMessage, pushToUser } from './lineNotifyService.js';

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

  // 每 10 分鐘檢查：預約結束 1 小時後推播保養須知 + 回饋邀請
  cron.schedule('*/10 * * * *', async () => {
    try {
      const now = new Date();
      // 台灣時間
      const twNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);
      const todayStr = twNow.toISOString().slice(0, 10);
      const twHour = twNow.getUTCHours();
      const twMin = twNow.getUTCMinutes();
      const nowMinutes = twHour * 60 + twMin; // 台灣時間分鐘數

      // 找今天已確認/已完成、尚未發過 aftercare 的預約
      const bookings = await prisma.booking.findMany({
        where: {
          date: todayStr,
          status: { in: ['已確認', '已完成'] },
          aftercareSentAt: null,
        },
      });

      // 按客人分組，同一客人同一天只發送一次
      const sentPhones = new Set<string>();

      for (const b of bookings) {
        // 計算預約結束時間 = 預約開始 + duration（預設 60 分鐘）
        const [h, m] = b.time.split(':').map(Number);
        const startMinutes = h * 60 + m;
        const duration = b.duration ?? 60;
        const endMinutes = startMinutes + duration;
        // 結束後 1 小時才推播
        const sendAfterMinutes = endMinutes + 60;

        if (nowMinutes < sendAfterMinutes) continue;

        // 同一客人只發一次
        if (sentPhones.has(b.phone)) {
          // 標記已發送但不重複推播
          await prisma.booking.update({
            where: { id: b.id },
            data: { aftercareSentAt: new Date() },
          });
          continue;
        }

        // 找會員的推播 ID
        const member = await prisma.member.findUnique({ where: { phone: b.phone } });
        const pushUserId = member?.lineOaUserId ?? member?.lineUserId;
        if (!pushUserId) {
          await prisma.booking.update({
            where: { id: b.id },
            data: { aftercareSentAt: new Date() },
          });
          continue;
        }

        // 取得 Google 評論連結（存在 SystemSetting）
        const reviewSetting = await prisma.systemSetting.findUnique({ where: { key: 'googleReviewUrl' } });

        // 推播兩則訊息：保養須知 + 回饋邀請
        await pushToUser(pushUserId, buildAftercareMessage());
        await pushToUser(pushUserId, buildFeedbackMessage(b.name, reviewSetting?.value));

        sentPhones.add(b.phone);

        // 標記已發送
        await prisma.booking.update({
          where: { id: b.id },
          data: { aftercareSentAt: new Date() },
        });
        console.log(`[Aftercare] Sent to ${b.name} (${b.phone})`);
      }
    } catch (err) {
      console.error('[Aftercare] Error:', err);
    }
  }, {
    timezone: 'Asia/Taipei',
  });

  console.log('[Aftercare] Scheduler started — every 10 minutes');
}
