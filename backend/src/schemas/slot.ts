import { z } from 'zod';

export const slotConfigSchema = z.object({
  slots: z.array(z.string().regex(/^\d{2}:\d{2}$/)),
});

export const blockedSlotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
});
