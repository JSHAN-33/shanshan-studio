import type { PrismaClient, Prisma } from '@prisma/client';

export interface AvailableSlot {
  time: string;
  available: boolean;
  reason?: 'booked' | 'blocked';
}

/**
 * 將 "HH:mm" 轉為分鐘數
 */
function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
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

  const [blocked, bookings] = await Promise.all([
    prisma.blockedSlot.findMany({ where: { date } }),
    prisma.booking.findMany({
      where: { date, status: { not: '已取消' } },
      select: { time: true },
    }),
  ]);

  const blockedSet = new Set(blocked.map((b) => b.time));
  const bookedSet = new Set(bookings.map((b) => b.time));

  // 先標記每個時段本身是否可用
  const baseSlots = allSlots.map((time) => {
    if (blockedSet.has(time)) return { time, available: false, reason: 'blocked' as const };
    if (bookedSet.has(time)) return { time, available: false, reason: 'booked' as const };
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
 * 檢查同日期同時段是否已有非取消預約。
 */
export async function hasConflict(
  prisma: PrismaClient,
  date: string,
  time: string,
  excludeId?: string
): Promise<boolean> {
  const where: Prisma.BookingWhereInput = {
    date,
    time,
    status: { not: '已取消' },
  };
  if (excludeId) where.id = { not: excludeId };
  const existing = await prisma.booking.findFirst({ where });
  return !!existing;
}
