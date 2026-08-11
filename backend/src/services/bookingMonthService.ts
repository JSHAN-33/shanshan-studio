import type { PrismaClient } from '@prisma/client';

/**
 * 取得台北時區的當前年月日。
 */
function getTaipeiDate(): { year: number; month: number; day: number; yearMonth: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  const year = Number(get('year'));
  const month = Number(get('month'));
  const day = Number(get('day'));
  return { year, month, day, yearMonth: `${year}-${get('month')}` };
}

/**
 * 判斷某月份是否依照自動規則開放：
 * - 當月 → 開放
 * - 下個月 & 今天 >= 15 號 → 開放
 * - 其他 → 未開放
 */
function isMonthAutoOpen(yearMonth: string): boolean {
  const { year, month, day, yearMonth: currentYM } = getTaipeiDate();

  if (yearMonth <= currentYM) return true;

  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextYM = `${nextYear}-${String(nextMonth).padStart(2, '0')}`;

  if (yearMonth === nextYM && day >= 15) return true;

  return false;
}

/**
 * 檢查某月份對客戶是否開放預約。
 * 1. 先查 BookingMonth 資料表 → 有記錄就以記錄為準
 * 2. 沒有記錄 → 用自動規則判斷
 */
export async function isMonthOpen(prisma: PrismaClient, yearMonth: string): Promise<boolean> {
  const record = await prisma.bookingMonth.findUnique({ where: { yearMonth } });
  if (record) return record.isOpen;
  return isMonthAutoOpen(yearMonth);
}

export interface BookingMonthStatus {
  yearMonth: string;
  isOpen: boolean;
  source: 'manual' | 'auto';
  autoOpenDate?: string; // 自動開放日期（若為 auto 且尚未開放）
}

/**
 * 取得未來數月的開放狀態（含當月）。
 */
export async function getBookingMonthStatuses(
  prisma: PrismaClient,
  count = 4,
): Promise<BookingMonthStatus[]> {
  const { year, month, day } = getTaipeiDate();
  const result: BookingMonthStatus[] = [];

  for (let i = 0; i < count; i++) {
    let m = month + i;
    let y = year;
    while (m > 12) { m -= 12; y += 1; }
    const ym = `${y}-${String(m).padStart(2, '0')}`;

    const record = await prisma.bookingMonth.findUnique({ where: { yearMonth: ym } });
    if (record) {
      result.push({ yearMonth: ym, isOpen: record.isOpen, source: 'manual' });
    } else {
      const autoOpen = isMonthAutoOpen(ym);
      const status: BookingMonthStatus = { yearMonth: ym, isOpen: autoOpen, source: 'auto' };
      // 如果是下個月且尚未自動開放，告知將於何時開放
      if (!autoOpen && i === 1) {
        status.autoOpenDate = `${year}-${String(month).padStart(2, '0')}-15`;
      }
      result.push(status);
    }
  }

  return result;
}
