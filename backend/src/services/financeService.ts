import type { PrismaClient } from '@prisma/client';

function ymd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function firstDayOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function firstDayOfNextMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

export interface FinanceSummary {
  today: { revenue: number; cost: number; net: number; bookings: number };
  month: { revenue: number; cost: number; net: number; bookings: number };
  nextMonthEstimate: { bookings: number; revenue: number };
}

/**
 * 計算今日、本月的營收/成本/淨利，以及下月預估（依已確認的預約）。
 * 營收以 booking.paidAt 為準；成本以 cost.date 為準。
 */
export async function getFinanceSummary(prisma: PrismaClient): Promise<FinanceSummary> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart.getTime() + 86400000);
  const monthStart = firstDayOfMonth(now);
  const nextMonthStart = firstDayOfNextMonth(now);
  const monthAfterNext = firstDayOfNextMonth(nextMonthStart);

  const todayStr = ymd(now);
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const nextMonthPrefix = `${nextMonthStart.getFullYear()}-${String(
    nextMonthStart.getMonth() + 1
  ).padStart(2, '0')}`;

  const [todayPaid, monthPaid, todayCosts, monthCosts, nextMonthBookings] = await Promise.all([
    prisma.booking.aggregate({
      _sum: { total: true },
      _count: true,
      where: { paidAt: { gte: todayStart, lt: tomorrowStart } },
    }),
    prisma.booking.aggregate({
      _sum: { total: true },
      _count: true,
      where: { paidAt: { gte: monthStart, lt: nextMonthStart } },
    }),
    prisma.cost.aggregate({
      _sum: { amount: true },
      where: { date: todayStr },
    }),
    prisma.cost.aggregate({
      _sum: { amount: true },
      where: { date: { startsWith: monthPrefix } },
    }),
    prisma.booking.findMany({
      where: {
        date: { startsWith: nextMonthPrefix },
        status: { not: '已取消' },
      },
      select: { total: true },
    }),
  ]);

  const todayRevenue = todayPaid._sum.total ?? 0;
  const monthRevenue = monthPaid._sum.total ?? 0;
  const todayCost = todayCosts._sum.amount ?? 0;
  const monthCost = monthCosts._sum.amount ?? 0;
  const nextMonthRevenue = nextMonthBookings.reduce((s, b) => s + b.total, 0);

  return {
    today: {
      revenue: todayRevenue,
      cost: todayCost,
      net: todayRevenue - todayCost,
      bookings: todayPaid._count,
    },
    month: {
      revenue: monthRevenue,
      cost: monthCost,
      net: monthRevenue - monthCost,
      bookings: monthPaid._count,
    },
    nextMonthEstimate: {
      bookings: nextMonthBookings.length,
      revenue: nextMonthRevenue,
    },
  };
}
