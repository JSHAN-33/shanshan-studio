import { z } from 'zod';

export const bookingStatusEnum = z.enum(['待確認', '已確認', '已完成', '已取消']);
export const payMethodEnum = z.enum(['現金', '轉帳', '儲值金']);

export const createBookingSchema = z.object({
  name: z.string().min(1).max(50),
  phone: z.string().min(6).max(20),
  bday: z.string().optional().nullable(),
  lineUserId: z.string().optional().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  items: z.string().min(1),
  total: z.number().int().nonnegative(),
  remarks: z.string().optional().nullable(),
});

export const updateBookingSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  items: z.string().optional(),
  total: z.number().int().nonnegative().optional(),
  status: bookingStatusEnum.optional(),
  remarks: z.string().optional().nullable(),
  payMethod: payMethodEnum.optional().nullable(),
  paidAt: z.union([z.string().datetime(), z.null()]).optional(),
});

export const availableSlotsQuery = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  duration: z.coerce.number().int().min(0).optional(),
});

export const listBookingsQuery = z.object({
  phone: z.string().optional(),
  date: z.string().optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  status: bookingStatusEnum.optional(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type UpdateBookingInput = z.infer<typeof updateBookingSchema>;
