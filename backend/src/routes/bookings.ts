import type { FastifyInstance } from 'fastify';
import { adminAuth } from '../middleware/adminAuth.js';
import {
  createBookingSchema,
  updateBookingSchema,
  availableSlotsQuery,
  listBookingsQuery,
} from '../schemas/booking.js';
import { getAvailableSlots, hasConflict } from '../services/bookingService.js';
import { upsertMemberFromBooking } from '../services/memberService.js';
import {
  buildBookingCancelledMessage,
  buildBookingConfirmedMessage,
  buildBookingFlexMessage,
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

    const bookings = await app.prisma.booking.findMany({
      where,
      orderBy: [{ date: 'desc' }, { time: 'desc' }],
    });
    return { bookings };
  });

  // POST /bookings  —— 公開（顧客送出預約）
  app.post('/', async (req, reply) => {
    const input = createBookingSchema.parse(req.body);

    if (await hasConflict(app.prisma, input.date, input.time)) {
      return reply.status(409).send({
        error: 'SlotConflict',
        message: '此時段已被預約，請選擇其他時段',
      });
    }

    const booking = await app.prisma.booking.create({ data: input });

    // 同步會員資料
    await upsertMemberFromBooking(app.prisma, {
      phone: input.phone,
      name: input.name,
      bday: input.bday,
      lineUserId: input.lineUserId,
    });

    // 推播通知店家
    await pushToOa(buildNewBookingMessage(booking));

    // 推播 Flex Message 確認卡片給客戶
    if (booking.lineUserId) {
      await pushToUser(booking.lineUserId, buildBookingFlexMessage(booking));
    }

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
    await pushToOa(`❌ 顧客取消預約：${updated.name} ${updated.date} ${updated.time}`);
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

    // 若變更日期/時段，檢查衝突
    if ((input.date && input.date !== existing.date) || (input.time && input.time !== existing.time)) {
      const conflict = await hasConflict(
        app.prisma,
        input.date ?? existing.date,
        input.time ?? existing.time,
        id
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

    // 狀態變更時推播顧客
    if (input.status && input.status !== existing.status && booking.lineUserId) {
      if (input.status === '已確認') {
        await pushToUser(booking.lineUserId, buildBookingConfirmedMessage(booking));
      } else if (input.status === '已取消') {
        await pushToUser(booking.lineUserId, buildBookingCancelledMessage(booking));
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
