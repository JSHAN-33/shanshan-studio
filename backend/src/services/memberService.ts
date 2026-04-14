import type { PrismaClient } from '@prisma/client';

/**
 * 依手機號 upsert 會員資料；用於顧客送出預約時同步建立會員。
 */
export async function upsertMemberFromBooking(
  prisma: PrismaClient,
  data: {
    phone: string;
    name: string;
    bday?: string | null;
    lineUserId?: string | null;
  }
) {
  return prisma.member.upsert({
    where: { phone: data.phone },
    update: {
      name: data.name,
      bday: data.bday ?? undefined,
      lineUserId: data.lineUserId ?? undefined,
    },
    create: {
      phone: data.phone,
      name: data.name,
      bday: data.bday ?? null,
      lineUserId: data.lineUserId ?? null,
    },
  });
}
