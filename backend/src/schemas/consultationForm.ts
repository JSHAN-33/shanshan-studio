import { z } from 'zod';

export const consultationFormSchema = z.object({
  phone: z.string().min(6).max(20),
  name: z.string().min(1).max(50),
  gender: z.string().optional().nullable(),
  birthday: z.string().optional().nullable(),
  mobile: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  hairRemoval: z.array(z.string()).default([]),
  isFirstWax: z.boolean().default(false),
  isSensitive: z.boolean().default(false),
  isAlcoholSensitive: z.boolean().default(false),
  isPeriod: z.boolean().default(false),
  isPregnant: z.boolean().default(false),
  isSick: z.boolean().default(false),
  hasAcne: z.boolean().default(false),
  consentAgreed: z.boolean().default(false),
  signatureData: z.string().optional().nullable(),
});

export type ConsultationFormInput = z.infer<typeof consultationFormSchema>;
