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

export type PayMethodLabel = '現金' | '轉帳' | '儲值金' | '空檔費';

export interface PayMethodBookingEntry {
  id: string;
  name: string;
  phone: string;
  items: string;
  total: number;
  date: string;
  time: string;
  paidAt: string | null;
}

export type PayMethodBreakdown = Record<
  PayMethodLabel,
  { count: number; total: number; bookings: PayMethodBookingEntry[] }
>;

export interface YearMonthEntry {
  month: string; // YYYY-MM
  revenue: number;
  bookings: number;
}

export interface YearSummary {
  year: number;
  revenue: number;
  bookings: number;
  byMonth: YearMonthEntry[];
  availableYears: number[];
}

export interface MonthSummary {
  month: string; // YYYY-MM
  revenue: number;
  cost: number;
  net: number;
  bookings: number;
  byPayMethod: PayMethodBreakdown;
}

export interface FinanceSummary {
  today: { revenue: number; cost: number; net: number; bookings: number; byPayMethod: PayMethodBreakdown };
  month: { revenue: number; cost: number; net: number; bookings: number; byPayMethod: PayMethodBreakdown };
  year: { year: number; revenue: number; bookings: number; byMonth: YearMonthEntry[] };
  nextMonthEstimate: { bookings: number; revenue: number };
}

function emptyBreakdown(): PayMethodBreakdown {
  return {
    '現金': { count: 0, total: 0, bookings: [] },
    '轉帳': { count: 0, total: 0, bookings: [] },
    '儲值金': { count: 0, total: 0, bookings: [] },
    '空檔費': { count: 0, total: 0, bookings: [] },
  };
}

interface PaidBookingRow {
  id: string;
  name: string;
  phone: string;
  items: string;
  total: number;
  date: string;
  time: string;
  paidAt: Date | null;
  payMethod: string | null;
  walletUsed: number | null;
}

function resolvePayMethod(pm: string | null): PayMethodLabel {
  if (pm === '現金' || pm === '轉帳' || pm === '儲值金' || pm === '空檔費') return pm;
  return '空檔費'; // 舊資料 fallback
}

