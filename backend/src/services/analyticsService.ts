import type { PrismaClient } from '@prisma/client';

export interface AnalyticsSummary {
  monthlyBookings: number;
  popularTimeSlots: Array<{ time: string; count: number }>;
  popularServices: Array<{ name: string; count: number }>;
}

export interface ColdSlotsSummary {
  period: { from: string; to: string };
  totalBookings: number;
  configuredSlots: string[];
  neverBooked: string[];
  allSlotStats: Array<{ time: string; count: number }>;
}

export async function getAnalytics(prisma: PrismaClient): Promise<AnalyticsSummary> {
  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const bookings = await prisma.booking.findMany({
    where: {
      date: { startsWith: monthPrefix },
      status: { not: '已取消' },
    },
    select: { time: true, items: true },
  });

  // Monthly total
  const monthlyBookings = bookings.length;

  // Popular time slots
  const timeMap = new Map<string, number>();
  for (const b of bookings) {
    timeMap.set(b.time, (timeMap.get(b.time) ?? 0) + 1);
  }
  const popularTimeSlots = Array.from(timeMap.entries())
    .map(([time, count]) => ({ time, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Popular services
  const serviceMap = new Map<string, number>();
  for (const b of bookings) {
    const names = b.items.split('、').map((n) => n.trim()).filter(Boolean);
    for (const name of names) {
      serviceMap.set(name, (serviceMap.get(name) ?? 0) + 1);
    }
  }
  const popularServices = Array.from(serviceMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return { monthlyBookings, popularTimeSlots, popularServices };
}

/**
 * 冷門時段分析：找出過去 N 個月內從未被預約的時段
 */
export async function getColdSlots(prisma: PrismaClient, months = 6): Promise<ColdSlotsSummary> {
  const now = new Date();
  const fromDate = new Date(now.getFullYear(), now.getMonth() - months, 1);
  const fromPrefix = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, '0')}`;
  const toPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // 取得所有設定的可預約時段
  const config = await prisma.slotConfig.findFirst();
  const configuredSlots: string[] = (config?.slots as string[] | undefined) ?? [];

  // 撈出期間內所有非取消的預約
  const bookings = await prisma.booking.findMany({
    where: {
      date: { gte: fromPrefix, lte: `${toPrefix}-31` },
      status: { not: '已取消' },
    },
    select: { time: true },
  });

  const totalBookings = bookings.length;

  // 統計每個時段的預約次數
  const timeMap = new Map<string, number>();
  for (const slot of configuredSlots) {
    timeMap.set(slot, 0);
  }
  for (const b of bookings) {
    timeMap.set(b.time, (timeMap.get(b.time) ?? 0) + 1);
  }

  // 從未被預約的時段
  const neverBooked = configuredSlots.filter((slot) => (timeMap.get(slot) ?? 0) === 0);

  // 全部時段統計（依預約次數升序，最冷門的排前面）
  const allSlotStats = Array.from(timeMap.entries())
    .map(([time, count]) => ({ time, count }))
    .sort((a, b) => a.count - b.count);

  return {
    period: { from: fromPrefix, to: toPrefix },
    totalBookings,
    configuredSlots,
    neverBooked,
    allSlotStats,
  };
}
