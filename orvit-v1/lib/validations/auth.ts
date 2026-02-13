import { z } from 'zod';
import { emailSchema } from './helpers';

// ─── Auth Me (lookup by email) ──────────────────────────────────────────────

export const AuthMeSchema = z.object({
  email: emailSchema,
});

// ─── Types ──────────────────────────────────────────────────────────────────

export type AuthMeInput = z.infer<typeof AuthMeSchema>;
