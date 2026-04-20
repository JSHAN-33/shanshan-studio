import { z } from 'zod';

export const createServiceHistorySchema = z.object({
  phone: z.string().min(6).max(20),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  items: z.string().min(1),
  total: z.number().int().nonnegative(),
  remarks: z.string().optional().nullable(),
});

export const updateServiceHistorySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  items: z.string().min(1).optional(),
  total: z.number().int().nonnegative().optional(),
  remarks: z.string().optional().nullable(),
});

export const listServiceHistoryQuery = z.object({
  phone: z.string().min(6).max(20),
});

export type CreateServiceHistoryInput = z.infer<typeof createServiceHistorySchema>;
export type UpdateServiceHistoryInput = z.infer<typeof updateServiceHistorySchema>;