function buildBreakdown(rows: PaidBookingRow[]): PayMethodBreakdown {
  const b = emptyBreakdown();
  for (const r of rows) {
    const wallet = r.walletUsed ?? 0;
    const cashPortion = r.total - wallet;
    const entry: PayMethodBookingEntry = {
      id: r.id,
      name: r.name,
      phone: r.phone,
      items: r.items,
      total: r.total,
      date: r.date,
      time: r.time,
      paidAt: r.paidAt ? r.paidAt.toISOString() : null,
    };

    if (wallet > 0) {
      // 儲值金部分
      b['儲值金'].count += 1;
      b['儲值金'].total += wallet;
      b['儲值金'].bookings.push({ ...entry, total: wallet });
    }

    if (cashPortion > 0) {
      // 現金/轉帳/空檔費部分
      const key = resolvePayMethod(r.payMethod);
      b[key].count += 1;
      b[key].total += cashPortion;
      b[key].bookings.push({ ...entry, total: cashPortion });
    } else if (wallet === 0) {
      // 全額由 payMethod 支付（無儲值金）
      const key = resolvePayMethod(r.payMethod);
      b[key].count += 1;
      b[key].total += r.total;
      b[key].bookings.push(entry);
    }
  }
  return b;
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
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const nextYearStart = new Date(now.getFullYear() + 1, 0, 1);

  const todayStr = ymd(now);
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const nextMonthPrefix = `${nextMonthStart.getFullYear()}-${String(
    nextMonthStart.getMonth() + 1
  ).padStart(2, '0')}`;

  const [todayPaidRows, monthPaidRows, yearPaidRows, todayCosts, monthCosts, nextMonthBookings] = await Promise.all([
    prisma.booking.findMany({
      where: { paidAt: { gte: todayStart, lt: tomorrowStart } },
      select: {
        id: true,
        name: true,
        phone: true,
        items: true,
        total: true,
        date: true,
        time: true,
        paidAt: true,
        payMethod: true,
        walletUsed: true,
      },
      orderBy: { paidAt: 'asc' },
    }),
    prisma.booking.findMany({
      where: { paidAt: { gte: monthStart, lt: nextMonthStart } },
      select: {
        id: true,
        name: true,
        phone: true,
        items: true,
        total: true,
        date: true,
        time: true,
        paidAt: true,
        payMethod: true,
        walletUsed: true,
      },
      orderBy: { paidAt: 'asc' },
    }),
    prisma.booking.findMany({
      where: { paidAt: { gte: yearStart, lt: nextYearStart } },
      select: {
        total: true,
        paidAt: true,
      },
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

  const todayRevenue = todayPaidRows.reduce((s, b) => s + b.total, 0);
  const monthRevenue = monthPaidRows.reduce((s, b) => s + b.total, 0);
  const todayCost = todayCosts._sum.amount ?? 0;
  const monthCost = monthCosts._sum.amount ?? 0;
  const nextMonthRevenue = nextMonthBookings.reduce((s, b) => s + b.total, 0);

  // 年營收按月份分類（以 paidAt 判斷）
  const currentYear = now.getFullYear();
  const byMonthMap = new Map<string, { revenue: number; bookings: number }>();
  for (let m = 0; m < 12; m++) {
    const key = `${currentYear}-${String(m + 1).padStart(2, '0')}`;
    byMonthMap.set(key, { revenue: 0, bookings: 0 });
  }
  for (const row of yearPaidRows) {
    if (!row.paidAt) continue;
    const key = `${row.paidAt.getFullYear()}-${String(row.paidAt.getMonth() + 1).padStart(2, '0')}`;
    const entry = byMonthMap.get(key);
    if (entry) {
      entry.revenue += row.total;
      entry.bookings += 1;
    }
  }
  const byMonth: YearMonthEntry[] = Array.from(byMonthMap.entries()).map(([month, v]) => ({
    month,
    revenue: v.revenue,
    bookings: v.bookings,
  }));
  const yearRevenue = yearPaidRows.reduce((s, b) => s + b.total, 0);

  return {
    today: {
      revenue: todayRevenue,
      cost: todayCost,
      net: todayRevenue - todayCost,
      bookings: todayPaidRows.length,
      byPayMethod: buildBreakdown(todayPaidRows),
    },
    month: {
      revenue: monthRevenue,
      cost: monthCost,
      net: monthRevenue - monthCost,
      bookings: monthPaidRows.length,
      byPayMethod: buildBreakdown(monthPaidRows),
    },
    year: {
      year: currentYear,
      revenue: yearRevenue,
      bookings: yearPaidRows.length,
      byMonth,
    },
    nextMonthEstimate: {
      bookings: nextMonthBookings.length,
      revenue: nextMonthRevenue,
    },
  };
}

/**
 * 回傳資料庫中有收入紀錄的年份清單（依 paidAt 判斷），以及當前年份做保底。
 * 用於 UI 顯示可切換的年份。
 */
export async function getAvailableYears(prisma: PrismaClient): Promise<number[]> {
  const rows = await prisma.booking.findMany({
    where: { paidAt: { not: null } },
    select: { paidAt: true },
  });
  const set = new Set<number>();
  for (const r of rows) {
    if (r.paidAt) set.add(r.paidAt.getFullYear());
  }
  set.add(new Date().getFullYear());
  return Array.from(set).sort((a, b) => b - a);
}

/**
 * 指定年度的營收摘要（依 paidAt 歸類），含 12 個月份的明細。
 */
export async function getYearSummary(
  prisma: PrismaClient,
  year: number
): Promise<YearSummary> {
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);
  const rows = await prisma.booking.findMany({
    where: { paidAt: { gte: start, lt: end } },
    select: { total: true, paidAt: true },
  });
  const byMonthMap = new Map<string, { revenue: number; bookings: number }>();
  for (let m = 0; m < 12; m++) {
    byMonthMap.set(`${year}-${String(m + 1).padStart(2, '0')}`, { revenue: 0, bookings: 0 });
  }
  for (const r of rows) {
    if (!r.paidAt) continue;
    const key = `${r.paidAt.getFullYear()}-${String(r.paidAt.getMonth() + 1).padStart(2, '0')}`;
    const entry = byMonthMap.get(key);
    if (entry) {
      entry.revenue += r.total;
      entry.bookings += 1;
    }
  }
  const byMonth: YearMonthEntry[] = Array.from(byMonthMap.entries()).map(([month, v]) => ({
    month,
    revenue: v.revenue,
    bookings: v.bookings,
  }));
  return {
    year,
    revenue: rows.reduce((s, r) => s + r.total, 0),
    bookings: rows.length,
    byMonth,
    availableYears: await getAvailableYears(prisma),
  };
}

/**
 * 指定月份（YYYY-MM）的完整財務摘要（營收、成本、淨利、付款分類）。
 */
export async function getMonthSummary(
  prisma: PrismaClient,
  month: string
): Promise<MonthSummary> {
  const [yStr, mStr] = month.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);
  const [paidRows, costAgg] = await Promise.all([
    prisma.booking.findMany({
      where: { paidAt: { gte: start, lt: end } },
      select: {
        id: true,
        name: true,
        phone: true,
        items: true,
        total: true,
        date: true,
        time: true,
        paidAt: true,
        payMethod: true,
        walletUsed: true,
      },
      orderBy: { paidAt: 'asc' },
    }),
    prisma.cost.aggregate({
      _sum: { amount: true },
      where: { date: { startsWith: month } },
    }),
  ]);
  const revenue = paidRows.reduce((s, r) => s + r.total, 0);
  const cost = costAgg._sum.amount ?? 0;
  return {
    month,
    revenue,
    cost,
    net: revenue - cost,
    bookings: paidRows.length,
    byPayMethod: buildBreakdown(paidRows),
  };
}
