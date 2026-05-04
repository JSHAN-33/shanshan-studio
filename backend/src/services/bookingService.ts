import type { PrismaClient, Prisma } from '@prisma/client';

export interface AvailableSlot {
  time: string;
  available: boolean;
  reason?: 'booked' | 'blocked' | 'past';
}

/**
 * 將 "HH:mm" 轉為分鐘數
 */
function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/** 當日預約需提前 2 小時 — 14:30 時，14:30~16:30 的時段皆視為已過 */
const BOOKING_BUFFER_MINUTES = 120;

/**
 * 以 Asia/Taipei 時區取得「現在」的日期字串（YYYY-MM-DD）與當日分鐘數。
 */
function getTaipeiNow(): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  const date = `${get('year')}-${get('month')}-${get('day')}`;
  const hour = Number(get('hour'));
  const minute = Number(get('minute'));
  return { date, minutes: hour * 60 + minute };
}

/**
 * 判斷某日某時段是否已過（含 2 小時預約緩衝）。
 */
function isPastTime(date: string, time: string): boolean {
  const now = getTaipeiNow();
  if (date > now.date) return false;
  if (date < now.date) return true;
  return timeToMinutes(time) <= now.minutes + BOOKING_BUFFER_MINUTES;
}

/**
 * 計算指定日期的可用時段。
 * - 從 SlotConfig 取得所有可預約時段
 * - 扣掉 BlockedSlot
 * - 把當日已有「非取消」預約的時段標記為不可選
 * - 若提供 duration，檢查該時段起算是否有足夠連續空檔
 */
export async function getAvailableSlots(
  prisma: PrismaClient,
  date: string,
  duration?: number
): Promise<AvailableSlot[]> {
  const config = await prisma.slotConfig.findFirst();
  const allSlots: string[] = Array.isArray(config?.slots)
    ? (config!.slots as string[])
    : [];

  const [blocked, bookings, forcedOpen] = await Promise.all([
    prisma.blockedSlot.findMany({ where: { date } }),
    prisma.booking.findMany({
      where: { date, status: { not: '已取消' } },
      select: { time: true, duration: true },
    }),
    prisma.forcedOpenSlot.findMany({ where: { date } }),
  ]);

  const blockedSet = new Set(blocked.map((b) => b.time));
  const forcedOpenSet = new Set(forcedOpen.map((f) => f.time));

  // 根據每筆預約的 duration 擴展封鎖時段（例：10:00 預約 60 分鐘 → 封鎖 10:00、10:30）
  const bookedSet = new Set<string>();
  for (const b of bookings) {
    bookedSet.add(b.time);
    const dur = b.duration ?? 30;
    if (dur > 30) {
      const startMin = timeToMinutes(b.time);
      const slotsNeeded = Math.ceil(dur / 30);
      for (let i = 1; i < slotsNeeded; i++) {
        const min = startMin + i * 30;
        const t = `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
        bookedSet.add(t);
      }
    }
  }

  // 先標記每個時段本身是否可用
  // 強制開放的時段即使有預約也視為可用（允許同時段再接一位客人）
  const baseSlots = allSlots.map((time) => {
    if (isPastTime(date, time)) return { time, available: false, reason: 'past' as const };
    if (blockedSet.has(time)) return { time, available: false, reason: 'blocked' as const };
    if (bookedSet.has(time) && !forcedOpenSet.has(time)) return { time, available: false, reason: 'booked' as const };
    return { time, available: true };
  });

  // 如果沒有指定 duration 或 duration <= 30，不需要額外過濾
  if (!duration || duration <= 30) return baseSlots;

  // 需要的連續時段數（每格 30 分鐘）
  const slotsNeeded = Math.ceil(duration / 30);

  return baseSlots.map((slot, idx) => {
    if (!slot.available) return slot;

    // 檢查從此時段開始是否有足夠連續空檔
    const startMin = timeToMinutes(slot.time);
    for (let i = 1; i < slotsNeeded; i++) {
      const needMin = startMin + i * 30;
      const needTime = `${String(Math.floor(needMin / 60)).padStart(2, '0')}:${String(needMin % 60).padStart(2, '0')}`;
      const nextSlot = baseSlots.find((s) => s.time === needTime);
      if (!nextSlot || !nextSlot.available) {
        return { time: slot.time, available: false, reason: 'blocked' as const };
      }
    }
    return slot;
  });
}

/**
 * 檢查新預約是否與同日的既有預約時段重疊（考慮 duration）。
 */
export async function hasConflict(
  prisma: PrismaClient,
  date: string,
  time: string,
  excludeId?: string,
  duration?: number
): Promise<boolean> {
  const where: Prisma.BookingWhereInput = {
    date,
    status: { not: '已取消' },
  };
  if (excludeId) where.id = { not: excludeId };

  const [existing, forcedOpen] = await Promise.all([
    prisma.booking.findMany({ where, select: { time: true, duration: true } }),
    prisma.forcedOpenSlot.findMany({ where: { date } }),
  ]);

  const forcedOpenSet = new Set(forcedOpen.map((f) => f.time));

  const newStart = timeToMinutes(time);
  const newEnd = newStart + (duration || 30);

  for (const b of existing) {
    const bStart = timeToMinutes(b.time);
    const bEnd = bStart + (b.duration ?? 30);
    // 兩區間重疊判定
    if (newStart < bEnd && newEnd > bStart) {
      // 如果重疊的時段有被強制開放，則不算衝突
      if (forcedOpenSet.has(b.time)) continue;
      return true;
    }
  }
  return false;
}
