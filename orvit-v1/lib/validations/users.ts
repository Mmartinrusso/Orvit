import { z } from 'zod';
import { boundedString, emailSchema, optionalTrimmedString, passwordSchema, optionalPasswordSchema } from './helpers';

// ─── Create ─────────────────────────────────────────────────────────────────

export const CreateUserSchema = z.object({
  name: boundedString('Nombre', 200),
  email: emailSchema,
  password: passwordSchema('Contraseña'),
  role: z.string().trim().max(50, 'Rol muy largo').optional(),
  isActive: z.boolean().default(true),
  companyId: z.coerce.number().int().positive().nullable().optional(),
});

// ─── Update ─────────────────────────────────────────────────────────────────

export const UpdateUserSchema = z.object({
  name: boundedString('Nombre', 200).optional(),
  email: emailSchema.optional(),
  role: z.string().trim().max(50, 'Rol muy largo').optional(),
  isActive: z.boolean().optional(),
  avatar: z.string().url('URL de avatar inválida').nullable().optional().or(z.literal('')),
  phone: z.string().trim().max(30, 'Teléfono muy largo').optional(),
  newPassword: optionalPasswordSchema('Nueva contraseña'),
});

// ─── Types ──────────────────────────────────────────────────────────────────

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
