import { z } from 'zod';

export const genderEnum = z.enum(['男', '女']);

export const upsertMemberSchema = z.object({
  phone: z.string().min(6).max(20),
  name: z.string().min(1).max(50),
  bday: z.string().optional().nullable(),
  gender: genderEnum.optional().nullable(),
  note: z.string().optional().nullable(),
  vip: z.boolean().optional(),
  lineUserId: z.string().optional().nullable(),
});

export const walletAdjustSchema = z.object({
  delta: z.number().int(),
  reason: z.string().optional(),
});

export type UpsertMemberInput = z.infer<typeof upsertMemberSchema>;
