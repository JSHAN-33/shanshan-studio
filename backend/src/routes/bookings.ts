import type { FastifyInstance } from 'fastify';
import { adminAuth } from '../middleware/adminAuth.js';
import {
  createBookingSchema,
  updateBookingSchema,
  availableSlotsQuery,
  bulkAvailableSlotsQuery,
  listBookingsQuery,
} from '../schemas/booking.js';
import { getAvailableSlots, hasConflict } from '../services/bookingService.js';
import { upsertMemberFromBooking } from '../services/memberService.js';
import {
  buildBindPromptMessage,
  buildBookingCancelledMessage,
  buildBookingConfirmedMessage,
  buildDepositInfoMessage,
  buildNewBookingMessage,
  pushToOa,
  pushToUser,
} from '../services/lineNotifyService.js';

export async function bookingsRoutes(app: FastifyInstance) {
  // GET /bookings/available-slots?date=YYYY-MM-DD&duration=60  —— 公開
  app.get('/available-slots', async (req) => {
    const { date, duration } = availableSlotsQuery.parse(req.query);
    const slots = await getAvailableSlots(app.prisma, date, duration);
    return { date, slots };
  });

  // GET /bookings/available-slots/bulk?startDate=...&endDate=...&duration=60  —— 公開
  // 回傳 { [date]: ['11:00', '13:30', ...] }（只含 available 的時段，不含預約隱私資訊）
  app.get('/available-slots/bulk', async (req) => {
    const { startDate, endDate, duration } = bulkAvailableSlotsQuery.parse(req.query);
    const result: Record<string, string[]> = {};

    // 以 UTC 基準遍歷，避免本地時區偏移造成日期錯位
    const start = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);
    for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 86400000)) {
      const dateStr = d.toISOString().slice(0, 10);
      const slots = await getAvailableSlots(app.prisma, dateStr, duration);
      result[dateStr] = slots.filter((s) => s.available).map((s) => s.time);
    }

    return { slotsByDate: result };
  });

  // GET /bookings?phone=xxx  顧客查自己的；或 admin 全查
  app.get('/', async (req, reply) => {
    const query = listBookingsQuery.parse(req.query);

    // 無 phone 時必須是 admin
    if (!query.phone) {
      const token = req.headers['x-admin-token'];
      if (!token || token !== process.env.ADMIN_TOKEN) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }
    }

    const where: Record<string, unknown> = {};
    if (query.phone) where.phone = query.phone;
    if (query.date) where.date = query.date;
    if (query.month) where.date = { startsWith: query.month };
    if (query.status) where.status = query.status;
    if (query.paid === 'true') where.paidAt = { not: null };
    if (query.paid === 'false') where.paidAt = null;
    if (query.paidMonth) {
      const [y, m] = query.paidMonth.split('-').map(Number);
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 1);
      where.paidAt = { gte: start, lt: end };
    }

    const bookings = await app.prisma.booking.findMany({
      where,
      orderBy: [{ date: 'desc' }, { time: 'desc' }],
    });
    return { bookings };
  });

  // POST /bookings  —— 公開（顧客送出預約）
  app.post('/', async (req, reply) => {
    const body = req.body as Record<string, unknown>;
    const inLiff = body.inLiff === true;
    const input = createBookingSchema.parse(body);

    if (await hasConflict(app.prisma, input.date, input.time, undefined, input.duration ?? undefined)) {
      return reply.status(409).send({
        error: 'SlotConflict',
        message: '此時段已被預約，請選擇其他時段',
      });
    }

    // 預約金邏輯：新客需付預約金
    const depositEnabled = await app.prisma.systemSetting.findUnique({ where: { key: 'depositEnabled' } });
    let depositData: { depositAmount?: number; depositStatus?: string } = {};
    let needsDeposit = false;

    if (depositEnabled?.value === 'true') {
      // 檢查是否為新客（沒有任何非取消的預約紀錄）
      const pastBookings = await app.prisma.booking.count({
        where: { phone: input.phone, status: { not: '已取消' } },
      });
      if (pastBookings === 0) {
        const amountSetting = await app.prisma.systemSetting.findUnique({ where: { key: 'depositAmount' } });
        depositData = {
          depositAmount: Number(amountSetting?.value ?? '500'),
          depositStatus: '待付訂金',
        };
        needsDeposit = true;
      }
    }

    const booking = await app.prisma.booking.create({
      data: {
        ...input,
        ...(needsDeposit ? { ...depositData, status: '待付訂金' } : {}),
      },
    });

    // 同步會員資料
    await upsertMemberFromBooking(app.prisma, {
      phone: input.phone,
      name: input.name,
      bday: input.bday,
      lineUserId: input.lineUserId,
    });

    // 在 LIFF 內由前端 liff.sendMessages() 以客人身份發送（右邊）；
    // 非 LIFF 環境才由後端 pushToOa 作為備案（左邊，bot 發的）
    if (!inLiff) {
      pushToOa(buildNewBookingMessage({
        name: input.name,
        phone: input.phone,
        date: input.date,
        time: input.time,
        items: input.items,
        total: input.total,
      })).catch((err) => console.error('[LINE] pushToOa failed', err));
    }

    // 若客人尚未綁定 OA，推播綁定提醒
    const mem = await app.prisma.member.findUnique({ where: { phone: input.phone } });
    const needsBind = !!(mem && !mem.lineOaUserId);
    if (needsBind && mem!.lineUserId) {
      pushToUser(mem!.lineUserId, buildBindPromptMessage(input.name, input.phone))
        .catch((err) => console.error('[LINE] bind prompt push failed', err));
    }

    // 新客需付預約金 → 推播轉帳資訊給客人
    if (needsDeposit) {
      const pushUid = mem?.lineOaUserId ?? mem?.lineUserId;
      if (pushUid) {
        const bankSetting = await app.prisma.systemSetting.findUnique({ where: { key: 'depositBankInfo' } });
        if (bankSetting?.value) {
          pushToUser(pushUid, buildDepositInfoMessage({
            name: input.name,
            date: input.date,
            time: input.time,
            items: input.items,
            total: input.total,
            depositAmount: depositData.depositAmount ?? 500,
            bankInfo: bankSetting.value,
          })).catch((err) => console.error('[LINE] deposit info push failed', err));
        }
      }
    }

    return reply.status(201).send({ booking, needsBind });
  });

  // POST /bookings/admin  —— admin only；手動補建預約（例如補登過往消費，進入「未結帳」列表）
  // 不做時段衝突檢查、不推播 LINE
  app.post('/admin', { preHandler: adminAuth }, async (req, reply) => {
    const input = createBookingSchema.parse(req.body);
    const booking = await app.prisma.booking.create({
      data: { ...input, status: '已確認' },
    });
    // 同步會員資料（若已存在則更新）
    await upsertMemberFromBooking(app.prisma, {
      phone: input.phone,
      name: input.name,
      bday: input.bday,
      lineUserId: input.lineUserId,
    });
    return reply.status(201).send({ booking });
  });

  // POST /bookings/:id/cancel  —— 顧客自行取消（需 phone 對得上）
  app.post<{ Params: { id: string } }>('/:id/cancel', async (req, reply) => {
    const { id } = req.params;
    const { phone } = (req.body ?? {}) as { phone?: string };
    if (!phone) {
      return reply.status(400).send({ error: 'PhoneRequired' });
    }
    const booking = await app.prisma.booking.findUnique({ where: { id } });
    if (!booking) return reply.status(404).send({ error: 'NotFound' });
    if (booking.phone !== phone) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
    if (booking.status !== '待確認') {
      return reply.status(400).send({
        error: 'CannotCancel',
        message: '只有「待確認」狀態的預約可自行取消',
      });
    }
    const updated = await app.prisma.booking.update({
      where: { id },
      data: { status: '已取消' },
    });
    // 不推播店家（使用者只要 5 種卡片通知）
    return { booking: updated };
  });

  // PATCH /bookings/:id  —— admin only
  app.patch<{ Params: { id: string } }>('/:id', { preHandler: adminAuth }, async (req, reply) => {
    const { id } = req.params;
    const input = updateBookingSchema.parse(req.body);

    const existing = await app.prisma.booking.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ error: 'NotFound' });
    }

    // 若變更日期/時段，檢查衝突（考慮 duration）
    if ((input.date && input.date !== existing.date) || (input.time && input.time !== existing.time)) {
      const dur = input.duration ?? existing.duration ?? undefined;
      const conflict = await hasConflict(
        app.prisma,
        input.date ?? existing.date,
        input.time ?? existing.time,
        id,
        dur ?? undefined
      );
      if (conflict) {
        return reply.status(409).send({ error: 'SlotConflict' });
      }
    }

    const data: Record<string, unknown> = { ...input };
    if (input.paidAt !== undefined) {
      data.paidAt = input.paidAt ? new Date(input.paidAt) : null;
    }

    const booking = await app.prisma.booking.update({ where: { id }, data });

    // 狀態變更時推播顧客（用 member.lineOaUserId，由 webhook 頭像配對綁定）
    if (input.status && input.status !== existing.status) {
      console.log(`[LINE] Status changed: ${existing.status} → ${input.status}, phone: ${booking.phone}`);
      const mem = await app.prisma.member.findUnique({ where: { phone: booking.phone } });
      const pushUserId = mem?.lineOaUserId ?? mem?.lineUserId;
      console.log(`[LINE] Member found: ${mem?.name}, lineOaUserId: ${mem?.lineOaUserId}, lineUserId: ${mem?.lineUserId}, using: ${pushUserId}`);
      if (pushUserId) {
        if (input.status === '已確認') {
          console.log('[LINE] Sending confirmed message...');
          await pushToUser(pushUserId, buildBookingConfirmedMessage(booking));
        } else if (input.status === '已取消') {
          console.log('[LINE] Sending cancelled message...');
          await pushToUser(pushUserId, buildBookingCancelledMessage(booking));
        }
      }
    }

    return { booking };
  });

  // DELETE /bookings/:id  —— admin only
  app.delete<{ Params: { id: string } }>('/:id', { preHandler: adminAuth }, async (req, reply) => {
    const { id } = req.params;
    const existing = await app.prisma.booking.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ error: 'NotFound' });
    }
    await app.prisma.booking.delete({ where: { id } });
    return reply.status(204).send();
  });
}
