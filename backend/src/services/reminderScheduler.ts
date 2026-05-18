import cron from 'node-cron';
import type { PrismaClient } from '@prisma/client';
import { buildBookingReminderMessage, buildAftercareMessage, buildFeedbackMessage, pushToUser } from './lineNotifyService.js';

/** 台灣時間 helper */
function getTaiwanNow(): Date {
  return new Date(Date.now() + 8 * 60 * 60 * 1000);
}

/** 用台灣時間計算明天日期 YYYY-MM-DD */
function getTomorrowTw(): string {
  const twNow = getTaiwanNow();
  const tomorrow = new Date(twNow.getTime() + 24 * 60 * 60 * 1000);
  return tomorrow.toISOString().slice(0, 10);
}

/** 用台灣時間取得今天日期 YYYY-MM-DD */
function getTodayTw(): string {
  return getTaiwanNow().toISOString().slice(0, 10);
}

/**
 * 發送明日預約提醒（核心邏輯，cron + startup 共用）
 * 回傳已發送筆數
 */
async function sendDailyReminder(prisma: PrismaClient): Promise<number> {
  const tomorrowStr = getTomorrowTw();
  const settingKey = `reminder_sent_${tomorrowStr}`;

  // 檢查是否已發送過
  const already = await prisma.systemSetting.findUnique({ where: { key: settingKey } });
  if (already) {
    console.log(`[Reminder] Already sent for ${tomorrowStr}, skipping.`);
    return 0;
  }

  const bookings = await prisma.booking.findMany({
    where: { date: tomorrowStr, status: { not: '已取消' } },
  });

  console.log(`[Reminder] Found ${bookings.length} bookings for ${tomorrowStr}`);

  let sent = 0;
  for (const b of bookings) {
    const member = await prisma.member.findUnique({ where: { phone: b.phone } });
    const pushUserId = member?.lineOaUserId ?? member?.lineUserId;
    if (!pushUserId) continue;

    await pushToUser(pushUserId, buildBookingReminderMessage(b));
    console.log(`[Reminder] Sent to ${b.name} (${b.phone})`);
    sent++;
  }

  // 標記今天已發送
  await prisma.systemSetting.upsert({
    where: { key: settingKey },
    update: { value: String(sent) },
    create: { key: settingKey, value: String(sent) },
  });

  console.log(`[Reminder] Done. Sent ${sent} reminders for ${tomorrowStr}.`);
  return sent;
}

/**
 * 啟動排程 + startup 補發
 */
export function startReminderScheduler(prisma: PrismaClient) {
  // === 每天 17:00 執行（台灣時間 UTC+8）===
  cron.schedule('0 17 * * *', async () => {
    console.log('[Reminder] Cron triggered at 17:00 (Asia/Taipei)');
    try {
      await sendDailyReminder(prisma);
    } catch (err) {
      console.error('[Reminder] Error:', err);
    }
  }, {
    timezone: 'Asia/Taipei',
  });

  console.log('[Reminder] Scheduler started — daily at 17:00 (Asia/Taipei)');

  // === Startup 補發：如果已過 17:00，強制重新發送（清除舊標記避免 token 過期時的假成功） ===
  (async () => {
    try {
      const twNow = getTaiwanNow();
      const twHour = twNow.getUTCHours();
      if (twHour >= 17) {
        const tomorrowStr = getTomorrowTw();
        const settingKey = `reminder_sent_${tomorrowStr}`;
        // 清除舊標記，確保每次重啟都會重新發送（pushToUser 內部不會重複推播給同一人造成困擾）
        await prisma.systemSetting.deleteMany({ where: { key: settingKey } });
        console.log('[Reminder] Startup check: past 17:00 TW, resending reminders...');
        await sendDailyReminder(prisma);
      } else {
        console.log(`[Reminder] Startup check: only ${twHour}:xx TW, not yet 17:00, skipping.`);
      }
    } catch (err) {
      console.error('[Reminder] Startup check error:', err);
    }
  })();

  // === 每 10 分鐘檢查：預約結束 1 小時後推播保養須知 + 回饋邀請 ===
  cron.schedule('*/10 * * * *', async () => {
    try {
      const todayStr = getTodayTw();
      const twNow = getTaiwanNow();
      const twHour = twNow.getUTCHours();
      const twMin = twNow.getUTCMinutes();
      const nowMinutes = twHour * 60 + twMin;

      const bookings = await prisma.booking.findMany({
        where: {
          date: todayStr,
          status: { in: ['已確認', '已完成'] },
          aftercareSentAt: null,
        },
      });

      for (const b of bookings) {
        const [h, m] = b.time.split(':').map(Number);
        const startMinutes = h * 60 + m;
        const duration = b.duration ?? 60;
        const endMinutes = startMinutes + duration;
        const sendAfterMinutes = endMinutes + 60;

        if (nowMinutes < sendAfterMinutes) continue;

        const alreadySent = await prisma.booking.findFirst({
          where: { phone: b.phone, aftercareSentAt: { not: null } },
          select: { id: true },
        });

        if (alreadySent) {
          await prisma.booking.update({
            where: { id: b.id },
            data: { aftercareSentAt: new Date() },
          });
          continue;
        }

        const member = await prisma.member.findUnique({ where: { phone: b.phone } });
        const pushUserId = member?.lineOaUserId ?? member?.lineUserId;
        if (!pushUserId) {
          await prisma.booking.update({
            where: { id: b.id },
            data: { aftercareSentAt: new Date() },
          });
          continue;
        }

        const reviewSetting = await prisma.systemSetting.findUnique({ where: { key: 'googleReviewUrl' } });

        await pushToUser(pushUserId, buildAftercareMessage());
        await pushToUser(pushUserId, buildFeedbackMessage(b.name, reviewSetting?.value));

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
