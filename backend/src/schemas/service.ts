import { z } from 'zod';

export const serviceCatEnum = z.enum(['women', 'men', 'products', 'all']);

export const createServiceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  nameEn: z.string().optional().nullable(),
  cat: serviceCatEnum,
  price: z.number().int().nonnegative(),
  oldPrice: z.number().int().nonnegative().optional().nullable(),
  duration: z.number().int().nonnegative().optional().nullable(),
  note: z.string().optional().nullable(),
  isCombo: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const updateServiceSchema = createServiceSchema.partial().omit({ id: true });

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
