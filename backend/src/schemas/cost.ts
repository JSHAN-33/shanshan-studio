import { z } from 'zod';

export const costCatEnum = z.enum(['耗材', '店租', '水電', '行銷', '薪資', '其他']);

export const createCostSchema = z.object({
  cat: costCatEnum,
  desc: z.string().optional().nullable(),
  amount: z.number().int(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const listCostsQuery = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  cat: costCatEnum.optional(),
});

export type CreateCostInput = z.infer<typeof createCostSchema>;
