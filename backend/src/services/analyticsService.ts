import type { PrismaClient } from '@prisma/client';

export interface AnalyticsSummary {
  monthlyBookings: number;
  popularTimeSlots: Array<{ time: string; count: number }>;
  popularServices: Array<{ name: string; count: number }>;
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
