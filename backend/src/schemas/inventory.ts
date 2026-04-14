import { z } from 'zod';

export const createInventorySchema = z.object({
  name: z.string().min(1),
  qty: z.number().int().nonnegative().default(0),
  unit: z.string().default('個'),
  minQty: z.number().int().nonnegative().default(0),
});

export const updateInventorySchema = z.object({
  name: z.string().optional(),
  qty: z.number().int().nonnegative().optional(),
  unit: z.string().optional(),
  minQty: z.number().int().nonnegative().optional(),
});

export type CreateInventoryInput = z.infer<typeof createInventorySchema>;
