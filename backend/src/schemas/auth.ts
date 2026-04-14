import { z } from 'zod';

export const credentialLoginSchema = z.object({
  account: z.string().min(1),
  password: z.string().min(1),
});

export const lineLoginSchema = z.object({
  lineUserId: z.string().min(1),
  displayName: z.string().optional().nullable(),
  pictureUrl: z.string().optional().nullable(),
});

export const registerSchema = z.object({
  lineUserId: z.string().min(1),
  displayName: z.string().optional().nullable(),
  pictureUrl: z.string().optional().nullable(),
  name: z.string().min(1).max(50),
  phone: z.string().min(8).max(20),
  gender: z.enum(['男', '女']),
  bday: z.string().optional().nullable(),
});
