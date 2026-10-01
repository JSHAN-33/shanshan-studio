import cron from 'node-cron';
import type { PrismaClient } from '@prisma/client';
import { buildBookingReminderMessage, buildAftercareMessage, buildFeedbackMessage, buildOwnerDailySummary, pushToUser, pushToOa } from './lineNotifyService.js';

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

  // 批量查詢所有相關會員，避免 N+1
  const phones = [...new Set(bookings.map((b) => b.phone))];
  const members = await prisma.member.findMany({ where: { phone: { in: phones } } });
  const memberMap = new Map(members.map((m) => [m.phone, m]));

  let sent = 0;
  const pushPromises: Promise<void>[] = [];
  for (const b of bookings) {
    const member = memberMap.get(b.phone);
    const pushUserId = member?.lineOaUserId ?? member?.lineUserId;
    if (!pushUserId) continue;

    pushPromises.push(
      pushToUser(pushUserId, buildBookingReminderMessage(b))
        .then(() => { console.log(`[Reminder] Sent to ${b.name} (${b.phone})`); sent++; })
        .catch((err) => console.error(`[Reminder] Failed for ${b.name}:`, err))
    );
  }
  await Promise.all(pushPromises);

  // 推送明日預約總覽給店家
  try {
    const summaryMsg = buildOwnerDailySummary(tomorrowStr, bookings.map((b) => ({
      name: b.name, time: b.time, items: b.items, total: b.total,
    })));
    await pushToOa(summaryMsg);
    console.log(`[Reminder] Owner summary sent for ${tomorrowStr} (${bookings.length} bookings)`);
  } catch (err) {
    console.error('[Reminder] Owner summary failed:', err);
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

      // 過濾出已到達發送時間的預約
      const readyBookings = bookings.filter((b) => {
        const [h, m] = b.time.split(':').map(Number);
        const endMinutes = h * 60 + m + (b.duration ?? 60);
        return nowMinutes >= endMinutes + 60;
      });

      if (readyBookings.length === 0) return;

      // 批量查詢：會員、已發送過的紀錄、Google 評論連結
      const phones = [...new Set(readyBookings.map((b) => b.phone))];
      const [members, alreadySentBookings, reviewSetting] = await Promise.all([
        prisma.member.findMany({ where: { phone: { in: phones } } }),
        prisma.booking.findMany({
          where: { phone: { in: phones }, aftercareSentAt: { not: null } },
          select: { phone: true },
          distinct: ['phone'],
        }),
        prisma.systemSetting.findUnique({ where: { key: 'googleReviewUrl' } }),
      ]);

      const memberMap = new Map(members.map((m) => [m.phone, m]));
      const alreadySentPhones = new Set(alreadySentBookings.map((b) => b.phone));

      // 需要標記已發送但不推播的 IDs
      const skipIds: string[] = [];
      // 需要推播的預約
      const toSend: { booking: typeof readyBookings[0]; pushUserId: string }[] = [];

      for (const b of readyBookings) {
        if (alreadySentPhones.has(b.phone)) {
          skipIds.push(b.id);
          continue;
        }

        const member = memberMap.get(b.phone);
        const pushUserId = member?.lineOaUserId ?? member?.lineUserId;
        if (!pushUserId) {
          skipIds.push(b.id);
          continue;
        }

        toSend.push({ booking: b, pushUserId });
      }

      // 批量更新跳過的預約
      if (skipIds.length > 0) {
        await prisma.booking.updateMany({
          where: { id: { in: skipIds } },
          data: { aftercareSentAt: new Date() },
        });
      }

      // 發送推播並更新
      const sentIds: string[] = [];
      for (const { booking: b, pushUserId } of toSend) {
        try {
          await pushToUser(pushUserId, buildAftercareMessage());
          await pushToUser(pushUserId, buildFeedbackMessage(b.name, reviewSetting?.value));
          sentIds.push(b.id);
          console.log(`[Aftercare] Sent to ${b.name} (${b.phone})`);
        } catch (err) {
          console.error(`[Aftercare] Failed for ${b.name}:`, err);
          sentIds.push(b.id); // 仍標記為已處理，避免重複嘗試
        }
      }

      if (sentIds.length > 0) {
        await prisma.booking.updateMany({
          where: { id: { in: sentIds } },
          data: { aftercareSentAt: new Date() },
        });
      }
    } catch (err) {
      console.error('[Aftercare] Error:', err);
    }
  }, {
    timezone: 'Asia/Taipei',
  });

  console.log('[Aftercare] Scheduler started — every 10 minutes');
}
